pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FcMSQ71YR9UPF1N27AicJSjuRVA8xcikS1V3Eza43mmh");

#[program]
pub mod accrue {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_fund(
        ctx: Context<InitializeFund>,
        name: String,
        symbol: String,
        uri: String,
        price: u64,
        fee_bps: u16,
        min_investment: u64,
        size_cap: u64,
        stream_period: i64,
    ) -> Result<()> {
        instructions::initialize_fund::handle_initialize_fund(
            ctx,
            name,
            symbol,
            uri,
            price,
            fee_bps,
            min_investment,
            size_cap,
            stream_period,
        )
    }
}
