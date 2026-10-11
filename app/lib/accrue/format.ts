import { USDC_DECIMALS } from "./constants";

const grouping = new Intl.NumberFormat("en-US");

/** Format base units with `shown` decimals, always rounding down. */
export function formatUnits(base: bigint, shown = 2, decimals = USDC_DECIMALS): string {
  const neg = base < 0n;
  const abs = neg ? -base : base;
  const unit = 10n ** BigInt(decimals);
  const whole = grouping.format(abs / unit);
  if (shown === 0) return `${neg ? "-" : ""}${whole}`;
  const frac = (abs % unit).toString().padStart(decimals, "0").slice(0, shown).padEnd(shown, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export const formatUsdc = (base: bigint, shown = 2) => `$${formatUnits(base, shown)}`;

/** Parse a user-typed decimal into base units, truncating extra digits. Returns null if invalid. */
export function parseUnits(input: string, decimals = USDC_DECIMALS): bigint | null {
  const v = input.trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(v) || v === "" || v === ".") return null;
  const [w, f = ""] = v.split(".");
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt((f.slice(0, decimals) || "0").padEnd(decimals, "0"));
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function shortAddress(a: string, n = 4): string {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (sec: bigint) => dateFmt.format(new Date(Number(sec) * 1000));
export const formatDateTime = (sec: bigint) => dateTimeFmt.format(new Date(Number(sec) * 1000));

export function formatDuration(sec: bigint): string {
  const d = Number(sec) / 86_400;
  if (d >= 1) return `${Number.isInteger(d) ? d : d.toFixed(1)} day${d === 1 ? "" : "s"}`;
  const h = Math.max(1, Math.round(Number(sec) / 3600));
  return `${h} hour${h === 1 ? "" : "s"}`;
}
