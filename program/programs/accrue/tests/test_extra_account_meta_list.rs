mod common;

use accrue::{extra_account_metas, extra_account_metas_len};
use anchor_lang::{
    prelude::Pubkey,
    solana_program::{instruction::Instruction, system_program},
    InstructionData, ToAccountMetas,
};
use common::*;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_signer::Signer;
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::{
    get_extra_account_metas_address, instruction::ExecuteInstruction,
};

fn init_extra_account_meta_list_ix(f: &Fund, payer: &Keypair, list: Pubkey) -> Instruction {
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

fn initialized_fund(svm: &mut LiteSVM) -> Fund {
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

#[test]
fn init_extra_account_meta_list_writes_the_hook_recipe() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm);
    // Anyone can pay for it, not just the manager.
    let payer = funded_keypair(&mut svm);

    // The address Token-2022 will look for, from the interface's own derivation.
    let list = get_extra_account_metas_address(&f.mint.pubkey(), &accrue::ID);
    send(
        &mut svm,
        &[init_extra_account_meta_list_ix(&f, &payer, list)],
        &payer,
        &[&payer],
    )
    .unwrap();

    let account = svm.get_account(&list).unwrap();
    assert_eq!(account.owner, accrue::ID);

    // Byte-for-byte the list we expect: Config, sender Holder, receiver Holder.
    let mut expected = vec![0; extra_account_metas_len()];
    ExtraAccountMetaList::init::<ExecuteInstruction>(
        &mut expected,
        &extra_account_metas().unwrap(),
    )
    .unwrap();
    assert_eq!(account.data, expected);
}

#[test]
fn init_extra_account_meta_list_only_once() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm);
    let list = get_extra_account_metas_address(&f.mint.pubkey(), &accrue::ID);

    send(
        &mut svm,
        &[init_extra_account_meta_list_ix(&f, &f.manager, list)],
        &f.manager,
        &[&f.manager],
    )
    .unwrap();
    svm.expire_blockhash();
    let again = send(
        &mut svm,
        &[init_extra_account_meta_list_ix(&f, &f.manager, list)],
        &f.manager,
        &[&f.manager],
    );
    assert!(
        again.is_err(),
        "second init should fail: account already exists"
    );
}

#[test]
fn init_extra_account_meta_list_needs_an_initialized_fund() {
    let mut svm = setup();
    let f = new_fund(&mut svm); // initialize_fund never called
    let list = get_extra_account_metas_address(&f.mint.pubkey(), &accrue::ID);

    let result = send(
        &mut svm,
        &[init_extra_account_meta_list_ix(&f, &f.manager, list)],
        &f.manager,
        &[&f.manager],
    );
    assert!(result.is_err());
}
