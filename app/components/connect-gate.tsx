"use client";

import { Plugs, WifiX } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useWallet } from "@/lib/wallet/context";
import { Button, Skeleton } from "./ui";
import { useWalletDialog } from "./wallet-button";
import { WalletDialog } from "./wallet-dialog";

/** Renders children only for a connected wallet on devnet; otherwise explains what is missing. */
export function ConnectGate({ children, reason }: { children: ReactNode; reason: string }) {
  const w = useWallet();
  const dialog = useWalletDialog();

  if (w.status === "pending") return <Skeleton className="h-40 w-full rounded-panel" />;

  if (w.status !== "connected") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong p-6">
        <Plugs size={24} className="text-accent" aria-hidden />
        <p className="font-medium text-ink">Connect a wallet {reason}.</p>
        <p className="text-sm text-muted">Phantom, Backpack, Solflare or any Wallet Standard wallet on devnet.</p>
        <Button onClick={dialog.show} disabled={w.status === "connecting"}>
          {w.status === "connecting" ? "Connecting" : "Connect wallet"}
        </Button>
        <WalletDialog open={dialog.open} onClose={dialog.close} />
      </div>
    );
  }

  if (w.wrongNetwork) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-panel border border-danger bg-danger-soft p-6">
        <WifiX size={24} className="text-danger" aria-hidden />
        <p className="font-medium text-ink">Your wallet is not on devnet</p>
        <p className="text-sm text-ink">
          Accrue runs on Solana devnet with Test USDC. Switch the network in {w.label ?? "your wallet"}, then come back.
        </p>
        <Button variant="secondary" onClick={w.disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
