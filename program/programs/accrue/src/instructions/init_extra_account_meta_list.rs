use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::{constants::*, state::Config};

// Fixed accounts Token-2022 passes to `execute`, by index.
const SOURCE_TOKEN_ACCOUNT: u8 = 0;
const MINT: u8 = 1;
const DESTINATION_TOKEN_ACCOUNT: u8 = 2;

// A token account's data is mint (0..32) then owner (32..64).
const TOKEN_ACCOUNT_OWNER_OFFSET: u8 = 32;

/// Extra accounts the hook needs, in order: Config, sender Holder, receiver Holder.
/// Holders are keyed by the token account's owner, not the transfer signer,
/// because the signer can be a delegate.
pub fn extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
    let holder_of = |token_account: u8| {
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: HOLDER_SEED.to_vec(),
                },
                Seed::AccountKey { index: MINT },
                Seed::AccountData {
                    account_index: token_account,
                    data_index: TOKEN_ACCOUNT_OWNER_OFFSET,
                    length: 32,
                },
            ],
            false,
            true,
        )
    };
    Ok(vec![
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: CONFIG_SEED.to_vec(),
                },
                Seed::AccountKey { index: MINT },
            ],
            false,
            true,
        )?,
        holder_of(SOURCE_TOKEN_ACCOUNT)?,
        holder_of(DESTINATION_TOKEN_ACCOUNT)?,
    ])
}

pub fn extra_account_metas_len() -> usize {
    ExtraAccountMetaList::size_of(3).unwrap()
}

#[derive(Accounts)]
pub struct InitExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Only funds created by initialize_fund get a list.
    #[account(seeds = [CONFIG_SEED, mint.key().as_ref()], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    /// CHECK: raw TLV account read by Token-2022; written below.
    #[account(
        init,
        payer = payer,
        space = extra_account_metas_len(),
        seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_init_extra_account_meta_list(ctx: Context<InitExtraAccountMetaList>) -> Result<()> {
    let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &extra_account_metas()?)?;
    Ok(())
}
