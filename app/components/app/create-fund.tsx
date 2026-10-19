"use client";

import type { Address } from "@solana/kit";
import { ArrowRight, Check } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { accrue } from "@/lib/accrue";
import { MAX_FEE_BPS, SECONDS_PER_DAY } from "@/lib/accrue/constants";
import { formatUnits, parseUnits } from "@/lib/accrue/format";
import { useTransaction } from "@/lib/accrue/hooks";
import { getInitExtraAccountMetaListInstruction, getInitializeFundInstruction } from "@/lib/accrue/instructions";
import { useWallet } from "@/lib/wallet/context";
import { ConnectGate } from "../connect-gate";
import { TxStatus } from "../tx-status";
import { Button, Field, FundMark, Panel, TextInput, buttonClass, cx } from "../ui";

type Form = {
  name: string;
  symbol: string;
  image: string;
  price: string;
  fee: string;
  min: string;
  cap: string;
  period: string;
};

const initial: Form = { name: "", symbol: "", image: "", price: "1.00", fee: "5", min: "100", cap: "1000000", period: "30" };

/** Unfinished form input survives leaving the page and reloads; it is cleared once the fund is created. */
const DRAFT_KEY = "accrue-create-fund-draft";
const isInitial = (f: Form) => (Object.keys(initial) as (keyof Form)[]).every((k) => f[k] === initial[k]);

function loadDraft(): Form {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...initial, ...(JSON.parse(raw) as Partial<Form>) } : initial;
  } catch {
    return initial;
  }
}

function saveDraft(f: Form | null) {
  try {
    if (!f || isInitial(f)) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
  } catch {
    // Storage blocked (private mode): the draft just isn't kept.
  }
}
const PERIODS = ["7", "30", "90"];

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.name.trim()) e.name = "Give the fund a name.";
  else if (f.name.trim().length > 32) e.name = "Use 32 characters or fewer.";
  if (!/^[A-Z0-9]{2,10}$/.test(f.symbol)) e.symbol = "Use 2 to 10 capital letters or digits.";
  if (f.image && !/^https:\/\/\S+$/.test(f.image)) e.image = "Use an https:// image link, or leave it empty.";
  const price = parseUnits(f.price);
  if (price === null || price <= 0n) e.price = "Enter a price above zero.";
  const fee = Number(f.fee);
  if (f.fee === "" || Number.isNaN(fee) || fee < 0) e.fee = "Enter a fee between 0 and 10%.";
  else if (Math.round(fee * 100) > MAX_FEE_BPS) e.fee = "The management fee cannot be more than 10%.";
  else if (Math.round(fee * 100) !== fee * 100) e.fee = "Use at most two decimals.";
  const min = parseUnits(f.min);
  const cap = parseUnits(f.cap);
  if (min === null) e.min = "Enter a minimum, or 0 for none.";
  if (cap === null || cap <= 0n) e.cap = "Enter a size cap above zero.";
  else if (min !== null && min > cap) e.min = "The minimum cannot be larger than the size cap.";
  const days = Number(f.period);
  if (!Number.isInteger(days) || days < 1 || days > 365) e.period = "Use a whole number of days from 1 to 365.";
  return e;
}

export function CreateFund() {
  return (
    <ConnectGate reason="to create a fund. That wallet becomes the fund manager">
      <CreateFundForm />
    </ConnectGate>
  );
}

function CreateFundForm() {
  const id = useId();
  const { address } = useWallet();
  const tx = useTransaction();
  // Mounts only in the browser (ConnectGate shows a skeleton until wallet state is known), so storage is safe to read here.
  const [f, setF] = useState<Form>(loadDraft);
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<Address | null>(null);
  const errors = useMemo(() => validate(f), [f]);
  const createdRef = useRef(false);
  const { reset: resetTx } = tx;

  // Keep the draft in step with the form, but never re-save a form that was just submitted.
  useEffect(() => {
    if (!createdRef.current) saveDraft(f);
  }, [f]);

  // Next keeps this page alive in the background (cacheComponents), and hiding it runs effect cleanups.
  // After a successful create, leaving the page resets it, so coming back opens an empty form.
  useEffect(
    () => () => {
      if (!createdRef.current) return;
      createdRef.current = false;
      setCreated(null);
      setF(initial);
      setTouched({});
      setSubmitted(false);
      resetTx();
    },
    [resetTx],
  );

  const clearDraft = () => {
    setF(initial);
    setTouched({});
    setSubmitted(false);
  };
  const err = (k: keyof Form) => ((touched[k] || submitted) && errors[k]) || null;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: k === "symbol" ? e.target.value.toUpperCase() : e.target.value }));
  const blur = (k: keyof Form) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length || !address) return;
    const mint = await accrue.generateMintAddress();
    const ok = await tx.run(address, [
      getInitializeFundInstruction({
        manager: address,
        mint,
        name: f.name.trim(),
        symbol: f.symbol,
        image: f.image,
        price: parseUnits(f.price)!,
        feeBps: Math.round(Number(f.fee) * 100),
        minInvestment: parseUnits(f.min)!,
        sizeCap: parseUnits(f.cap)!,
        streamPeriod: BigInt(f.period) * SECONDS_PER_DAY,
      }),
      getInitExtraAccountMetaListInstruction({ payer: address, mint }),
    ]);
    if (ok) {
      createdRef.current = true;
      saveDraft(null);
      setCreated(mint);
    }
  }

  if (created && tx.state.phase === "success") {
    return (
      <Panel className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <Check size={22} aria-hidden />
        </span>
        <h2 className="text-2xl font-semibold text-ink">{f.name.trim()} is live</h2>
        <p className="max-w-[60ch] text-muted">
          The share mint, its Transfer Hook account list and the fund config are created. Share the fund page with investors, then deposit income from Manage.
        </p>
        <TxStatus state={tx.state} success="Fund created on devnet." className="w-full" />
        <div className="flex flex-wrap gap-3">
          <Link href={`/funds/${created}`} className={buttonClass("primary")}>
            Open fund page <ArrowRight size={16} aria-hidden />
          </Link>
          <Link href="/manage" className={buttonClass("secondary")}>
            Go to Manage
          </Link>
        </div>
      </Panel>
    );
  }

  const fee = Number(f.fee);
  const sym = f.symbol || "SYM";

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-5" disabled={tx.busy}>
          <legend className="mb-4 text-lg font-semibold text-ink">Token</legend>
          <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
            <Field label="Fund name" htmlFor={`${id}-name`} error={err("name")} help="Stored in the share mint's token metadata.">
              <TextInput id={`${id}-name`} value={f.name} onChange={set("name")} onBlur={blur("name")} invalid={!!err("name")} placeholder="e.g. Meridian Trade Credit" maxLength={40} />
            </Field>
            <Field label="Symbol" htmlFor={`${id}-symbol`} error={err("symbol")} help="2 to 10 characters.">
              <TextInput id={`${id}-symbol`} value={f.symbol} onChange={set("symbol")} onBlur={blur("symbol")} invalid={!!err("symbol")} placeholder="MTC" maxLength={10} className="num" />
            </Field>
          </div>
          <Field label="Logo image link (optional)" htmlFor={`${id}-image`} error={err("image")} help="A square https:// image. Without one, the symbol is used as the mark.">
            <div className="flex items-center gap-3">
              <FundMark symbol={sym} image={errors.image ? "" : f.image} size={44} />
              <TextInput id={`${id}-image`} value={f.image} onChange={set("image")} onBlur={blur("image")} invalid={!!err("image")} placeholder="https://" type="url" className="flex-1" />
            </div>
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-5 border-t border-line pt-8" disabled={tx.busy}>
          <legend className="sr-only">Terms</legend>
          <p className="text-lg font-semibold text-ink" aria-hidden>
            Terms
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Price per share" htmlFor={`${id}-price`} error={err("price")} help="tokens = USDC ÷ price. You can change it later.">
              <TextInput id={`${id}-price`} value={f.price} onChange={set("price")} onBlur={blur("price")} invalid={!!err("price")} inputMode="decimal" prefix="$" suffix="USDC" />
            </Field>
            <Field label="Management fee" htmlFor={`${id}-fee`} error={err("fee")} help="Taken from each income deposit. Max 10%.">
              <TextInput id={`${id}-fee`} value={f.fee} onChange={set("fee")} onBlur={blur("fee")} invalid={!!err("fee")} inputMode="decimal" suffix="%" />
            </Field>
            <Field label="Minimum investment" htmlFor={`${id}-min`} error={err("min")}>
              <TextInput id={`${id}-min`} value={f.min} onChange={set("min")} onBlur={blur("min")} invalid={!!err("min")} inputMode="decimal" prefix="$" suffix="USDC" />
            </Field>
            <Field label="Size cap" htmlFor={`${id}-cap`} error={err("cap")} help="Most USDC the fund will accept in total.">
              <TextInput id={`${id}-cap`} value={f.cap} onChange={set("cap")} onBlur={blur("cap")} invalid={!!err("cap")} inputMode="decimal" prefix="$" suffix="USDC" />
            </Field>
          </div>
          <Field label="Stream period" htmlFor={`${id}-period`} error={err("period")} help="How long each income deposit takes to pay out.">
            <div className="flex flex-wrap items-center gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setF((x) => ({ ...x, period: p }))}
                  aria-pressed={f.period === p}
                  className={cx("press h-11 rounded-control border px-4 text-sm", f.period === p ? "border-ink bg-sunk font-medium text-ink" : "border-line-strong text-ink hover:bg-sunk")}
                >
                  {p} days
                </button>
              ))}
              <TextInput id={`${id}-period`} value={f.period} onChange={set("period")} onBlur={blur("period")} invalid={!!err("period")} inputMode="numeric" suffix="days" className="w-32" aria-label="Stream period in days" />
            </div>
          </Field>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <Panel className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Summary</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <SummaryRow label="Investor pays" value={`$${f.price || "0"} per ${sym}`} />
            <SummaryRow label="On a $10,000 deposit" value={Number.isNaN(fee) || errors.fee ? "Fix the fee" : `$${formatUnits(BigInt(Math.round(fee * 100)) * 1_000_000n, 2)} fee`} />
            <SummaryRow label="Pays out over" value={`${f.period || "?"} days`} />
          </dl>
          <div className="border-t border-line pt-4 text-sm text-muted">
            <p>One transaction, two instructions:</p>
            <ul className="num mt-2 flex flex-col gap-1 text-ink">
              <li>initialize_fund</li>
              <li>init_extra_account_meta_list</li>
            </ul>
            <p className="mt-2">Creates the Token-2022 share mint with the Transfer Hook and metadata. Mint authority is the fund config.</p>
          </div>
          <Button type="submit" variant="accent" size="lg" disabled={tx.busy}>
            {tx.state.phase === "signing" ? "Approve in wallet" : tx.state.phase === "confirming" ? "Confirming" : "Create fund"}
          </Button>
          {!isInitial(f) && tx.state.phase === "idle" ? (
            <p className="flex items-center justify-between gap-3 text-sm text-muted">
              Draft saved on this device.
              <button type="button" onClick={clearDraft} className="rounded-control font-medium text-accent-strong underline-offset-4 hover:underline">
                Start over
              </button>
            </p>
          ) : null}
          {submitted && Object.keys(errors).length > 0 && tx.state.phase === "idle" ? (
            <p className="text-sm text-danger" role="alert">
              Fix the highlighted fields first.
            </p>
          ) : null}
          <TxStatus state={tx.state} success="Fund created." />
        </Panel>
      </aside>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-right text-ink">{value}</dd>
    </div>
  );
}
