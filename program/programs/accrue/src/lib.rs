pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
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

    pub fn init_extra_account_meta_list(ctx: Context<InitExtraAccountMetaList>) -> Result<()> {
        instructions::init_extra_account_meta_list::handle_init_extra_account_meta_list(ctx)
    }

    pub fn invest(ctx: Context<Invest>, usdc_amount: u64) -> Result<()> {
        instructions::invest::handle_invest(ctx, usdc_amount)
    }
}
