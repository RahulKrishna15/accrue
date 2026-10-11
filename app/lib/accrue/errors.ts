/** Custom program errors (Anchor numbering starts at 6000). Codama generates the same table. */
export const ACCRUE_ERRORS = {
  6000: ["FundPaused", "This fund is paused. Investing, deposits and transfers are blocked; claims still work."],
  6001: ["FundClosed", "This fund is closed to new investment."],
  6002: ["BelowMinimum", "The amount is below the fund's minimum investment."],
  6003: ["CapExceeded", "This investment would take the fund over its size cap."],
  6004: ["FeeTooHigh", "The management fee cannot exceed 10%."],
  6005: ["Unauthorized", "Only the fund manager can do this."],
  6006: ["NothingToClaim", "There is no income to claim yet."],
  6007: ["InvalidPrice", "The price must be greater than zero."],
  6008: ["InvalidAmount", "The amount must be greater than zero."],
  6009: ["HolderNotRegistered", "The recipient has no Holder account. Add register_holder to the transaction."],
  6010: ["HolderAlreadyRegistered", "This wallet already has a Holder account for the fund."],
  6011: ["NotTransferring", "The hook was called directly instead of through a Token-2022 transfer."],
  6012: ["NoHolders", "Income cannot be deposited before anyone holds shares."],
  6013: ["InvalidPeriod", "The stream period must be at least one hour."],
  6014: ["InsufficientFunds", "Not enough balance for this transaction."],
} as const;

export type AccrueErrorCode = keyof typeof ACCRUE_ERRORS;

export class AccrueProgramError extends Error {
  constructor(
    readonly code: AccrueErrorCode,
    readonly signature?: string,
  ) {
    super(ACCRUE_ERRORS[code][1]);
    this.name = ACCRUE_ERRORS[code][0];
  }
}

export class WalletRejectedError extends Error {
  constructor() {
    super("You declined the request in your wallet.");
    this.name = "WalletRejectedError";
  }
}

export class TransactionDroppedError extends Error {
  constructor(readonly signature?: string) {
    super("The transaction expired before it was confirmed. Nothing changed; try again.");
    this.name = "TransactionDroppedError";
  }
}

export function describeError(e: unknown): { title: string; detail: string } {
  if (e instanceof WalletRejectedError) return { title: "Request declined", detail: e.message };
  if (e instanceof TransactionDroppedError) return { title: "Transaction expired", detail: e.message };
  if (e instanceof AccrueProgramError) return { title: `Transaction failed: ${e.name}`, detail: e.message };
  return { title: "Transaction failed", detail: e instanceof Error ? e.message : "Unknown error." };
}
