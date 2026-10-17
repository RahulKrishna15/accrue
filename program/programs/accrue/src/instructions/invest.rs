use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    mint_to, transfer_checked, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::AccrueError,
    math::{accrue, settle, shares_for_usdc},
    state::{Config, Holder},
};

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        has_one = mint,
        has_one = usdc_mint,
        has_one = treasury,
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = investor,
        space = 8 + Holder::INIT_SPACE,
        seeds = [HOLDER_SEED, mint.key().as_ref(), investor.key().as_ref()],
        bump,
    )]
    pub holder: Box<Account<'info, Holder>>,

    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program,
    )]
    pub investor_share_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = investor,
        token::token_program = usdc_token_program,
    )]
    pub investor_usdc: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: checked against config.treasury by has_one. Unchecked so a manager
    /// can invest from the treasury itself (same writable account twice).
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_invest(ctx: Context<Invest>, usdc_amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let config = &mut ctx.accounts.config;

    require!(!config.paused, AccrueError::FundPaused);
    require!(!config.closed, AccrueError::FundClosed);
    require!(usdc_amount > 0, AccrueError::InvalidAmount);
    require!(
        usdc_amount >= config.min_investment,
        AccrueError::BelowMinimum
    );
    let total_raised = config
        .total_raised
        .checked_add(usdc_amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    require!(total_raised <= config.size_cap, AccrueError::CapExceeded);
    require!(
        ctx.accounts.investor_usdc.amount >= usdc_amount,
        AccrueError::InsufficientFunds
    );
    let shares = shares_for_usdc(usdc_amount, config.price)?;
    require!(shares > 0, AccrueError::InvalidAmount);

    // 1. Release streamed income with the supply as it was before this mint.
    accrue(config, now)?;
    let acc = config.acc_per_token;

    // 2. New holder starts at the current acc; an existing one settles first.
    // mint_to does not call the transfer hook, so this is the only settle.
    let holder = &mut ctx.accounts.holder;
    if holder.owner == Pubkey::default() {
        holder.mint = ctx.accounts.mint.key();
        holder.owner = ctx.accounts.investor.key();
        holder.last_acc = acc;
        holder.bump = ctx.bumps.holder;
    } else {
        settle(holder, ctx.accounts.investor_share_account.amount, acc)?;
    }

    // 3. Principal goes straight to the manager's treasury.
    transfer_checked(
        CpiContext::new(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.investor_usdc.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        ),
        usdc_amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    // 4. Mint shares, signed by the Config PDA (the mint authority).
    let mint_key = ctx.accounts.mint.key();
    let bump = [ctx.accounts.config.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &bump]];
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.investor_share_account.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ),
        shares,
    )?;

    // 5. Supply grows only after acc was updated.
    let config = &mut ctx.accounts.config;
    config.total_supply = config
        .total_supply
        .checked_add(shares)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    config.total_raised = total_raised;

    let holder = &mut ctx.accounts.holder;
    holder.total_invested = holder
        .total_invested
        .checked_add(usdc_amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    Ok(())
}
