"use client";

import { Copy, Drop, SignOut, Wallet, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { accrue } from "@/lib/accrue";
import { shortAddress } from "@/lib/accrue/format";
import { useUsdcBalance } from "@/lib/accrue/hooks";
import { useWallet } from "@/lib/wallet/context";
import { Amount, Button, buttonClass, cx } from "./ui";
import { WalletDialog } from "./wallet-dialog";

export function useWalletDialog() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return { open, show: () => setOpen(true), close };
}

export function WalletButton({ className }: { className?: string }) {
  const w = useWallet();
  const dialog = useWalletDialog();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fauceting, setFauceting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const usdc = useUsdcBalance(w.address);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (w.status !== "connected" || !w.address) {
    return (
      <>
        <Button size="sm" onClick={dialog.show} disabled={w.status === "connecting"} className={className}>
          <Wallet size={18} aria-hidden />
          {w.status === "connecting" ? "Connecting" : "Connect wallet"}
        </Button>
        <WalletDialog open={dialog.open} onClose={dialog.close} />
      </>
    );
  }

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-expanded={menu}
        aria-haspopup="true"
        className={cx(buttonClass("secondary", "sm"), w.wrongNetwork && "border-danger")}
      >
        {w.wrongNetwork ? <WarningCircle size={18} className="text-danger" aria-hidden /> : <Wallet size={18} aria-hidden />}
        <span className="num">{shortAddress(w.address)}</span>
        <span className="sr-only">{w.wrongNetwork ? "Wrong network" : "Wallet menu"}</span>
      </button>
      {menu ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-panel border border-line bg-surface p-2 shadow-[0_20px_50px_-20px_var(--shadow)]">
          <div className="px-3 py-2">
            <p className="text-sm text-muted">{w.label}</p>
            <p className="num mt-0.5 break-all text-sm text-ink">{w.address}</p>
            {w.wrongNetwork ? (
              <p className="mt-2 text-sm text-danger">This wallet is not on devnet. Switch networks in your wallet.</p>
            ) : null}
            <p className="mt-3 text-sm text-muted">Test USDC</p>
            <p className="text-lg text-ink">
              {usdc.data !== undefined ? <Amount value={usdc.data} /> : <span className="skeleton inline-block h-6 w-24 align-middle" />}
            </p>
          </div>
          <div className="mt-1 flex flex-col border-t border-line pt-1">
            <MenuItem
              onClick={() => {
                navigator.clipboard?.writeText(w.address!).then(() => setCopied(true), () => {});
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy size={18} aria-hidden /> {copied ? "Copied" : "Copy address"}
            </MenuItem>
            {accrue.requestTestUsdc ? (
              <MenuItem
                disabled={fauceting}
                onClick={async () => {
                  setFauceting(true);
                  await accrue.requestTestUsdc!(w.address!);
                  setFauceting(false);
                }}
              >
                <Drop size={18} aria-hidden /> {fauceting ? "Requesting" : "Get 10,000 Test USDC"}
              </MenuItem>
            ) : (
              <a className={itemClass} href="https://faucet.circle.com/" target="_blank" rel="noreferrer">
                <Drop size={18} aria-hidden /> Test USDC faucet
              </a>
            )}
            <MenuItem
              onClick={() => {
                setMenu(false);
                w.disconnect();
              }}
            >
              <SignOut size={18} aria-hidden /> Disconnect
            </MenuItem>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const itemClass = "flex h-10 items-center gap-2.5 rounded-control px-3 text-left text-sm text-ink hover:bg-sunk disabled:opacity-50";

function MenuItem(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={itemClass} {...props} />;
}
