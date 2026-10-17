//! Income math. Mirrors app/lib/accrue/math.ts.
//! Every division rounds down, so the vault never owes more than it holds.

use anchor_lang::prelude::*;

use crate::{
    constants::*,
    state::{Config, Holder},
};

fn overflow() -> Error {
    ProgramError::ArithmeticOverflow.into()
}

/// Release streamed income up to `now` into `acc_per_token`.
/// Must run before `total_supply` or any balance changes.
pub fn accrue(config: &mut Config, now: i64) -> Result<()> {
    if now <= config.last_update {
        return Ok(());
    }
    // Nobody to pay: hold the remainder and spread it over what is left of the window.
    if config.stream_remaining == 0 || config.total_supply == 0 {
        config.last_update = now;
        return Ok(());
    }

    let released = if now >= config.stream_end {
        config.stream_remaining
    } else {
        let elapsed = (now - config.last_update) as u128;
        let window = (config.stream_end - config.last_update) as u128;
        let part = (config.stream_remaining as u128)
            .checked_mul(elapsed)
            .ok_or_else(overflow)?
            / window;
        part as u64 // part < stream_remaining, so it fits
    };

    let acc_delta = (released as u128)
        .checked_mul(ACC_PRECISION)
        .ok_or_else(overflow)?
        / config.total_supply as u128;

    config.acc_per_token = config
        .acc_per_token
        .checked_add(acc_delta)
        .ok_or_else(overflow)?;
    config.stream_remaining -= released;
    config.last_update = now;
    Ok(())
}

/// earned = balance x (acc - last_acc)
pub fn earned(balance: u64, last_acc: u128, acc: u128) -> Result<u64> {
    let delta = acc.checked_sub(last_acc).ok_or_else(overflow)?;
    let amount = (balance as u128).checked_mul(delta).ok_or_else(overflow)? / ACC_PRECISION;
    u64::try_from(amount).map_err(|_| overflow())
}

/// Bring a holder up to date with the fund accumulator.
/// Must run before the holder's balance changes.
pub fn settle(holder: &mut Holder, balance: u64, acc: u128) -> Result<()> {
    let amount = earned(balance, holder.last_acc, acc)?;
    holder.pending = holder.pending.checked_add(amount).ok_or_else(overflow)?;
    holder.last_acc = acc;
    Ok(())
}

/// tokens = USDC / price (price is USDC base units per whole share).
pub fn shares_for_usdc(usdc: u64, price: u64) -> Result<u64> {
    let shares = (usdc as u128)
        .checked_mul(SHARE_UNIT as u128)
        .ok_or_else(overflow)?
        / price as u128;
    u64::try_from(shares).map_err(|_| overflow())
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 86_400;
    const UNIT: u64 = 1_000_000; // 1 USDC or 1 share in base units

    fn fund_streaming(total: u64, days: i64, supply: u64) -> Config {
        Config {
            stream_remaining: total * UNIT,
            stream_end: days * DAY,
            last_update: 0,
            total_supply: supply * UNIT,
            ..Default::default()
        }
    }

    /// Settle a holder at `acc`, then change their balance.
    fn rebalance(h: &mut Holder, balance: &mut u64, acc: u128, new_balance: u64) {
        settle(h, *balance * UNIT, acc).unwrap();
        *balance = new_balance;
    }

    #[test]
    fn worked_example_transfer_mid_period() {
        // 3,000 USDC over 30 days, Alice 600 + Bob 400. Alice sends 300 to Bob on day 10.
        let mut c = fund_streaming(3_000, 30, 1_000);
        let (mut alice, mut bob) = (Holder::default(), Holder::default());
        let (mut a, mut b) = (600, 400);

        accrue(&mut c, 10 * DAY).unwrap();
        rebalance(&mut alice, &mut a, c.acc_per_token, 300);
        rebalance(&mut bob, &mut b, c.acc_per_token, 700);

        accrue(&mut c, 30 * DAY).unwrap();
        settle(&mut alice, a * UNIT, c.acc_per_token).unwrap();
        settle(&mut bob, b * UNIT, c.acc_per_token).unwrap();

        assert_eq!(alice.pending, 1_200 * UNIT);
        assert_eq!(bob.pending, 1_800 * UNIT);
        assert_eq!(c.stream_remaining, 0);
    }

    #[test]
    fn worked_example_carol_joins_and_bob_claims() {
        let mut c = fund_streaming(3_000, 30, 1_000);
        let (mut alice, mut bob) = (Holder::default(), Holder::default());
        let (mut a, mut b) = (600, 400);

        accrue(&mut c, 10 * DAY).unwrap();
        rebalance(&mut alice, &mut a, c.acc_per_token, 300);
        rebalance(&mut bob, &mut b, c.acc_per_token, 700);

        // Day 20: Carol invests 1,000 shares. Accrue first, then grow the supply.
        accrue(&mut c, 20 * DAY).unwrap();
        let carol = Holder {
            last_acc: c.acc_per_token,
            ..Default::default()
        };
        c.total_supply += 1_000 * UNIT;

        // Day 25: Bob claims.
        accrue(&mut c, 25 * DAY).unwrap();
        settle(&mut bob, b * UNIT, c.acc_per_token).unwrap();
        assert_eq!(bob.pending, 1_275 * UNIT);
        assert_eq!(c.acc_per_token, 2_250_000_000_000); // 2.25 x 1e12

        accrue(&mut c, 30 * DAY).unwrap();
        let mut carol = carol;
        settle(&mut alice, a * UNIT, c.acc_per_token).unwrap();
        settle(&mut carol, 1_000 * UNIT, c.acc_per_token).unwrap();
        assert_eq!(alice.pending, 1_050 * UNIT);
        assert_eq!(carol.pending, 500 * UNIT);
    }

    #[test]
    fn minting_before_accrue_would_dilute_earlier_holders() {
        // Same day-20 moment, wrong order: supply grows before accrue.
        let mut c = fund_streaming(3_000, 30, 1_000);
        accrue(&mut c, 10 * DAY).unwrap();
        c.total_supply += 1_000 * UNIT;
        accrue(&mut c, 20 * DAY).unwrap();
        // Days 10-20 (1,000 USDC) got spread over 2,000 shares instead of 1,000.
        assert_eq!(c.acc_per_token, 1_500_000_000_000);
    }

    #[test]
    fn no_supply_holds_income_back() {
        let mut c = fund_streaming(3_000, 30, 0);
        accrue(&mut c, 10 * DAY).unwrap();
        assert_eq!(c.acc_per_token, 0);
        assert_eq!(c.stream_remaining, 3_000 * UNIT);
        assert_eq!(c.last_update, 10 * DAY);
    }

    #[test]
    fn shares_round_down() {
        assert_eq!(
            shares_for_usdc(1_000 * UNIT, 10 * UNIT).unwrap(),
            100 * UNIT
        );
        // 1 USDC at 3 USDC per share = 0.333333 shares -> 333_333 base units
        assert_eq!(shares_for_usdc(UNIT, 3 * UNIT).unwrap(), 333_333);
    }
}
