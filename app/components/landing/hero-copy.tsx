"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { fadeUp as rise } from "@/components/motion";
import { buttonClass } from "@/components/ui";

export function HeroCopy() {
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
      <motion.h1 variants={rise} className="max-w-[18ch] text-4xl leading-[1.05] font-semibold tracking-tighter text-ink md:text-5xl lg:text-6xl">
        Fund income, split fairly by time held
      </motion.h1>
      <motion.p variants={rise} className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted">
        Investors hold Token-2022 shares. Managers deposit USDC income. Accrue streams it to every holder by the second, even across transfers.
      </motion.p>
      <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
        <Link href="/funds" className={buttonClass("accent", "lg")}>
          Explore funds <ArrowRight size={18} aria-hidden />
        </Link>
        <a href="#fair-split" className={buttonClass("secondary", "lg")}>
          How the split works
        </a>
      </motion.div>
    </motion.div>
  );
}
