import { SECONDS_PER_DAY, SHARE_UNIT, USDC_UNIT } from "./constants";
import { accrue, earned, settle, startStream, type StreamState } from "./math";

/**
 * Worked examples rendered on the landing page. They run the same accrual
 * math as the program, so the numbers on screen are computed, not typed in.
 */

export type SplitHolder = "Alice" | "Bob" | "Charlie";
export type SplitDay = {
  day: number;
  balances: Record<SplitHolder, number>;
  /** Income earned so far, in base units. */
  earned: Record<SplitHolder, bigint>;
};
export type SplitTransfer = { day: number; from: SplitHolder; to: SplitHolder; tokens: number };

/** $3,000 over 30 days, 100 tokens. Alice sends 30 to Bob on day 10 and 20 to Charlie on day 20. */
export const FAIR_SPLIT_TRANSFERS: SplitTransfer[] = [
  { day: 10, from: "Alice", to: "Bob", tokens: 30 },
  { day: 20, from: "Alice", to: "Charlie", tokens: 20 },
];
export const FAIR_SPLIT_DEPOSIT = 3_000n * USDC_UNIT;

export function fairSplitTimeline(): SplitDay[] {
  const names: SplitHolder[] = ["Alice", "Bob", "Charlie"];
  const bal: Record<SplitHolder, bigint> = { Alice: 100n * SHARE_UNIT, Bob: 0n, Charlie: 0n };
  const h = Object.fromEntries(names.map((n) => [n, { lastAcc: 0n, pending: 0n }])) as Record<
    SplitHolder,
    { lastAcc: bigint; pending: bigint }
  >;
  let fund: StreamState = {
    accPerToken: 0n,
    streamRemaining: 0n,
    streamEnd: 0n,
    lastUpdate: 0n,
    totalSupply: 100n * SHARE_UNIT,
  };
  fund = startStream(fund, FAIR_SPLIT_DEPOSIT, 0n, 30n * SECONDS_PER_DAY);

  const out: SplitDay[] = [];
  for (let day = 0; day <= 30; day++) {
    const t = BigInt(day) * SECONDS_PER_DAY;
    fund = accrue(fund, t);
    for (const tr of FAIR_SPLIT_TRANSFERS.filter((x) => x.day === day)) {
      // The hook settles both sides at their pre-transfer balances, then tokens move.
      h[tr.from] = settle(h[tr.from], bal[tr.from], fund.accPerToken);
      h[tr.to] = settle(h[tr.to], bal[tr.to], fund.accPerToken);
      bal[tr.from] -= BigInt(tr.tokens) * SHARE_UNIT;
      bal[tr.to] += BigInt(tr.tokens) * SHARE_UNIT;
    }
    out.push({
      day,
      balances: Object.fromEntries(names.map((n) => [n, Number(bal[n] / SHARE_UNIT)])) as Record<SplitHolder, number>,
      earned: Object.fromEntries(
        names.map((n) => [n, h[n].pending + earned(bal[n], h[n].lastAcc, fund.accPerToken)]),
      ) as Record<SplitHolder, bigint>,
    });
  }
  return out;
}

/**
 * Sample position for the landing hero: 25,000 shares of an 840,000-share fund,
 * 11 days into a 30-day stream of $9,367 net income. Sample data, not a real fund.
 * Time is relative to the stream start (t = 0), so it renders the same on the server.
 */
export const SAMPLE_ELAPSED_MS = 11 * 86_400_000;

export function samplePosition() {
  const fund = startStream(
    { accPerToken: 0n, streamRemaining: 0n, streamEnd: 0n, lastUpdate: 0n, totalSupply: 840_000n * SHARE_UNIT },
    9_367n * USDC_UNIT,
    0n,
    30n * SECONDS_PER_DAY,
  );
  return {
    fund: { ...fund, streamPeriod: 30n * SECONDS_PER_DAY },
    holder: { lastAcc: 0n, pending: 0n },
    balance: 25_000n * SHARE_UNIT,
    symbol: "MTC",
    name: "Sample private-credit fund",
  };
}
