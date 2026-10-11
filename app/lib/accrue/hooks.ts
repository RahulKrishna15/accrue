"use client";

import type { Address } from "@solana/kit";
import { useCallback, useState } from "react";
import { describeError } from "./errors";
import { accrue } from "./index";
import type { AccrueInstruction } from "./instructions";
import { useAccrueQuery, useClientSnapshot } from "./query";

export { useClientSnapshot };

export const useFunds = () => useAccrueQuery("funds", () => accrue.fetchAllFunds());

export const useFund = (mint: Address | null) =>
  useAccrueQuery(mint ? `fund:${mint}` : null, () => accrue.fetchFund(mint!));

export const usePositions = (owner: Address | null) =>
  useAccrueQuery(owner ? `positions:${owner}` : null, () => accrue.fetchPositions(owner!));

export const useHolder = (mint: Address | null, owner: Address | null) =>
  useAccrueQuery(mint && owner ? `holder:${mint}:${owner}` : null, () => accrue.fetchHolder(mint!, owner!));

export const useShareBalance = (mint: Address | null, owner: Address | null) =>
  useAccrueQuery(mint && owner ? `shares:${mint}:${owner}` : null, () => accrue.fetchShareBalance(mint!, owner!));

export const useUsdcBalance = (owner: Address | null) =>
  useAccrueQuery(owner ? `usdc:${owner}` : null, () => accrue.fetchUsdcBalance(owner!));

export const useEvents = (filter: { mint?: Address; wallet?: Address } | null) =>
  useAccrueQuery(filter ? `events:${filter.mint ?? "*"}:${filter.wallet ?? "*"}` : null, () =>
    accrue.fetchEvents(filter!),
  );

/** Chain clock in ms; re-reads when the demo clock is moved. */
export const useChainClockOffset = () =>
  useClientSnapshot(() => (accrue.demo ? accrue.demo.getState().clockOffsetMs : 0), 0);

export type TxState =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "confirming"; signature?: string }
  | { phase: "success"; signature: string }
  | { phase: "error"; title: string; detail: string; signature?: string };

/** Drives one action through signing, confirming, then success or failure. */
export function useTransaction() {
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(async (signer: Address, instructions: AccrueInstruction[]) => {
    try {
      const { signature } = await accrue.send(instructions, {
        signer,
        onPhase: (phase, signature) => setState(phase === "signing" ? { phase } : { phase, signature }),
      });
      setState({ phase: "success", signature });
      return true;
    } catch (e) {
      const sig = (e as { signature?: string }).signature;
      setState({ phase: "error", ...describeError(e), signature: sig });
      return false;
    }
  }, []);

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  const busy = state.phase === "signing" || state.phase === "confirming";
  return { state, run, reset, busy };
}
