"use client";

import { MagnifyingGlass, Plus, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { accrue } from "@/lib/accrue";
import { formatBps, formatDuration, formatUnits } from "@/lib/accrue/format";
import { useFunds } from "@/lib/accrue/hooks";
import { fundDailyRate } from "@/lib/accrue/math";
import type { Fund } from "@/lib/accrue/types";
import { FadeIn, duration, snappy, spring } from "../motion";
import { Amount, EmptyState, FundMark, Skeleton, StatusBadge, buttonClass, cx } from "../ui";

// Rows enter in order on first load; on a filter change the survivors slide into place.
const rowMotion = (i: number) =>
  ({
    layout: "position",
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { ...spring, delay: i * 0.05 } },
    exit: { opacity: 0, transition: { duration: duration.fast } },
  }) as const;

type Filter = "all" | "open" | "paused" | "closed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "paused", label: "Paused" },
  { id: "closed", label: "Closed" },
];

const statusOf = (f: Fund): Exclude<Filter, "all"> => (f.paused ? "paused" : f.closed ? "closed" : "open");

export function FundsExplorer() {
  const funds = useFunds();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (funds.data ?? []).filter(
      (f) =>
        (filter === "all" || statusOf(f) === filter) &&
        (!q || f.metadata.name.toLowerCase().includes(q) || f.metadata.symbol.toLowerCase().includes(q)),
    );
  }, [funds.data, filter, query]);

  if (funds.status === "error" && !funds.data) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-panel border border-danger bg-danger-soft p-5">
        <WarningCircle size={22} className="shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-medium text-ink">Could not load funds</p>
          <p className="text-sm text-ink">The devnet RPC did not respond. Refresh to try again.</p>
        </div>
      </div>
    );
  }

  const loading = funds.status === "loading" && !funds.data;
  // Only read the clock once data exists: the prerendered shell is always the loading state.
  const nowSec = loading ? 0n : BigInt(Math.floor(accrue.now() / 1000));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label="Filter by status" className="inline-flex w-fit gap-1 rounded-control bg-sunk p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx("relative h-8 rounded-[8px] px-3 text-sm transition-colors", filter === f.id ? "font-medium text-ink" : "text-muted hover:text-ink")}
            >
              {filter === f.id ? (
                <motion.span layoutId="funds-filter" aria-hidden className="absolute inset-0 rounded-[8px] bg-surface shadow-[0_1px_2px_var(--shadow)]" transition={snappy} />
              ) : null}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent sm:w-72">
          <MagnifyingGlass size={18} className="text-muted" aria-hidden />
          <span className="sr-only">Search funds</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or symbol"
            className="h-full w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-none!"
          />
        </label>
      </div>

      {loading ? (
        <ExplorerSkeleton />
      ) : funds.data!.length === 0 ? (
        <EmptyState
          icon={<Plus size={28} />}
          title="No funds yet"
          body="Funds appear here as soon as a manager creates one. Be the first."
          action={
            <Link href="/funds/new" className={buttonClass("primary")}>
              Create a fund
            </Link>
          }
        />
      ) : shown.length === 0 ? (
        <p className="rounded-panel border border-dashed border-line-strong px-5 py-8 text-center text-muted">
          No funds match. Clear the search or pick another status.
        </p>
      ) : (
        <FadeIn>
          {/* Desktop table, framed like the other panels */}
          <div className="hidden overflow-hidden rounded-panel border border-line bg-surface md:block">
            <table className="w-full border-separate border-spacing-0 text-left">
              <caption className="sr-only">All funds</caption>
              <thead>
                <tr className="bg-sunk text-sm text-muted [&>th]:border-b [&>th]:border-line [&>th]:px-5 [&>th]:py-3 [&>th]:font-medium">
                  <th scope="col">Fund</th>
                  <th scope="col" className="text-right">Price</th>
                  <th scope="col">Raised of cap</th>
                  <th scope="col" className="text-right">Fee</th>
                  <th scope="col" className="text-right">Income / day</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={true}>
                {shown.map((f, i) => (
                  <motion.tr
                    key={f.mint}
                    className="group [&>td]:px-5 [&>td]:py-4 [&:not(:first-child)>td]:border-t [&>td]:border-line hover:[&>td]:bg-sunk/50"
                    {...rowMotion(i)}
                  >
                    <td>
                      <Link href={`/funds/${f.mint}`} className="flex items-center gap-3 rounded-control">
                        <FundMark symbol={f.metadata.symbol} image={f.metadata.image} />
                        <span>
                          <span className="block font-medium text-ink group-hover:underline group-hover:underline-offset-4">{f.metadata.name}</span>
                          <span className="num text-sm text-muted">{f.metadata.symbol}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-right">
                      <Amount value={f.price} />
                    </td>
                    <td>
                      <CapMeter fund={f} />
                    </td>
                    <td className="num text-right">{formatBps(f.feeBps)}</td>
                    <td className="text-right">
                      <DailyIncome fund={f} nowSec={nowSec} />
                    </td>
                    <td>
                      <StatusBadge paused={f.paused} closed={f.closed} />
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked rows */}
          <ul className="flex flex-col gap-3 md:hidden">
            <AnimatePresence initial={true}>
            {shown.map((f, i) => (
              <motion.li key={f.mint} {...rowMotion(i)}>
                <Link href={`/funds/${f.mint}`} className="lift block rounded-panel border border-line bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <FundMark symbol={f.metadata.symbol} image={f.metadata.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{f.metadata.name}</p>
                      <p className="num text-sm text-muted">{f.metadata.symbol}</p>
                    </div>
                    <StatusBadge paused={f.paused} closed={f.closed} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-muted">Price</dt>
                      <dd className="mt-0.5">
                        <Amount value={f.price} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Fee</dt>
                      <dd className="num mt-0.5">{formatBps(f.feeBps)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Per day</dt>
                      <dd className="mt-0.5">
                        <DailyIncome fund={f} nowSec={nowSec} />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <CapMeter fund={f} />
                  </div>
                </Link>
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        </FadeIn>
      )}
    </div>
  );
}

export function CapMeter({ fund }: { fund: Fund }) {
  const pct = fund.sizeCap > 0n ? Number((fund.totalRaised * 1000n) / fund.sizeCap) / 10 : 0;
  return (
    <div className="flex min-w-48 flex-col gap-1.5">
      <p className="text-sm">
        <Amount value={fund.totalRaised} decimals={0} /> <span className="text-muted">of</span>{" "}
        <Amount value={fund.sizeCap} decimals={0} className="text-muted" />
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-sunk" aria-hidden>
        <motion.div
          className="h-full origin-left rounded-full bg-bar"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.min(100, pct) / 100 }}
          transition={{ ...spring, delay: 0.15 }}
        />
      </div>
      <span className="sr-only">{pct.toFixed(1)}% of cap raised</span>
    </div>
  );
}

function DailyIncome({ fund, nowSec }: { fund: Fund; nowSec: bigint }) {
  const rate = fundDailyRate(fund, nowSec);
  if (rate === 0n) return <span className="text-sm text-muted">{fund.totalIncome === 0n ? "None yet" : "Between streams"}</span>;
  return (
    <span className="num" title={`Streaming over ${formatDuration(fund.streamPeriod)}`}>
      ${formatUnits(rate, 2)}
    </span>
  );
}

function ExplorerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading funds">
      <div className="hidden flex-col md:flex">
        <Skeleton className="mb-3 h-5 w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <Skeleton className="size-10 rounded-control" />
            <div className="flex w-56 flex-col gap-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="ml-8 h-4 w-48" />
            <Skeleton className="ml-8 h-4 w-12" />
            <Skeleton className="ml-8 h-4 w-20" />
            <Skeleton className="ml-8 h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-panel" />
        ))}
      </div>
    </div>
  );
}
