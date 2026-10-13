"use client";

import { Clock, Flask, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { accrue } from "@/lib/accrue";
import { useClientSnapshot } from "@/lib/accrue/hooks";
import { Button, cx } from "./ui";

const DAY = 86_400_000;

/** Mock-only panel for showing every transaction state on demand. Not rendered against a real program. */
export function DemoControls() {
  const demo = accrue.demo;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const state = useClientSnapshot(() => demo?.getState() ?? null, null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!demo || !state) return null;
  const days = Math.floor(state.clockOffsetMs / DAY);

  return (
    <div ref={ref} className="fixed right-4 bottom-4 z-40 flex flex-col items-end">
      {open ? (
        <div
          role="region"
          aria-label="Demo controls"
          className="mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-4 text-sm shadow-[0_20px_50px_-20px_var(--shadow)]"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink">Demo controls</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close demo controls" className="press inline-flex size-8 items-center justify-center rounded-control hover:bg-sunk">
              <X size={16} />
            </button>
          </div>

          <fieldset className="mt-3">
            <legend className="text-muted">Next transaction</legend>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-control bg-sunk p-1">
              {(
                [
                  ["normal", "Succeeds"],
                  ["reject", "Rejected"],
                  ["drop", "Expires"],
                ] as const
              ).map(([v, l]) => (
                <label
                  key={v}
                  className={cx(
                    "flex h-8 cursor-pointer items-center justify-center rounded-[8px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                    state.nextTx === v ? "bg-surface font-medium text-ink" : "text-muted",
                  )}
                >
                  <input type="radio" name="next-tx" value={v} checked={state.nextTx === v} onChange={() => demo.set({ nextTx: v })} className="sr-only" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 flex items-center justify-between gap-3">
            <span className="text-ink">Wallet on wrong network</span>
            <input type="checkbox" checked={state.wrongNetwork} onChange={(e) => demo.set({ wrongNetwork: e.target.checked })} className="size-4 accent-[var(--accent)]" />
          </label>

          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-muted">
              <Clock size={16} aria-hidden /> Chain clock {days > 0 ? <span className="num text-ink">+{days}d</span> : "is live"}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => demo.skipAhead(DAY)}>
                +1 day
              </Button>
              <Button size="sm" variant="secondary" onClick={() => demo.skipAhead(7 * DAY)}>
                +7 days
              </Button>
            </div>
          </div>

          <Button size="sm" variant="ghost" className="mt-4 -ml-3" onClick={() => demo.reset()}>
            Reset sample data
          </Button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink shadow-[0_10px_30px_-12px_var(--shadow)] hover:bg-sunk"
      >
        <Flask size={18} className="text-accent" aria-hidden /> Demo
      </button>
    </div>
  );
}
