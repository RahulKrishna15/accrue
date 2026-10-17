use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    constants::*,
    error::AccrueError,
    math::accrue,
    state::{Config, Holder},
};

/// Creates the Holder for a wallet about to receive shares by transfer.
/// The hook can't create accounts, so the client puts this in the same
/// transaction as the transfer.
#[derive(Accounts)]
pub struct RegisterHolder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: any wallet can be registered; it only seeds the Holder PDA.
    pub owner: UncheckedAccount<'info>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Holder::INIT_SPACE,
        seeds = [HOLDER_SEED, mint.key().as_ref(), owner.key().as_ref()],
        bump,
    )]
    pub holder: Box<Account<'info, Holder>>,

    pub system_program: Program<'info, System>,
}

pub fn handle_register_holder(ctx: Context<RegisterHolder>) -> Result<()> {
    let holder = &mut ctx.accounts.holder;
    require!(
        holder.owner == Pubkey::default(),
        AccrueError::HolderAlreadyRegistered
    );

    let config = &mut ctx.accounts.config;
    accrue(config, Clock::get()?.unix_timestamp)?;

    holder.mint = ctx.accounts.mint.key();
    holder.owner = ctx.accounts.owner.key();
    // Balance is 0 here, so nothing is earned either way; start at the current acc anyway.
    holder.last_acc = config.acc_per_token;
    holder.bump = ctx.bumps.holder;
    Ok(())
}
