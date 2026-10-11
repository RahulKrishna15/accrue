/** Cluster the app targets. Devnet only; there is no mainnet build. */
export const CLUSTER = "devnet" as const;
export const WALLET_CHAIN = "solana:devnet" as const;
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/** Test USDC and share tokens both use 6 decimals. */
export const USDC_DECIMALS = 6;
export const SHARE_DECIMALS = 6;
export const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);
export const SHARE_UNIT = 10n ** BigInt(SHARE_DECIMALS);

/** Fixed-point scale of `acc_per_token` (income per base unit of share, x 1e12). */
export const ACC_PRECISION = 1_000_000_000_000n;

export const BPS_DENOMINATOR = 10_000n;
/** Management fee cap enforced by `deposit_revenue` / `initialize_fund`: 10%. */
export const MAX_FEE_BPS = 1_000;

export const SECONDS_PER_DAY = 86_400n;
