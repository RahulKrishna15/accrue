import type { Address } from "@solana/kit";
import { SHARE_UNIT } from "../constants";
import { AccrueProgramError, type AccrueErrorCode } from "../errors";
import type { AccrueInstruction } from "../instructions";
import { accrue, settle, sharesForUsdc, splitFee, startStream } from "../math";
import { MAX_FEE_BPS } from "../constants";
import type { AccrueEvent, FundConfig, FundMetadata, HolderAccount } from "../types";
import { mockAddress } from "./ids";

/**
 * mock: an in-memory stand-in for the Accrue program and the token accounts it touches.
 * Instruction handlers follow the planned on-chain logic so the UI exercises the same rules.
 */
export type LedgerState = {
  funds: Record<string, { config: FundConfig; metadata: FundMetadata }>;
  holders: Record<string, HolderAccount>;
  shares: Record<string, bigint>;
  usdc: Record<string, bigint>;
  vaults: Record<string, bigint>;
  treasuries: Record<string, bigint>;
  events: AccrueEvent[];
};

export const emptyLedger = (): LedgerState => ({
  funds: {},
  holders: {},
  shares: {},
  usdc: {},
  vaults: {},
  treasuries: {},
  events: [],
});

const key = (mint: string, owner: string) => `${mint}:${owner}`;
const fail = (code: AccrueErrorCode): never => {
  throw new AccrueProgramError(code);
};

function requireFund(s: LedgerState, mint: Address) {
  return s.funds[mint] ?? fail(6008);
}

function requireManager(config: FundConfig, signer: Address) {
  if (config.manager !== signer) fail(6005);
}

function debit(book: Record<string, bigint>, k: string, amount: bigint) {
  if ((book[k] ?? 0n) < amount) fail(6014);
  book[k] = (book[k] ?? 0n) - amount;
}

const credit = (book: Record<string, bigint>, k: string, amount: bigint) => {
  book[k] = (book[k] ?? 0n) + amount;
};

/** Bring the fund to `now`, then settle a holder against its pre-change balance. */
function touch(s: LedgerState, mint: Address, owner: Address, balance: bigint, now: bigint) {
  const f = s.funds[mint];
  f.config = accrue(f.config, now);
  const h = s.holders[key(mint, owner)];
  if (h) s.holders[key(mint, owner)] = settle(h, balance, f.config.accPerToken);
}

function newHolder(s: LedgerState, mint: Address, owner: Address): HolderAccount {
  const h: HolderAccount = {
    address: mockAddress(`holder:${mint}:${owner}`),
    mint,
    owner,
    lastAcc: s.funds[mint].config.accPerToken,
    pending: 0n,
    totalClaimed: 0n,
    totalInvested: 0n,
  };
  s.holders[key(mint, owner)] = h;
  return h;
}

/** Execute one transaction atomically. Throws AccrueProgramError and leaves `s` untouched on failure. */
export function processTransaction(
  prev: LedgerState,
  ixs: AccrueInstruction[],
  signer: Address,
  now: bigint,
  signature: string,
): LedgerState {
  const s = structuredClone(prev);
  const emit = (mint: Address, e: DistributiveOmit<AccrueEvent, "signature" | "timestamp" | "mint">) =>
    s.events.push({ ...e, mint, signature, timestamp: now } as AccrueEvent);

  for (const ix of ixs) {
    switch (ix.name) {
      case "initializeFund": {
        const { mint, manager } = ix.accounts;
        const a = ix.args;
        if (manager !== signer) fail(6005);
        if (a.feeBps > MAX_FEE_BPS) fail(6004);
        if (a.price <= 0n) fail(6007);
        if (a.streamPeriod < 3600n) fail(6013);
        if (a.sizeCap <= 0n) fail(6008);
        s.funds[mint] = {
          metadata: { name: a.name, symbol: a.symbol, image: a.image },
          config: {
            address: mockAddress(`config:${mint}`),
            mint,
            manager,
            treasury: mockAddress(`treasury:${mint}`),
            vault: mockAddress(`vault:${mint}`),
            price: a.price,
            feeBps: a.feeBps,
            minInvestment: a.minInvestment,
            sizeCap: a.sizeCap,
            streamPeriod: a.streamPeriod,
            totalSupply: 0n,
            totalRaised: 0n,
            accPerToken: 0n,
            streamRemaining: 0n,
            streamEnd: 0n,
            lastUpdate: now,
            totalIncome: 0n,
            totalFees: 0n,
            totalClaimed: 0n,
            paused: false,
            closed: false,
            createdAt: now,
          },
        };
        emit(mint, { kind: "FundInitialized", manager, price: a.price, feeBps: a.feeBps });
        break;
      }
      case "initExtraAccountMetaList":
        requireFund(s, ix.accounts.mint);
        break;
      case "registerHolder": {
        const { mint, owner } = ix.accounts;
        requireFund(s, mint);
        if (s.holders[key(mint, owner)]) fail(6010);
        s.funds[mint].config = accrue(s.funds[mint].config, now);
        newHolder(s, mint, owner);
        emit(mint, { kind: "HolderRegistered", owner });
        break;
      }
      case "invest": {
        const { mint, investor } = ix.accounts;
        const { usdcAmount } = ix.args;
        const c = requireFund(s, mint).config;
        if (c.paused) fail(6000);
        if (c.closed) fail(6001);
        if (usdcAmount <= 0n) fail(6008);
        if (usdcAmount < c.minInvestment) fail(6002);
        if (c.totalRaised + usdcAmount > c.sizeCap) fail(6003);
        const shares = sharesForUsdc(usdcAmount, c.price);
        if (shares === 0n) fail(6008);
        const k = key(mint, investor);
        const fresh = !s.holders[k];
        if (fresh) {
          s.funds[mint].config = accrue(s.funds[mint].config, now);
          newHolder(s, mint, investor);
          emit(mint, { kind: "HolderRegistered", owner: investor });
        } else {
          touch(s, mint, investor, s.shares[k] ?? 0n, now);
        }
        // Principal goes to the treasury, never the income vault.
        debit(s.usdc, investor, usdcAmount);
        credit(s.treasuries, mint, usdcAmount);
        credit(s.shares, k, shares);
        const f = s.funds[mint];
        f.config = { ...f.config, totalSupply: f.config.totalSupply + shares, totalRaised: f.config.totalRaised + usdcAmount };
        s.holders[k] = { ...s.holders[k], totalInvested: s.holders[k].totalInvested + usdcAmount };
        emit(mint, { kind: "Invested", investor, usdc: usdcAmount, shares, price: c.price });
        break;
      }
      case "depositRevenue": {
        const { mint, manager } = ix.accounts;
        const { amount } = ix.args;
        const f = requireFund(s, mint);
        requireManager(f.config, signer);
        if (f.config.paused) fail(6000);
        if (amount <= 0n) fail(6008);
        if (f.config.totalSupply === 0n) fail(6012);
        const { fee, net } = splitFee(amount, f.config.feeBps);
        debit(s.usdc, manager, amount);
        credit(s.treasuries, mint, fee);
        credit(s.vaults, mint, net);
        const c = startStream(f.config, net, now, f.config.streamPeriod);
        f.config = { ...c, totalIncome: c.totalIncome + net, totalFees: c.totalFees + fee };
        emit(mint, { kind: "RevenueDeposited", gross: amount, fee, net, streamEnd: c.streamEnd });
        break;
      }
      case "claim": {
        // Never blocked by pause or close.
        const { mint, owner } = ix.accounts;
        requireFund(s, mint);
        const k = key(mint, owner);
        if (!s.holders[k]) fail(6009);
        touch(s, mint, owner, s.shares[k] ?? 0n, now);
        const amount = s.holders[k].pending;
        if (amount === 0n) fail(6006);
        debit(s.vaults, mint, amount);
        credit(s.usdc, owner, amount);
        s.holders[k] = { ...s.holders[k], pending: 0n, totalClaimed: s.holders[k].totalClaimed + amount };
        const f = s.funds[mint];
        f.config = { ...f.config, totalClaimed: f.config.totalClaimed + amount };
        emit(mint, { kind: "Claimed", owner, amount });
        break;
      }
      case "setPrice": {
        const f = requireFund(s, ix.accounts.mint);
        requireManager(f.config, signer);
        if (ix.args.price <= 0n) fail(6007);
        emit(ix.accounts.mint, { kind: "PriceChanged", oldPrice: f.config.price, newPrice: ix.args.price });
        f.config = { ...f.config, price: ix.args.price };
        break;
      }
      case "setPaused": {
        const f = requireFund(s, ix.accounts.mint);
        requireManager(f.config, signer);
        f.config = { ...accrue(f.config, now), paused: ix.args.paused };
        emit(ix.accounts.mint, { kind: "PausedSet", paused: ix.args.paused });
        break;
      }
      case "closeFund": {
        const f = requireFund(s, ix.accounts.mint);
        requireManager(f.config, signer);
        if (f.config.closed) fail(6001);
        f.config = { ...f.config, closed: true };
        emit(ix.accounts.mint, { kind: "FundClosed" });
        break;
      }
      case "transferCheckedWithHook": {
        const { mint, owner, destinationOwner } = ix.accounts;
        const { amount } = ix.args;
        const f = requireFund(s, mint);
        if (amount <= 0n) fail(6008);
        const from = key(mint, owner);
        const to = key(mint, destinationOwner);
        // Token-2022 moves the tokens first...
        debit(s.shares, from, amount);
        credit(s.shares, to, amount);
        // ...then calls `execute`, which rebuilds pre-transfer balances.
        if (f.config.paused) fail(6000);
        if (!s.holders[from] || !s.holders[to]) fail(6009);
        touch(s, mint, owner, s.shares[from] + amount, now);
        touch(s, mint, destinationOwner, s.shares[to] - amount, now);
        emit(mint, { kind: "Transferred", from: owner, to: destinationOwner, amount });
        break;
      }
    }
  }
  return s;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const usdc = (whole: number) => BigInt(Math.round(whole * 1_000_000));
export const shareUnits = (whole: number) => BigInt(whole) * SHARE_UNIT;
