use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{
    spl_token_2022::{
        extension::{
            transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions,
        },
        state::Account as TokenState,
    },
    Mint, TokenAccount,
};

use crate::{
    constants::*,
    error::AccrueError,
    events::Transferred,
    math::{accrue, settle},
    state::{Config, Holder},
};

/// Transfer Hook. Token-2022 calls this on every transfer_checked of a share,
/// after the tokens have moved. Account order is fixed by the interface (0-4)
/// and by our extra account meta list (5-7).
#[derive(Accounts)]
pub struct Execute<'info> {
    /// Shares only live in ATAs, so one Holder always matches one balance.
    #[account(
        token::mint = mint,
        address = get_associated_token_address_with_program_id(
            &source_token.owner, &mint.key(), &token_2022::ID
        ),
    )]
    pub source_token: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        token::mint = mint,
        address = get_associated_token_address_with_program_id(
            &destination_token.owner, &mint.key(), &token_2022::ID
        ),
    )]
    pub destination_token: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: owner or delegate; Token-2022 already verified the signature.
    pub authority: UncheckedAccount<'info>,

    /// CHECK: our own meta list, verified by seeds.
    #[account(seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Box<Account<'info, Config>>,

    /// Keyed by the token account's owner, never the signer (could be a delegate).
    #[account(
        mut,
        seeds = [HOLDER_SEED, mint.key().as_ref(), source_token.owner.as_ref()],
        bump = sender_holder.bump,
    )]
    pub sender_holder: Box<Account<'info, Holder>>,

    /// CHECK: may not exist yet; checked in the handler so the error says
    /// HolderNotRegistered. Same account as sender_holder on a self-transfer.
    #[account(
        mut,
        seeds = [HOLDER_SEED, mint.key().as_ref(), destination_token.owner.as_ref()],
        bump,
    )]
    pub receiver_holder: UncheckedAccount<'info>,
}

pub fn handle_execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
    // Only a real Token-2022 transfer sets this flag. A direct call could pass
    // any `amount` and inflate the sender's rebuilt balance below.
    assert_is_transferring(&ctx.accounts.source_token)?;

    let config = &mut ctx.accounts.config;
    require!(!config.paused, AccrueError::FundPaused);
    let now = Clock::get()?.unix_timestamp;
    accrue(config, now)?;
    let acc = config.acc_per_token;

    let source = &ctx.accounts.source_token;
    let destination = &ctx.accounts.destination_token;
    let event = Transferred {
        mint: ctx.accounts.mint.key(),
        timestamp: now,
        from: source.owner,
        to: destination.owner,
        amount,
    };

    // Self-transfer: same ATA, balance unchanged, one Holder.
    if source.key() == destination.key() {
        settle(&mut ctx.accounts.sender_holder, source.amount, acc)?;
        emit!(event);
        return Ok(());
    }

    // The hook runs after the move, so rebuild the balances income was earned on.
    let sender_before = source
        .amount
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    let receiver_before = destination
        .amount
        .checked_sub(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    settle(&mut ctx.accounts.sender_holder, sender_before, acc)?;

    let info = ctx.accounts.receiver_holder.to_account_info();
    require!(
        info.owner == &crate::ID && !info.data_is_empty(),
        AccrueError::HolderNotRegistered
    );
    let mut data = info.try_borrow_mut_data()?;
    let mut receiver = Holder::try_deserialize(&mut &data[..])?;
    settle(&mut receiver, receiver_before, acc)?;
    receiver.try_serialize(&mut &mut data[..])?;

    emit!(event);
    Ok(())
}

fn assert_is_transferring(token_account: &InterfaceAccount<TokenAccount>) -> Result<()> {
    let info = token_account.to_account_info();
    let data = info.try_borrow_data()?;
    let state = StateWithExtensions::<TokenState>::unpack(&data)?;
    let transferring = state
        .get_extension::<TransferHookAccount>()
        .map(|ext| bool::from(ext.transferring))
        .unwrap_or(false);
    require!(transferring, AccrueError::NotTransferring);
    Ok(())
}
