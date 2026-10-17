use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*, error::AccrueError, events::RevenueDeposited, math::accrue, state::Config,
};

#[derive(Accounts)]
pub struct DepositRevenue<'info> {
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        has_one = manager @ AccrueError::Unauthorized,
        has_one = mint,
        has_one = usdc_mint,
        has_one = vault,
        has_one = treasury,
    )]
    pub config: Box<Account<'info, Config>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = manager,
        token::token_program = usdc_token_program,
    )]
    pub manager_usdc: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: checked against config.treasury by has_one. Unchecked because the
    /// manager may deposit from the treasury itself, and Anchor rejects the same
    /// writable account appearing twice as a typed account.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_deposit_revenue(ctx: Context<DepositRevenue>, amount: u64) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(!config.paused, AccrueError::FundPaused);
    require!(amount > 0, AccrueError::InvalidAmount);
    require!(config.total_supply > 0, AccrueError::NoHolders);
    require!(
        ctx.accounts.manager_usdc.amount >= amount,
        AccrueError::InsufficientFunds
    );

    // Fee rounds down, which favours holders.
    let fee = (amount as u128 * config.fee_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    let net = amount - fee;

    // Pay out the old stream up to now, then roll what's left plus the new
    // income into a fresh window.
    let now = Clock::get()?.unix_timestamp;
    accrue(config, now)?;
    config.stream_remaining = config
        .stream_remaining
        .checked_add(net)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    config.stream_end = now + config.stream_period;
    config.last_update = now;
    config.total_income = config
        .total_income
        .checked_add(net)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    config.total_fees = config
        .total_fees
        .checked_add(fee)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    let decimals = ctx.accounts.usdc_mint.decimals;
    let pay = |to, value: u64| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.usdc_token_program.key(),
                TransferChecked {
                    from: ctx.accounts.manager_usdc.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to,
                    authority: ctx.accounts.manager.to_account_info(),
                },
            ),
            value,
            decimals,
        )
    };
    pay(ctx.accounts.vault.to_account_info(), net)?;
    if fee > 0 {
        pay(ctx.accounts.treasury.to_account_info(), fee)?;
    }

    emit!(RevenueDeposited {
        mint: ctx.accounts.mint.key(),
        timestamp: now,
        gross: amount,
        fee,
        net,
        stream_end: ctx.accounts.config.stream_end,
    });
    Ok(())
}
