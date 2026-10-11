"use client";

import { ArrowSquareOut, Buildings, LockSimple, Pause, Play, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { accrue } from "@/lib/accrue";
import { formatBps, formatDate, formatDuration, formatUnits, parseUnits } from "@/lib/accrue/format";
import { useChainClockOffset, useFunds, useTransaction, useUsdcBalance } from "@/lib/accrue/hooks";
import {
  getCloseFundInstruction,
  getDepositRevenueInstruction,
  getSetPausedInstruction,
  getSetPriceInstruction,
} from "@/lib/accrue/instructions";
import { accrue as accrueStream, splitFee } from "@/lib/accrue/math";
import type { Fund } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { TxStatus } from "../tx-status";
import { Amount, Button, EmptyState, Field, FundMark, Panel, Skeleton, Stat, StatusBadge, TextInput, buttonClass, cx } from "../ui";

export function ManageView() {
  return (
    <ConnectGate reason="to manage your funds">
      <Manage />
    </ConnectGate>
  );
}

function Manage() {
  const { address } = useWallet();
  const funds = useFunds();
  const [selected, setSelected] = useState<string | null>(null);
  useChainClockOffset();

  if (!funds.data) {
    return (
      <div aria-busy="true" aria-label="Loading your funds" className="flex flex-col gap-6">
        <Skeleton className="h-11 w-80 max-w-full" />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-96 rounded-panel" />
          <Skeleton className="h-96 rounded-panel" />
        </div>
      </div>
    );
  }

  const mine = funds.data.filter((f) => f.manager === address);
  if (mine.length === 0) {
    return (
      <EmptyState
        icon={<Buildings size={28} />}
        title="You do not manage any funds"
        body="Funds you create are managed from this wallet. Create one to start taking investments."
        action={
          <Link href="/funds/new" className={buttonClass("primary")}>
            Create a fund
          </Link>
        }
      />
    );
  }

  const fund = mine.find((f) => f.mint === selected) ?? mine[0];

  return (
    <div className="flex flex-col gap-6">
      {mine.length > 1 ? (
        <>
          <div className="sm:hidden">
            <label htmlFor="fund-pick" className="text-sm font-medium text-ink">
              Fund
            </label>
            <select
              id="fund-pick"
              value={fund.mint}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-2 h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-ink"
            >
              {mine.map((f) => (
                <option key={f.mint} value={f.mint}>
                  {f.metadata.name}
                </option>
              ))}
            </select>
          </div>
          <div role="tablist" aria-label="Your funds" className="hidden w-fit gap-1 rounded-control bg-sunk p-1 sm:flex">
            {mine.map((f) => (
              <button
                key={f.mint}
                role="tab"
                type="button"
                aria-selected={f.mint === fund.mint}
                onClick={() => setSelected(f.mint)}
                className={cx("h-9 rounded-[8px] px-3 text-sm", f.mint === fund.mint ? "bg-surface font-medium text-ink" : "text-muted hover:text-ink")}
              >
                {f.metadata.symbol}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <ManagedFund key={fund.mint} fund={fund} />
    </div>
  );
}

function ManagedFund({ fund }: { fund: Fund }) {
  const unclaimed = fund.totalIncome - fund.totalClaimed;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <FundMark symbol={fund.metadata.symbol} image={fund.metadata.image} size={44} />
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{fund.metadata.name}</h2>
        <StatusBadge paused={fund.paused} closed={fund.closed} />
        <Link href={`/funds/${fund.mint}`} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
          Public page <ArrowSquareOut size={14} aria-hidden />
        </Link>
      </div>

      <Panel className="p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Raised">
            <Amount value={fund.totalRaised} decimals={0} />
          </Stat>
          <Stat label="Income to holders">
            <Amount value={fund.totalIncome} />
          </Stat>
          <Stat label="Fees to treasury">
            <Amount value={fund.totalFees} />
          </Stat>
          <Stat label="Unclaimed in vault">
            <Amount value={unclaimed} />
          </Stat>
        </dl>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <DepositIncome fund={fund} />
        <div className="flex flex-col gap-6">
          <SetPrice fund={fund} />
          <PauseControl fund={fund} />
          <CloseFund fund={fund} />
        </div>
      </div>
    </div>
  );
}

function DepositIncome({ fund }: { fund: Fund }) {
  const id = useId();
  const { address } = useWallet();
  const usdc = useUsdcBalance(address);
  const tx = useTransaction();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const amount = parseUnits(value);
  const nowSec = BigInt(Math.floor(accrue.now() / 1000));
  const leftover = accrueStream(fund, nowSec).streamRemaining;
  const { fee, net } = splitFee(amount ?? 0n, fund.feeBps);
  const streamed = leftover + net;
  const perDay = (streamed * 86_400n) / fund.streamPeriod;

  const error =
    amount === null
      ? "Enter an amount in USDC."
      : amount <= 0n
        ? "Enter an amount greater than zero."
        : usdc.data !== undefined && amount > usdc.data
          ? `You have $${formatUnits(usdc.data, 2)} Test USDC.`
          : fund.totalSupply === 0n
            ? "Nobody holds shares yet, so there is no one to pay."
            : null;
  const shown = touched ? error : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (error || !address || !amount) return;
    if (await tx.run(address, [getDepositRevenueInstruction({ manager: address, mint: fund.mint, amount })])) {
      setValue("");
      setTouched(false);
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-ink">Deposit income</h3>
      <p className="mt-1 text-sm text-muted">
        Streams to holders over {formatDuration(fund.streamPeriod)}, split by shares held each second.
      </p>
      {fund.paused ? (
        <p className="mt-4 flex gap-2 rounded-control bg-sunk p-4 text-sm text-ink">
          <Pause size={18} className="shrink-0 text-accent" aria-hidden /> Deposits are blocked while the fund is paused. Resume it to deposit.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          <Field
            label="Gross income"
            htmlFor={id}
            error={shown}
            help={
              <>
                Wallet balance {usdc.data !== undefined ? <span className="num">${formatUnits(usdc.data, 2)}</span> : "loading"} Test USDC.
              </>
            }
          >
            <TextInput
              id={id}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              prefix="$"
              suffix="USDC"
              value={value}
              invalid={!!shown}
              disabled={tx.busy}
              onChange={(e) => {
                setValue(e.target.value);
                if (tx.state.phase === "success" || tx.state.phase === "error") tx.reset();
              }}
              onBlur={() => value !== "" && setTouched(true)}
            />
          </Field>

          <div className="rounded-control bg-sunk p-4">
            <p className="text-sm font-medium text-ink">Fee split</p>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Row label={`Management fee (${formatBps(fund.feeBps)}) to treasury`} value={fee} />
              <Row label="Net to income vault" value={net} strong />
              {leftover > 0n ? <Row label="Still streaming from the last deposit" value={leftover} /> : null}
            </dl>
            <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
              {streamed > 0n ? (
                <>
                  <span className="num text-ink">${formatUnits(streamed, 2)}</span> streams until{" "}
                  {formatDate(nowSec + fund.streamPeriod)}, about <span className="num text-ink">${formatUnits(perDay, 2)}</span> a day.
                </>
              ) : (
                "Enter an amount to preview the stream."
              )}
            </p>
          </div>

          <Button type="submit" variant="accent" disabled={tx.busy || (touched && !!error)}>
            {tx.state.phase === "signing" ? "Approve in wallet" : tx.state.phase === "confirming" ? "Confirming" : "Deposit income"}
          </Button>
          <TxStatus state={tx.state} success="Deposited. Holders are earning from this deposit now." />
        </form>
      )}
    </Panel>
  );
}

function Row({ label, value, strong }: { label: string; value: bigint; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={cx("shrink-0", strong ? "font-medium text-ink" : "text-ink")}>
        <Amount value={value} />
      </dd>
    </div>
  );
}

function SetPrice({ fund }: { fund: Fund }) {
  const id = useId();
  const { address } = useWallet();
  const tx = useTransaction();
  const [value, setValue] = useState("");
  const price = parseUnits(value);
  const error =
    value === "" ? null : price === null || price <= 0n ? "Enter a price above zero." : price === fund.price ? "That is the current price." : null;

  return (
    <Panel className="p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-ink">Share price</h3>
      <p className="mt-1 text-sm text-muted">
        Now <Amount value={fund.price} className="text-ink" /> per share. A new price applies to new investments only and is logged publicly.
      </p>
      <form
        noValidate
        className="mt-4 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!address || !price || error) return;
          if (await tx.run(address, [getSetPriceInstruction({ manager: address, mint: fund.mint, price })])) setValue("");
        }}
      >
        <Field label="New price" htmlFor={id} error={error}>
          <TextInput
            id={id}
            inputMode="decimal"
            autoComplete="off"
            placeholder={formatUnits(fund.price, 2)}
            prefix="$"
            suffix="USDC"
            value={value}
            invalid={!!error}
            disabled={tx.busy}
            onChange={(e) => {
              setValue(e.target.value);
              if (tx.state.phase !== "idle" && !tx.busy) tx.reset();
            }}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={tx.busy || !price || !!error}>
          {tx.busy ? "Updating" : "Update price"}
        </Button>
        <TxStatus state={tx.state} success="Price updated for new investments." />
      </form>
    </Panel>
  );
}

function PauseControl({ fund }: { fund: Fund }) {
  const { address } = useWallet();
  const tx = useTransaction();
  const [target, setTarget] = useState(!fund.paused);
  return (
    <Panel className="p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-ink">{fund.paused ? "Fund is paused" : "Pause"}</h3>
      <p className="mt-1 text-sm text-muted">
        Pausing blocks investing, income deposits and share transfers. Holders can always claim what they have earned.
      </p>
      <Button
        className="mt-4"
        variant={fund.paused ? "primary" : "secondary"}
        disabled={tx.busy}
        onClick={() => {
          if (!address) return;
          setTarget(!fund.paused);
          tx.run(address, [getSetPausedInstruction({ manager: address, mint: fund.mint, paused: !fund.paused })]);
        }}
      >
        {fund.paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
        {tx.busy ? "Updating" : fund.paused ? "Resume fund" : "Pause fund"}
      </Button>
      <TxStatus className="mt-3" state={tx.state} success={target ? "Fund paused. Claims still work." : "Fund resumed."} />
    </Panel>
  );
}

function CloseFund({ fund }: { fund: Fund }) {
  const { address } = useWallet();
  const tx = useTransaction();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const inputId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (fund.closed) {
    return (
      <Panel className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <LockSimple size={20} className="text-accent" aria-hidden /> Closed to new investment
        </h3>
        <p className="mt-1 text-sm text-muted">Closing is permanent. You can keep depositing income and holders keep claiming.</p>
      </Panel>
    );
  }

  const done = tx.state.phase === "success";

  return (
    <Panel className="p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-ink">Close fund</h3>
      <p className="mt-1 text-sm text-muted">Stops new investment for good. Income deposits and claims continue.</p>
      <Button className="mt-4" variant="danger" onClick={() => setOpen(true)}>
        Close fund
      </Button>

      <dialog
        ref={ref}
        onClose={() => {
          setOpen(false);
          setConfirm("");
          if (!tx.busy) tx.reset();
        }}
        aria-labelledby={`${inputId}-title`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-6 text-ink backdrop:bg-[#283618]/45"
      >
        <h2 id={`${inputId}-title`} className="flex items-center gap-2 text-lg font-semibold">
          <WarningCircle size={22} className="text-danger" aria-hidden /> Close {fund.metadata.name}?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Nobody will be able to invest again, and this cannot be undone. Existing holders keep earning, you can still deposit income, and claims keep working.
        </p>
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!address || confirm !== fund.metadata.symbol) return;
            await tx.run(address, [getCloseFundInstruction({ manager: address, mint: fund.mint })]);
          }}
        >
          <Field label={`Type ${fund.metadata.symbol} to confirm`} htmlFor={inputId}>
            <TextInput id={inputId} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" disabled={tx.busy || done} />
          </Field>
          <TxStatus state={tx.state} success="Fund closed to new investment." />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={tx.busy}>
              {done ? "Done" : "Cancel"}
            </Button>
            {!done ? (
              <Button type="submit" variant="danger" disabled={tx.busy || confirm !== fund.metadata.symbol}>
                {tx.busy ? "Closing" : "Close fund"}
              </Button>
            ) : null}
          </div>
        </form>
      </dialog>
    </Panel>
  );
}
