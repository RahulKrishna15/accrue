import type { Address } from "@solana/kit";
import type { AccrueInstruction } from "./instructions";
import type { AccrueEvent, Fund, HolderAccount, Position } from "./types";

export type TxPhase = "signing" | "confirming";

export type SendOptions = {
  /** Wallet that signs and pays. */
  signer: Address;
  onPhase?: (phase: TxPhase, signature?: string) => void;
};

/** A wallet the app can connect without a browser extension (mock only). */
export type DemoWallet = { address: Address; label: string; role: string };

/**
 * Everything the UI reads from or writes to the chain goes through this interface.
 * The mock implements it in memory; the real one wraps the Codama client and
 * a Kit `client.sendTransaction`.
 */
export interface AccrueClient {
  readonly mode: "mock" | "devnet";
  /** Chain clock in milliseconds. */
  now(): number;
  fetchAllFunds(): Promise<Fund[]>;
  fetchFund(mint: Address): Promise<Fund | null>;
  fetchHolder(mint: Address, owner: Address): Promise<HolderAccount | null>;
  fetchShareBalance(mint: Address, owner: Address): Promise<bigint>;
  fetchPositions(owner: Address): Promise<Position[]>;
  fetchUsdcBalance(owner: Address): Promise<bigint>;
  fetchEvents(filter?: { mint?: Address; wallet?: Address }): Promise<AccrueEvent[]>;
  /** Fresh keypair address for a new share mint. */
  generateMintAddress(): Promise<Address>;
  send(instructions: AccrueInstruction[], options: SendOptions): Promise<{ signature: string }>;
  /** Fires after any account the app reads may have changed. */
  subscribe(listener: () => void): () => void;
  explorerTxUrl(signature: string): string | null;
  explorerAddressUrl(address: Address): string | null;
  /** Optional Test USDC faucet. */
  requestTestUsdc?(owner: Address): Promise<{ signature: string }>;
  demoWallets?: DemoWallet[];
  demo?: DemoControls;
}

export type DemoControls = {
  getState(): DemoState;
  set(patch: Partial<Omit<DemoState, "clockOffsetMs">>): void;
  skipAhead(ms: number): void;
  reset(): void;
};

export type DemoState = {
  nextTx: "normal" | "reject" | "drop";
  wrongNetwork: boolean;
  clockOffsetMs: number;
  demoWallet: Address | null;
};
