mod common;

use accrue::{state::Config, CONFIG_SEED};
use anchor_lang::{
    prelude::{Clock, Pubkey},
    solana_program::{instruction::Instruction, system_program},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use anchor_spl::{
    associated_token::{self, get_associated_token_address_with_program_id},
    token::spl_token,
    token_2022,
    token_interface::{
        spl_token_2022::{
            extension::{
                metadata_pointer::MetadataPointer, transfer_hook::TransferHook,
                BaseStateWithExtensions, StateWithExtensions,
            },
            state::Mint,
        },
        spl_token_metadata_interface::state::TokenMetadata,
    },
};
use common::*;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_signer::Signer;

struct Fund {
    manager: Keypair,
    mint: Keypair,
    usdc_mint: Pubkey,
    treasury: Pubkey,
    config: Pubkey,
    vault: Pubkey,
}

fn new_fund(svm: &mut LiteSVM) -> Fund {
    let manager = funded_keypair(svm);
    let mint = Keypair::new();
    let usdc_mint = create_usdc_mint(svm, &manager.pubkey());
    let treasury = create_usdc_account(svm, &usdc_mint, &manager.pubkey(), 0);
    let config = Pubkey::find_program_address(&[CONFIG_SEED, mint.pubkey().as_ref()], &accrue::ID).0;
    let vault = get_associated_token_address_with_program_id(&config, &usdc_mint, &spl_token::ID);
    Fund { manager, mint, usdc_mint, treasury, config, vault }
}

fn initialize_fund_ix(f: &Fund, fee_bps: u16) -> Instruction {
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

#[test]
fn initialize_fund_creates_mint_config_and_vault() {
    let mut svm = setup();
    let f = new_fund(&mut svm);

    send(&mut svm, &[initialize_fund_ix(&f, 200)], &f.manager, &[&f.manager, &f.mint]).unwrap();

    // Config holds the inputs; the income engine starts empty.
    let data = svm.get_account(&f.config).unwrap().data;
    let config = Config::try_deserialize(&mut data.as_slice()).unwrap();
    let now = svm.get_sysvar::<Clock>().unix_timestamp;
    assert_eq!(config.manager, f.manager.pubkey());
    assert_eq!(config.mint, f.mint.pubkey());
    assert_eq!(config.usdc_mint, f.usdc_mint);
    assert_eq!(config.vault, f.vault);
    assert_eq!(config.treasury, f.treasury);
    assert_eq!(config.price, 10 * USDC);
    assert_eq!(config.fee_bps, 200);
    assert_eq!(config.stream_period, 30 * 86_400);
    assert_eq!(config.acc_per_token, 0);
    assert_eq!(config.total_supply, 0);
    assert_eq!(config.last_update, now);
    assert!(!config.paused && !config.closed);

    // Share mint: Token-2022, Config PDA is the mint authority, hook points at us.
    let mint_account = svm.get_account(&f.mint.pubkey()).unwrap();
    assert_eq!(mint_account.owner, token_2022::ID);
    let mint = StateWithExtensions::<Mint>::unpack(&mint_account.data).unwrap();
    assert_eq!(mint.base.mint_authority, Some(f.config).into());
    assert_eq!(mint.base.decimals, 6);

    let hook = mint.get_extension::<TransferHook>().unwrap();
    assert_eq!(Option::<Pubkey>::from(hook.program_id), Some(accrue::ID));
    assert_eq!(Option::<Pubkey>::from(hook.authority), Some(f.config));

    let pointer = mint.get_extension::<MetadataPointer>().unwrap();
    assert_eq!(Option::<Pubkey>::from(pointer.metadata_address), Some(f.mint.pubkey()));

    let meta = mint.get_variable_len_extension::<TokenMetadata>().unwrap();
    assert_eq!(meta.name, "Harbor Credit Fund");
    assert_eq!(meta.symbol, "HCF");
    assert_eq!(Option::<Pubkey>::from(meta.update_authority), Some(f.manager.pubkey()));

    // Vault: USDC token account owned by the Config PDA.
    let vault = svm.get_account(&f.vault).unwrap();
    assert_eq!(vault.owner, spl_token::ID);
    let vault = <spl_token::state::Account as anchor_lang::solana_program::program_pack::Pack>::unpack(&vault.data).unwrap();
    assert_eq!(vault.owner, f.config);
    assert_eq!(vault.mint, f.usdc_mint);
}

#[test]
fn initialize_fund_rejects_fee_above_ten_percent() {
    let mut svm = setup();
    let f = new_fund(&mut svm);

    let result = send(&mut svm, &[initialize_fund_ix(&f, 1_100)], &f.manager, &[&f.manager, &f.mint]);
    assert!(err_string(result).contains("Custom(6004)"), "expected FeeTooHigh");
}
