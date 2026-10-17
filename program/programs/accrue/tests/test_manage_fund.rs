mod common;

use accrue::{
    events::{HolderRegistered, Invested, RevenueDeposited, Transferred},
    state::Config,
};
use common::*;
use solana_keypair::Keypair;
use solana_signer::Signer;

const DAY: i64 = 86_400;

#[test]
fn set_price_applies_to_new_investments() {
    let mut svm = setup();
    let f = initialized_fund(&mut svm);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);

    as_manager(
        &mut svm,
        &f,
        set_price_ix(&f, &f.manager.pubkey(), 20 * USDC),
    )
    .unwrap();
    invest(&mut svm, &f, &alice, &alice_usdc, 1_000 * USDC).unwrap();
    // 1,000 USDC at 20 USDC per share = 50 shares, not 100.
    assert_eq!(
        token_balance(&svm, &share_account(&f, &alice.pubkey())),
        50 * USDC
    );

    let zero = as_manager(&mut svm, &f, set_price_ix(&f, &f.manager.pubkey(), 0));
    assert!(err_string(zero).contains("Custom(6007)"), "InvalidPrice");

    svm.expire_blockhash();
    let not_manager = send(
        &mut svm,
        &[set_price_ix(&f, &alice.pubkey(), 1)],
        &alice,
        &[&alice],
    );
    assert!(
        err_string(not_manager).contains("Custom(6005)"),
        "Unauthorized"
    );
}

#[test]
fn pause_blocks_invest_deposit_and_transfers_but_not_claims() {
    let mut svm = setup();
    let f = transferable_fund_with_fee(&mut svm, 0);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    let (bob, bob_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();
    invest(&mut svm, &f, &bob, &bob_usdc, 4_000 * USDC).unwrap();
    let from = manager_usdc(&mut svm, &f, 6_000 * USDC);
    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();

    as_manager(&mut svm, &f, set_paused_ix(&f, &f.manager.pubkey(), true)).unwrap();
    warp(&mut svm, 10 * DAY);

    let invest_paused = invest(&mut svm, &f, &alice, &alice_usdc, 1_000 * USDC);
    assert!(err_string(invest_paused).contains("Custom(6000)"), "invest");
    let deposit_paused = deposit(&mut svm, &f, &from, 1_000 * USDC);
    assert!(
        err_string(deposit_paused).contains("Custom(6000)"),
        "deposit"
    );
    svm.expire_blockhash();
    let transfer_paused = send(
        &mut svm,
        &[hooked_transfer_ix(
            &f,
            &alice.pubkey(),
            &bob.pubkey(),
            100 * USDC,
        )],
        &alice,
        &[&alice],
    );
    assert!(
        err_string(transfer_paused).contains("Custom(6000)"),
        "transfer"
    );

    // Income kept streaming while paused, and claims still work.
    let before = token_balance(&svm, &alice_usdc);
    claim(&mut svm, &f, &alice, &alice_usdc).unwrap();
    assert_eq!(token_balance(&svm, &alice_usdc) - before, 600 * USDC);

    as_manager(&mut svm, &f, set_paused_ix(&f, &f.manager.pubkey(), false)).unwrap();
    invest(&mut svm, &f, &alice, &alice_usdc, 1_000 * USDC).unwrap();

    svm.expire_blockhash();
    let not_manager = send(
        &mut svm,
        &[set_paused_ix(&f, &bob.pubkey(), true)],
        &bob,
        &[&bob],
    );
    assert!(
        err_string(not_manager).contains("Custom(6005)"),
        "Unauthorized"
    );
}

#[test]
fn closed_fund_stops_investment_only() {
    let mut svm = setup();
    let f = initialized_fund_with_fee(&mut svm, 0);
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);
    invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC).unwrap();

    as_manager(&mut svm, &f, close_fund_ix(&f, &f.manager.pubkey())).unwrap();
    let config: Config = read(&svm, &f.config);
    assert!(config.closed);

    let invest_closed = invest(&mut svm, &f, &alice, &alice_usdc, 1_000 * USDC);
    assert!(
        err_string(invest_closed).contains("Custom(6001)"),
        "FundClosed"
    );

    // Deposits and claims carry on.
    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);
    deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap();
    warp(&mut svm, 30 * DAY);
    claim(&mut svm, &f, &alice, &alice_usdc).unwrap();
    assert_eq!(
        token_balance(&svm, &alice_usdc),
        4_000 * USDC + 3_000 * USDC
    );

    let twice = as_manager(&mut svm, &f, close_fund_ix(&f, &f.manager.pubkey()));
    assert!(
        err_string(twice).contains("Custom(6001)"),
        "closing is one-way"
    );
}

#[test]
fn instructions_emit_events() {
    let mut svm = setup();
    let f = transferable_fund(&mut svm); // 2% fee
    let (alice, alice_usdc) = new_investor(&mut svm, &f, 10_000 * USDC);

    // First investment: Invested + HolderRegistered.
    let logs = invest(&mut svm, &f, &alice, &alice_usdc, 6_000 * USDC)
        .unwrap()
        .logs;
    let invested = events::<Invested>(&logs);
    assert_eq!(invested.len(), 1);
    assert_eq!(invested[0].investor, alice.pubkey());
    assert_eq!(invested[0].usdc, 6_000 * USDC);
    assert_eq!(invested[0].shares, 600 * USDC);
    assert_eq!(events::<HolderRegistered>(&logs)[0].owner, alice.pubkey());

    // Second investment: no new Holder, so no HolderRegistered.
    let logs = invest(&mut svm, &f, &alice, &alice_usdc, 1_000 * USDC)
        .unwrap()
        .logs;
    assert!(events::<HolderRegistered>(&logs).is_empty());

    let from = manager_usdc(&mut svm, &f, 3_000 * USDC);
    let logs = deposit(&mut svm, &f, &from, 3_000 * USDC).unwrap().logs;
    let deposited = &events::<RevenueDeposited>(&logs)[0];
    assert_eq!(
        (deposited.gross, deposited.fee, deposited.net),
        (3_000 * USDC, 60 * USDC, 2_940 * USDC)
    );
    assert_eq!(deposited.stream_end, now(&svm) + 30 * DAY);

    // The hook's event names owner wallets, not token accounts.
    let dave = Keypair::new();
    svm.expire_blockhash();
    let logs = send(
        &mut svm,
        &[
            create_share_account_ix(&f, &alice.pubkey(), &dave.pubkey()),
            register_holder_ix(&f, &alice.pubkey(), &dave.pubkey()),
            hooked_transfer_ix(&f, &alice.pubkey(), &dave.pubkey(), 100 * USDC),
        ],
        &alice,
        &[&alice],
    )
    .unwrap()
    .logs;
    let moved = &events::<Transferred>(&logs)[0];
    assert_eq!(
        (moved.from, moved.to, moved.amount),
        (alice.pubkey(), dave.pubkey(), 100 * USDC)
    );
    assert_eq!(events::<HolderRegistered>(&logs)[0].owner, dave.pubkey());
}
