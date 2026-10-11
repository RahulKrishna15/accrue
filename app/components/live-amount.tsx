"use client";

import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect } from "react";
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

  const update = () => {
    const [h, t] = split(total(now()));
    head.set(`$${h}`);
    tail.set(t);
  };

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
