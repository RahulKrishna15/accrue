"use client";

import { Briefcase, PauseCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { accrue } from "@/lib/accrue";
import { getClaimInstruction } from "@/lib/accrue/instructions";
import { useChainClockOffset, usePositions, useTransaction, useUsdcBalance } from "@/lib/accrue/hooks";
import { projectPending } from "@/lib/accrue/math";
import type { Position } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { EarningsCard } from "../earnings-card";
import { LiveAmount } from "../live-amount";
import { FadeIn, NumberTicker } from "../motion";
import { TxStatus } from "../tx-status";
import { Amount, Button, EmptyState, Panel, Skeleton, Stat, buttonClass, enter } from "../ui";

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
  const claimed = list.reduce((a, p) => a + p.holder.totalClaimed, 0n);
  const invested = list.reduce((a, p) => a + p.holder.totalInvested, 0n);

  return (
    <FadeIn className="flex flex-col gap-8">
      <Panel className="enter p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-1 lg:col-span-1">
            <dt className="text-sm text-muted">Claimable now, all funds</dt>
            <dd className="text-2xl text-ink">
              <LiveAmount positions={list} now={accrue.now} tailClassName="text-[0.65em]" />
            </dd>
          </div>
          {/* Counts up after a claim while the claimable total settles to zero. */}
          <Stat label="Claimed to date">
            <NumberTicker value={claimed} prefix="$" />
          </Stat>
          <Stat label="Principal invested">
            <Amount value={invested} />
          </Stat>
          <Stat label="Test USDC in wallet">
            {usdc.data !== undefined ? <Amount value={usdc.data} /> : <Skeleton className="h-6 w-24" />}
          </Stat>
        </dl>
      </Panel>

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
