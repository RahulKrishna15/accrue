"use client";

import type { Address } from "@solana/kit";
import type { WalletState as KitWalletState } from "@solana/kit-plugin-wallet";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useIsWalletReady,
  useWallets,
  useWalletStatus,
} from "@solana/kit-plugin-wallet/react";
import { ClientProvider } from "@solana/react";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { accrue, WALLET_CHAIN, type DemoWallet } from "@/lib/accrue";
import { useClientSnapshot } from "@/lib/accrue/hooks";
import { kitClient } from "./kit-client";

export { kitClient, type AppClient } from "./kit-client";
export type UiWallet = KitWalletState["wallets"][number];

/** Wallets the app names when none is installed. Any Wallet Standard wallet still works. */
export const SUPPORTED_WALLETS = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Backpack", url: "https://backpack.app/downloads" },
  { name: "Solflare", url: "https://www.solflare.com/download/" },
];

type WalletContextValue = {
  status: "pending" | "disconnected" | "connecting" | "connected";
  address: Address | null;
  label: string | null;
  icon: string | null;
  isDemo: boolean;
  wrongNetwork: boolean;
  wallets: readonly UiWallet[];
  ready: boolean;
  connect: (wallet: UiWallet) => void;
  connectDemo: (wallet: DemoWallet) => void;
  disconnect: () => void;
  connectError: string | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletState({ children }: { children: ReactNode }) {
  const wallets = useWallets(kitClient);
  const connected = useConnectedWallet(kitClient);
  const status = useWalletStatus(kitClient);
  const ready = useIsWalletReady(kitClient);
  const { dispatch: connectWallet, error } = useConnect(kitClient);
  const { dispatch: disconnectWallet } = useDisconnect(kitClient);
  // The demo wallet choice lives in the mock's persisted demo state so it survives reloads.
  const demoAddress = useClientSnapshot(() => accrue.demo?.getState().demoWallet ?? null, null);
  const demo = accrue.demoWallets?.find((w) => w.address === demoAddress) ?? null;
  const setDemo = useCallback((w: DemoWallet | null) => accrue.demo?.set({ demoWallet: w?.address ?? null }), []);
  // Wallet state only exists in the browser: report "pending" until hydration so server and client HTML match.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const demoWrongNetwork = useClientSnapshot(() => accrue.demo?.getState().wrongNetwork ?? false, false);

  const connect = useCallback(
    (w: UiWallet) => {
      setDemo(null);
      connectWallet(w);
    },
    [connectWallet, setDemo],
  );
  const connectDemo = useCallback(
    (w: DemoWallet) => {
      if (connected) disconnectWallet();
      setDemo(w);
    },
    [connected, disconnectWallet, setDemo],
  );
  const disconnect = useCallback(() => {
    setDemo(null);
    if (connected) disconnectWallet();
  }, [connected, disconnectWallet, setDemo]);

  const value = useMemo<WalletContextValue>(() => {
    const base = { wallets, ready, connect, connectDemo, disconnect, connectError: error ? describe(error) : null };
    if (!hydrated) {
      return { ...base, status: "pending", address: null, label: null, icon: null, isDemo: false, wrongNetwork: false };
    }
    if (demo) {
      return {
        ...base,
        status: "connected",
        address: demo.address,
        label: demo.label,
        icon: null,
        isDemo: true,
        wrongNetwork: demoWrongNetwork,
      };
    }
    if (connected) {
      return {
        ...base,
        status: "connected",
        address: connected.account.address as Address,
        label: connected.wallet.name,
        icon: connected.wallet.icon,
        isDemo: false,
        wrongNetwork: !connected.account.chains.includes(WALLET_CHAIN) || demoWrongNetwork,
      };
    }
    return {
      ...base,
      status: status === "connecting" || status === "reconnecting" ? "connecting" : status === "pending" ? "pending" : "disconnected",
      address: null,
      label: null,
      icon: null,
      isDemo: false,
      wrongNetwork: false,
    };
  }, [hydrated, wallets, ready, connect, connectDemo, disconnect, error, demo, connected, status, demoWrongNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

const noopSubscribe = () => () => {};

function describe(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return /reject|denied|declin/i.test(m) ? "You declined the connection in your wallet." : "Could not connect to that wallet.";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <ClientProvider client={kitClient}>
      <WalletState>{children}</WalletState>
    </ClientProvider>
  );
}

export function useWallet() {
  const v = useContext(WalletContext);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}
