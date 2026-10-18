"use client";

import { Briefcase } from "@phosphor-icons/react";
import Link from "next/link";
import { accrue } from "@/lib/accrue";
import { getClaimInstruction } from "@/lib/accrue/instructions";
import { useChainClockOffset, usePositions, useTransaction, useUsdcBalance } from "@/lib/accrue/hooks";
import { formatDate, formatUnits } from "@/lib/accrue/format";
import { holderDailyRate, projectPending, streamProgress } from "@/lib/accrue/math";
import type { Position } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { LiveAmount } from "../live-amount";
import { FadeIn, NumberTicker } from "../motion";
import { TxStatus } from "../tx-status";
import { Amount, Button, EmptyState, FundMark, Skeleton, StatusBadge, buttonClass, cx, enter } from "../ui";

export function PortfolioView() {
  return (
    <ConnectGate reason="to see your holdings and claim income">
      <Portfolio />
    </ConnectGate>
  );
}

function Portfolio() {
  const { address } = useWallet();
  const positions = usePositions(address);
  const usdc = useUsdcBalance(address);
  useChainClockOffset(); // re-render rates when the demo clock moves

  if (!positions.data) return <PortfolioSkeleton />;
  if (positions.data.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={28} />}
        title="No holdings yet"
        body="Invest in a fund and your shares, live income and claims show up here."
        action={
          <Link href="/funds" className={buttonClass("primary")}>
            Explore funds
          </Link>
        }
      />
    );
  }

  const list = positions.data;

  return (
    <FadeIn className="flex flex-col gap-12">
      <section aria-labelledby="all-funds-h" className="flex flex-col gap-4">
        <SectionHeading id="all-funds-h" title="All funds" note={`Totals across your ${list.length} ${list.length === 1 ? "fund" : "funds"}`} />
        <PortfolioSummary positions={list} usdc={usdc.data} />
      </section>

      <section aria-labelledby="by-fund-h" className="enter flex flex-col gap-4" style={enter(2)}>
        <SectionHeading id="by-fund-h" title="By fund" note="Income each fund is paying you, claimable one at a time" />
        <PositionList positions={list} />
      </section>
    </FadeIn>
  );
}

function SectionHeading({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <h2 id={id} className="text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="text-sm text-muted">{note}</p>
    </div>
  );
}

/** A claim adds about 160 bytes per fund; four keeps one transaction under the 1,232-byte limit. */
const CLAIM_ALL_MAX = 4;

/**
 * The totals across every fund. The live claimable amount is the one bold element;
 * the income bar and the two balances sit beside it as reference.
 */
function PortfolioSummary({ positions, usdc }: { positions: Position[]; usdc: bigint | undefined }) {
  const { address } = useWallet();
  const tx = useTransaction();
  const nowMs = accrue.now();
  const nowSec = BigInt(Math.floor(nowMs / 1000));

  const claimed = positions.reduce((a, p) => a + p.holder.totalClaimed, 0n);
  const invested = positions.reduce((a, p) => a + p.holder.totalInvested, 0n);
  const claimable = positions.map((p) => projectPending(p.fund, p.holder, p.balance, nowMs));
  const ready = claimable.reduce((a, v) => a + v, 0n);
  const perDay = positions.reduce((a, p) => a + holderDailyRate(p.fund, p.balance, nowSec), 0n);
  const earning = positions.filter((p) => holderDailyRate(p.fund, p.balance, nowSec) > 0n).length;
  const earned = claimed + ready;
  const claimedPct = earned > 0n ? Number((claimed * 1000n) / earned) / 10 : 0;

  const toClaim = positions.filter((_, i) => claimable[i] > 0n).slice(0, CLAIM_ALL_MAX);
  const claimLabel =
    tx.state.phase === "signing"
      ? "Approve in wallet"
      : tx.state.phase === "confirming"
        ? "Confirming"
        : toClaim.length === 0
          ? "Nothing to claim yet"
          : toClaim.length === 1
            ? "Claim income"
            : `Claim from ${toClaim.length} funds`;

  return (
    <section aria-label="Portfolio totals" className="enter flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* The live card: same earnings surface as the position cards (honey in light, forest in dark), so it reads as the one thing that moves. */}
        <div className="rounded-panel shadow-[0_28px_60px_-30px_var(--lift)]">
          <div className="forest-panel relative isolate flex h-full flex-col gap-6 rounded-panel p-6 text-panel-ink sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-sm text-panel-muted">Claimable now, all funds</h2>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-panel-line px-2.5 py-1 text-xs font-medium">
                <span aria-hidden className={cx("size-2 rounded-full", perDay > 0n ? "live-dot bg-panel-income" : "bg-panel-muted")} />
                {perDay > 0n ? "Live" : "Not streaming"}
              </span>
            </div>
            <div>
              <LiveAmount
                positions={positions}
                now={accrue.now}
                className="block text-[clamp(2.75rem,8vw,4.5rem)] leading-none font-medium tracking-tight text-panel-income"
                tailClassName="text-[0.42em] text-panel-muted"
              />
              <p className="mt-3 text-sm text-panel-muted">
                {perDay > 0n ? (
                  <>
                    Growing by <span className="num text-panel-ink">${formatUnits(perDay, 2)}</span> a day from {earning} {earning === 1 ? "fund" : "funds"}
                  </>
                ) : (
                  "Not growing right now. Income starts when a manager deposits it."
                )}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              {/* Claim is never blocked by pause or close; it only needs something to claim. */}
              <Button
                variant="accent"
                disabled={tx.busy || toClaim.length === 0}
                onClick={() => address && tx.run(address, toClaim.map((p) => getClaimInstruction({ owner: address, mint: p.fund.mint })))}
              >
                {claimLabel}
              </Button>
              {toClaim.length === CLAIM_ALL_MAX && claimable.filter((v) => v > 0n).length > CLAIM_ALL_MAX ? (
                <span className="text-sm text-panel-muted">Claims the first {CLAIM_ALL_MAX}; run it again for the rest.</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-6 sm:p-8">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm text-muted">Income earned so far</h2>
              <Amount value={earned} className="text-lg text-ink" />
            </div>
            <div
              className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line"
              role="img"
              aria-label={earned > 0n ? `${Math.round(claimedPct)}% claimed, the rest ready to claim` : "No income earned yet"}
            >
              <span className="h-full bg-bar" style={{ width: `${claimedPct}%` }} />
              <span className="h-full flex-1 bg-income" style={{ display: ready > 0n ? undefined : "none" }} />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full bg-bar" />
                <dt className="text-muted">Claimed</dt>
                <dd>
                  <NumberTicker value={claimed} prefix="$" className="text-ink" />
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full bg-income" />
                <dt className="text-muted">Ready to claim</dt>
                <dd>
                  <Amount value={ready} className="text-ink" />
                </dd>
              </div>
            </dl>
          </div>
          <dl className="mt-auto flex flex-col divide-y divide-line border-t border-line text-sm">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-muted">Principal invested</dt>
              <dd>
                <Amount value={invested} className="text-ink" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-muted">Test USDC in wallet</dt>
              <dd>{usdc !== undefined ? <Amount value={usdc} className="text-ink" /> : <Skeleton className="h-5 w-20" />}</dd>
            </div>
          </dl>
        </div>
      </div>
      <TxStatus state={tx.state} success="Claimed. The USDC is in your wallet." />
    </section>
  );
}

/** Desktop columns, shared by the header row and every fund row so they line up. */
const ROW_COLS = "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,1.2fr)_9.5rem]";

/** One framed list, one row per fund: the breakdown under the All funds total. */
function PositionList({ positions }: { positions: Position[] }) {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface">
      <div aria-hidden className={cx("hidden gap-6 border-b border-line bg-sunk px-5 py-3 text-sm font-medium text-muted lg:grid", ROW_COLS)}>
        <span>Fund</span>
        <span className="text-right">Claimable</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Shares</span>
        <span>Current stream</span>
        <span className="sr-only">Action</span>
      </div>
      <ul className="divide-y divide-line">
        {positions.map((p) => (
          <li key={p.fund.mint}>
            <PositionRow position={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PositionRow({ position: p }: { position: Position }) {
  const { address } = useWallet();
  const tx = useTransaction();
  const nowMs = accrue.now();
  const nowSec = BigInt(Math.floor(nowMs / 1000));
  const claimable = projectPending(p.fund, p.holder, p.balance, nowMs);
  const perDay = holderDailyRate(p.fund, p.balance, nowSec);
  const progress = streamProgress(p.fund, nowSec);
  const hasStream = p.fund.streamEnd > 0n;

  return (
    <div className="px-5 py-5 lg:py-4">
      <div className={cx("grid grid-cols-2 items-center gap-x-6 gap-y-4", ROW_COLS)}>
        {/* Fund */}
        <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <FundMark symbol={p.fund.metadata.symbol} image={p.fund.metadata.image} size={36} />
          <div className="min-w-0">
            <Link href={`/funds/${p.fund.mint}`} className="block truncate font-medium text-ink underline-offset-4 hover:underline">
              {p.fund.metadata.name}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
              <span className="num">{p.fund.metadata.symbol}</span>
              {p.fund.paused || p.fund.closed ? <StatusBadge paused={p.fund.paused} closed={p.fund.closed} /> : null}
            </div>
          </div>
        </div>

        {/* Claimable, live */}
        <Cell label="Claimable" className="lg:text-right">
          <LiveAmount
            positions={[p]}
            now={accrue.now}
            className="text-lg font-medium text-accent-strong"
            tailClassName="text-[0.7em] text-muted"
          />
        </Cell>

        <Cell label="Rate" className="lg:text-right">
          <span className="num text-ink">{perDay > 0n ? `$${formatUnits(perDay, 2)} / day` : "None"}</span>
        </Cell>

        <Cell label="Shares" className="lg:text-right">
          <span className="num text-ink">{formatUnits(p.balance, 2)}</span>
        </Cell>

        <Cell label="Current stream">
          {hasStream ? (
            <div className="flex flex-col gap-1.5">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-sunk"
                role="progressbar"
                aria-label={`${p.fund.metadata.name} stream released`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div className="h-full origin-left rounded-full bg-income" style={{ transform: `scaleX(${progress})` }} />
              </div>
              <span className="text-xs text-muted">{progress >= 1 ? `Ended ${formatDate(p.fund.streamEnd)}` : `Ends ${formatDate(p.fund.streamEnd)}`}</span>
            </div>
          ) : (
            <span className="text-sm text-muted">No income yet</span>
          )}
        </Cell>

        {/* Claim is never blocked by pause or close; it only needs something to claim. */}
        <div className="col-span-2 lg:col-span-1 lg:justify-self-end">
          <Button
            variant={claimable === 0n ? "secondary" : "accent"}
            size="sm"
            className="w-full lg:w-auto"
            disabled={tx.busy || claimable === 0n}
            onClick={() => address && tx.run(address, [getClaimInstruction({ owner: address, mint: p.fund.mint })])}
          >
            {tx.state.phase === "signing" ? "Approve in wallet" : tx.state.phase === "confirming" ? "Confirming" : claimable === 0n ? "Nothing to claim" : "Claim"}
          </Button>
        </div>
      </div>
      {tx.state.phase !== "idle" ? <TxStatus state={tx.state} success="Claimed. The USDC is in your wallet." className="mt-4" /> : null}
    </div>
  );
}

/** A value with its column name shown only on narrow screens, where there is no header row. */
function Cell({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="mb-1 text-sm text-muted lg:hidden">{label}</p>
      {children}
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading holdings" className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Skeleton className="h-60 rounded-panel" />
          <Skeleton className="h-60 rounded-panel" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-40 rounded-panel" />
      </div>
    </div>
  );
}
