use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::AccrueError,
    events::Claimed,
    math::{accrue, settle},
    state::{Config, Holder},
};

/// Pays a holder's income from the vault. Never blocked by pause or close.
#[derive(Accounts)]
pub struct Claim<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        has_one = mint,
        has_one = usdc_mint,
        has_one = vault,
    )]
    pub config: Box<Account<'info, Config>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Seeds include the signer, so only your own Holder can be claimed.
    #[account(
        mut,
        seeds = [HOLDER_SEED, mint.key().as_ref(), owner.key().as_ref()],
        bump = holder.bump,
        has_one = owner @ AccrueError::Unauthorized,
    )]
    pub holder: Box<Account<'info, Holder>>,

    /// Share balance used to settle up to now.
    #[account(
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_share_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = owner,
        token::token_program = usdc_token_program,
    )]
    pub owner_usdc: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let config = &mut ctx.accounts.config;
    accrue(config, now)?;
    let acc = config.acc_per_token;

    // pending only covers income up to the last settle; add the rest first.
    let holder = &mut ctx.accounts.holder;
    settle(holder, ctx.accounts.owner_share_account.amount, acc)?;
    let amount = holder.pending;
    require!(amount > 0, AccrueError::NothingToClaim);

    // last_acc stays at acc (set by settle). Resetting it to 0 would pay the
    // whole history again on the next claim.
    holder.pending = 0;
    holder.total_claimed = holder
        .total_claimed
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    config.total_claimed = config
        .total_claimed
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    let mint_key = ctx.accounts.mint.key();
    let bump = [ctx.accounts.config.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.owner_usdc.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    emit!(Claimed {
        mint: mint_key,
        timestamp: now,
        owner: ctx.accounts.owner.key(),
        amount,
    });
    Ok(())
}
