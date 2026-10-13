"use client";

import { formatDate, formatUnits } from "@/lib/accrue/format";
import { holderDailyRate, streamProgress, type StreamState } from "@/lib/accrue/math";
import type { HolderAccount } from "@/lib/accrue/types";
import type { ReactNode } from "react";
import { LiveAmount } from "./live-amount";
import { cx } from "./ui";

type Props = {
  title: string;
  subtitle?: ReactNode;
  fund: StreamState & { streamPeriod: bigint };
  holder: Pick<HolderAccount, "lastAcc" | "pending">;
  balance: bigint;
  now: () => number;
  action?: ReactNode;
  className?: string;
  /** Replaces the stream end date (for samples on a relative clock). */
  streamEndLabel?: string;
  /** Deeper tinted shadow for the landing hero. */
  elevated?: boolean;
};

/** Forest panel showing a position's claimable income live. Amber is used for income only. */
export function EarningsCard({ title, subtitle, fund, holder, balance, now, action, className, streamEndLabel, elevated }: Props) {
  const nowSec = BigInt(Math.floor(now() / 1000));
  const perDay = holderDailyRate(fund, balance, nowSec);
  const progress = streamProgress(fund, nowSec);
  const streaming = perDay > 0n;

  // The forest surface clips its grain, so the tinted shadow lives on this wrapper.
  return (
    <div
      className={cx(
        "flex flex-col rounded-panel",
        elevated ? "shadow-[0_50px_100px_-40px_var(--lift),0_18px_36px_-24px_var(--lift)]" : "shadow-[0_24px_60px_-28px_var(--shadow)]",
        className,
      )}
    >
    <section aria-label={`${title} earnings`} className="forest-panel relative isolate flex flex-1 flex-col rounded-panel p-5 text-panel-ink sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 font-medium text-pretty">{title}</p>
        <span className="shrink-0 text-sm text-panel-muted">{streaming ? "Earning now" : "Not streaming"}</span>
      </div>
      {/* Full width under the title row, so status lines fit on one line in narrow cards. */}
      {subtitle ? <p className="mt-0.5 text-sm text-pretty text-panel-muted">{subtitle}</p> : null}

      <p className="mt-6 text-sm text-panel-muted">Claimable income</p>
      <LiveAmount
        positions={[{ fund, holder, balance }]}
        now={now}
        className="mt-1 block text-[clamp(1.9rem,6vw,2.6rem)] leading-tight font-medium tracking-tight text-panel-income"
        tailClassName="text-[0.6em]"
      />

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-panel-line pt-4 text-sm">
        <div>
          <dt className="text-panel-muted">Rate</dt>
          <dd className="num mt-1">{streaming ? `$${formatUnits(perDay, 2)} / day` : "No active stream"}</dd>
        </div>
        <div>
          <dt className="text-panel-muted">Shares held</dt>
          <dd className="num mt-1">{formatUnits(balance, 2)}</dd>
        </div>
      </dl>

      {fund.streamEnd > 0n ? (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-panel-muted">
            <span>Current stream</span>
            <span>{streamEndLabel ?? (progress >= 1 ? `Ended ${formatDate(fund.streamEnd)}` : `Ends ${formatDate(fund.streamEnd)}`)}</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-line"
            role="progressbar"
            aria-label="Stream released"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full origin-left rounded-full bg-panel-income" style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      ) : null}

      {/* mt-auto keeps actions on one line across cards of different heights. */}
      {action ? <div className="mt-auto pt-6">{action}</div> : null}
    </section>
    </div>
  );
}
