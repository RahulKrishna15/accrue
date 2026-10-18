"use client";

import type { Address } from "@solana/kit";
import {
  ArrowSquareOut,
  ArrowsLeftRight,
  CurrencyCircleDollar,
  HandCoins,
  LockSimple,
  Pause,
  Play,
  Rocket,
  Tag,
  UserPlus,
  Vault,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accrue } from "@/lib/accrue";
import { formatBps, formatDateTime, formatUnits, shortAddress } from "@/lib/accrue/format";
import { useEvents, useFunds } from "@/lib/accrue/hooks";
import type { AccrueEvent } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { DataTable, GroupRow, RowTh, Td, Th, rowClass } from "../data-table";
import { FadeIn, duration, ease, spring } from "../motion";
import { EmptyState, Select, Skeleton, cx, enter } from "../ui";

const ICONS = {
  FundInitialized: Rocket,
  HolderRegistered: UserPlus,
  Invested: CurrencyCircleDollar,
  RevenueDeposited: Vault,
  Claimed: HandCoins,
  Transferred: ArrowsLeftRight,
  PriceChanged: Tag,
  PausedSet: Pause,
  FundClosed: LockSimple,
} as const;

const usd = (v: bigint) => `$${formatUnits(v, 2)}`;

function who(a: Address, me: Address | null) {
  return a === me ? "You" : shortAddress(a);
}

export function describeEvent(e: AccrueEvent, me: Address | null): { title: string; detail: string } {
  switch (e.kind) {
    case "FundInitialized":
      return { title: "Fund created", detail: `Price ${usd(e.price)}, fee ${formatBps(e.feeBps)}` };
    case "HolderRegistered":
      return { title: "Holder registered", detail: who(e.owner, me) };
    case "Invested":
      return { title: "Invested", detail: `${who(e.investor, me)} put in ${usd(e.usdc)} for ${formatUnits(e.shares, 2)} shares` };
    case "RevenueDeposited":
      return { title: "Income deposited", detail: `${usd(e.gross)} gross, ${usd(e.fee)} fee, ${usd(e.net)} streams to holders` };
    case "Claimed":
      return { title: "Income claimed", detail: `${who(e.owner, me)} claimed ${usd(e.amount)}` };
    case "Transferred":
      return { title: "Shares transferred", detail: `${who(e.from, me)} sent ${formatUnits(e.amount, 2)} shares to ${who(e.to, me)}` };
    case "PriceChanged":
      return { title: "Price changed", detail: `${usd(e.oldPrice)} to ${usd(e.newPrice)} for new investments` };
    case "PausedSet":
      return e.paused ? { title: "Fund paused", detail: "Invest, deposits and transfers blocked" } : { title: "Fund resumed", detail: "All actions available again" };
    case "FundClosed":
      return { title: "Fund closed", detail: "No new investment; income and claims continue" };
  }
}

export function EventRow({ event, compact, fundName, index = 0 }: { event: AccrueEvent; compact?: boolean; fundName?: string; index?: number }) {
  const { address } = useWallet();
  const Icon = event.kind === "PausedSet" && !event.paused ? Play : ICONS[event.kind];
  const d = describeEvent(event, address);
  const url = accrue.explorerTxUrl(event.signature);
  return (
    // Inside AnimatePresence initial={false}: rows present on load stay put, new events slide in at the top.
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className={cx("enter grid grid-cols-[2.25rem_1fr] gap-3", compact ? "py-3" : "py-4 md:grid-cols-[2.25rem_1fr_11rem_9rem] md:items-center")}
      // Rows already on screen cascade in once; past the first screenful they appear together.
      style={enter(Math.min(index, 10), 35)}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-control bg-sunk text-accent" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {d.title}
          {fundName ? <span className="font-normal text-muted"> in {fundName}</span> : null}
        </p>
        <p className="num text-sm break-words text-muted md:truncate">{d.detail}</p>
        <p className={cx("text-xs text-muted", !compact && "md:hidden")}>{formatDateTime(event.timestamp)}</p>
      </div>
      {!compact ? (
        <>
          <p className="hidden text-sm text-muted md:block">{formatDateTime(event.timestamp)}</p>
          <p className="col-start-2 text-xs md:col-start-auto md:text-sm">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="num text-accent-strong underline-offset-4 hover:underline">
                {shortAddress(event.signature, 5)}
              </a>
            ) : (
              <span className="num text-muted" title="Simulated signature">
                {shortAddress(event.signature, 5)}
              </span>
            )}
          </p>
        </>
      ) : null}
    </motion.li>
  );
}

type Cell = { account: ReactNode; amount: ReactNode; note?: string };

/** What each event contributes to the table's Account and Amount columns. */
function cellsFor(e: AccrueEvent, me: Address | null): Cell {
  const none = (
    <>
      <span aria-hidden className="text-muted">—</span>
      <span className="sr-only">None</span>
    </>
  );
  switch (e.kind) {
    case "FundInitialized":
      return { account: <Who a={e.manager} me={me} />, amount: usd(e.price), note: `Share price, fee ${formatBps(e.feeBps)}` };
    case "HolderRegistered":
      return { account: <Who a={e.owner} me={me} />, amount: none };
    case "Invested":
      return { account: <Who a={e.investor} me={me} />, amount: usd(e.usdc), note: `${formatUnits(e.shares, 2)} shares` };
    case "RevenueDeposited":
      return { account: <span className="text-muted">Manager</span>, amount: usd(e.gross), note: `${usd(e.net)} to holders, ${usd(e.fee)} fee` };
    case "Claimed":
      return { account: <Who a={e.owner} me={me} />, amount: usd(e.amount) };
    case "Transferred":
      return {
        account: (
          <span className="flex flex-col items-start">
            <Who a={e.from} me={me} />
            <span className="text-xs text-muted">
              to <Who a={e.to} me={me} />
            </span>
          </span>
        ),
        amount: (
          <>
            {formatUnits(e.amount, 2)} <span className="font-sans text-sm text-muted">shares</span>
          </>
        ),
      };
    case "PriceChanged":
      return { account: <span className="text-muted">Manager</span>, amount: usd(e.newPrice), note: `was ${usd(e.oldPrice)}` };
    case "PausedSet":
    case "FundClosed":
      return { account: <span className="text-muted">Manager</span>, amount: none };
  }
}

function Who({ a, me }: { a: Address; me: Address | null }) {
  if (a === me) {
    return <span className="inline-flex rounded-full bg-accent-soft px-2 text-sm font-medium text-accent-strong">You</span>;
  }
  const url = accrue.explorerAddressUrl(a);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" title={a} className="num text-ink underline-offset-4 hover:underline">
      {shortAddress(a)}
    </a>
  ) : (
    <span className="num" title={a}>
      {shortAddress(a)}
    </span>
  );
}

function TxLink({ signature }: { signature: string }) {
  const url = accrue.explorerTxUrl(signature);
  if (!url) return <span className="num text-muted">{shortAddress(signature, 5)}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="num inline-flex items-center gap-1 text-accent-strong underline-offset-4 hover:underline"
      aria-label={`Transaction ${shortAddress(signature, 5)} on Solana Explorer`}
    >
      {shortAddress(signature, 5)}
      <ArrowSquareOut size={12} aria-hidden />
    </a>
  );
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function dayLabel(d: Date) {
  const key = dayKeyFmt.format(d);
  const today = new Date();
  if (key === dayKeyFmt.format(today)) return "Today";
  if (key === dayKeyFmt.format(new Date(today.getTime() - 86_400_000))) return "Yesterday";
  return dayLabelFmt.format(d);
}

/** Events arrive newest first; group consecutive events by local calendar day. */
function groupByDay(events: readonly AccrueEvent[]) {
  const groups: { key: string; label: string; events: AccrueEvent[] }[] = [];
  for (const e of events) {
    const d = new Date(Number(e.timestamp) * 1000);
    const key = dayKeyFmt.format(d);
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(e);
    else groups.push({ key, label: dayLabel(d), events: [e] });
  }
  return groups;
}

function EventName({ event, className }: { event: AccrueEvent; className?: string }) {
  const Icon = event.kind === "PausedSet" && !event.paused ? Play : ICONS[event.kind];
  return (
    <span className={cx("inline-flex items-center gap-2.5 font-medium text-ink", className)}>
      <Icon size={18} className="shrink-0 text-accent" aria-hidden />
      {describeEvent(event, null).title}
    </span>
  );
}

function Time({ ts }: { ts: bigint }) {
  const d = new Date(Number(ts) * 1000);
  return (
    <time dateTime={d.toISOString()} title={formatDateTime(ts)} className="num">
      {timeFmt.format(d)}
    </time>
  );
}

const rowMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: duration.base, ease },
} as const;

function ActivityTable({ events, me, names, showFund }: { events: readonly AccrueEvent[]; me: Address | null; names: Map<Address, string>; showFund: boolean }) {
  const groups = groupByDay(events);
  const cols = showFund ? 6 : 5;
  return (
    <>
      {/* Desktop and tablet: a real table, so columns line up and screen readers announce headers. */}
      <div className="hidden overflow-hidden rounded-panel border border-line bg-surface md:block">
        <table className="w-full border-collapse text-left text-[15px]">
          <caption className="sr-only">Accrue program events, newest first</caption>
          <thead>
            <tr className="border-b border-line bg-sunk text-sm text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Event</th>
              {showFund ? <th scope="col" className="px-4 py-3 font-medium">Fund</th> : null}
              <th scope="col" className="px-4 py-3 font-medium">Account</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Time</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Transaction</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.key}>
              <tr>
                <th scope="rowgroup" colSpan={cols} className="border-b border-line px-4 pt-5 pb-2 text-sm font-medium text-ink">
                  {g.label}
                  <span className="ml-2 font-normal text-muted">
                    {g.events.length} {g.events.length === 1 ? "event" : "events"}
                  </span>
                </th>
              </tr>
              <AnimatePresence initial={false}>
                {g.events.map((e) => {
                  const c = cellsFor(e, me);
                  return (
                    <motion.tr key={`${e.signature}-${e.kind}`} {...rowMotion} className="border-b border-line last:border-b-0 hover:bg-sunk/50">
                      <td className="px-4 py-3 align-top">
                        <EventName event={e} />
                      </td>
                      {showFund ? (
                        <td className="max-w-[14rem] truncate px-4 py-3 align-top">
                          <Link href={`/funds/${e.mint}`} className="text-ink underline-offset-4 hover:underline">
                            {names.get(e.mint) ?? shortAddress(e.mint)}
                          </Link>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 align-top">{c.account}</td>
                      <td className="px-4 py-3 text-right align-top">
                        <span className="num block text-ink">{c.amount}</span>
                        {c.note ? <span className="block text-xs text-muted">{c.note}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right align-top text-sm whitespace-nowrap text-muted">
                        <Time ts={e.timestamp} />
                      </td>
                      <td className="px-4 py-3 text-right align-top text-sm whitespace-nowrap">
                        <TxLink signature={e.signature} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          ))}
        </table>
      </div>

      {/* Phones: the same columns folded into two lines per event. */}
      <div className="flex flex-col gap-6 md:hidden">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h2 className="pb-2 text-sm font-medium text-ink">
              {g.label}
              <span className="ml-2 font-normal text-muted">
                {g.events.length} {g.events.length === 1 ? "event" : "events"}
              </span>
            </h2>
            <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
              <AnimatePresence initial={false}>
                {g.events.map((e) => {
                  const c = cellsFor(e, me);
                  return (
                    <motion.li key={`${e.signature}-${e.kind}`} {...rowMotion} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <EventName event={e} />
                          {showFund ? <p className="truncate pl-7 text-sm text-muted">{names.get(e.mint) ?? shortAddress(e.mint)}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="num block text-ink">{c.amount}</span>
                          {c.note ? <span className="block text-xs text-muted">{c.note}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-sm text-muted">
                        <span className="text-ink">{c.account}</span>
                        <Time ts={e.timestamp} />
                        <TxLink signature={e.signature} />
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity" className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="h-11 border-b border-line bg-sunk" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-line px-4 py-4 last:border-b-0">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="hidden h-4 w-28 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="hidden h-4 w-20 md:block" />
        </div>
      ))}
    </div>
  );
}

/** Framed-grid version of the events table, for summaries such as the fund page's recent activity. */
export function RecentActivityTable({
  events,
  me,
  names,
  showFund,
}: {
  events: readonly AccrueEvent[];
  me: Address | null;
  names?: Map<Address, string>;
  showFund: boolean;
}) {
  const groups = groupByDay(events);
  const cols = showFund ? 6 : 5;
  return (
    <DataTable caption="Accrue program events, newest first" minWidth={showFund ? "52rem" : "42rem"}>
      <thead>
        <tr>
          <Th pinned>Event</Th>
          {showFund ? <Th>Fund</Th> : null}
          <Th>Account</Th>
          <Th numeric>Amount</Th>
          <Th numeric>Time</Th>
          <Th>Transaction</Th>
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.key}>
          <GroupRow colSpan={cols}>
            {g.label}
            <span className="ml-2 font-normal text-muted">
              {g.events.length} {g.events.length === 1 ? "event" : "events"}
            </span>
          </GroupRow>
          <AnimatePresence initial={false}>
            {g.events.map((e) => {
              const c = cellsFor(e, me);
              return (
                <motion.tr key={`${e.signature}-${e.kind}`} {...rowMotion} className={rowClass}>
                  <RowTh pinned className="font-normal whitespace-nowrap">
                    <EventName event={e} />
                  </RowTh>
                  {showFund ? (
                    <Td className="max-w-[14rem] truncate">
                      <Link href={`/funds/${e.mint}`} className="text-ink underline-offset-4 hover:underline">
                        {names?.get(e.mint) ?? shortAddress(e.mint)}
                      </Link>
                    </Td>
                  ) : null}
                  <Td>{c.account}</Td>
                  <Td numeric>
                    <span className="block text-ink">{c.amount}</span>
                    {c.note ? <span className="block font-sans text-xs text-muted">{c.note}</span> : null}
                  </Td>
                  <Td numeric className="text-sm text-muted">
                    <Time ts={e.timestamp} />
                  </Td>
                  <Td className="text-sm whitespace-nowrap">
                    <TxLink signature={e.signature} />
                  </Td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      ))}
    </DataTable>
  );
}

export function RecentActivitySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading activity" className="overflow-hidden rounded-panel border border-line-strong/60 bg-surface">
      <div className="h-10 border-b border-line-strong/60 bg-sunk" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] divide-x divide-line border-b border-line last:border-b-0">
          {["w-36", "w-24", "w-16", "w-20"].map((w, j) => (
            <div key={w} className={cx("flex px-4 py-4", j > 1 && "justify-end")}>
              <Skeleton className={cx("h-4", w)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const params = useSearchParams();
  const router = useRouter();
  const { address } = useWallet();
  const funds = useFunds();
  const fund = (params.get("fund") as Address | null) ?? undefined;
  const mine = params.get("mine") === "1";
  const events = useEvents({ mint: fund, wallet: mine && address ? address : undefined });

  const names = new Map((funds.data ?? []).map((f) => [f.mint, f.metadata.name]));

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`/activity${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  return (
    <div>
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="fund-filter" className="text-sm font-medium text-ink">
            Fund
          </label>
          <Select
            id="fund-filter"
            size="sm"
            value={fund ?? ""}
            onChange={(e) => setParam("fund", e.target.value || null)}
            className="sm:w-64"
          >
            <option value="">All funds</option>
            {(funds.data ?? []).map((f) => (
              <option key={f.mint} value={f.mint}>
                {f.metadata.name}
              </option>
            ))}
          </Select>
        </div>
        <label className={cx("flex h-10 items-center gap-2 text-sm", !address && "opacity-50")}>
          <input
            type="checkbox"
            checked={mine}
            disabled={!address}
            onChange={(e) => setParam("mine", e.target.checked ? "1" : null)}
            className="size-4 accent-[var(--accent)]"
          />
          Only events involving my wallet
        </label>
      </div>
      {mine && !address ? <p className="pb-4 text-sm text-muted">Connect a wallet to filter by it.</p> : null}

      {!events.data ? (
        <TableSkeleton />
      ) : events.data.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise size={28} />}
          title="No activity yet"
          body={mine ? "This wallet has not invested, transferred or claimed in these funds." : "Program events appear here as they happen."}
          action={
            <Link href="/funds" className="font-medium text-accent-strong underline-offset-4 hover:underline">
              Browse funds
            </Link>
          }
        />
      ) : (
        <FadeIn>
          <ActivityTable events={events.data} me={address} names={names} showFund={!fund} />
        </FadeIn>
      )}
    </div>
  );
}
