"use client";

import { ArrowSquareOut, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { accrue } from "@/lib/accrue";
import { shortAddress } from "@/lib/accrue/format";
import type { TxState } from "@/lib/accrue/hooks";
import { cx } from "./ui";

function Signature({ signature }: { signature: string }) {
  const url = accrue.explorerTxUrl(signature);
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-strong underline-offset-4 hover:underline">
        View on Solana Explorer <ArrowSquareOut size={16} aria-hidden />
      </a>
    );
  }
  return (
    <span className="text-muted">
      Signature <span className="num">{shortAddress(signature, 6)}</span> (simulated, not on Explorer)
    </span>
  );
}

/** Inline progress for one transaction. Announced to screen readers as it changes. */
export function TxStatus({ state, success, className }: { state: TxState; success: string; className?: string }) {
  if (state.phase === "idle") return <div aria-live="polite" className="sr-only" />;
  return (
    <div aria-live="polite" className={cx("rounded-control border px-4 py-3 text-sm", tone(state.phase), className)}>
      {state.phase === "signing" && (
        <Step n={1} title="Waiting for your signature" body="Approve the transaction in your wallet." />
      )}
      {state.phase === "confirming" && (
        <Step n={2} title="Confirming on devnet" body={state.signature ? <Signature signature={state.signature} /> : "Sending the transaction."} />
      )}
      {state.phase === "success" && (
        <div className="flex gap-3">
          <CheckCircle size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-ink">{success}</p>
            <Signature signature={state.signature} />
          </div>
        </div>
      )}
      {state.phase === "error" && (
        <div className="flex gap-3" role="alert">
          <WarningCircle size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-danger">{state.title}</p>
            <p className="text-ink">{state.detail}</p>
            {state.signature ? <Signature signature={state.signature} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function tone(phase: TxState["phase"]) {
  if (phase === "error") return "border-danger bg-danger-soft";
  if (phase === "success") return "border-line bg-sunk";
  return "border-line bg-surface";
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="relative mt-1 inline-flex size-3 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
        <span className="relative size-3 rounded-full bg-accent" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">
          <span className="sr-only">Step {n} of 2: </span>
          {title}
        </p>
        <p className="text-muted">{body}</p>
      </div>
    </div>
  );
}
