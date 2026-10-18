"use client";

import { List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { accrue } from "@/lib/accrue";
import { duration, ease, snappy } from "./motion";
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
      <LogoMark />
      Accrue
    </Link>
  );
}

/** Brand mark: income rising over the fund. Fixed brand colours (not panel tokens), same in both themes. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 28 28" className="shrink-0">
      <defs>
        <clipPath id="accrue-mark">
          <rect width="28" height="28" rx="8" />
        </clipPath>
      </defs>
      <g clipPath="url(#accrue-mark)">
        <rect width="28" height="28" fill="#283618" />
        <circle cx="14" cy="27" r="10" fill="#dda15e" />
        <rect x="5" y="27" width="18" height="1" fill="#283618" />
      </g>
      <rect x="0.5" y="0.5" width="27" height="27" rx="7.5" fill="none" stroke="rgb(254 250 224 / 0.14)" />
    </svg>
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
      <ul id="mobile-nav" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
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
            className={cx(
              "relative rounded-control px-3 py-2 text-[15px] transition-colors hover:bg-sunk",
              active(n.href) ? "font-medium text-ink" : "text-muted hover:text-ink",
            )}
          >
            {n.label}
            {active(n.href) ? (
              <motion.span layoutId="nav-active" aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" transition={snappy} />
            ) : null}
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
      <div className="relative border-b border-line">
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
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={open ? "x" : "list"}
                  className="inline-flex"
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 45 }}
                  transition={{ duration: duration.fast, ease }}
                >
                  {open ? <X size={20} /> : <List size={20} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {open ? (
            <motion.div
              key="mobile-nav"
              className="absolute inset-x-0 top-full border-b border-line bg-bg shadow-[0_24px_40px_-28px_var(--lift)] lg:hidden"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: duration.fast, ease }}
            >
              <NavLinks mobile onNavigate={() => setOpen(false)} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={cx("mt-auto border-t border-line", accrue.demo && "pb-16")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
        <Logo />
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
