"use client";

import { Briefcase, PauseCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { accrue } from "@/lib/accrue";
import { getClaimInstruction } from "@/lib/accrue/instructions";
import { useChainClockOffset, usePositions, useTransaction, useUsdcBalance } from "@/lib/accrue/hooks";
import { formatUnits } from "@/lib/accrue/format";
import { holderDailyRate, projectPending } from "@/lib/accrue/math";
import type { Position } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { EarningsCard } from "../earnings-card";
import { LiveAmount } from "../live-amount";
import { FadeIn, NumberTicker } from "../motion";
import { TxStatus } from "../tx-status";
import { Amount, Button, EmptyState, Skeleton, buttonClass, enter } from "../ui";

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
    <FadeIn className="flex flex-col gap-8">
      <PortfolioSummary positions={list} usdc={usdc.data} />

      {/* auto-fit: three positions fill one row on wide screens instead of leaving an empty cell. */}
      <ul className="grid items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
        {list.map((p, i) => (
          <li key={p.fund.mint} className="enter" style={enter(i + 1, 80)}>
            <PositionCard position={p} />
          </li>
        ))}
      </ul>
    </FadeIn>
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
      <div className="grid overflow-hidden rounded-panel border border-line bg-surface lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <h2 className="text-sm text-muted">Claimable now, all funds</h2>
            <LiveAmount
              positions={positions}
              now={accrue.now}
              className="mt-2 block text-[clamp(2.5rem,7vw,4rem)] leading-none font-medium tracking-tight text-ink"
              tailClassName="text-[0.45em] text-muted"
            />
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              {perDay > 0n ? (
                <>
                  <span aria-hidden className="live-dot size-2 rounded-full bg-income" />
                  Growing by <span className="num text-ink">${formatUnits(perDay, 2)}</span> a day from {earning} {earning === 1 ? "fund" : "funds"}
                </>
              ) : (
                "Not growing right now. Income starts when a manager deposits it."
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Claim is never blocked by pause or close; it only needs something to claim. */}
            <Button
              variant="accent"
              disabled={tx.busy || toClaim.length === 0}
              onClick={() => address && tx.run(address, toClaim.map((p) => getClaimInstruction({ owner: address, mint: p.fund.mint })))}
            >
              {claimLabel}
            </Button>
            {toClaim.length === CLAIM_ALL_MAX && claimable.filter((v) => v > 0n).length > CLAIM_ALL_MAX ? (
              <span className="text-sm text-muted">Claims the first {CLAIM_ALL_MAX}; run it again for the rest.</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-line bg-sunk/60 p-6 sm:p-8 lg:border-t-0 lg:border-l">
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
              <span className="h-full bg-primary" style={{ width: `${claimedPct}%` }} />
              <span className="h-full flex-1 bg-income" style={{ display: ready > 0n ? undefined : "none" }} />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full bg-primary" />
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

function PositionCard({ position: p }: { position: Position }) {
  const { address } = useWallet();
  const tx = useTransaction();
  const claimable = projectPending(p.fund, p.holder, p.balance, accrue.now());
  const subtitle = p.fund.paused ? (
    <span className="inline-flex items-center gap-1">
      <PauseCircle size={14} aria-hidden /> Fund paused. Claims still work.
    </span>
  ) : p.fund.closed ? (
    "Closed to new investment. Still earning."
  ) : (
    <Link href={`/funds/${p.fund.mint}`} className="underline-offset-4 hover:underline">
      View fund
    </Link>
  );

  return (
    <div className="flex flex-col gap-3">
      <EarningsCard
        title={`${p.fund.metadata.name} (${p.fund.metadata.symbol})`}
        subtitle={subtitle}
        fund={p.fund}
        holder={p.holder}
        balance={p.balance}
        now={accrue.now}
        action={
          // Claim is never blocked by pause or close; it only needs something to claim.
          <Button
            variant="accent"
            className="w-full sm:w-auto"
            disabled={tx.busy || claimable === 0n}
            onClick={() => address && tx.run(address, [getClaimInstruction({ owner: address, mint: p.fund.mint })])}
          >
            {tx.state.phase === "signing" ? "Approve in wallet" : tx.state.phase === "confirming" ? "Confirming" : claimable === 0n ? "Nothing to claim yet" : "Claim income"}
          </Button>
        }
      />
      <TxStatus state={tx.state} success="Claimed. The USDC is in your wallet." />
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading holdings" className="flex flex-col gap-8">
      <Skeleton className="h-28 rounded-panel" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-panel" />
        <Skeleton className="h-80 rounded-panel" />
        <Skeleton className="hidden h-80 rounded-panel xl:block" />
      </div>
    </div>
  );
}
