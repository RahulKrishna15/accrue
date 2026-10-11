import { ACC_PRECISION, BPS_DENOMINATOR, SHARE_UNIT } from "./constants";
import type { FundConfig, HolderAccount } from "./types";

/**
 * Income math shared by the (mock) program and the UI.
 * Every division rounds down, so the vault can never owe more than it holds.
 * `now` must be in the same unit as the state's timestamps (seconds on chain,
 * milliseconds for UI projections via `toMillis`).
 */
export type StreamState = Pick<
  FundConfig,
  "accPerToken" | "streamRemaining" | "streamEnd" | "lastUpdate" | "totalSupply"
>;

/** Release the streamed income up to `now` into `accPerToken`. */
export function accrue<S extends StreamState>(s: S, now: bigint): S {
  if (now <= s.lastUpdate) return s;
  // Nobody to pay: hold the remainder and spread it over what is left of the window.
  if (s.streamRemaining === 0n || s.totalSupply === 0n) return { ...s, lastUpdate: now };
  const released =
    now >= s.streamEnd
      ? s.streamRemaining
      : (s.streamRemaining * (now - s.lastUpdate)) / (s.streamEnd - s.lastUpdate);
  const accDelta = (released * ACC_PRECISION) / s.totalSupply;
  return {
    ...s,
    accPerToken: s.accPerToken + accDelta,
    streamRemaining: s.streamRemaining - released,
    lastUpdate: now,
  };
}

/** earned = tokens x (acc now - last_acc) */
export function earned(balance: bigint, lastAcc: bigint, acc: bigint): bigint {
  return (balance * (acc - lastAcc)) / ACC_PRECISION;
}

/** Bring a holder up to date with the fund accumulator. */
export function settle<H extends Pick<HolderAccount, "lastAcc" | "pending">>(
  h: H,
  balance: bigint,
  acc: bigint,
): H {
  return { ...h, pending: h.pending + earned(balance, h.lastAcc, acc), lastAcc: acc };
}

/** tokens = USDC / price */
export function sharesForUsdc(usdc: bigint, price: bigint): bigint {
  if (price <= 0n) return 0n;
  return (usdc * SHARE_UNIT) / price;
}

export function splitFee(gross: bigint, feeBps: number): { fee: bigint; net: bigint } {
  const fee = (gross * BigInt(feeBps)) / BPS_DENOMINATOR;
  return { fee, net: gross - fee };
}

/**
 * A new deposit restarts the stream: unreleased income from the previous
 * deposit is added to the new amount and both stream over a fresh period.
 */
export function startStream<S extends StreamState>(s: S, net: bigint, now: bigint, period: bigint): S {
  const a = accrue(s, now);
  return { ...a, streamRemaining: a.streamRemaining + net, streamEnd: now + period, lastUpdate: now };
}

export function toMillis<S extends StreamState>(s: S): S {
  return { ...s, streamEnd: s.streamEnd * 1000n, lastUpdate: s.lastUpdate * 1000n };
}

/** Claimable income for a holder at `nowMs`, projected client-side. */
export function projectPending(
  fund: StreamState,
  holder: Pick<HolderAccount, "lastAcc" | "pending">,
  balance: bigint,
  nowMs: number,
): bigint {
  const s = accrue(toMillis(fund), BigInt(Math.floor(nowMs)));
  return holder.pending + earned(balance, holder.lastAcc, s.accPerToken);
}

/** Income per day the whole fund is releasing right now (base units). */
export function fundDailyRate(fund: StreamState, nowSec: bigint): bigint {
  if (fund.streamRemaining === 0n || nowSec >= fund.streamEnd) return 0n;
  const from = nowSec > fund.lastUpdate ? nowSec : fund.lastUpdate;
  const left = accrue(fund, from).streamRemaining;
  return (left * 86_400n) / (fund.streamEnd - from);
}

/** A holder's share of the fund's current daily rate. */
export function holderDailyRate(fund: StreamState, balance: bigint, nowSec: bigint): bigint {
  if (fund.totalSupply === 0n) return 0n;
  return (fundDailyRate(fund, nowSec) * balance) / fund.totalSupply;
}

export function streamProgress(fund: Pick<FundConfig, "streamEnd" | "streamPeriod">, nowSec: bigint): number {
  if (fund.streamEnd === 0n) return 0;
  const start = fund.streamEnd - fund.streamPeriod;
  if (nowSec >= fund.streamEnd) return 1;
  if (nowSec <= start) return 0;
  return Number(nowSec - start) / Number(fund.streamPeriod);
}
