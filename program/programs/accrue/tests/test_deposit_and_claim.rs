mod common;

use accrue::state::{Config, Holder};
use common::*;
use solana_signer::Signer;

const DAY: i64 = 86_400;

#[test]
fn deposit_splits_fee_and_starts_stream() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm); // 2% fee
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();

    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);
    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();

    assert_eq!(token_balance(&svm, &from), 0);
    assert_eq!(token_balance(&svm, &f.vault), 2_940 * USDC);
    assert_eq!(token_balance(&svm, &f.treasury), 6_000 * USDC + 60 * USDC); // principal + fee

    let config: Config = read(&svm, &f.config);
    assert_eq!(config.stream_remaining, 2_940 * USDC);
    assert_eq!(config.stream_end, now(&svm) + 30 * DAY);
    assert_eq!(config.last_update, now(&svm));
    assert_eq!(config.total_income, 2_940 * USDC);
    assert_eq!(config.total_fees, 60 * USDC);
}

#[test]
fn deposit_rules() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm);
    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);

    let no_holders = deposit(&mut svm, &f, &from, 1_000 * USDC);
    assert!(err_string(no_holders).contains("Custom(6012)"), "NoHolders");

    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();

    let zero = deposit(&mut svm, &f, &from, 0);
    assert!(err_string(zero).contains("Custom(6008)"), "InvalidAmount");

    let too_much = deposit(&mut svm, &f, &from, 3_001 * USDC);
    assert!(
        err_string(too_much).contains("Custom(6014)"),
        "InsufficientFunds"
    );

    // Alice signs a deposit from her own USDC: she is not the manager.
    svm.expire_blockhash();
    let not_manager = send(
        &mut svm,
        &[deposit_ix(&f, &alice.pubkey(), &alice_usdc, 1_000 * USDC)],
        &alice,
        &[&alice],
    );
    assert!(
        err_string(not_manager).contains("Custom(6005)"),
        "Unauthorized"
    );
}

#[test]
fn second_deposit_rolls_leftover_into_a_fresh_stream() {
    let mut svm = setup();
    let f = initialized_fund_with_fee(&mut svm, 0);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();
    let from = manager_usdc(&mut svm, &f, 5_000 * USDC);

    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();
    warp(&mut svm, 20 * DAY);
    deposit(&mut svm, &f, &from, 2_000 * USDC).unwrap();

    // 1,000 left of the first deposit + 2,000 new, over the next 30 days.
    let config: Config = read(&svm, &f.config);
    assert_eq!(config.stream_remaining, 3_000 * USDC);
    assert_eq!(config.stream_end, now(&svm) + 30 * DAY);
    // The 2,000 released in days 0-20 went to Alice's 600 shares already.
    let alice_h: Holder = read(&svm, &holder_pda(&f, &alice.pubkey()));
    assert_eq!(alice_h.pending, 0, "not settled until Alice is touched");
    assert_eq!(token_balance(&svm, &f.vault), 5_000 * USDC);
}

/// The worked example from the design notes, end to end with real tokens:
/// 3,000 USDC over 30 days, Alice 600 + Bob 400. Day 10 Alice sends Bob 300,
/// day 20 Carol buys 1,000, day 25 Bob claims, day 30 everyone claims.
#[test]
fn worked_example_on_chain() {
    let mut svm = setup();
    let f = transferable_fund_with_fee(&mut svm, 0);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 6_000 * USDC);
    let (bob, bob_usdc) = new_investor(&mut svm, &f, 4_000 * USDC);
    let (carol, carol_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap(); // 600 shares
    invest(&mut svm, &f, &bob, &bob_usdc, 4_000 * USDC).unwrap(); // 400 shares

    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);
    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();

    warp(&mut svm, 10 * DAY);
    svm.expire_blockhash();
    send(
        &mut svm,
        &[hooked_transfer_ix(
            &f,
            &alice.pubkey(),
            &bob.pubkey(),
            300 * USDC,
        )],
        &alice,
        &[&alice],
    )
    .unwrap();

    warp(&mut svm, 10 * DAY);
    invest(&mut svm, &f, &carol, &carol_usdc, 10_000 * USDC).unwrap(); // 1,000 shares

    // Day 25: Bob claims 1,275 and acc is exactly 2.25.
    warp(&mut svm, 5 * DAY);
    claim(&mut svm, &f, &bob, &bob_usdc).unwrap();
    assert_eq!(token_balance(&svm, &bob_usdc), 1_275 * USDC);
    let config: Config = read(&svm, &f.config);
    assert_eq!(config.acc_per_token, 2_250_000_000_000);

    let bob_h: Holder = read(&svm, &holder_pda(&f, &bob.pubkey()));
    assert_eq!(bob_h.pending, 0);
    assert_eq!(bob_h.last_acc, config.acc_per_token, "never reset to 0");

    let again = claim(&mut svm, &f, &bob, &bob_usdc);
    assert!(err_string(again).contains("Custom(6006)"), "NothingToClaim");

    // Day 30: the stream is done and everyone claims.
    warp(&mut svm, 5 * DAY);
    claim(&mut svm, &f, &alice, &alice_usdc).unwrap();
    claim(&mut svm, &f, &bob, &bob_usdc).unwrap();
    claim(&mut svm, &f, &carol, &carol_usdc).unwrap();

    assert_eq!(token_balance(&svm, &alice_usdc), 1_050 * USDC);
    assert_eq!(token_balance(&svm, &bob_usdc), 1_450 * USDC);
    assert_eq!(token_balance(&svm, &carol_usdc), 500 * USDC);
    assert_eq!(
        token_balance(&svm, &f.vault),
        0,
        "every deposited USDC paid out"
    );

    let config: Config = read(&svm, &f.config);
    assert_eq!(config.total_claimed, 3_000 * USDC);
    assert_eq!(config.stream_remaining, 0);
}

#[test]
fn cannot_claim_someone_elses_income() {
    let mut svm = setup();
    let f = initialized_fund_with_fee(&mut svm, 0);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 6_000 * USDC);
    let (mallory, mallory_usdc) = new_investor(&mut svm, &f, 1_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();
    invest(&mut svm, &f, &mallory, &mallory_usdc, 1_000 * USDC).unwrap();
    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);
    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();
    warp(&mut svm, 10 * DAY);

    // Mallory signs, but points at Alice's Holder.
    svm.expire_blockhash();
    let alice_holder = holder_pda(&f, &alice.pubkey());
    let result = send(
        &mut svm,
        &[claim_ix(
            &f,
            &mallory.pubkey(),
            &alice_holder,
            &mallory_usdc,
        )],
        &mallory,
        &[&mallory],
    );
    assert!(result.is_err());
    assert_eq!(token_balance(&svm, &mallory_usdc), 0);

    // Alice can still claim her own.
    claim(&mut svm, &f, &alice, &alice_usdc).unwrap();
    assert!(token_balance(&svm, &alice_usdc) > 0);
}
