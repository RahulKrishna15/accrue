"use client";

import type { Address } from "@solana/kit";
import type { WalletState as KitWalletState } from "@solana/kit-plugin-wallet";
import {
  useConnect,
  useConnectedWallet,
  useIsWalletReady,
  useSelectAccount,
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
export type UiWalletAccount = UiWallet["accounts"][number];

/** An account the app may use right now: one a connected wallet has shared with us. */
export type AppAccount = { address: Address; label: string | null; wallet: UiWallet; account: UiWalletAccount; active: boolean };

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
  /**
   * Every account shared by a connected wallet. Phantom, Solflare and Backpack share only the
   * account selected inside the wallet, so this grows by connecting more wallets.
   */
  accounts: readonly AppAccount[];
  ready: boolean;
  /** True while a wallet prompt is open, even if another wallet is still connected. */
  connecting: boolean;
  /** Resolves true once the wallet is connected, false if the user declined or it failed. */
  connect: (wallet: UiWallet) => Promise<boolean>;
  connectDemo: (wallet: DemoWallet) => void;
  /** Switches to another shared account without a wallet prompt. */
  selectAccount: (account: AppAccount) => void;
  disconnect: () => void;
  connectError: string | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletState({ children }: { children: ReactNode }) {
  const wallets = useWallets(kitClient);
  const connected = useConnectedWallet(kitClient);
  const status = useWalletStatus(kitClient);
  const ready = useIsWalletReady(kitClient);
  const { dispatchAsync: connectWallet, error } = useConnect(kitClient);
  const selectWalletAccount = useSelectAccount(kitClient);
  // The demo wallet choice lives in the mock's persisted demo state so it survives reloads.
  const demoAddress = useClientSnapshot(() => accrue.demo?.getState().demoWallet ?? null, null);
  const demo = accrue.demoWallets?.find((w) => w.address === demoAddress) ?? null;
  const setDemo = useCallback((w: DemoWallet | null) => accrue.demo?.set({ demoWallet: w?.address ?? null }), []);
  // Wallet state only exists in the browser: report "pending" until hydration so server and client HTML match.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const demoWrongNetwork = useClientSnapshot(() => accrue.demo?.getState().wrongNetwork ?? false, false);

  // A wallet's `accounts` is non-empty only once it has authorized this site.
  const accounts = useMemo<AppAccount[]>(
    () =>
      wallets.flatMap((wallet) =>
        wallet.accounts.map((account) => ({
          address: account.address as Address,
          label: account.label ?? null,
          wallet,
          account,
          active: !demo && connected?.account.address === account.address && connected.wallet.name === wallet.name,
        })),
      ),
    [wallets, connected, demo],
  );

  const connect = useCallback(
    async (w: UiWallet) => {
      setDemo(null);
      try {
        await connectWallet(w);
        return true;
      } catch {
        // The error (or a superseded attempt) surfaces through useConnect's `error`.
        return false;
      }
    },
    [connectWallet, setDemo],
  );
  const selectAccount = useCallback(
    (a: AppAccount) => {
      setDemo(null);
      selectWalletAccount(a.account);
    },
    [selectWalletAccount, setDemo],
  );
  const connectDemo = useCallback(
    (w: DemoWallet) => {
      if (connected) void kitClient.wallet.disconnect();
      setDemo(w);
    },
    [connected, setDemo],
  );
  // Disconnects the active wallet only. If another connected wallet still shares an account, use it.
  const disconnect = useCallback(() => {
    setDemo(null);
    if (!connected) return;
    const next = accounts.find((a) => a.wallet.name !== connected.wallet.name);
    void kitClient.wallet.disconnect().then(() => {
      if (next) {
        try {
          selectWalletAccount(next.account);
        } catch {
          // That wallet dropped the account meanwhile; staying disconnected is fine.
        }
      }
    });
  }, [connected, accounts, selectWalletAccount, setDemo]);

  const value = useMemo<WalletContextValue>(() => {
    const base = {
      wallets,
      accounts: demo ? [] : accounts,
      ready,
      connecting: status === "connecting",
      connect,
      connectDemo,
      selectAccount,
      disconnect,
      connectError: error && !isAbort(error) ? describe(error) : null,
    };
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
  }, [hydrated, wallets, accounts, ready, connect, connectDemo, selectAccount, disconnect, error, demo, connected, status, demoWrongNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

const noopSubscribe = () => () => {};

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

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
