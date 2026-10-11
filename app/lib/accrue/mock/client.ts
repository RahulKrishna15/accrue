import type { Address } from "@solana/kit";
import type { AccrueClient, DemoState } from "../client";
import { TransactionDroppedError, WalletRejectedError, AccrueProgramError } from "../errors";
import type { AccrueEvent, Fund, HolderAccount, Position } from "../types";
import { mockAddress, mockSignature } from "./ids";
import { processTransaction, usdc, type LedgerState } from "./ledger";
import { DEMO_INVESTOR, DEMO_MANAGER, seedLedger } from "./seed";

// mock: in-memory AccrueClient with simulated wallet and network latency.

const STORAGE_KEY = "accrue-mock-ledger-v1";
const SIGN_MS = 1100;
const CONFIRM_MS = 1500;
const READ_MS = 280;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const replacer = (_: string, v: unknown) => (typeof v === "bigint" ? { $b: v.toString() } : v);
const reviver = (_: string, v: unknown) =>
  v && typeof v === "object" && "$b" in v && Object.keys(v).length === 1 ? BigInt((v as { $b: string }).$b) : v;

type Persisted = { ledger: LedgerState; demo: DemoState };

const defaultDemo = (): DemoState => ({ nextTx: "normal", wrongNetwork: false, clockOffsetMs: 0, demoWallet: null });

export function createMockClient(): AccrueClient {
  let data: Persisted | null = null;
  let counter = 0;
  const listeners = new Set<() => void>();

  const nowMs = () => Date.now() + (data?.demo.clockOffsetMs ?? 0);
  const nowSec = () => BigInt(Math.floor(nowMs() / 1000));

  function load(): Persisted {
    if (data) return data;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) data = JSON.parse(raw, reviver) as Persisted;
    } catch {
      data = null;
    }
    data ??= { ledger: seedLedger(BigInt(Math.floor(Date.now() / 1000))), demo: defaultDemo() };
    return data;
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data, replacer));
    } catch {
      // Storage unavailable (private mode); state stays in memory.
    }
  }

  function changed() {
    save();
    listeners.forEach((l) => l());
  }

  const ledger = () => load().ledger;
  const toFund = (mint: string): Fund | null => {
    const f = ledger().funds[mint];
    return f ? { ...f.config, metadata: f.metadata } : null;
  };
  const read = async <T>(fn: () => T): Promise<T> => {
    await wait(READ_MS);
    return fn();
  };

  return {
    mode: "mock",
    now: () => (load(), nowMs()),

    fetchAllFunds: () =>
      read(() =>
        Object.keys(ledger().funds)
          .map((m) => toFund(m)!)
          .sort((a, b) => Number(b.createdAt - a.createdAt)),
      ),
    fetchFund: (mint) => read(() => toFund(mint)),
    fetchHolder: (mint, owner) => read(() => ledger().holders[`${mint}:${owner}`] ?? null),
    fetchShareBalance: (mint, owner) => read(() => ledger().shares[`${mint}:${owner}`] ?? 0n),
    fetchUsdcBalance: (owner) => read(() => ledger().usdc[owner] ?? 0n),
    fetchPositions: (owner) =>
      read(() =>
        Object.values(ledger().holders)
          .filter((h: HolderAccount) => h.owner === owner)
          .map((holder): Position => ({
            holder,
            fund: toFund(holder.mint)!,
            balance: ledger().shares[`${holder.mint}:${owner}`] ?? 0n,
          }))
          .filter((p) => p.balance > 0n || p.holder.pending > 0n),
      ),
    fetchEvents: (filter) =>
      read(() =>
        ledger()
          .events.filter((e: AccrueEvent) => {
            if (filter?.mint && e.mint !== filter.mint) return false;
            if (filter?.wallet) {
              const w = filter.wallet;
              const touches =
                ("investor" in e && e.investor === w) ||
                ("owner" in e && e.owner === w) ||
                ("manager" in e && e.manager === w) ||
                ("from" in e && (e.from === w || e.to === w)) ||
                ledger().funds[e.mint]?.config.manager === w;
              if (!touches) return false;
            }
            return true;
          })
          .slice()
          .reverse(),
      ),

    generateMintAddress: () => mockAddress(`mint-${Date.now()}-${Math.random()}`),

    async send(ixs, { signer, onPhase }) {
      const mode = load().demo.nextTx;
      if (mode !== "normal") load().demo = { ...load().demo, nextTx: "normal" };
      onPhase?.("signing");
      await wait(SIGN_MS);
      if (mode === "reject") {
        changed();
        throw new WalletRejectedError();
      }
      const signature = mockSignature(`tx-${Date.now()}-${counter++}`);
      onPhase?.("confirming", signature);
      await wait(CONFIRM_MS);
      if (mode === "drop") {
        changed();
        throw new TransactionDroppedError(signature);
      }
      try {
        load().ledger = processTransaction(ledger(), ixs, signer, nowSec(), signature);
      } catch (e) {
        if (e instanceof AccrueProgramError) throw new AccrueProgramError(e.code, signature);
        throw e;
      }
      changed();
      return { signature };
    },

    subscribe(l) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },

    // Simulated signatures do not exist on chain, so there is nothing to link to yet.
    explorerTxUrl: () => null,
    explorerAddressUrl: () => null,

    async requestTestUsdc(owner: Address) {
      await wait(900);
      const l = ledger();
      l.usdc[owner] = (l.usdc[owner] ?? 0n) + usdc(10_000);
      changed();
      return { signature: mockSignature(`faucet-${Date.now()}`) };
    },

    demoWallets: [
      { address: DEMO_INVESTOR, label: "Demo investor", role: "Holds MTC, HSL and KSN shares" },
      { address: DEMO_MANAGER, label: "Demo manager", role: "Manages MTC, HSL and ALR" },
    ],

    demo: {
      getState: () => load().demo,
      set(patch) {
        load().demo = { ...load().demo, ...patch };
        changed();
      },
      skipAhead(ms) {
        load().demo = { ...load().demo, clockOffsetMs: load().demo.clockOffsetMs + ms };
        changed();
      },
      reset() {
        data = {
          ledger: seedLedger(BigInt(Math.floor(Date.now() / 1000))),
          demo: { ...defaultDemo(), demoWallet: load().demo.demoWallet },
        };
        changed();
      },
    },
  };
}
