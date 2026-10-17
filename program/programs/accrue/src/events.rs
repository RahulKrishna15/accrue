//! Program events, written to the transaction logs with `emit!`.
//! The app rebuilds its activity feed from these (no indexer).
//! Mirrors `AccrueEvent` in app/lib/accrue/types.ts.

use anchor_lang::prelude::*;

#[event]
pub struct FundInitialized {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub manager: Pubkey,
    pub price: u64,
    pub fee_bps: u16,
}

#[event]
pub struct HolderRegistered {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub owner: Pubkey,
}

#[event]
pub struct Invested {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub investor: Pubkey,
    pub usdc: u64,
    pub shares: u64,
    pub price: u64,
}

#[event]
pub struct RevenueDeposited {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub gross: u64,
    pub fee: u64,
    pub net: u64,
    pub stream_end: i64,
}

#[event]
pub struct Claimed {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub owner: Pubkey,
    pub amount: u64,
}

/// `from` and `to` are the owner wallets, not the token accounts.
#[event]
pub struct Transferred {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PriceChanged {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub old_price: u64,
    pub new_price: u64,
}

#[event]
pub struct PausedSet {
    pub mint: Pubkey,
    pub timestamp: i64,
    pub paused: bool,
}

#[event]
pub struct FundClosed {
    pub mint: Pubkey,
    pub timestamp: i64,
}
