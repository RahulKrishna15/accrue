use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    constants::*,
    error::AccrueError,
    events::{FundClosed, PausedSet, PriceChanged},
    math::accrue,
    state::Config,
};

/// Shared by set_price, set_paused and close_fund.
#[derive(Accounts)]
pub struct ManageFund<'info> {
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        has_one = manager @ AccrueError::Unauthorized,
        has_one = mint,
    )]
    pub config: Box<Account<'info, Config>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
}

/// Applies to new investments only; income is per share, not per USDC.
pub fn handle_set_price(ctx: Context<ManageFund>, price: u64) -> Result<()> {
    require!(price > 0, AccrueError::InvalidPrice);
    let config = &mut ctx.accounts.config;
    let old_price = config.price;
    config.price = price;

    emit!(PriceChanged {
        mint: config.mint,
        timestamp: Clock::get()?.unix_timestamp,
        old_price,
        new_price: price,
    });
    Ok(())
}

/// Pause blocks invest, deposit and transfers. Income keeps streaming and
/// claims always work.
pub fn handle_set_paused(ctx: Context<ManageFund>, paused: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let config = &mut ctx.accounts.config;
    accrue(config, now)?;
    config.paused = paused;

    emit!(PausedSet {
        mint: config.mint,
        timestamp: now,
        paused,
    });
    Ok(())
}

/// One-way: stops new investment. Deposits, claims and transfers continue.
pub fn handle_close_fund(ctx: Context<ManageFund>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(!config.closed, AccrueError::FundClosed);
    config.closed = true;

    emit!(FundClosed {
        mint: config.mint,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
