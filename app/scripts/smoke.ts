/**
 * Smoke test: runs the worked example against a local Surfpool network over
 * RPC, using the generated client and the same calls the app will make.
 *
 *   cd program && surfpool start --network devnet --no-deploy
 *   solana program deploy --url localhost target/deploy/accrue.so \
 *     --program-id target/deploy/accrue-keypair.json
 *   cd app && bun scripts/smoke.ts
 *
 * Uses Surfpool cheatcodes to fund wallets and move the clock, so it only
 * runs against Surfpool, never devnet.
 */
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { findAssociatedTokenPda as findUsdcAta, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  findAssociatedTokenPda as findShareAta,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
  getTransferCheckedWithTransferHookInstructionAsync,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";

import {
  ACCRUE_PROGRAM_ADDRESS,
  findConfigPda,
  findExtraAccountMetaListPda,
  findHolderPda,
  getClaimInstructionAsync,
  getDepositRevenueInstructionAsync,
  getInitExtraAccountMetaListInstructionAsync,
  getInitializeFundInstructionAsync,
  getInvestInstructionAsync,
  getRegisterHolderInstructionAsync,
} from "../lib/accrue/generated";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const WS_URL = RPC_URL.replace(/^http/, "ws").replace("8899", "8900");
/** Circle's devnet USDC, fetched on demand from the devnet fork. */
const USDC_MINT = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC = 1_000_000n;
const DAY = 86_400;

const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

/** Calls a Surfpool cheatcode (not part of the standard RPC). */
async function cheat(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

/** unix_timestamp from the Clock sysvar (bytes 32..40). */
async function chainTime(): Promise<number> {
  const clock = address("SysvarC1ock11111111111111111111111111111111");
  const { value } = await rpc.getAccountInfo(clock, { encoding: "base64" }).send();
  const bytes = Buffer.from(value!.data[0], "base64");
  return Number(bytes.readBigInt64LE(32));
}

async function warp(seconds: number) {
  const now = await chainTime();
  await cheat("surfnet_timeTravel", [{ absoluteTimestamp: (now + seconds) * 1000 }]);
}

/** A fresh wallet with 10 SOL and `usdc` in its USDC ATA. */
async function wallet(usdc: bigint): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  await cheat("surfnet_setAccount", [signer.address, { lamports: 10_000_000_000 }]);
  await cheat("surfnet_setTokenAccount", [
    signer.address,
    USDC_MINT,
    { amount: Number(usdc), state: "initialized" },
  ]);
  return signer;
}

async function usdcAta(owner: Address) {
  const [ata] = await findUsdcAta({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

async function balance(account: Address): Promise<bigint> {
  const { value } = await rpc.getTokenAccountBalance(account).send();
  return BigInt(value.amount);
}

const fmt = (amount: bigint) => (Number(amount) / 1e6).toFixed(6);

async function send(label: string, instructions: Instruction[], feePayer: KeyPairSigner) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(tx);
  await sendAndConfirm(tx, { commitment: "confirmed" });
  const result = await rpc
    .getTransaction(getSignatureFromTransaction(tx), {
      commitment: "confirmed",
      encoding: "json",
      maxSupportedTransactionVersion: 0,
    })
    .send();
  console.log(`  ok  ${label.padEnd(44)} ${result?.meta?.computeUnitsConsumed} CU`);
}

/** Payouts drift by a few base units because real seconds pass between steps. */
function expectAbout(label: string, actual: bigint, expected: bigint, tolerance = USDC / 10n) {
  const diff = actual > expected ? actual - expected : expected - actual;
  const mark = diff <= tolerance ? "ok " : "FAIL";
  console.log(`  ${mark} ${label.padEnd(44)} ${fmt(actual)} (expected ~${fmt(expected)})`);
  if (diff > tolerance) process.exitCode = 1;
}

async function main() {
  console.log(`Surfpool at ${RPC_URL}\n`);

  // Fund: the manager's USDC ATA is the treasury and also the deposit source.
  const manager = await wallet(3_000n * USDC);
  const treasury = await usdcAta(manager.address);
  const mint = await generateKeyPairSigner();
  const [config] = await findConfigPda({ mint: mint.address });
  const [vault] = await findUsdcAta({ owner: config, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const usdc = { usdcMint: USDC_MINT, usdcTokenProgram: TOKEN_PROGRAM_ADDRESS };

  await send(
    "initialize_fund",
    [
      await getInitializeFundInstructionAsync({
        manager,
        mint,
        treasury,
        ...usdc,
        name: "Harbor Credit Fund",
        symbol: "HCF",
        uri: "https://example.com/hcf.png",
        price: 10n * USDC,
        feeBps: 0,
        minInvestment: 100n * USDC,
        sizeCap: 1_000_000n * USDC,
        streamPeriod: BigInt(30 * DAY),
      }),
    ],
    manager,
  );
  await send(
    "init_extra_account_meta_list",
    [await getInitExtraAccountMetaListInstructionAsync({ payer: manager, mint: mint.address })],
    manager,
  );

  const alice = await wallet(6_000n * USDC);
  const bob = await wallet(4_000n * USDC);
  const carol = await wallet(10_000n * USDC);
  const invest = async (who: KeyPairSigner, amount: bigint) =>
    getInvestInstructionAsync({
      investor: who,
      mint: mint.address,
      investorUsdc: await usdcAta(who.address),
      treasury,
      ...usdc,
      usdcAmount: amount,
    });
  const claim = async (who: KeyPairSigner) =>
    getClaimInstructionAsync({
      owner: who,
      mint: mint.address,
      ownerUsdc: await usdcAta(who.address),
      vault,
      ...usdc,
    });
  const shareAta = async (owner: Address) =>
    (await findShareAta({ owner, mint: mint.address, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS }))[0];
  const hookedTransfer = async (from: KeyPairSigner, to: Address, amount: bigint) =>
    getTransferCheckedWithTransferHookInstructionAsync(
      { rpc },
      {
        source: await shareAta(from.address),
        mint: mint.address,
        destination: await shareAta(to),
        authority: from,
        amount,
        decimals: 6,
      },
    );

  /**
   * For a receiver whose share ATA doesn't exist yet (created in the same
   * transaction), the helper above can't read the owner out of it. We know the
   * owner, so derive the hook's extra accounts directly. Token-2022 still checks
   * them against the on-chain recipe.
   */
  const hookedTransferToNewWallet = async (from: KeyPairSigner, to: Address, amount: bigint) => {
    const transfer = getTransferCheckedInstruction(
      {
        source: await shareAta(from.address),
        mint: mint.address,
        destination: await shareAta(to),
        authority: from,
        amount,
        decimals: 6,
      },
      { programAddress: TOKEN_2022_PROGRAM_ADDRESS },
    );
    const holder = async (owner: Address) => (await findHolderPda({ mint: mint.address, owner }))[0];
    const [metaList] = await findExtraAccountMetaListPda({ mint: mint.address });
    return {
      ...transfer,
      accounts: [
        ...transfer.accounts,
        { address: config, role: AccountRole.WRITABLE },
        { address: await holder(from.address), role: AccountRole.WRITABLE },
        { address: await holder(to), role: AccountRole.WRITABLE },
        { address: ACCRUE_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        { address: metaList, role: AccountRole.READONLY },
      ],
    };
  };

  await send("invest (Alice, 600 shares)", [await invest(alice, 6_000n * USDC)], alice);
  await send("invest (Bob, 400 shares)", [await invest(bob, 4_000n * USDC)], bob);
  await send(
    "deposit_revenue (3,000, from the treasury)",
    [
      await getDepositRevenueInstructionAsync({
        manager,
        mint: mint.address,
        managerUsdc: treasury,
        vault,
        treasury,
        ...usdc,
        amount: 3_000n * USDC,
      }),
    ],
    manager,
  );

  await warp(10 * DAY);
  await send("day 10: hooked transfer Alice -> Bob 300", [await hookedTransfer(alice, bob.address, 300n * USDC)], alice);

  await warp(10 * DAY);
  await send("day 20: invest (Carol, 1,000 shares)", [await invest(carol, 10_000n * USDC)], carol);

  await warp(5 * DAY);
  await send("day 25: claim (Bob)", [await claim(bob)], bob);
  expectAbout("Bob's first claim", await balance(await usdcAta(bob.address)), 1_275n * USDC);

  await warp(5 * DAY);
  for (const [name, who] of [["Alice", alice], ["Bob", bob], ["Carol", carol]] as const) {
    await send(`day 30: claim (${name})`, [await claim(who)], who);
  }

  // A brand-new wallet: share ATA + Holder + hooked transfer in one transaction.
  const dave = await generateKeyPairSigner();
  await send(
    "new wallet: ATA + register_holder + transfer",
    [
      await getCreateAssociatedTokenIdempotentInstructionAsync({
        payer: alice,
        owner: dave.address,
        mint: mint.address,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      }),
      await getRegisterHolderInstructionAsync({ payer: alice, owner: dave.address, mint: mint.address }),
      await hookedTransferToNewWallet(alice, dave.address, 100n * USDC),
    ],
    alice,
  );

  console.log("");
  expectAbout("Alice total", await balance(await usdcAta(alice.address)), 1_050n * USDC);
  expectAbout("Bob total", await balance(await usdcAta(bob.address)), 1_450n * USDC);
  expectAbout("Carol total", await balance(await usdcAta(carol.address)), 500n * USDC);
  expectAbout("Vault left (rounding dust)", await balance(vault), 0n, 10n);
  expectAbout("Dave's shares", await balance(await shareAta(dave.address)), 100n * USDC, 0n);

  console.log(process.exitCode ? "\nSmoke test FAILED" : "\nSmoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
