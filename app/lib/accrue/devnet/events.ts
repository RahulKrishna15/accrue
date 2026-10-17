import { getBase64Encoder, type Address, type Rpc, type Signature, type SolanaRpcApi } from "@solana/kit";
import {
  ACCRUE_PROGRAM_ADDRESS,
  AccrueEvent as EventId,
  getClaimedEventDecoder,
  getFundClosedEventDecoder,
  getFundInitializedEventDecoder,
  getHolderRegisteredEventDecoder,
  getInvestedEventDecoder,
  getPausedSetEventDecoder,
  getPriceChangedEventDecoder,
  getRevenueDepositedEventDecoder,
  getTransferredEventDecoder,
  identifyAccrueEvent,
} from "../generated";
import type { AccrueEvent } from "../types";

/** How many recent transactions the feed reads per address (public devnet rate-limits bursts). */
const PAGE = 50;
const CONCURRENCY = 4;

const decoders = {
  [EventId.Claimed]: getClaimedEventDecoder,
  [EventId.FundClosed]: getFundClosedEventDecoder,
  [EventId.FundInitialized]: getFundInitializedEventDecoder,
  [EventId.HolderRegistered]: getHolderRegisteredEventDecoder,
  [EventId.Invested]: getInvestedEventDecoder,
  [EventId.PausedSet]: getPausedSetEventDecoder,
  [EventId.PriceChanged]: getPriceChangedEventDecoder,
  [EventId.RevenueDeposited]: getRevenueDepositedEventDecoder,
  [EventId.Transferred]: getTransferredEventDecoder,
};

/**
 * Reads Accrue events out of transaction logs. Anchor's `emit!` writes each event as a
 * `Program data: <base64>` line; only lines written while Accrue is the running program
 * are decoded (it also runs as the transfer hook, nested under Token-2022).
 */
export function parseEventsFromLogs(logs: readonly string[], signature: string): AccrueEvent[] {
  const stack: string[] = [];
  const events: AccrueEvent[] = [];
  for (const line of logs) {
    const invoke = /^Program (\w+) invoke \[\d+\]$/.exec(line);
    if (invoke) {
      stack.push(invoke[1]);
    } else if (/^Program \w+ (success|failed)/.test(line)) {
      stack.pop();
    } else if (line.startsWith("Program data: ") && stack.at(-1) === ACCRUE_PROGRAM_ADDRESS) {
      const data = getBase64Encoder().encode(line.slice("Program data: ".length).split(" ")[0]);
      let id: EventId;
      try {
        id = identifyAccrueEvent(data);
      } catch {
        continue;
      }
      const decoded = decoders[id]().decode(data);
      events.push({ kind: EventId[id], signature, ...decoded } as AccrueEvent);
    }
  }
  return events;
}

/** Event list for an address, newest first, with parsed transactions cached by signature. */
export function createEventReader(rpc: Rpc<SolanaRpcApi>) {
  const cache = new Map<string, AccrueEvent[]>();

  async function load(signature: Signature): Promise<void> {
    const tx = await rpc
      .getTransaction(signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
      .send();
    // Not visible yet: leave it uncached so the next refresh tries again.
    if (!tx?.meta?.logMessages) return;
    cache.set(signature, parseEventsFromLogs(tx.meta.logMessages, signature));
  }

  return async function eventsFor(address: Address): Promise<AccrueEvent[]> {
    const sigs = await rpc.getSignaturesForAddress(address, { limit: PAGE, commitment: "confirmed" }).send();
    const ok = sigs.filter((s) => s.err === null).map((s) => s.signature);
    const missing = ok.filter((s) => !cache.has(s));
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      // A failed fetch (e.g. a 429) skips that transaction until the next refresh.
      await Promise.allSettled(missing.slice(i, i + CONCURRENCY).map(load));
    }
    // Signatures come newest first; events inside one transaction are in log order.
    return ok.flatMap((s) => (cache.get(s) ?? []).slice().reverse());
  };
}
