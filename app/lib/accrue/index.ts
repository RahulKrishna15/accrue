import type { TransactionSigner } from "@solana/kit";
import { kitClient } from "../wallet/kit-client";
import type { AccrueClient } from "./client";
import { createDevnetClient } from "./devnet/client";
import { createMockClient } from "./mock/client";

/** The connected wallet's signer; `kitClient.payer` throws while no wallet is connected. */
function connectedSigner(): TransactionSigner | null {
  try {
    return kitClient.payer;
  } catch {
    return null;
  }
}

/**
 * The single AccrueClient the app talks to: the deployed program on devnet.
 * Set NEXT_PUBLIC_ACCRUE_MODE=mock to run the simulated ledger instead (demo fallback).
 */
export const accrue: AccrueClient =
  process.env.NEXT_PUBLIC_ACCRUE_MODE === "mock"
    ? createMockClient()
    : createDevnetClient({
        rpc: kitClient.rpc,
        rpcSubscriptions: kitClient.rpcSubscriptions,
        getSigner: connectedSigner,
      });

export * from "./client";
export * from "./constants";
export * from "./errors";
export * from "./format";
export * from "./instructions";
export * from "./math";
export * from "./types";
