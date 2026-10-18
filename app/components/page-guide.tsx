import { GUIDES, type Guide, type GuideKey } from "@/lib/guide";

/**
 * "How this page works": what the page is for, where to start, and the words it uses.
 * Sits at the end of each app page; the page header links here with #guide.
 */
export function PageGuide({ page }: { page: GuideKey }) {
  const g: Guide = GUIDES[page];
  return (
    <section id="guide" aria-labelledby="guide-title" className="mt-16 scroll-mt-24 border-t border-line pt-10 md:mt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
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
          <table className="mt-3 w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-line-strong text-sm text-muted">
                <th scope="col" className="w-[38%] py-2.5 pr-4 font-medium sm:w-44">
                  Term
                </th>
                <th scope="col" className="py-2.5 font-medium">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-b border-line">
              {g.terms.map((t) => (
                <tr key={t.term} className="align-top">
                  <th scope="row" className="py-3.5 pr-4 font-medium text-ink">
                    {t.term}
                  </th>
                  <td className="max-w-[60ch] py-3.5 leading-relaxed text-muted">{t.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
