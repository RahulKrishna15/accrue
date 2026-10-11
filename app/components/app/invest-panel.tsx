"use client";

import { LockSimple, PauseCircle } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { getInvestInstruction } from "@/lib/accrue/instructions";
import { formatUnits, parseUnits } from "@/lib/accrue/format";
import { useTransaction, useUsdcBalance } from "@/lib/accrue/hooks";
import { sharesForUsdc } from "@/lib/accrue/math";
import type { Fund } from "@/lib/accrue/types";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { TxStatus } from "../tx-status";
import { Amount, Button, Field, Panel, TextInput } from "../ui";

export function investError(fund: Fund, amount: bigint | null, balance: bigint | undefined): string | null {
  if (amount === null) return "Enter an amount in USDC.";
  if (amount <= 0n) return "Enter an amount greater than zero.";
  if (amount < fund.minInvestment) return `The minimum investment is $${formatUnits(fund.minInvestment, 2)}.`;
  const room = fund.sizeCap - fund.totalRaised;
  if (amount > room) return `Only $${formatUnits(room, 2)} of capacity is left before the cap.`;
  if (balance !== undefined && amount > balance) return `You have $${formatUnits(balance, 2)} Test USDC.`;
  if (sharesForUsdc(amount, fund.price) === 0n) return "This amount is too small to buy any shares.";
  return null;
}

export function InvestPanel({ fund }: { fund: Fund }) {
  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">Invest</h2>
      <div className="mt-4">
        {fund.paused ? (
          <Blocked icon={<PauseCircle size={22} />} title="Investing is paused">
            The manager paused this fund. Investing, income deposits and transfers are blocked until it resumes. Holders can still claim income.
          </Blocked>
        ) : fund.closed ? (
          <Blocked icon={<LockSimple size={22} />} title="Closed to new investment">
            Existing holders keep earning and can claim any time. Shares can still change hands through the Transfer page.
          </Blocked>
        ) : fund.totalRaised >= fund.sizeCap ? (
          <Blocked icon={<LockSimple size={22} />} title="This fund is full">
            It has reached its size cap of ${formatUnits(fund.sizeCap, 0)}.
          </Blocked>
        ) : (
          <ConnectGate reason="to invest">
            <InvestForm fund={fund} />
          </ConnectGate>
        )}
      </div>
    </Panel>
  );
}

function Blocked({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-control bg-sunk p-4">
      <span className="text-accent" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

function InvestForm({ fund }: { fund: Fund }) {
  const id = useId();
  const { address } = useWallet();
  const balance = useUsdcBalance(address);
  const tx = useTransaction();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const amount = parseUnits(value);
  const error = investError(fund, amount, balance.data);
  const shares = amount ? sharesForUsdc(amount, fund.price) : 0n;
  const showError = touched ? error : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (error || !address || !amount) return;
    const ok = await tx.run(address, [getInvestInstruction({ investor: address, mint: fund.mint, usdcAmount: amount })]);
    if (ok) {
      setValue("");
      setTouched(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label="Amount"
        htmlFor={id}
        error={showError}
        help={
          <>
            Minimum <span className="num">${formatUnits(fund.minInvestment, 2)}</span>. Balance{" "}
            {balance.data !== undefined ? <span className="num">${formatUnits(balance.data, 2)}</span> : "loading"}.
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
          invalid={!!showError}
          disabled={tx.busy}
          onChange={(e) => {
            setValue(e.target.value);
            if (tx.state.phase === "success" || tx.state.phase === "error") tx.reset();
          }}
          onBlur={() => value !== "" && setTouched(true)}
        />
      </Field>

      <dl className="grid grid-cols-2 gap-3 rounded-control bg-sunk p-4 text-sm">
        <div>
          <dt className="text-muted">You receive</dt>
          <dd className="num mt-0.5 text-lg text-ink">{formatUnits(shares, 2)}</dd>
          <dd className="text-muted">{fund.metadata.symbol} shares</dd>
        </div>
        <div>
          <dt className="text-muted">Price per share</dt>
          <dd className="mt-0.5 text-lg text-ink">
            <Amount value={fund.price} />
          </dd>
          <dd className="text-muted">tokens = USDC ÷ price</dd>
        </div>
      </dl>

      <p className="text-sm text-muted">
        Your USDC goes to the fund treasury. Income is paid separately and your share count never changes.
      </p>

      <Button type="submit" variant="accent" size="lg" disabled={tx.busy || (touched && !!error)}>
        {tx.state.phase === "signing" ? "Approve in wallet" : tx.state.phase === "confirming" ? "Confirming" : "Invest"}
      </Button>
      <TxStatus state={tx.state} success={`Invested. Your ${fund.metadata.symbol} shares are in your wallet and start earning now.`} />
    </form>
  );
}
