"use client";

import { isAddress, type Address } from "@solana/kit";
import { ArrowsLeftRight, Info, UserPlus } from "@phosphor-icons/react";
import Link from "next/link";
import { useId, useState } from "react";
import { formatUnits, parseUnits, shortAddress } from "@/lib/accrue/format";
import { useHolder, usePositions, useTransaction } from "@/lib/accrue/hooks";
import { getRegisterHolderInstruction, getTransferCheckedWithHookInstruction, type AccrueInstruction } from "@/lib/accrue/instructions";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { TxStatus } from "../tx-status";
import { Button, EmptyState, Field, Panel, Skeleton, TextInput, buttonClass, cx } from "../ui";

export function TransferView() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <ConnectGate reason="to send shares">
        <TransferForm />
      </ConnectGate>
      <aside className="flex flex-col gap-4 rounded-panel bg-sunk p-5 text-sm sm:p-6 lg:self-start">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          <Info size={18} className="text-accent" aria-hidden /> Why send from here
        </h2>
        <p className="text-muted">
          Every share transfer runs Accrue&apos;s Transfer Hook, which settles income for both wallets at their old balances. The hook needs extra accounts: the fund config and a Holder account for each side.
        </p>
        <p className="text-muted">
          The hook cannot create accounts. When the recipient has never held this fund, the app adds <code className="num text-ink">register_holder</code> to the same transaction so the transfer can go through.
        </p>
        <p className="text-muted">
          Some wallets&apos; built-in Send does not attach the hook&apos;s extra accounts or the registration step, so the transfer fails. Sending from this page avoids that.
        </p>
      </aside>
    </div>
  );
}

function TransferForm() {
  const id = useId();
  const { address } = useWallet();
  const positions = usePositions(address);
  const tx = useTransaction();
  const [mint, setMint] = useState<string>("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const held = (positions.data ?? []).filter((p) => p.balance > 0n);
  const position = held.find((p) => p.fund.mint === mint) ?? held[0];
  const recipient = to.trim();
  const validRecipient = isAddress(recipient);
  const receiver = useHolder(position?.fund.mint ?? null, validRecipient ? (recipient as Address) : null);

  if (!positions.data) return <Skeleton className="h-96 rounded-panel" />;
  if (!position) {
    return (
      <EmptyState
        icon={<ArrowsLeftRight size={28} />}
        title="No shares to send"
        body="You need fund shares in this wallet before you can transfer them."
        action={
          <Link href="/funds" className={buttonClass("primary")}>
            Explore funds
          </Link>
        }
      />
    );
  }

  const fund = position.fund;
  const amount = parseUnits(value);
  const needsRegister = validRecipient && receiver.status === "success" && receiver.data === null;
  const errors = {
    to: !recipient ? "Enter the recipient's wallet address." : !validRecipient ? "That is not a valid Solana address." : recipient === address ? "You cannot send shares to yourself." : null,
    amount:
      amount === null
        ? "Enter how many shares to send."
        : amount <= 0n
          ? "Enter an amount greater than zero."
          : amount > position.balance
            ? `You hold ${formatUnits(position.balance, 2)} ${fund.metadata.symbol}.`
            : null,
  };
  const show = (k: keyof typeof errors, typed: string) => (submitted || typed !== "" ? errors[k] : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.to || errors.amount || !address || !amount || fund.paused) return;
    const ixs: AccrueInstruction[] = [];
    if (needsRegister) ixs.push(getRegisterHolderInstruction({ payer: address, mint: fund.mint, owner: recipient as Address }));
    ixs.push(getTransferCheckedWithHookInstruction({ owner: address, mint: fund.mint, destinationOwner: recipient as Address, amount }));
    if (await tx.run(address, ixs)) {
      setValue("");
      setSubmitted(false);
    }
  }

  const resetTx = () => {
    if (tx.state.phase === "success" || tx.state.phase === "error") tx.reset();
  };

  return (
    <Panel className="p-5 sm:p-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <fieldset disabled={tx.busy} className="flex flex-col gap-5">
          <Field label="Fund" htmlFor={`${id}-fund`}>
            <select
              id={`${id}-fund`}
              value={fund.mint}
              onChange={(e) => {
                setMint(e.target.value);
                resetTx();
              }}
              className="h-11 rounded-control border border-line-strong bg-surface px-3 text-ink"
            >
              {held.map((p) => (
                <option key={p.fund.mint} value={p.fund.mint}>
                  {p.fund.metadata.name} ({formatUnits(p.balance, 2)} {p.fund.metadata.symbol})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Recipient wallet" htmlFor={`${id}-to`} error={show("to", to)} help="A Solana address on devnet.">
            <TextInput
              id={`${id}-to`}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetTx();
              }}
              invalid={!!show("to", to)}
              autoComplete="off"
              spellCheck={false}
              className="num"
              placeholder="Address"
            />
          </Field>

          <Field label="Shares" htmlFor={`${id}-amount`} error={show("amount", value)} help={`You hold ${formatUnits(position.balance, 2)} ${fund.metadata.symbol}.`}>
            <div className="flex gap-2">
              <TextInput
                id={`${id}-amount`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  resetTx();
                }}
                invalid={!!show("amount", value)}
                inputMode="decimal"
                autoComplete="off"
                suffix={fund.metadata.symbol}
                className="flex-1"
              />
              <Button variant="secondary" onClick={() => setValue(formatUnits(position.balance, 6).replace(/,/g, ""))}>
                Max
              </Button>
            </div>
          </Field>
        </fieldset>

        {validRecipient && recipient !== address ? (
          <div className={cx("flex gap-3 rounded-control p-4 text-sm", needsRegister ? "bg-accent-soft" : "bg-sunk")} aria-live="polite">
            {receiver.status === "loading" ? (
              <span className="text-muted">Checking the recipient&apos;s Holder account</span>
            ) : needsRegister ? (
              <>
                <UserPlus size={20} className="shrink-0 text-accent-strong" aria-hidden />
                <p className="text-ink">
                  <span className="num">{shortAddress(recipient)}</span> has never held {fund.metadata.symbol}. This transaction also runs{" "}
                  <code className="num">register_holder</code> to create their Holder account. You pay its small rent deposit in SOL.
                </p>
              </>
            ) : (
              <p className="text-muted">The recipient already has a Holder account for {fund.metadata.symbol}. Only the transfer is needed.</p>
            )}
          </div>
        ) : null}

        <div className="rounded-control border border-line p-4 text-sm">
          <p className="font-medium text-ink">Income is not transferred</p>
          <p className="mt-1 text-muted">
            Income you earned before sending stays yours to claim. The recipient starts earning on these shares from the moment they arrive.
          </p>
        </div>

        {fund.paused ? (
          <p className="rounded-control bg-sunk p-4 text-sm text-ink" role="alert">
            {fund.metadata.name} is paused, so its shares cannot move. Claims still work.
          </p>
        ) : null}

        <Button type="submit" variant="accent" size="lg" disabled={tx.busy || fund.paused}>
          {tx.state.phase === "signing" ? "Approve in wallet" : tx.state.phase === "confirming" ? "Confirming" : "Send shares"}
        </Button>
        <TxStatus state={tx.state} success="Sent. Both wallets were settled by the Transfer Hook." />
      </form>
    </Panel>
  );
}
