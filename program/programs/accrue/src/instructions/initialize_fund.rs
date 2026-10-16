use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    token_metadata_initialize, Mint, TokenAccount, TokenInterface, TokenMetadataInitialize,
};

use crate::{constants::*, error::AccrueError, state::Config};

#[derive(Accounts)]
pub struct InitializeFund<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    /// Share mint. Every transfer_checked calls this program's hook.
    #[account(
        init,
        payer = manager,
        mint::decimals = SHARE_DECIMALS,
        mint::authority = config,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = manager,
        extensions::metadata_pointer::metadata_address = mint,
        extensions::transfer_hook::authority = config,
        extensions::transfer_hook::program_id = crate::ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = manager,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(mint::token_program = usdc_token_program)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Income vault: USDC owned by the Config PDA.
    #[account(
        init,
        payer = manager,
        associated_token::mint = usdc_mint,
        associated_token::authority = config,
        associated_token::token_program = usdc_token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Manager's USDC account for principal and fees.
    #[account(
        token::mint = usdc_mint,
        token::authority = manager,
        token::token_program = usdc_token_program,
    )]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_initialize_fund(
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
    require!(price > 0, AccrueError::InvalidPrice);
    require!(fee_bps <= MAX_FEE_BPS, AccrueError::FeeTooHigh);
    require!(stream_period >= MIN_STREAM_PERIOD, AccrueError::InvalidPeriod);

    let now = Clock::get()?.unix_timestamp;
    let mint_key = ctx.accounts.mint.key();

    let config = &mut ctx.accounts.config;
    config.manager = ctx.accounts.manager.key();
    config.mint = mint_key;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.vault = ctx.accounts.vault.key();
    config.treasury = ctx.accounts.treasury.key();
    config.price = price;
    config.fee_bps = fee_bps;
    config.min_investment = min_investment;
    config.size_cap = size_cap;
    config.stream_period = stream_period;
    config.last_update = now;
    config.created_at = now;
    config.bump = ctx.bumps.config;
    // acc_per_token, stream and totals start at 0: no income has been paid yet.

    // TokenMetadata is variable length, so Token-2022 grows the mint when it
    // writes it. Top up rent first: TLV header (4) + update authority (32)
    // + mint (32) + three strings (4 + len each) + empty additional list (4).
    let metadata_len = 4 + 32 + 32 + 4 + name.len() + 4 + symbol.len() + 4 + uri.len() + 4;
    let mint_info = ctx.accounts.mint.to_account_info();
    let rent_needed = Rent::get()?
        .minimum_balance(mint_info.data_len() + metadata_len)
        .saturating_sub(mint_info.lamports());
    if rent_needed > 0 {
        system_program::transfer(
            CpiContext::new(
                system_program::ID,
                system_program::Transfer {
                    from: ctx.accounts.manager.to_account_info(),
                    to: mint_info.clone(),
                },
            ),
            rent_needed,
        )?;
    }

    // The mint authority (Config PDA) must sign, so pass its seeds.
    let bump = [ctx.accounts.config.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, mint_key.as_ref(), &bump]];
    token_metadata_initialize(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TokenMetadataInitialize {
                program_id: ctx.accounts.token_program.to_account_info(),
                metadata: mint_info.clone(),
                update_authority: ctx.accounts.manager.to_account_info(),
                mint_authority: ctx.accounts.config.to_account_info(),
                mint: mint_info,
            },
            signer_seeds,
        ),
        name,
        symbol,
        uri,
    )?;

    Ok(())
}
