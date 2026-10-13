"use client";

import { animate, motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { formatUnits } from "@/lib/accrue/format";
import { projectPending, type StreamState } from "@/lib/accrue/math";
import type { HolderAccount } from "@/lib/accrue/types";
import { cx } from "./ui";

export type LivePosition = {
  fund: StreamState;
  holder: Pick<HolderAccount, "lastAcc" | "pending">;
  balance: bigint;
};

type Props = {
  /** One or more positions; the amount shown is their total. */
  positions: LivePosition[];
  /** Clock in ms (chain clock in the app, wall clock for samples). */
  now: () => number;
  className?: string;
  tailClassName?: string;
};

/**
 * Claimable income that ticks up as the stream releases it.
 * Values live in motion values and update outside React render; reduced motion
 * falls back to one update per second.
 * When the positions change in a jump (a claim, the demo clock moving), the shown
 * amount eases from the old figure to the new one instead of snapping.
 */
export function LiveAmount({ positions, now, className, tailClassName }: Props) {
  const total = (t: number) => positions.reduce((a, p) => a + projectPending(p.fund, p.holder, p.balance, t), 0n);
  const split = (v: bigint) => {
    const s = formatUnits(v, 6);
    return [s.slice(0, -4), s.slice(-4)] as const;
  };
  const initial = split(total(now()));
  const head = useMotionValue(`$${initial[0]}`);
  const tail = useMotionValue(initial[1]);
  const reduce = useReducedMotion();
  // Base units still to ease out after a jump; 0 when settled.
  const offset = useMotionValue(0);
  const shown = useRef<bigint | null>(null);

  const update = () => {
    const v = total(now()) + BigInt(Math.round(offset.get()));
    shown.current = v;
    const [h, t] = split(v < 0n ? 0n : v);
    head.set(`$${h}`);
    tail.set(t);
  };

  // Identity of the inputs that can jump; plain re-renders with the same data keep ticking.
  const key = positions.map((p) => `${p.holder.pending}:${p.holder.lastAcc}:${p.balance}`).join("|");
  const prevKey = useRef(key);
  const settle = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => settle.current?.stop(), []);
  useLayoutEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    if (reduce || shown.current === null) return;
    const delta = Number(shown.current - total(now()));
    if (Math.abs(delta) < 10_000) return; // under a cent: just continue
    settle.current?.stop();
    offset.set(delta);
    settle.current = animate(offset, 0, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
  });

  useAnimationFrame(() => {
    if (!reduce) update();
  });

  useEffect(() => {
    if (!reduce) return;
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  });

  return (
    <span className={cx("num", className)} suppressHydrationWarning>
      <motion.span suppressHydrationWarning>{head}</motion.span>
      <motion.span suppressHydrationWarning className={cx("opacity-70", tailClassName)}>
        {tail}
      </motion.span>
    </span>
  );
}
