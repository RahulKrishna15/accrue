"use client";

import type { Address } from "@solana/kit";
import { ArrowLeft, ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { accrue } from "@/lib/accrue";
import { formatBps, formatDate, formatDuration, formatUnits, shortAddress } from "@/lib/accrue/format";
import { useEvents, useFund, useHolder, useShareBalance } from "@/lib/accrue/hooks";
import { fundDailyRate } from "@/lib/accrue/math";
import type { Fund } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { EarningsCard } from "../earnings-card";
import { FadeIn } from "../motion";
import { Amount, EmptyState, FundMark, Panel, Skeleton, Stat, StatusBadge, buttonClass, enter } from "../ui";
import { EventRow } from "./activity-feed";
import { CapMeter } from "./funds-explorer";
import { InvestPanel } from "./invest-panel";

export function FundView({ mint }: { mint: Address }) {
  const fund = useFund(mint);

  if (fund.status === "loading" && !fund.data) return <FundSkeleton />;
  if (!fund.data) {
    return (
      <EmptyState
        icon={<MagnifyingGlass size={28} />}
        title="Fund not found"
        body="No Accrue fund uses this mint address on devnet. Check the link or browse all funds."
        action={
          <Link href="/funds" className={buttonClass("primary")}>
            Browse funds
          </Link>
        }
      />
    );
  }
  return (
    <FadeIn>
      <FundDetail fund={fund.data} />
    </FadeIn>
  );
}

function FundDetail({ fund }: { fund: Fund }) {
  const nowSec = BigInt(Math.floor(accrue.now() / 1000));
  const rate = fundDailyRate(fund, nowSec);
  const streaming = rate > 0n;

  return (
    <>
      <Link href="/funds" className="enter mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> All funds
      </Link>
      <div className="enter flex flex-col gap-4 pb-8 sm:flex-row sm:items-center" style={enter(1)}>
        <FundMark symbol={fund.metadata.symbol} image={fund.metadata.image} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{fund.metadata.name}</h1>
            <StatusBadge paused={fund.paused} closed={fund.closed} />
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="num">{fund.metadata.symbol}</span> share mint <span className="num">{shortAddress(fund.mint, 6)}</span>
          </p>
        </div>
      </div>

      <div className="enter grid gap-8 lg:grid-cols-[1fr_24rem]" style={enter(2)}>
        <div className="flex flex-col gap-8">
          <Panel className="p-5 sm:p-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
              <Stat label="Price per share">
                <Amount value={fund.price} />
              </Stat>
              <Stat label="Management fee">
                <span className="num">{formatBps(fund.feeBps)}</span>
              </Stat>
              <Stat label="Minimum">
                <Amount value={fund.minInvestment} />
              </Stat>
              <Stat label="Stream period">{formatDuration(fund.streamPeriod)}</Stat>
              <Stat label="Net income deposited">
                <Amount value={fund.totalIncome} decimals={0} />
              </Stat>
              <Stat label="Shares outstanding">
                <span className="num">{formatUnits(fund.totalSupply, 0)}</span>
              </Stat>
            </dl>
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-2 text-sm text-muted">Raised of size cap</p>
              <CapMeter fund={fund} />
            </div>
          </Panel>

          <section aria-labelledby="stream-h">
            <h2 id="stream-h" className="text-lg font-semibold text-ink">
              Income stream
            </h2>
            <p className="mt-2 max-w-[65ch] text-muted">
              {streaming ? (
                <>
                  Releasing <span className="num text-ink">${formatUnits(rate, 2)}</span> a day across all holders until{" "}
                  {formatDate(fund.streamEnd)}. That is <span className="num text-ink">${perShareDay(fund, rate)}</span> per 1,000 shares a day.
                </>
              ) : fund.totalIncome === 0n ? (
                "No income has been deposited yet. Income starts streaming as soon as the manager makes the first deposit."
              ) : (
                `The last deposit finished streaming on ${formatDate(fund.streamEnd)}. The next deposit starts a new ${formatDuration(fund.streamPeriod)} stream.`
              )}
            </p>
          </section>

          <YourPosition fund={fund} />
          <RecentActivity mint={fund.mint} />
        </div>

        <div className="lg:sticky lg:top-36 lg:self-start">
          <InvestPanel fund={fund} />
        </div>
      </div>
    </>
  );
}

function perShareDay(fund: Fund, rate: bigint) {
  if (fund.totalSupply === 0n) return "0.00";
  return formatUnits((rate * 1000n * 1_000_000n) / fund.totalSupply, 4);
}

function YourPosition({ fund }: { fund: Fund }) {
  const { address, wrongNetwork } = useWallet();
  const holder = useHolder(fund.mint, address);
  const balance = useShareBalance(fund.mint, address);
  if (!address || wrongNetwork || !holder.data || balance.data === undefined) return null;
  if (balance.data === 0n && holder.data.pending === 0n) return null;
  return (
    <section aria-labelledby="pos-h">
      <h2 id="pos-h" className="mb-3 text-lg font-semibold text-ink">
        Your position
      </h2>
      <EarningsCard
        title={fund.metadata.name}
        subtitle={fund.paused ? "Paused: claims still work" : undefined}
        fund={fund}
        holder={holder.data}
        balance={balance.data}
        now={accrue.now}
        action={
          <Link href="/portfolio" className={buttonClass("accent")}>
            Claim in Portfolio <ArrowRight size={16} aria-hidden />
          </Link>
        }
      />
    </section>
  );
}

function RecentActivity({ mint }: { mint: Address }) {
  const events = useEvents({ mint });
  return (
    <section aria-labelledby="act-h">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="act-h" className="text-lg font-semibold text-ink">
          Recent activity
        </h2>
        <Link href={`/activity?fund=${mint}`} className="text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
          View all
        </Link>
      </div>
      {!events.data ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {events.data.slice(0, 5).map((e, i) => (
              <EventRow key={`${e.signature}-${e.kind}`} event={e} index={i} compact />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function FundSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading fund">
      <Skeleton className="mb-6 h-4 w-20" />
      <div className="flex items-center gap-4 pb-8">
        <Skeleton className="size-14 rounded-control" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-8">
          <Skeleton className="h-64 rounded-panel" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-96 rounded-panel" />
      </div>
    </div>
  );
}
