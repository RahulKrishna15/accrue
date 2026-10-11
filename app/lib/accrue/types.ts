import type { Address } from "@solana/kit";

/**
 * Mirrors the planned Config PDA `["config", mint]`.
 * Amounts are base units (6 decimals); timestamps are unix seconds.
 */
export type FundConfig = {
  address: Address;
  mint: Address;
  manager: Address;
  /** Manager's USDC account. Receives invested principal and fees. */
  treasury: Address;
  /** USDC income vault owned by the Config PDA. */
  vault: Address;
  /** USDC base units per 1 whole share. Applies to new investments only. */
  price: bigint;
  feeBps: number;
  minInvestment: bigint;
  /** Maximum USDC the fund will accept in total. */
  sizeCap: bigint;
  /** Seconds each deposit streams over. */
  streamPeriod: bigint;
  totalSupply: bigint;
  totalRaised: bigint;
  accPerToken: bigint;
  streamRemaining: bigint;
  streamEnd: bigint;
  lastUpdate: bigint;
  totalIncome: bigint;
  totalFees: bigint;
  totalClaimed: bigint;
  paused: boolean;
  closed: boolean;
  createdAt: bigint;
};

/** Token-2022 TokenMetadata on the share mint. */
export type FundMetadata = {
  name: string;
  symbol: string;
  /** Logo image URL (empty when none was set). */
  image: string;
};

export type Fund = FundConfig & { metadata: FundMetadata };

/** Mirrors the planned Holder PDA `["holder", mint, owner]`. */
export type HolderAccount = {
  address: Address;
  mint: Address;
  owner: Address;
  lastAcc: bigint;
  pending: bigint;
  totalClaimed: bigint;
  totalInvested: bigint;
};

/** A wallet's stake in one fund: Holder PDA joined with its share balance. */
export type Position = {
  fund: Fund;
  holder: HolderAccount;
  balance: bigint;
};

type EventBase = { signature: string; timestamp: bigint; mint: Address };

/** Program events (emitted via logs; the app reads them without an indexer). */
export type AccrueEvent = EventBase &
  (
    | { kind: "FundInitialized"; manager: Address; price: bigint; feeBps: number }
    | { kind: "HolderRegistered"; owner: Address }
    | { kind: "Invested"; investor: Address; usdc: bigint; shares: bigint; price: bigint }
    | { kind: "RevenueDeposited"; gross: bigint; fee: bigint; net: bigint; streamEnd: bigint }
    | { kind: "Claimed"; owner: Address; amount: bigint }
    | { kind: "Transferred"; from: Address; to: Address; amount: bigint }
    | { kind: "PriceChanged"; oldPrice: bigint; newPrice: bigint }
    | { kind: "PausedSet"; paused: boolean }
    | { kind: "FundClosed" }
  );

export type AccrueEventKind = AccrueEvent["kind"];
