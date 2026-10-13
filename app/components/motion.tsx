"use client";

/*
  Motion primitives. One spring, one ease, transform and opacity only.
  MotionConfig reducedMotion="user" (providers.tsx) strips transforms for people
  who ask for less motion; value tweens below check useReducedMotion themselves
  because MotionConfig does not reach animate() on motion values.
*/

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatUnits } from "@/lib/accrue/format";
import { cx } from "./ui";

export const spring = { type: "spring", stiffness: 120, damping: 20 } as const;
/** For indicators that slide between options: quick, no overshoot. */
export const snappy = { type: "spring", stiffness: 420, damping: 38 } as const;
export const ease = [0.16, 1, 0.3, 1] as const;
export const duration = { fast: 0.18, base: 0.3, slow: 0.6 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Fades a block up once as it enters the viewport, so the page reads in order. */
export function FadeUp({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const M = as === "li" ? motion.li : as === "section" ? motion.section : motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: duration.slow, delay, ease }}
    >
      {children}
    </M>
  );
}

/** Parent for a staggered entrance. Children use `fadeUp` (or their own hidden/show variants). */
export function Stagger({
  children,
  className,
  gap = 0.06,
  inView = false,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  /** Start when scrolled into view instead of on mount. */
  inView?: boolean;
}) {
  const trigger = inView ? { whileInView: "show", viewport: { once: true, amount: 0.2 } } : { animate: "show" };
  return (
    <motion.div className={className} initial="hidden" {...trigger} variants={{ show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  );
}

/** Content that replaces a skeleton: a short crossfade with a 6px rise instead of a hard swap. */
export function FadeIn({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      {children}
    </motion.div>
  );
}

// The first page is server-rendered and must be visible before hydration, so only
// client-side navigations fade in. The flag flips after the first mount.
const routeState = { hydrated: false };

/** Route fade for app/template.tsx. */
export function PageTransition({ children }: { children: ReactNode }) {
  const [fade] = useState(() => routeState.hydrated);
  useEffect(() => {
    routeState.hydrated = true;
  }, []);
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={fade ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: duration.fast, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A base-unit amount that counts to its new value when it changes, so a computed
 * result visibly follows its input. Rounds down like every other amount.
 */
export function NumberTicker({
  value,
  decimals = 2,
  prefix = "",
  className,
}: {
  value: bigint;
  decimals?: number;
  prefix?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(Number(value));
  const text = useTransform(mv, (v) => `${prefix}${formatUnits(BigInt(Math.max(0, Math.floor(v))), decimals)}`);

  useEffect(() => {
    if (reduce) {
      mv.set(Number(value));
      return;
    }
    const controls = animate(mv, Number(value), { duration: 0.5, ease });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return <motion.span className={cx("num", className)}>{text}</motion.span>;
}

/** Slow transform-only drift for the hero glow. The one decorative loop on the site. */
export function Drift({ className }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      className={className}
      animate={{ x: ["0%", "6%", "-4%", "0%"], y: ["0%", "-5%", "4%", "0%"], scale: [1, 1.06, 0.97, 1] }}
      transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
    />
  );
}

/** A vertical rule that fills as its content scrolls past, showing how far through a sequence the reader is. */
export function ScrollLine({ children, className, lineClassName }: { children: ReactNode; className?: string; lineClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  return (
    <div ref={ref} className={cx("relative", className)}>
      <div aria-hidden className={cx("absolute w-px bg-line", lineClassName)} />
      <motion.div aria-hidden style={{ scaleY: scrollYProgress }} className={cx("absolute w-px origin-top bg-accent", lineClassName)} />
      {children}
    </div>
  );
}

/** A horizontal rule that draws left to right once in view, linking one step to the next. */
export function GrowLine({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.span
      aria-hidden
      className={cx("absolute h-px origin-left bg-line", className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 1 }}
      transition={{ duration: duration.slow, delay, ease }}
    />
  );
}
