"use client";

import { isAddress, type Address } from "@solana/kit";
import { ArrowRight, ArrowsLeftRight, Info, UserPlus } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import { formatUnits, parseUnits, shortAddress } from "@/lib/accrue/format";
import { useHolder, usePositions, useTransaction } from "@/lib/accrue/hooks";
import { getRegisterHolderInstruction, getTransferCheckedWithHookInstruction, type AccrueInstruction } from "@/lib/accrue/instructions";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { duration, ease, spring } from "../motion";
import { TxStatus } from "../tx-status";
import { Button, EmptyState, Field, Panel, Select, Skeleton, TextInput, buttonClass, cx } from "../ui";

export function TransferView() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <ConnectGate reason="to send shares">
        <TransferForm />
      </ConnectGate>
      <aside className="flex flex-col gap-4 rounded-panel bg-sunk p-5 text-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          <Info size={18} className="text-accent" aria-hidden /> Why send from here
        </h2>
        <p className="text-muted">
          Every share transfer runs Accrue&apos;s Transfer Hook, which settles income for both wallets at their old balances. The hook needs extra accounts: the fund config and a Holder account for each side.
        </p>
        <p className="text-muted">
          The hook cannot create accounts. When the recipient has never held this fund, the app adds <code className="font-mono text-[0.9em] text-ink">register_holder</code> to the same transaction so the transfer can go through.
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
  const sending = amount !== null && !errors.amount ? `${formatUnits(amount, 2)} ${fund.metadata.symbol}` : null;
  const sendingShort = amount !== null && !errors.amount ? formatUnits(amount, 2) : null;
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
            <Select
              id={`${id}-fund`}
              value={fund.mint}
              onChange={(e) => {
                setMint(e.target.value);
                resetTx();
              }}
            >
              {held.map((p) => (
                <option key={p.fund.mint} value={p.fund.mint}>
                  {p.fund.metadata.name} ({formatUnits(p.balance, 2)} {p.fund.metadata.symbol})
                </option>
              ))}
            </Select>
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

        <AnimatePresence initial={false}>
          {validRecipient && recipient !== address ? (
            <motion.div
              key="route"
              layout="position"
              className="flex flex-col gap-3"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: duration.base, ease }}
            >
              <Route
                from={address ? shortAddress(address) : "Your wallet"}
                to={shortAddress(recipient)}
                label={sending}
                shortLabel={sendingShort}
                replay={`${recipient}:${sending ? "amount" : "none"}`}
              />
              <div className={cx("rounded-control p-4 text-sm transition-colors duration-300", needsRegister ? "bg-accent-soft" : "bg-sunk")} aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={receiver.status === "loading" ? "loading" : needsRegister ? "register" : "known"}
                    className="flex gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: duration.fast }}
                  >
                    {receiver.status === "loading" ? (
                      <span className="text-muted">Checking the recipient&apos;s Holder account</span>
                    ) : needsRegister ? (
                      <>
                        <UserPlus size={20} className="shrink-0 text-accent-strong" aria-hidden />
                        <p className="text-ink">
                          <span className="num">{shortAddress(recipient)}</span> has never held {fund.metadata.symbol}. This transaction also runs{" "}
                          <code className="font-mono text-[0.9em]">register_holder</code> to create their Holder account. You pay its small rent deposit in SOL.
                        </p>
                      </>
                    ) : (
                      <p className="text-muted">The recipient already has a Holder account for {fund.metadata.symbol}. Only the transfer is needed.</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Slides as one block when the recipient notice above opens or closes. */}
        <motion.div layout="position" transition={{ duration: duration.base, ease }} className="flex flex-col gap-5">
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
        </motion.div>
      </form>
    </Panel>
  );
}

/** Sender and receiver with an arrow that travels from one to the other whenever either side or the amount changes. */
function Route({
  from,
  to,
  label,
  shortLabel,
  replay,
}: {
  from: string;
  to: string;
  label: string | null;
  shortLabel: string | null;
  replay: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,auto)_1fr_minmax(0,auto)] items-center gap-3 rounded-control border border-line px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="text-xs text-muted">From you</p>
        <p className="num truncate text-ink">{from}</p>
      </div>
      <div className="relative flex h-10 min-w-12 items-center overflow-hidden" aria-hidden>
        {label ? (
          <span className="num absolute inset-x-0 top-0 truncate text-center text-xs text-muted">
            <span className="sm:hidden">{shortLabel}</span>
            <span className="max-sm:hidden">{label}</span>
          </span>
        ) : null}
        <motion.div
          key={replay}
          className="flex w-full items-center text-accent"
          initial={{ x: "-70%", opacity: 0 }}
          animate={{ x: "0%", opacity: 1 }}
          transition={spring}
        >
          <span className="h-px flex-1 bg-current" />
          <ArrowRight size={16} weight="bold" className="-ml-1 shrink-0" />
        </motion.div>
      </div>
      <div className="min-w-0 text-right">
        <p className="text-xs text-muted">To</p>
        <p className="num truncate text-ink">{to}</p>
      </div>
      <p className="sr-only">
        Sending {label ?? "shares"} from your wallet {from} to {to}.
      </p>
    </div>
  );
}
