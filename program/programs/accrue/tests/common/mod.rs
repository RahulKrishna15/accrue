#![allow(dead_code)]

use accrue::CONFIG_SEED;
use anchor_lang::{
    prelude::Pubkey,
    solana_program::{
        instruction::Instruction, program_option::COption, program_pack::Pack, system_program,
    },
    InstructionData, ToAccountMetas,
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
