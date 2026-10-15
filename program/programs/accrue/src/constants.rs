use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const HOLDER_SEED: &[u8] = b"holder";

/// Fixed by the Transfer Hook interface; Token-2022 derives this PDA itself.
#[constant]
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// Test USDC and shares both use 6 decimals.
#[constant]
pub const SHARE_DECIMALS: u8 = 6;

pub const SHARE_UNIT: u64 = 1_000_000;

/// Fixed-point scale of acc_per_token (income per base unit of share x 1e12).
#[constant]
pub const ACC_PRECISION: u128 = 1_000_000_000_000u128;

pub const BPS_DENOMINATOR: u64 = 10_000;

/// Management fee cap: 10%.
#[constant]
pub const MAX_FEE_BPS: u16 = 1_000;

/// Shortest stream period: 1 hour.
#[constant]
pub const MIN_STREAM_PERIOD: i64 = 3_600;
