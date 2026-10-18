"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { spring } from "@/components/motion";
import { cx } from "@/components/ui";
import { FAIR_SPLIT_DEPOSIT, FAIR_SPLIT_TRANSFERS, fairSplitTimeline, type SplitHolder } from "@/lib/accrue/examples";
import { formatUnits } from "@/lib/accrue/format";

const HOLDERS: SplitHolder[] = ["Alice", "Bob", "Charlie"];

/** Interactive worked example: the timeline is computed by the same accrual math the program uses. */
export function FairSplit() {
  const timeline = useMemo(() => fairSplitTimeline(), []);
  const [day, setDay] = useState(30);
  const sliderId = useId();
  const now = timeline[day];

  // Holding segments per holder: [startDay, endDay, tokens].
  const segments = useMemo(
    () =>
      Object.fromEntries(
        HOLDERS.map((h) => {
          const segs: [number, number, number][] = [];
          for (let d = 0; d < 30; d++) {
            const t = timeline[d].balances[h];
            const last = segs[segs.length - 1];
            if (last && last[2] === t) last[1] = d + 1;
            else segs.push([d, d + 1, t]);
          }
          return [h, segs];
        }),
      ) as Record<SplitHolder, [number, number, number][]>,
    [timeline],
  );

  const total = HOLDERS.reduce((a, h) => a + now.earned[h], 0n);

  return (
    <div className="rounded-panel border border-line bg-surface p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="font-medium text-ink">
          <span className="num">${formatUnits(FAIR_SPLIT_DEPOSIT, 0)}</span> income over 30 days, 100 tokens
        </p>
        <p className="text-sm text-muted">
          Released so far <span className="num text-ink">${formatUnits(total, 2)}</span>
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {HOLDERS.map((h, hi) => (
          <div key={h} className="grid grid-cols-[4.5rem_1fr] items-center gap-x-4 gap-y-2 md:grid-cols-[6rem_1fr_9rem]">
            <p className="font-medium text-ink">{h}</p>
            <div className="relative h-9 overflow-hidden rounded-[8px] bg-sunk" aria-hidden>
              {/* Holding periods draw in left to right, holder by holder, to read as a timeline. */}
              {segments[h].map(([a, b, t], si) =>
                t > 0 ? (
                  <div key={a} className="absolute inset-y-0" style={{ left: `${(a / 30) * 100}%`, width: `${((b - a) / 30) * 100}%` }}>
                    <motion.div
                      className="absolute inset-0 origin-left border-r-2 border-surface bg-bar"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, amount: 0.8 }}
                      transition={{ ...spring, delay: hi * 0.14 + si * 0.1 }}
                    />
                    <motion.span
                      className="num relative flex h-full items-center truncate px-2 text-xs text-on-bar"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true, amount: 0.8 }}
                      transition={{ duration: 0.3, delay: hi * 0.14 + si * 0.1 + 0.25 }}
                    >
                      {t}
                    </motion.span>
                  </div>
                ) : null,
              )}
              <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `calc(${(day / 30) * 100}% - 1px)` }} />
            </div>
            <div className="col-start-2 flex items-center gap-3 md:col-start-auto md:flex-col md:items-end md:gap-1">
              <p className="num text-lg text-ink">${formatUnits(now.earned[h], 2)}</p>
              <div className="h-1.5 rounded-full bg-income" style={{ width: `${Math.max(2, Number((now.earned[h] * 100n) / FAIR_SPLIT_DEPOSIT))}%`, minWidth: 4 }} />
              <p className="sr-only">
                {h} holds {now.balances[h]} tokens on day {day} and has earned ${formatUnits(now.earned[h], 2)}.
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between text-sm">
          <label htmlFor={sliderId} className="font-medium text-ink">
            Day <span className="num">{day}</span> of 30
          </label>
          <span className="text-muted">Bars show tokens held</span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={30}
          step={1}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="mt-3 w-full"
          aria-valuetext={`Day ${day}`}
        />
        <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {FAIR_SPLIT_TRANSFERS.map((t) => (
            <li key={t.day} className={cx("flex items-center gap-2", day >= t.day && "text-ink")}>
              <span className="num">Day {t.day}</span>
              <span>{t.from}</span>
              <ArrowRight size={14} aria-hidden />
              <span>
                {t.to}, <span className="num">{t.tokens}</span> tokens
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
