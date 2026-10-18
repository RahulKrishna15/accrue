"use client";

import { Check, Copy, Drop, Plus, SignOut, Wallet, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { accrue } from "@/lib/accrue";
import { shortAddress } from "@/lib/accrue/format";
import { useUsdcBalance } from "@/lib/accrue/hooks";
import { useWallet, type AppAccount } from "@/lib/wallet/context";
import { duration, ease } from "./motion";
import { Amount, Button, buttonClass, cx } from "./ui";
import { WalletDialog } from "./wallet-dialog";

export function useWalletDialog() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return { open, show: () => setOpen(true), close };
}

/**
 * The address shown after the account changes, whether it changed here or inside the wallet.
 * Derived during render (not in an effect) so the notice appears in the same frame as the new address.
 */
function useSwitchNotice(address: string | null) {
  const [prev, setPrev] = useState(address);
  const [notice, setNotice] = useState<string | null>(null);
  if (address !== prev) {
    setPrev(address);
    setNotice(prev && address ? address : null);
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  return notice;
}

export function WalletButton({ className }: { className?: string }) {
  const w = useWallet();
  const dialog = useWalletDialog();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fauceting, setFauceting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const usdc = useUsdcBalance(w.address);
  const notice = useSwitchNotice(w.address);

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

  const single = w.accounts.length <= 1;

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-expanded={menu}
        aria-haspopup="true"
        className={cx(buttonClass("secondary", "sm"), w.wrongNetwork && "border-danger")}
      >
        {w.wrongNetwork ? (
          <WarningCircle size={18} className="text-danger" aria-hidden />
        ) : w.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.icon} alt="" width={18} height={18} className="size-[18px] rounded" />
        ) : (
          <Wallet size={18} aria-hidden />
        )}
        <span className="num">{shortAddress(w.address)}</span>
        <span className="sr-only">{w.wrongNetwork ? "Wrong network" : "Wallet menu"}</span>
      </button>

      <AnimatePresence>
        {notice && !menu ? (
          <motion.p
            key={notice}
            role="status"
            className="absolute right-0 z-40 mt-2 rounded-control bg-primary px-3 py-2 text-sm whitespace-nowrap text-on-primary shadow-[0_12px_30px_-12px_var(--lift)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease }}
          >
            Switched to <span className="num">{shortAddress(notice)}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {menu ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-surface p-2 shadow-[0_20px_50px_-20px_var(--shadow)]">
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

          {!w.isDemo ? (
            <div className="mt-1 border-t border-line pt-2">
              <p id="accounts-heading" className="px-3 pb-1 text-sm font-medium text-ink">
                Accounts
              </p>
              <ul aria-labelledby="accounts-heading" className="flex flex-col">
                {w.accounts.map((a) => (
                  <li key={`${a.wallet.name}:${a.address}`}>
                    <AccountRow
                      account={a}
                      onSelect={() => {
                        if (!a.active) w.selectAccount(a);
                        setMenu(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
              {single ? (
                <p className="px-3 pt-1 pb-2 text-xs text-pretty text-muted">
                  To use another {w.label} account, select it in {w.label} and Accrue follows. Or connect a second wallet to switch here.
                </p>
              ) : null}
              <MenuItem
                onClick={() => {
                  setMenu(false);
                  dialog.show();
                }}
              >
                <Plus size={18} aria-hidden /> Connect another wallet
              </MenuItem>
            </div>
          ) : null}

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
              <SignOut size={18} aria-hidden /> {single ? "Disconnect" : `Disconnect ${w.label}`}
            </MenuItem>
          </div>
        </div>
      ) : null}
      <WalletDialog open={dialog.open} onClose={dialog.close} />
    </div>
  );
}

function AccountRow({ account: a, onSelect }: { account: AppAccount; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={a.active ? "true" : undefined}
      className={cx("flex h-12 w-full items-center gap-3 rounded-control px-3 text-left hover:bg-sunk", a.active && "bg-sunk")}
    >
      {/* Wallet Standard icons are data URIs supplied by the extension. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.account.icon ?? a.wallet.icon} alt="" width={22} height={22} className="size-[22px] shrink-0 rounded-md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="num text-sm text-ink">{shortAddress(a.address)}</span>
        <span className="truncate text-xs text-muted">{a.label && a.label !== a.wallet.name ? `${a.label} in ${a.wallet.name}` : a.wallet.name}</span>
      </span>
      {a.active ? (
        <>
          <Check size={16} className="shrink-0 text-accent" aria-hidden />
          <span className="sr-only">Active account</span>
        </>
      ) : null}
    </button>
  );
}

const itemClass = "flex h-10 items-center gap-2.5 rounded-control px-3 text-left text-sm text-ink hover:bg-sunk disabled:opacity-50";

function MenuItem(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={itemClass} {...props} />;
}
