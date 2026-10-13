"use client";

import { ArrowSquareOut, CheckCircle, HourglassMedium, Signature as SignatureIcon, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { accrue } from "@/lib/accrue";
import { shortAddress } from "@/lib/accrue/format";
import type { TxState } from "@/lib/accrue/hooks";
import { duration, ease, spring } from "./motion";
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

const PHASE_ICON = {
  signing: SignatureIcon,
  confirming: HourglassMedium,
  success: CheckCircle,
  error: WarningCircle,
} as const;

/**
 * Inline progress for one transaction. Announced to screen readers as it changes.
 * The icon morphs between phases so the move from signing to confirming to done is visible;
 * success adds one amber pulse.
 */
export function TxStatus({ state, success, className }: { state: TxState; success: string; className?: string }) {
  if (state.phase === "idle") return <div aria-live="polite" className="sr-only" />;
  const Icon = PHASE_ICON[state.phase];
  return (
    <div aria-live="polite" className={cx("rounded-control border px-4 py-3 text-sm transition-colors duration-300", tone(state.phase), className)}>
      <div className="flex gap-3">
        <span className="relative mt-0.5 inline-flex size-5 shrink-0" aria-hidden>
          {state.phase === "success" ? (
            <motion.span
              key={state.signature}
              className="absolute inset-0 rounded-full bg-income"
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.6, ease }}
            />
          ) : null}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={state.phase}
              className={cx("absolute inset-0 inline-flex", state.phase === "error" ? "text-danger" : "text-accent")}
              initial={{ scale: 0.4, opacity: 0, rotate: -40 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={spring}
            >
              <Icon size={20} weight={state.phase === "success" ? "fill" : "regular"} />
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.phase}
            className="flex min-w-0 flex-col gap-1"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease }}
          >
            {state.phase === "signing" && <Step n={1} title="Waiting for your signature" body="Approve the transaction in your wallet." />}
            {state.phase === "confirming" && (
              <Step n={2} title="Confirming on devnet" body={state.signature ? <Signature signature={state.signature} /> : "Sending the transaction."} />
            )}
            {state.phase === "success" && (
              <>
                <p className="font-medium text-ink">{success}</p>
                <Signature signature={state.signature} />
              </>
            )}
            {state.phase === "error" && (
              <div role="alert" className="flex flex-col gap-1">
                <p className="font-medium text-danger">{state.title}</p>
                <p className="text-ink">{state.detail}</p>
                {state.signature ? <Signature signature={state.signature} /> : null}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
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
    <>
      <p className="font-medium text-ink">
        <span className="sr-only">Step {n} of 2: </span>
        {title}
      </p>
      <p className="text-muted">{body}</p>
    </>
  );
}
