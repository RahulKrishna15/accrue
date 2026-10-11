"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "accrue-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function write(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // Storage blocked; the choice lasts for this page view.
  }
  listeners.forEach((l) => l());
}

/** Runs before first paint (inlined in <head>) so the stored theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const label: Record<Theme, string> = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    read,
    () => "system" as Theme,
  );
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Desktop;
  return (
    <button
      type="button"
      onClick={() => write(next[theme])}
      className="press inline-flex size-10 items-center justify-center rounded-control text-ink hover:bg-sunk"
      aria-label={`${label[theme]}. Switch to ${next[theme]}.`}
      title={label[theme]}
    >
      <Icon size={20} />
    </button>
  );
}
