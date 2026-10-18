"use client";

import { ArrowSquareOut, Flask, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { accrue } from "@/lib/accrue";
import { SUPPORTED_WALLETS, useWallet } from "@/lib/wallet/context";
import { cx } from "./ui";

/** Native <dialog>: focus trap, Esc to close and inert background come from the platform. */
export function WalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { wallets, ready, connect, connectDemo, connecting, connectError, status } = useWallet();
  // The wallet whose prompt is open, so only its row says "Check your wallet".
  const [pending, setPending] = useState<string | null>(null);
  const adding = status === "connected";

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const installed = new Set(wallets.map((w) => w.name.toLowerCase()));
  const missing = SUPPORTED_WALLETS.filter((w) => !installed.has(w.name.toLowerCase()));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="wallet-dialog-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_-30px_var(--shadow)] backdrop:bg-[#283618]/45"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="wallet-dialog-title" className="font-semibold">
          {adding ? "Connect another wallet" : "Connect a wallet"}
        </h2>
        <button type="button" onClick={onClose} className="press inline-flex size-9 items-center justify-center rounded-control hover:bg-sunk" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {/* Wallet discovery only exists in the browser, so the body renders once the dialog opens. */}
      {open ? (
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="text-sm text-muted">
              {adding
                ? "Each wallet you connect adds its account to the Accounts list, so you can switch without leaving Accrue."
                : "Use a wallet set to Solana devnet."}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {!ready ? (
                <li className="skeleton h-12" />
              ) : wallets.length === 0 ? (
                <li className="text-sm text-muted">No Solana wallet found in this browser.</li>
              ) : (
                wallets.map((w) => (
                  <li key={w.name}>
                    <button
                      type="button"
                      onClick={async () => {
                        setPending(w.name);
                        const ok = await connect(w);
                        setPending(null);
                        if (ok) onClose();
                      }}
                      disabled={connecting}
                      className="press flex h-12 w-full items-center gap-3 rounded-control border border-line-strong px-3 text-left hover:bg-sunk disabled:opacity-50"
                    >
                      {/* Wallet Standard icons are data URIs supplied by the extension. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.icon} alt="" width={24} height={24} className="size-6 rounded-md" />
                      <span className="font-medium">{w.name}</span>
                      {pending === w.name ? (
                        <span className="ml-auto text-sm text-muted">Check your wallet</span>
                      ) : w.accounts.length > 0 ? (
                        <span className="ml-auto text-sm text-muted">Connected</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
            {connectError ? (
              <p className="mt-2 text-sm text-danger" role="alert">
                {connectError}
              </p>
            ) : null}
            {missing.length > 0 && ready ? (
              <p className="mt-3 text-sm text-muted">
                Get{" "}
                {missing.map((w, i) => (
                  <span key={w.name}>
                    <a href={w.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-accent-strong underline-offset-4 hover:underline">
                      {w.name}
                      <ArrowSquareOut size={13} aria-hidden />
                    </a>
                    {i < missing.length - 2 ? ", " : i === missing.length - 2 ? " or " : ""}
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          {accrue.demoWallets?.length ? (
            <div className="border-t border-line pt-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Flask size={16} className="text-accent" aria-hidden />
                Try it without a wallet
              </p>
              <p className="mt-1 text-sm text-muted">Sample accounts in the simulated ledger.</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {accrue.demoWallets.map((w) => (
                  <li key={w.address}>
                    <button
                      type="button"
                      onClick={() => {
                        connectDemo(w);
                        onClose();
                      }}
                      className={cx("press flex w-full flex-col items-start rounded-control border border-line-strong px-3 py-2.5 text-left hover:bg-sunk")}
                    >
                      <span className="font-medium">{w.label}</span>
                      <span className="text-xs text-muted">{w.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
