use anchor_lang::prelude::*;

/// Codes start at 6000 in this order. Keep in sync with app/lib/accrue/errors.ts.
#[error_code]
pub enum AccrueError {
    #[msg("This fund is paused")]
    FundPaused, // 6000
    #[msg("This fund is closed to new investment")]
    FundClosed,
    #[msg("Amount is below the fund's minimum investment")]
    BelowMinimum,
    #[msg("Investment would exceed the fund's size cap")]
    CapExceeded,
    #[msg("Management fee cannot exceed 10%")]
    FeeTooHigh,
    #[msg("Only the fund manager can do this")]
    Unauthorized, // 6005
    #[msg("No income to claim")]
    NothingToClaim,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Recipient has no Holder account")]
    HolderNotRegistered,
    #[msg("Holder account already exists")]
    HolderAlreadyRegistered, // 6010
    #[msg("Hook called outside a Token-2022 transfer")]
    NotTransferring,
    #[msg("No shares exist yet")]
    NoHolders,
    #[msg("Stream period must be at least one hour")]
    InvalidPeriod,
    #[msg("Insufficient funds")]
    InsufficientFunds, // 6014
}
