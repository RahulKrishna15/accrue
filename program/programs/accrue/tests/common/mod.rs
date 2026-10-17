#![allow(dead_code)]

use accrue::CONFIG_SEED;
use anchor_lang::{
    prelude::{Clock, Pubkey},
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program_option::COption,
        program_pack::Pack,
        system_program,
    },
    AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas,
};
use anchor_spl::{
    associated_token::{self, get_associated_token_address_with_program_id},
    token::spl_token,
    token_2022,
};
use litesvm::{types::TransactionResult, LiteSVM};
use solana_account::Account;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

pub const USDC: u64 = 1_000_000;

/// LiteSVM with the built program loaded (run `anchor build` first).
pub fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/accrue.so"));
    svm.add_program(accrue::ID, bytes).unwrap();
    svm
}

pub fn funded_keypair(svm: &mut LiteSVM) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    kp
}

pub fn send(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> TransactionResult {
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
}

/// Writes a classic SPL Token mint straight into the SVM (stands in for Test USDC).
pub fn create_usdc_mint(svm: &mut LiteSVM, authority: &Pubkey) -> Pubkey {
    let mint = Pubkey::new_unique();
    let state = spl_token::state::Mint {
        mint_authority: COption::Some(*authority),
        supply: 0,
        decimals: 6,
        is_initialized: true,
        freeze_authority: COption::None,
    };
    let mut data = vec![0; spl_token::state::Mint::LEN];
    spl_token::state::Mint::pack(state, &mut data).unwrap();
    set_token_owned(svm, mint, data);
    mint
}

/// Writes a classic SPL Token account holding `amount` of `mint`.
pub fn create_usdc_account(
    svm: &mut LiteSVM,
    mint: &Pubkey,
    owner: &Pubkey,
    amount: u64,
) -> Pubkey {
    let address = Pubkey::new_unique();
    let state = spl_token::state::Account {
        mint: *mint,
        owner: *owner,
        amount,
        delegate: COption::None,
        state: spl_token::state::AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    };
    let mut data = vec![0; spl_token::state::Account::LEN];
    spl_token::state::Account::pack(state, &mut data).unwrap();
    set_token_owned(svm, address, data);
    address
}

fn set_token_owned(svm: &mut LiteSVM, address: Pubkey, data: Vec<u8>) {
    let lamports = svm.minimum_balance_for_rent_exemption(data.len());
    svm.set_account(
        address,
        Account {
            lamports,
            data,
            owner: spl_token::ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

/// Debug string of a failed transaction's error, e.g. "...Custom(6004)...".
pub fn err_string(result: TransactionResult) -> String {
    format!("{:?}", result.expect_err("transaction should fail").err)
}

pub struct Fund {
    pub manager: Keypair,
    pub mint: Keypair,
    pub usdc_mint: Pubkey,
    pub treasury: Pubkey,
    pub config: Pubkey,
    pub vault: Pubkey,
}

pub fn new_fund(svm: &mut LiteSVM) -> Fund {
    let manager = funded_keypair(svm);
    let mint = Keypair::new();
    let usdc_mint = create_usdc_mint(svm, &manager.pubkey());
    let treasury = create_usdc_account(svm, &usdc_mint, &manager.pubkey(), 0);
    let config =
        Pubkey::find_program_address(&[CONFIG_SEED, mint.pubkey().as_ref()], &accrue::ID).0;
    let vault = get_associated_token_address_with_program_id(&config, &usdc_mint, &spl_token::ID);
    Fund {
        manager,
        mint,
        usdc_mint,
        treasury,
        config,
        vault,
    }
}

pub fn initialize_fund_ix(f: &Fund, fee_bps: u16) -> Instruction {
    Instruction {
        program_id: accrue::ID,
        accounts: accrue::accounts::InitializeFund {
            manager: f.manager.pubkey(),
            mint: f.mint.pubkey(),
            config: f.config,
            usdc_mint: f.usdc_mint,
            vault: f.vault,
            treasury: f.treasury,
            token_program: token_2022::ID,
            usdc_token_program: spl_token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: accrue::instruction::InitializeFund {
            name: "Harbor Credit Fund".into(),
            symbol: "HCF".into(),
            uri: "https://example.com/hcf.png".into(),
            price: 10 * USDC,
            fee_bps,
            min_investment: 100 * USDC,
            size_cap: 1_000_000 * USDC,
            stream_period: 30 * 86_400,
        }
        .data(),
    }
}

pub fn holder_pda(f: &Fund, owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            accrue::HOLDER_SEED,
            f.mint.pubkey().as_ref(),
            owner.as_ref(),
        ],
        &accrue::ID,
    )
    .0
}

pub fn share_account(f: &Fund, owner: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, &f.mint.pubkey(), &token_2022::ID)
}

/// A fund that has run initialize_fund (2% fee, 10 USDC per share).
pub fn initialized_fund(svm: &mut LiteSVM) -> Fund {
    let f = new_fund(svm);
    send(
        svm,
        &[initialize_fund_ix(&f, 200)],
        &f.manager,
        &[&f.manager, &f.mint],
    )
    .unwrap();
    f
}

/// A funded investor wallet with `usdc` Test USDC. Returns (wallet, USDC account).
pub fn new_investor(svm: &mut LiteSVM, f: &Fund, usdc: u64) -> (Keypair, Pubkey) {
    let investor = funded_keypair(svm);
    let usdc_account = create_usdc_account(svm, &f.usdc_mint, &investor.pubkey(), usdc);
    (investor, usdc_account)
}

pub fn invest_ix(
    f: &Fund,
    investor: &Pubkey,
    investor_usdc: &Pubkey,
    usdc_amount: u64,
) -> Instruction {
    Instruction {
        program_id: accrue::ID,
        accounts: accrue::accounts::Invest {
            investor: *investor,
            config: f.config,
            mint: f.mint.pubkey(),
            holder: holder_pda(f, investor),
            investor_share_account: share_account(f, investor),
            usdc_mint: f.usdc_mint,
            investor_usdc: *investor_usdc,
            treasury: f.treasury,
            token_program: token_2022::ID,
            usdc_token_program: spl_token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: accrue::instruction::Invest { usdc_amount }.data(),
    }
}

pub fn invest(
    svm: &mut LiteSVM,
    f: &Fund,
    investor: &Keypair,
    investor_usdc: &Pubkey,
    usdc_amount: u64,
) -> TransactionResult {
    svm.expire_blockhash();
    send(
        svm,
        &[invest_ix(f, &investor.pubkey(), investor_usdc, usdc_amount)],
        investor,
        &[investor],
    )
}

pub fn read<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let data = svm.get_account(address).unwrap().data;
    T::try_deserialize(&mut data.as_slice()).unwrap()
}

/// Overwrites an Anchor account's data (used to fake state the program can't set yet).
pub fn write<T: AccountSerialize>(svm: &mut LiteSVM, address: &Pubkey, value: &T) {
    let mut account = svm.get_account(address).unwrap();
    let mut data = Vec::new();
    value.try_serialize(&mut data).unwrap();
    account.data[..data.len()].copy_from_slice(&data);
    svm.set_account(*address, account).unwrap();
}

pub fn token_balance(svm: &LiteSVM, address: &Pubkey) -> u64 {
    // amount sits at bytes 64..72 in both SPL Token and Token-2022 accounts
    let data = svm.get_account(address).unwrap().data;
    u64::from_le_bytes(data[64..72].try_into().unwrap())
}

pub fn now(svm: &LiteSVM) -> i64 {
    svm.get_sysvar::<Clock>().unix_timestamp
}

pub fn warp(svm: &mut LiteSVM, seconds: i64) {
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += seconds;
    svm.set_sysvar(&clock);
}

pub fn meta_list_pda(f: &Fund) -> Pubkey {
    spl_transfer_hook_interface::get_extra_account_metas_address(&f.mint.pubkey(), &accrue::ID)
}

pub fn init_extra_account_meta_list_ix(f: &Fund, payer: &Keypair, list: Pubkey) -> Instruction {
    Instruction {
        program_id: accrue::ID,
        accounts: accrue::accounts::InitExtraAccountMetaList {
            payer: payer.pubkey(),
            mint: f.mint.pubkey(),
            config: f.config,
            extra_account_meta_list: list,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: accrue::instruction::InitExtraAccountMetaList {}.data(),
    }
}

/// initialize_fund + init_extra_account_meta_list: shares can be transferred.
pub fn transferable_fund(svm: &mut LiteSVM) -> Fund {
    let f = initialized_fund(svm);
    send(
        svm,
        &[init_extra_account_meta_list_ix(
            &f,
            &f.manager,
            meta_list_pda(&f),
        )],
        &f.manager,
        &[&f.manager],
    )
    .unwrap();
    f
}

pub fn register_holder_ix(f: &Fund, payer: &Pubkey, owner: &Pubkey) -> Instruction {
    Instruction {
        program_id: accrue::ID,
        accounts: accrue::accounts::RegisterHolder {
            payer: *payer,
            owner: *owner,
            mint: f.mint.pubkey(),
            config: f.config,
            holder: holder_pda(f, owner),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: accrue::instruction::RegisterHolder {}.data(),
    }
}

/// Creates `owner`'s Token-2022 share ATA (empty), as a wallet would.
pub fn create_share_account_ix(f: &Fund, payer: &Pubkey, owner: &Pubkey) -> Instruction {
    associated_token::spl_associated_token_account::instruction::create_associated_token_account_idempotent(
        payer,
        owner,
        &f.mint.pubkey(),
        &token_2022::ID,
    )
}

/// transfer_checked between share ATAs, with the hook's extra accounts appended
/// (what the client resolves from the meta list on Day 3).
pub fn hooked_transfer_ix(f: &Fund, from: &Pubkey, to: &Pubkey, amount: u64) -> Instruction {
    let mut ix = anchor_spl::token_interface::spl_token_2022::instruction::transfer_checked(
        &token_2022::ID,
        &share_account(f, from),
        &f.mint.pubkey(),
        &share_account(f, to),
        from,
        &[],
        amount,
        accrue::SHARE_DECIMALS,
    )
    .unwrap();
    ix.accounts.extend([
        AccountMeta::new(f.config, false),
        AccountMeta::new(holder_pda(f, from), false),
        AccountMeta::new(holder_pda(f, to), false),
        AccountMeta::new_readonly(accrue::ID, false),
        AccountMeta::new_readonly(meta_list_pda(f), false),
    ]);
    ix
}
