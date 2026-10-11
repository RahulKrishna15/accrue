"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { WalletProvider } from "@/lib/wallet/context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <WalletProvider>{children}</WalletProvider>
    </MotionConfig>
  );
}
