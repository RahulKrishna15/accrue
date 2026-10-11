import type { Address } from "@solana/kit";

// mock: deterministic base58 strings shaped like real addresses and signatures.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function b58(seed: string, len: number): string {
  const r = rng(seed);
  let s = "";
  for (let i = 0; i < len; i++) s += B58[Math.floor(r() * 58)];
  return s;
}

export const mockAddress = (seed: string) => b58(`addr:${seed}`, 44) as Address;
export const mockSignature = (seed: string) => b58(`sig:${seed}`, 88);
