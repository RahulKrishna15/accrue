mod common;

use accrue::{
    state::{Config, Holder},
    ACC_PRECISION,
};
use common::*;
use solana_signer::Signer;

const DAY: i64 = 86_400;

#[test]
fn first_invest_mints_shares_and_creates_holder() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);

    // 6,000 USDC at 10 USDC per share = 600 shares.
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();

    assert_eq!(
        token_balance(&svm, &share_account(&f, &alice.pubkey())),
        600 * USDC
    );
    assert_eq!(token_balance(&svm, &alice_usdc), 4_000 * USDC);
    assert_eq!(token_balance(&svm, &f.treasury), 6_000 * USDC);
    assert_eq!(token_balance(&svm, &f.vault), 0); // principal never touches the income vault

    let config: Config = read(&svm, &f.config);
    assert_eq!(config.total_supply, 600 * USDC);
    assert_eq!(config.total_raised, 6_000 * USDC);

    let holder: Holder = read(&svm, &holder_pda(&f, &alice.pubkey()));
    assert_eq!(holder.owner, alice.pubkey());
    assert_eq!(holder.mint, f.mint.pubkey());
    assert_eq!(holder.last_acc, config.acc_per_token);
    assert_eq!(holder.pending, 0);
    assert_eq!(holder.total_invested, 6_000 * USDC);
}

#[test]
fn invest_rejects_bad_amounts() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm);
    let (whale, whale_usdc) = new_investor(&mut svm, &f, 2_000_000 * USDC);
    let (small, small_usdc) = new_investor(&mut svm, &f, 150 * USDC);

    let below_min = invest(&mut svm, &f, &whale, &whale_usdc, 50 * USDC);
    assert!(
        err_string(below_min).contains("Custom(6002)"),
        "BelowMinimum"
    );

    let over_cap = invest(&mut svm, &f, &whale, &whale_usdc, 1_000_001 * USDC);
    assert!(err_string(over_cap).contains("Custom(6003)"), "CapExceeded");

    let too_poor = invest(&mut svm, &f, &small, &small_usdc, 200 * USDC);
    assert!(
        err_string(too_poor).contains("Custom(6014)"),
        "InsufficientFunds"
    );
}

#[test]
fn invest_accrues_before_minting_and_settles_existing_holders() {
    let mut svm = setup();
    let f = initialized_fund_with_fee(&mut svm, 0);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    let (bob, bob_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);

    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap(); // 600 shares

    // 3,000 USDC streaming over 30 days (fee 0 keeps the numbers round).
    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);
    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();

    // Day 10: Bob buys 400 shares. Days 0-10 (1,000 USDC) belong to Alice's 600 alone.
    warp(&mut svm, 10 * DAY);
    invest(&mut svm, &f, &bob, &bob_usdc, 4_000 * USDC).unwrap();

    let acc_day_10 = 1_000 * USDC as u128 * ACC_PRECISION / (600 * USDC as u128);
    let config: Config = read(&svm, &f.config);
    assert_eq!(
        config.acc_per_token, acc_day_10,
        "acc must use the supply before Bob's mint"
    );
    assert_eq!(config.stream_remaining, 2_000 * USDC);
    assert_eq!(config.total_supply, 1_000 * USDC);

    let bob_holder: Holder = read(&svm, &holder_pda(&f, &bob.pubkey()));
    assert_eq!(
        bob_holder.last_acc, acc_day_10,
        "new holder starts at current acc, not 0"
    );

    // Day 20: Alice buys 100 more. She settles on her old 600 shares first.
    warp(&mut svm, 10 * DAY);
    invest(&mut svm, &f, &alice, &alice_usdc, 1_000 * USDC).unwrap();

    let acc_day_20 = acc_day_10 + 1_000 * USDC as u128 * ACC_PRECISION / (1_000 * USDC as u128);
    let alice_holder: Holder = read(&svm, &holder_pda(&f, &alice.pubkey()));
    assert_eq!(alice_holder.last_acc, acc_day_20);
    // 1,000 (days 0-10) + 600 (days 10-20), minus rounding dust from 1/600.
    let expected = (600 * USDC as u128 * acc_day_20 / ACC_PRECISION) as u64;
    assert_eq!(alice_holder.pending, expected);
    assert_eq!(expected, 1_599_999_999);
    assert_eq!(alice_holder.total_invested, 7_000 * USDC);
}
