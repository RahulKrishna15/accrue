import type { Address } from "@solana/kit";
import { SECONDS_PER_DAY } from "../constants";
import * as ix from "../instructions";
import type { AccrueInstruction } from "../instructions";
import { mockAddress, mockSignature } from "./ids";
import { emptyLedger, processTransaction, shareUnits, usdc, type LedgerState } from "./ledger";

// mock: sample funds, holders and history replayed through the mock program.

export const DEMO_INVESTOR = mockAddress("demo-investor");
export const DEMO_MANAGER = mockAddress("demo-manager");
const KESTREL_MANAGER = mockAddress("kestrel-manager");
const inv = (n: number) => mockAddress(`investor-${n}`);

const MTC = mockAddress("mint-meridian");
const HSL = mockAddress("mint-harbor");
const KSN = mockAddress("mint-kestrel");
const ALR = mockAddress("mint-alder");

const DAYS30 = 30n * SECONDS_PER_DAY;

type Step = { day: number; signer: Address; ixs: AccrueInstruction[] };

function fund(
  mint: Address,
  manager: Address,
  name: string,
  symbol: string,
  o: { price: number; feeBps: number; min: number; cap: number; period?: bigint },
): AccrueInstruction[] {
  return [
    ix.getInitializeFundInstruction({
      manager,
      mint,
      name,
      symbol,
      image: "",
      price: usdc(o.price),
      feeBps: o.feeBps,
      minInvestment: usdc(o.min),
      sizeCap: usdc(o.cap),
      streamPeriod: o.period ?? DAYS30,
    }),
    ix.getInitExtraAccountMetaListInstruction({ payer: manager, mint }),
  ];
}

const invest = (day: number, investor: Address, mint: Address, amount: number): Step => ({
  day,
  signer: investor,
  ixs: [ix.getInvestInstruction({ investor, mint, usdcAmount: usdc(amount) })],
});

const deposit = (day: number, manager: Address, mint: Address, amount: number): Step => ({
  day,
  signer: manager,
  ixs: [ix.getDepositRevenueInstruction({ manager, mint, amount: usdc(amount) })],
});

const steps: Step[] = [
  // Meridian Trade Credit: open, streaming income, the demo investor's main holding.
  { day: -64, signer: DEMO_MANAGER, ixs: fund(MTC, DEMO_MANAGER, "Meridian Trade Credit", "MTC", { price: 1, feeBps: 500, min: 100, cap: 2_500_000 }) },
  invest(-61, inv(1), MTC, 412_500),
  invest(-58, DEMO_INVESTOR, MTC, 25_000),
  invest(-52, inv(2), MTC, 186_250),
  deposit(-44, DEMO_MANAGER, MTC, 9_860),
  invest(-40, inv(3), MTC, 93_400),
  invest(-33, inv(4), MTC, 61_750),
  { day: -30, signer: DEMO_MANAGER, ixs: [ix.getSetPriceInstruction({ manager: DEMO_MANAGER, mint: MTC, price: usdc(1.02) })] },
  {
    day: -20,
    signer: DEMO_INVESTOR,
    ixs: [
      ix.getRegisterHolderInstruction({ payer: DEMO_INVESTOR, mint: MTC, owner: inv(5) }),
      ix.getTransferCheckedWithHookInstruction({ owner: DEMO_INVESTOR, mint: MTC, destinationOwner: inv(5), amount: shareUnits(4_000) }),
    ],
  },
  deposit(-14, DEMO_MANAGER, MTC, 10_415.5),
  { day: -9, signer: DEMO_INVESTOR, ixs: [ix.getClaimInstruction({ owner: DEMO_INVESTOR, mint: MTC })] },
  invest(-6, inv(6), MTC, 48_960),

  // Harbor SME Lending: paused by its manager.
  { day: -95, signer: DEMO_MANAGER, ixs: fund(HSL, DEMO_MANAGER, "Harbor SME Lending", "HSL", { price: 1, feeBps: 800, min: 500, cap: 1_000_000 }) },
  invest(-90, inv(2), HSL, 220_000),
  invest(-80, DEMO_INVESTOR, HSL, 12_000),
  invest(-70, inv(7), HSL, 147_300),
  deposit(-21, DEMO_MANAGER, HSL, 6_240),
  { day: -3, signer: DEMO_MANAGER, ixs: [ix.getSetPausedInstruction({ manager: DEMO_MANAGER, mint: HSL, paused: true })] },

  // Kestrel Solar Notes: filled to its cap and closed; income keeps streaming quarterly.
  { day: -130, signer: KESTREL_MANAGER, ixs: fund(KSN, KESTREL_MANAGER, "Kestrel Solar Notes", "KSN", { price: 10, feeBps: 300, min: 1_000, cap: 750_000, period: 90n * SECONDS_PER_DAY }) },
  invest(-126, inv(1), KSN, 400_000),
  invest(-118, inv(8), KSN, 230_000),
  invest(-101, DEMO_INVESTOR, KSN, 120_000),
  { day: -35, signer: KESTREL_MANAGER, ixs: [ix.getCloseFundInstruction({ manager: KESTREL_MANAGER, mint: KSN })] },
  deposit(-11, KESTREL_MANAGER, KSN, 14_720),

  // Alder Receivables: new, no income deposited yet.
  { day: -2, signer: DEMO_MANAGER, ixs: fund(ALR, DEMO_MANAGER, "Alder Receivables", "ALR", { price: 1, feeBps: 650, min: 250, cap: 500_000 }) },
  invest(-1, inv(3), ALR, 18_500),
];

export function seedLedger(nowSec: bigint): LedgerState {
  let s = emptyLedger();
  for (const a of [DEMO_INVESTOR, DEMO_MANAGER, KESTREL_MANAGER, ...Array.from({ length: 8 }, (_, i) => inv(i + 1))]) {
    s.usdc[a] = usdc(1_000_000);
  }
  steps
    .slice()
    .sort((a, b) => a.day - b.day)
    .forEach((step, i) => {
      // Spread same-day steps across the day so ordering is stable.
      const t = nowSec + BigInt(step.day) * SECONDS_PER_DAY + BigInt(i * 97);
      s = processTransaction(s, step.ixs, step.signer, t, mockSignature(`seed-${i}`));
    });
  s.usdc[DEMO_INVESTOR] = usdc(8_450);
  s.usdc[DEMO_MANAGER] = usdc(42_300);
  return s;
}
