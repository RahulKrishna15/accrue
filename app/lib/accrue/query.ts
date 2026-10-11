"use client";

import { useEffect, useSyncExternalStore } from "react";
import { accrue } from "./index";

/**
 * Tiny stale-while-revalidate cache over the AccrueClient reads.
 * Every mounted key refetches when the client reports an account change.
 */
export type QueryState<T> = {
  status: "loading" | "success" | "error";
  data?: T;
  error?: unknown;
  /** True while a background refetch runs over existing data. */
  refreshing?: boolean;
};

const cache = new Map<string, QueryState<unknown>>();
const fetchers = new Map<string, () => Promise<unknown>>();
const refs = new Map<string, number>();
const inflight = new Set<string>();
const again = new Set<string>();
const listeners = new Set<() => void>();
let wired = false;

const emit = () => listeners.forEach((l) => l());

function load(key: string) {
  const fetcher = fetchers.get(key);
  if (!fetcher) return;
  if (inflight.has(key)) {
    again.add(key);
    return;
  }
  inflight.add(key);
  const prev = cache.get(key);
  cache.set(key, prev?.data !== undefined ? { ...prev, refreshing: true } : { status: "loading" });
  emit();
  fetcher()
    .then(
      (data) => cache.set(key, { status: "success", data }),
      (error) => cache.set(key, { status: "error", error, data: cache.get(key)?.data }),
    )
    .finally(() => {
      inflight.delete(key);
      emit();
      if (again.delete(key)) load(key);
    });
}

function wire() {
  if (wired) return;
  wired = true;
  accrue.subscribe(() => {
    for (const [key, n] of refs) if (n > 0) load(key);
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

const LOADING: QueryState<never> = { status: "loading" };
const IDLE: QueryState<never> = { status: "success" };

/** Pass `null` as the key to disable the query. */
export function useAccrueQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  useEffect(() => {
    if (!key) return;
    fetchers.set(key, fetcher);
  });

  const state = useSyncExternalStore(
    subscribe,
    () => (key ? ((cache.get(key) as QueryState<T> | undefined) ?? LOADING) : IDLE),
    () => (key ? LOADING : IDLE),
  );

  useEffect(() => {
    if (!key) return;
    wire();
    refs.set(key, (refs.get(key) ?? 0) + 1);
    load(key);
    return () => void refs.set(key, (refs.get(key) ?? 1) - 1);
  }, [key]);

  return state;
}

/** Re-render when the client reports a change, reading a synchronous value. */
export function useClientSnapshot<T>(get: () => T, server: T): T {
  return useSyncExternalStore((l) => accrue.subscribe(l), get, () => server);
}
