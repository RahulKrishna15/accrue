/**
 * Runs the worked example through the app's real AccrueClient (lib/accrue/devnet)
 * against Surfpool, so the same code path the browser uses is tested over RPC.
 * Keypair signers stand in for the wallet.
 *
 *   cd program && NO_DNA=1 surfpool start --network devnet --no-deploy
 *   solana program deploy --url localhost target/deploy/accrue.so \
 *     --program-id target/deploy/accrue-keypair.json
 *   cd app && bun scripts/client-smoke.ts
 */
import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  type KeyPairSigner,
} from "@solana/kit";
import { createDevnetClient } from "../lib/accrue/devnet/client";
import {
  getClaimInstruction,
  getDepositRevenueInstruction,
  getInitExtraAccountMetaListInstruction,
  getInitializeFundInstruction,
  getInvestInstruction,
  getRegisterHolderInstruction,
  getSetPausedInstruction,
  getTransferCheckedWithHookInstruction,
} from "../lib/accrue/instructions";
import { AccrueProgramError } from "../lib/accrue/errors";
import { USDC_MINT } from "../lib/accrue/constants";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const USDC = 1_000_000n;
const DAY = 86_400;

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_URL.replace(/^http/, "ws").replace("8899", "8900"));

let current: KeyPairSigner | null = null;
const client = createDevnetClient({ rpc, rpcSubscriptions, getSigner: () => current });

async function cheat(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { error?: { message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
}

async function warp(seconds: number) {
  const { value } = await rpc
    .getAccountInfo(address("SysvarC1ock11111111111111111111111111111111"), { encoding: "base64" })
    .send();
  const now = Number(Buffer.from(value!.data[0], "base64").readBigInt64LE(32));
  await cheat("surfnet_timeTravel", [{ absoluteTimestamp: (now + seconds) * 1000 }]);
}

async function wallet(usdc: bigint) {
  const signer = await generateKeyPairSigner();
  await cheat("surfnet_setAccount", [signer.address, { lamports: 10_000_000_000 }]);
  if (usdc > 0n) {
    await cheat("surfnet_setTokenAccount", [signer.address, USDC_MINT, { amount: Number(usdc), state: "initialized" }]);
  }
  return signer;
}

async function run(label: string, who: KeyPairSigner, ixs: Parameters<typeof client.send>[0]) {
  current = who;
  const phases: string[] = [];
  await client.send(ixs, { signer: who.address, onPhase: (p) => phases.push(p) });
  console.log(`  ok  ${label.padEnd(44)} ${phases.join(" > ")}`);
}

const fmt = (amount: bigint) => (Number(amount) / 1e6).toFixed(6);
function expectAbout(label: string, actual: bigint, expected: bigint, tolerance = USDC / 10n) {
  const diff = actual > expected ? actual - expected : expected - actual;
  const ok = diff <= tolerance;
  console.log(`  ${ok ? "ok " : "FAIL"} ${label.padEnd(44)} ${fmt(actual)} (expected ~${fmt(expected)})`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log(`Surfpool at ${RPC_URL}\n`);
  const manager = await wallet(3_000n * USDC);
  const mint = await client.generateMintAddress();

  await run("initialize_fund + meta list", manager, [
    getInitializeFundInstruction({
      manager: manager.address,
      mint,
      name: "Harbor Credit Fund",
      symbol: "HCF",
      image: "https://example.com/hcf.png",
      price: 10n * USDC,
      feeBps: 0,
      minInvestment: 100n * USDC,
      sizeCap: 1_000_000n * USDC,
      streamPeriod: BigInt(30 * DAY),
    }),
    getInitExtraAccountMetaListInstruction({ payer: manager.address, mint }),
  ]);

  const fund = await client.fetchFund(mint);
  console.log(`  ok  read fund: ${fund?.metadata.name} (${fund?.metadata.symbol}), price ${fmt(fund!.price)}`);
  const listed = await client.fetchAllFunds();
  console.log(`  ${listed.some((f) => f.mint === mint) ? "ok " : "FAIL"} fetchAllFunds lists it (${listed.length} funds)`);

  const alice = await wallet(6_000n * USDC);
  const bob = await wallet(4_000n * USDC);
  const carol = await wallet(10_000n * USDC);
  const invest = (who: KeyPairSigner, usdcAmount: bigint) =>
    run(`invest ${fmt(usdcAmount)}`, who, [getInvestInstruction({ investor: who.address, mint, usdcAmount })]);
  const claim = (label: string, who: KeyPairSigner) =>
    run(label, who, [getClaimInstruction({ owner: who.address, mint })]);

  await invest(alice, 6_000n * USDC);
  await invest(bob, 4_000n * USDC);
  await run("deposit_revenue 3,000", manager, [
    getDepositRevenueInstruction({ manager: manager.address, mint, amount: 3_000n * USDC }),
  ]);

  await warp(10 * DAY);
  await run("day 10: transfer Alice -> Bob 300", alice, [
    getTransferCheckedWithHookInstruction({ owner: alice.address, mint, destinationOwner: bob.address, amount: 300n * USDC }),
  ]);

  await warp(10 * DAY);
  await invest(carol, 10_000n * USDC);

  await warp(5 * DAY);
  await claim("day 25: claim (Bob)", bob);
  expectAbout("Bob's first claim", await client.fetchUsdcBalance(bob.address), 1_275n * USDC);

  await warp(5 * DAY);
  await claim("day 30: claim (Alice)", alice);
  await claim("day 30: claim (Bob)", bob);
  await claim("day 30: claim (Carol)", carol);

  const dave = await generateKeyPairSigner();
  await run("new wallet: register_holder + transfer", alice, [
    getRegisterHolderInstruction({ payer: alice.address, mint, owner: dave.address }),
    getTransferCheckedWithHookInstruction({ owner: alice.address, mint, destinationOwner: dave.address, amount: 100n * USDC }),
  ]);

  // A program error should come back as AccrueProgramError with the right code.
  await run("set_paused true", manager, [getSetPausedInstruction({ manager: manager.address, mint, paused: true })]);
  try {
    await invest(alice, 1_000n * USDC);
    console.log("  FAIL invest while paused succeeded");
    process.exitCode = 1;
  } catch (e) {
    const ok = e instanceof AccrueProgramError && e.code === 6000;
    console.log(`  ${ok ? "ok " : "FAIL"} invest while paused -> ${(e as Error).name}`);
    if (!ok) process.exitCode = 1;
  }

  console.log("");
  expectAbout("Alice total", await client.fetchUsdcBalance(alice.address), 1_050n * USDC);
  expectAbout("Bob total", await client.fetchUsdcBalance(bob.address), 1_450n * USDC);
  expectAbout("Carol total", await client.fetchUsdcBalance(carol.address), 500n * USDC);
  expectAbout("Dave's shares", await client.fetchShareBalance(mint, dave.address), 100n * USDC, 0n);
  const positions = await client.fetchPositions(alice.address);
  console.log(`  ${positions.length === 1 ? "ok " : "FAIL"} fetchPositions(Alice): ${positions.length} position, ${fmt(positions[0]?.balance ?? 0n)} shares`);
  const holder = await client.fetchHolder(mint, dave.address);
  console.log(`  ${holder && holder.lastAcc > 0n ? "ok " : "FAIL"} Dave's Holder exists, last_acc > 0`);

  console.log(process.exitCode ? "\nClient smoke test FAILED" : "\nClient smoke test passed");
  process.exit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
