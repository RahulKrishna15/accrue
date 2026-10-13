"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { EarningsCard } from "@/components/earnings-card";
import { spring } from "@/components/motion";
import { SAMPLE_ELAPSED_MS, samplePosition } from "@/lib/accrue/examples";

const sample = samplePosition();

/** The real EarningsCard and LiveAmount, fed a sample position instead of chain data. */
export function HeroEarnings() {
  // Relative clock: 11 days into the stream plus time since this component mounted.
  const [origin] = useState(() => performance.now());
  const clock = () => SAMPLE_ELAPSED_MS + performance.now() - origin;
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.24 }}
    >
      <EarningsCard
        title="Meridian Trade Credit"
        subtitle="Sample position, live accrual math"
        fund={sample.fund}
        holder={sample.holder}
        balance={sample.balance}
        now={clock}
        streamEndLabel="19 days left"
        elevated
      />
    </motion.div>
  );
}
