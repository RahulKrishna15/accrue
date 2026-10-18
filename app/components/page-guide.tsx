import { DataTable, RowTh, Td, Th } from "./data-table";
import { GUIDES, type Guide, type GuideKey } from "@/lib/guide";

/**
 * "How this page works": what the page is for, where to start, and the words it uses.
 * Sits at the end of each app page; the page header links here with #guide.
 */
export function PageGuide({ page }: { page: GuideKey }) {
  const g: Guide = GUIDES[page];
  return (
    <section id="guide" aria-labelledby="guide-title" className="mt-16 scroll-mt-24 border-t border-line pt-10 md:mt-20">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h2 id="guide-title" className="text-2xl font-semibold tracking-tight text-ink">
            How this page works
          </h2>
          <p className="mt-2 max-w-[52ch] leading-relaxed text-muted">{g.intro}</p>
          {g.steps ? (
            <>
              <h3 className="mt-8 font-medium text-ink">Where to start</h3>
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
            </>
          ) : null}
        </div>
        <div>
          <h3 className="font-medium text-ink">Words on this page</h3>
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
        </div>
      </div>
    </section>
  );
}
