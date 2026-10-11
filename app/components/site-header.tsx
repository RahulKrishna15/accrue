"use client";

import { Info, List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { accrue } from "@/lib/accrue";
import { ThemeToggle } from "./theme-toggle";
import { cx } from "./ui";
import { WalletButton } from "./wallet-button";

const NAV = [
  { href: "/funds", label: "Funds" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/manage", label: "Manage" },
  { href: "/transfer", label: "Transfer" },
  { href: "/activity", label: "Activity" },
];

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 rounded-control font-semibold tracking-tight text-ink">
      <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-[8px] bg-primary text-sm text-on-primary">
        A
      </span>
      Accrue
    </Link>
  );
}

/** Persistent network notice. Not dismissible: every amount in the app is Test USDC on devnet. */
export function NetworkBanner() {
  return (
    <div className="border-b border-line bg-sunk">
      <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm text-ink sm:items-center sm:px-6">
        <Info size={16} className="mt-0.5 shrink-0 text-accent sm:mt-0" aria-hidden />
        <span>
          <strong className="font-medium">Solana devnet, Test USDC only.</strong>{" "}
          {accrue.mode === "mock" ? (
            <span className="text-muted">
              <span className="sm:hidden">Simulated ledger.</span>
              <span className="hidden sm:inline">The program is not deployed yet, so transactions run against a simulated ledger.</span>
            </span>
          ) : (
            <span className="text-muted">Nothing here has real value.</span>
          )}
        </span>
      </p>
    </div>
  );
}

/** Reads the URL, so it sits in its own Suspense boundary; the fallback is the same links without the active state. */
function NavLinks({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList mobile={mobile} pathname={null} onNavigate={onNavigate} />}>
      <ActiveNavList mobile={mobile} onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavList(props: { mobile?: boolean; onNavigate?: () => void }) {
  return <NavList {...props} pathname={usePathname()} />;
}

function NavList({ mobile, pathname, onNavigate }: { mobile?: boolean; pathname: string | null; onNavigate?: () => void }) {
  const active = (href: string) => !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
  if (mobile) {
    return (
      <ul id="mobile-nav" className="mx-auto flex max-w-7xl flex-col gap-1 border-t border-line px-4 py-3 sm:px-6 lg:hidden">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active(n.href) ? "page" : undefined}
              className={cx("flex h-11 items-center rounded-control px-3 hover:bg-sunk", active(n.href) ? "bg-sunk font-medium text-ink" : "text-ink")}
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="hidden items-center gap-1 lg:flex">
      {NAV.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={cx("rounded-control px-3 py-2 text-[15px] hover:bg-sunk", active(n.href) ? "font-medium text-ink" : "text-muted")}
          >
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-sm">
      <NetworkBanner />
      <div className="border-b border-line">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <NavLinks />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <WalletButton />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="press inline-flex size-10 items-center justify-center rounded-control hover:bg-sunk lg:hidden"
            >
              {open ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </nav>
        {open ? <NavLinks mobile onNavigate={() => setOpen(false)} /> : null}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={cx("mt-auto border-t border-line", accrue.demo && "pb-16")}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Accrue is a Solana School cohort project. Devnet only; not investment advice.</p>
        <div className="flex gap-4">
          <Link href="/funds" className="hover:text-ink">
            Funds
          </Link>
          <Link href="/activity" className="hover:text-ink">
            Activity
          </Link>
        </div>
      </div>
    </footer>
  );
}
