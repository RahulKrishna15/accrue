use anchor_lang::prelude::*;

/// One per fund. Seeds: ["config", mint].
/// Signs as the share mint authority and the income vault authority.
/// Amounts are base units (6 decimals); timestamps are unix seconds.
#[account]
#[derive(InitSpace, Default)]
pub struct Config {
    pub manager: Pubkey,
    /// Token-2022 share mint.
    pub mint: Pubkey,
    pub usdc_mint: Pubkey,
    /// USDC income vault, owned by this Config PDA. Claims pay from here.
    pub vault: Pubkey,
    /// Manager's USDC account. Receives invested principal and fees.
    pub treasury: Pubkey,

    /// USDC base units per 1 whole share. Applies to new investments only.
    pub price: u64,
    pub fee_bps: u16,
    pub min_investment: u64,
    /// Maximum USDC the fund accepts in total.
    pub size_cap: u64,
    /// Seconds each deposit streams over.
    pub stream_period: i64,

    pub total_supply: u64,
    pub total_raised: u64,

    /// Income per base unit of share, scaled by ACC_PRECISION.
    pub acc_per_token: u128,
    /// Deposited income not yet released into acc_per_token.
    pub stream_remaining: u64,
    pub stream_end: i64,
    pub last_update: i64,

    pub total_income: u64,
    pub total_fees: u64,
    pub total_claimed: u64,

    pub paused: bool,
    pub closed: bool,
    pub created_at: i64,
    pub bump: u8,
}

/// One per (fund, wallet). Seeds: ["holder", mint, owner].
/// The share balance lives in the token account; this only tracks income.
#[account]
#[derive(InitSpace, Default)]
pub struct Holder {
    pub mint: Pubkey,
    pub owner: Pubkey,
    /// acc_per_token at the last settle. Starts at the current acc, never 0.
    pub last_acc: u128,
    /// Settled income not yet claimed.
    pub pending: u64,
    pub total_invested: u64,
    pub total_claimed: u64,
    pub bump: u8,
}
