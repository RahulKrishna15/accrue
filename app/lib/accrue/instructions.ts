import type { Address } from "@solana/kit";

/**
 * Instruction builders shaped like the Codama output for the Accrue IDL
 * (`getInvestInstruction({ ...accounts, ...args })`).
 * mock: these return plain descriptors the mock ledger executes. Once the
 * program exists, replace this file with re-exports from the generated client.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type NoArgs = {};

export type AccrueInstruction =
  | {
      name: "initializeFund";
      accounts: { manager: Address; mint: Address };
      args: {
        name: string;
        symbol: string;
        image: string;
        price: bigint;
        feeBps: number;
        minInvestment: bigint;
        sizeCap: bigint;
        streamPeriod: bigint;
      };
    }
  | { name: "initExtraAccountMetaList"; accounts: { payer: Address; mint: Address }; args: NoArgs }
  | { name: "invest"; accounts: { investor: Address; mint: Address }; args: { usdcAmount: bigint } }
  | { name: "registerHolder"; accounts: { payer: Address; mint: Address; owner: Address }; args: NoArgs }
  | { name: "depositRevenue"; accounts: { manager: Address; mint: Address }; args: { amount: bigint } }
  | { name: "claim"; accounts: { owner: Address; mint: Address }; args: NoArgs }
  | { name: "setPrice"; accounts: { manager: Address; mint: Address }; args: { price: bigint } }
  | { name: "setPaused"; accounts: { manager: Address; mint: Address }; args: { paused: boolean } }
  | { name: "closeFund"; accounts: { manager: Address; mint: Address }; args: NoArgs }
  /** Token-2022 TransferChecked with the hook's extra accounts resolved (Config, sender + receiver Holder). */
  | {
      name: "transferCheckedWithHook";
      accounts: { owner: Address; mint: Address; destinationOwner: Address };
      args: { amount: bigint };
    };

type Ix<N extends AccrueInstruction["name"]> = Extract<AccrueInstruction, { name: N }>;
type Input<N extends AccrueInstruction["name"]> = Ix<N>["accounts"] & Ix<N>["args"];

function build<N extends AccrueInstruction["name"]>(name: N, keys: (keyof Ix<N>["accounts"])[]) {
  return (input: Input<N>): Ix<N> => {
    const accounts: Record<string, unknown> = {};
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) ((keys as string[]).includes(k) ? accounts : args)[k] = v;
    return { name, accounts, args } as Ix<N>;
  };
}

export const getInitializeFundInstruction = build("initializeFund", ["manager", "mint"]);
export const getInitExtraAccountMetaListInstruction = build("initExtraAccountMetaList", ["payer", "mint"]);
export const getInvestInstruction = build("invest", ["investor", "mint"]);
export const getRegisterHolderInstruction = build("registerHolder", ["payer", "mint", "owner"]);
export const getDepositRevenueInstruction = build("depositRevenue", ["manager", "mint"]);
export const getClaimInstruction = build("claim", ["owner", "mint"]);
export const getSetPriceInstruction = build("setPrice", ["manager", "mint"]);
export const getSetPausedInstruction = build("setPaused", ["manager", "mint"]);
export const getCloseFundInstruction = build("closeFund", ["manager", "mint"]);
export const getTransferCheckedWithHookInstruction = build("transferCheckedWithHook", [
  "owner",
  "mint",
  "destinationOwner",
]);
