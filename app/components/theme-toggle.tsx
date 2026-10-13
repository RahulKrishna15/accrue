"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const KEY = "accrue-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function write(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Storage blocked; the choice lasts for this page view.
  }
  listeners.forEach((l) => l());
}

/**
 * Runs before first paint (inlined in <head>) so the theme never flashes.
 * Always sets data-theme: the stored choice, or the OS preference on a first visit.
 */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    read,
    () => "light" as Theme,
  );
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => write(next)}
      className="press inline-flex size-10 items-center justify-center rounded-control text-ink hover:bg-sunk"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <Icon size={20} />
    </button>
  );
}
