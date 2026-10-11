import type { AccrueClient } from "./client";
import { createMockClient } from "./mock/client";

/**
 * The single AccrueClient the app talks to.
 * mock: swap `createMockClient()` for the Codama-backed client once the program is deployed.
 */
export const accrue: AccrueClient = createMockClient();

export * from "./client";
export * from "./constants";
export * from "./errors";
export * from "./format";
export * from "./instructions";
export * from "./math";
export * from "./types";
