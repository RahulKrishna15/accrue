mod common;

use accrue::{
    state::{Config, Holder},
    ACC_PRECISION,
};
use anchor_lang::{solana_program::instruction::Instruction, InstructionData, ToAccountMetas};
use common::*;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_signer::Signer;

const DAY: i64 = 86_400;

/// Transferable fund where Alice holds 600 shares and a 3,000 USDC / 30 day stream is running.
fn fund_with_alice_and_stream(svm: &mut LiteSVM) -> (Fund, Keypair) {
    let f = transferable_fund(svm);
    let (alice, alice_usdc) = new_investor(svm, &f, 10_000 * USDC);
    invest(svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();

    // deposit_revenue comes on Day 2: fake the stream.
    let mut config: Config = read(svm, &f.config);
    config.stream_remaining = 3_000 * USDC;
    config.last_update = now(svm);
    config.stream_end = now(svm) + 30 * DAY;
    write(svm, &f.config, &config);
    (f, alice)
}

/// income per share base unit (x 1e12) when `usdc` is released over `shares`
fn acc_for(usdc: u64, shares: u64) -> u128 {
    usdc as u128 * ACC_PRECISION / shares as u128
}

fn earned(balance: u64, acc_delta: u128) -> u64 {
    (balance as u128 * acc_delta / ACC_PRECISION) as u64
}

#[test]
fn transfer_to_new_wallet_settles_both_holders() {
    let mut svm = setup();
    let (f, alice) = fund_with_alice_and_stream(&mut svm);
    let dave = Keypair::new();

    // Day 10: Alice sends 300 shares to Dave, a wallet the fund has never seen.
    // One transaction: Dave's share ATA, Dave's Holder, the hooked transfer.
    warp(&mut svm, 10 * DAY);
    send(
        &mut svm,
        &[
            create_share_account_ix(&f, &alice.pubkey(), &dave.pubkey()),
            register_holder_ix(&f, &alice.pubkey(), &dave.pubkey()),
            hooked_transfer_ix(&f, &alice.pubkey(), &dave.pubkey(), 300 * USDC),
        ],
        &alice,
        &[&alice],
    )
    .unwrap();

    assert_eq!(
        token_balance(&svm, &share_account(&f, &alice.pubkey())),
        300 * USDC
    );
    assert_eq!(
        token_balance(&svm, &share_account(&f, &dave.pubkey())),
        300 * USDC
    );

    // Days 0-10 (1,000 USDC) were earned on Alice's 600 shares, the pre-transfer balance.
    let acc_10 = acc_for(1_000 * USDC, 600 * USDC);
    let config: Config = read(&svm, &f.config);
    assert_eq!(config.acc_per_token, acc_10);

    let alice_h: Holder = read(&svm, &holder_pda(&f, &alice.pubkey()));
    assert_eq!(alice_h.pending, earned(600 * USDC, acc_10)); // ~1,000 USDC
    assert_eq!(alice_h.last_acc, acc_10);

    let dave_h: Holder = read(&svm, &holder_pda(&f, &dave.pubkey()));
    assert_eq!(dave_h.owner, dave.pubkey());
    assert_eq!(dave_h.pending, 0);
    assert_eq!(dave_h.last_acc, acc_10);

    // Day 20: a second transfer between existing holders needs no register_holder.
    warp(&mut svm, 10 * DAY);
    svm.expire_blockhash();
    send(
        &mut svm,
        &[hooked_transfer_ix(
            &f,
            &alice.pubkey(),
            &dave.pubkey(),
            100 * USDC,
        )],
        &alice,
        &[&alice],
    )
    .unwrap();

    // Days 10-20 (1,000 USDC) split 300 / 300.
    let step = acc_for(1_000 * USDC, 600 * USDC);
    let alice_h: Holder = read(&svm, &holder_pda(&f, &alice.pubkey()));
    let dave_h: Holder = read(&svm, &holder_pda(&f, &dave.pubkey()));
    assert_eq!(
        alice_h.pending,
        earned(600 * USDC, acc_10) + earned(300 * USDC, step)
    );
    assert_eq!(dave_h.pending, earned(300 * USDC, step)); // ~500 USDC
    assert_eq!(alice_h.last_acc, acc_10 + step);
    assert_eq!(dave_h.last_acc, acc_10 + step);
}

#[test]
fn transfer_to_unregistered_wallet_fails() {
    let mut svm = setup();
    let (f, alice) = fund_with_alice_and_stream(&mut svm);
    let eve = Keypair::new();

    let result = send(
        &mut svm,
        &[
            create_share_account_ix(&f, &alice.pubkey(), &eve.pubkey()),
            hooked_transfer_ix(&f, &alice.pubkey(), &eve.pubkey(), 100 * USDC),
        ],
        &alice,
        &[&alice],
    );
    assert!(
        err_string(result).contains("Custom(6009)"),
        "HolderNotRegistered"
    );
}

#[test]
fn calling_the_hook_directly_fails() {
    let mut svm = setup();
    let (f, alice) = fund_with_alice_and_stream(&mut svm);
    let dave = Keypair::new();
    send(
        &mut svm,
        &[
            create_share_account_ix(&f, &alice.pubkey(), &dave.pubkey()),
            register_holder_ix(&f, &alice.pubkey(), &dave.pubkey()),
        ],
        &alice,
        &[&alice],
    )
    .unwrap();
    warp(&mut svm, 10 * DAY);

    // Pretend Alice just sent a million shares, to inflate her rebuilt balance.
    let direct = Instruction {
        program_id: accrue::ID,
        accounts: accrue::accounts::Execute {
            source_token: share_account(&f, &alice.pubkey()),
            mint: f.mint.pubkey(),
            destination_token: share_account(&f, &dave.pubkey()),
            authority: alice.pubkey(),
            extra_account_meta_list: meta_list_pda(&f),
            config: f.config,
            sender_holder: holder_pda(&f, &alice.pubkey()),
            receiver_holder: holder_pda(&f, &dave.pubkey()),
        }
        .to_account_metas(None),
        data: accrue::instruction::Execute {
            amount: 1_000_000 * USDC,
        }
        .data(),
    };
    svm.expire_blockhash();
    let result = send(&mut svm, &[direct], &alice, &[&alice]);
    assert!(
        err_string(result).contains("Custom(6011)"),
        "NotTransferring"
    );

    let alice_h: Holder = read(&svm, &holder_pda(&f, &alice.pubkey()));
    assert_eq!(alice_h.pending, 0);
}
