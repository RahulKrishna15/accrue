pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;
use spl_discriminator::SplDiscriminate;
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

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

    pub fn deposit_revenue(ctx: Context<DepositRevenue>, amount: u64) -> Result<()> {
        instructions::deposit_revenue::handle_deposit_revenue(ctx, amount)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handle_claim(ctx)
    }

    pub fn set_price(ctx: Context<ManageFund>, price: u64) -> Result<()> {
        instructions::manage_fund::handle_set_price(ctx, price)
    }

    pub fn set_paused(ctx: Context<ManageFund>, paused: bool) -> Result<()> {
        instructions::manage_fund::handle_set_paused(ctx, paused)
    }

    pub fn close_fund(ctx: Context<ManageFund>) -> Result<()> {
        instructions::manage_fund::handle_close_fund(ctx)
    }

    pub fn register_holder(ctx: Context<RegisterHolder>) -> Result<()> {
        instructions::register_holder::handle_register_holder(ctx)
    }

    /// Transfer Hook entry point, called by Token-2022 with the SPL discriminator.
    #[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        instructions::execute::handle_execute(ctx, amount)
    }
}
