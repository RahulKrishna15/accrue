"use client";

import { Question, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { GUIDES, type Guide, type GuideKey } from "@/lib/guide";
import { DataTable, RowTh, Td, Th } from "./data-table";

/**
 * "How this page works": a link-style button that opens a dialog with what the page is for,
 * where to start, and the words it uses. Native <dialog>: focus trap, Esc to close and an inert
 * background come from the platform. No import from ./ui, which renders this in PageHeader.
 */
export function PageGuide({ page, className }: { page: GuideKey; className?: string }) {
  const g: Guide = GUIDES[page];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-accent-strong underline-offset-4 hover:underline ${className ?? ""}`}
      >
        <Question size={16} aria-hidden />
        How this page works
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        aria-labelledby={titleId}
        className="m-auto max-h-[min(85vh,52rem)] w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_-30px_var(--lift)] backdrop:bg-[#283618]/40"
      >
        {/* Only the body scrolls, so the title and close button stay in view. */}
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
                How this page works
              </h2>
              <p className="mt-1 max-w-[56ch] leading-relaxed text-muted">{g.intro}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="press inline-flex size-9 shrink-0 items-center justify-center rounded-control hover:bg-sunk"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-7 overflow-y-auto px-6 py-6">
            {g.steps ? (
              <section aria-labelledby={`${titleId}-steps`}>
                <h3 id={`${titleId}-steps`} className="font-medium text-ink">
                  Where to start
                </h3>
                <ol className="mt-3 flex flex-col gap-3">
                  {g.steps.map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span
                        aria-hidden
                        className="num inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-ink"
                      >
                        {i + 1}
                      </span>
                      <span className="leading-relaxed text-ink">{s}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section aria-labelledby={`${titleId}-terms`}>
              <h3 id={`${titleId}-terms`} className="font-medium text-ink">
                Words on this page
              </h3>
              <DataTable caption="Words used on this page and what they mean" minWidth="0" className="mt-3">
                <thead>
                  <tr>
                    <Th className="w-[38%] sm:w-48">Term</Th>
                    <Th>Meaning</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.terms.map((t) => (
                    <tr key={t.term} className="[&>*]:align-top">
                      <RowTh>{t.term}</RowTh>
                      <Td className="leading-relaxed text-muted">{t.meaning}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </section>
          </div>
        </div>
      </dialog>
    </>
  );
}
