"use client";

import type { Address } from "@solana/kit";
import {
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { accrue } from "@/lib/accrue";
import { formatBps, formatDateTime, formatUnits, shortAddress } from "@/lib/accrue/format";
import { useEvents, useFunds } from "@/lib/accrue/hooks";
import type { AccrueEvent } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { EmptyState, Skeleton, cx } from "../ui";

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

export function EventRow({ event, compact, fundName }: { event: AccrueEvent; compact?: boolean; fundName?: string }) {
  const { address } = useWallet();
  const Icon = event.kind === "PausedSet" && !event.paused ? Play : ICONS[event.kind];
  const d = describeEvent(event, address);
  const url = accrue.explorerTxUrl(event.signature);
  return (
    <li className={cx("grid grid-cols-[2.25rem_1fr] gap-3", compact ? "py-3" : "py-4 md:grid-cols-[2.25rem_1fr_11rem_9rem] md:items-center")}>
      <span className="inline-flex size-9 items-center justify-center rounded-control bg-sunk text-accent" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {d.title}
          {fundName ? <span className="font-normal text-muted"> in {fundName}</span> : null}
        </p>
        <p className="num truncate text-sm text-muted">{d.detail}</p>
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
    </li>
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
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="fund-filter" className="text-sm font-medium text-ink">
            Fund
          </label>
          <select
            id="fund-filter"
            value={fund ?? ""}
            onChange={(e) => setParam("fund", e.target.value || null)}
            className="h-10 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink sm:w-64"
          >
            <option value="">All funds</option>
            {(funds.data ?? []).map((f) => (
              <option key={f.mint} value={f.mint}>
                {f.metadata.name}
              </option>
            ))}
          </select>
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
        <div aria-busy="true" aria-label="Loading activity" className="flex flex-col gap-4 pt-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-control" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
          ))}
        </div>
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
        <ul className="divide-y divide-line border-t border-line">
          {events.data.map((e) => (
            <EventRow key={`${e.signature}-${e.kind}`} event={e} fundName={fund ? undefined : names.get(e.mint)} />
          ))}
        </ul>
      )}
    </div>
  );
}
