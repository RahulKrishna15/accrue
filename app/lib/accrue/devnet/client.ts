import {
  AccountRole,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase58Decoder,
  getBase64Encoder,
  getSignatureFromTransaction,
  isSolanaError,
  isTransactionModifyingSigner,
  isTransactionPartialSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  type Address,
  type Base58EncodedBytes,
  type Instruction,
  type KeyPairSigner,
  type ReadonlyUint8Array,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  type TransactionSigner,
} from "@solana/kit";
import { findAssociatedTokenPda as findUsdcAta, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  fetchAllMaybeMint,
  findAssociatedTokenPda as findShareAta,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  type Mint,
} from "@solana-program/token-2022";
import type { AccrueClient } from "../client";
import { SHARE_DECIMALS, USDC_MINT } from "../constants";
import {
  ACCRUE_ERRORS,
  AccrueProgramError,
  TransactionDroppedError,
  WalletRejectedError,
  type AccrueErrorCode,
} from "../errors";
import {
  ACCRUE_PROGRAM_ADDRESS,
  CONFIG_DISCRIMINATOR,
  fetchMaybeConfig,
  fetchMaybeHolder,
  findConfigPda,
  findExtraAccountMetaListPda,
  findHolderPda,
  getClaimInstructionAsync,
  getCloseFundInstructionAsync,
  getConfigDecoder,
  getDepositRevenueInstructionAsync,
  getHolderDecoder,
  getInitExtraAccountMetaListInstructionAsync,
  getInitializeFundInstructionAsync,
  getInvestInstructionAsync,
  getRegisterHolderInstructionAsync,
  getSetPausedInstructionAsync,
  getSetPriceInstructionAsync,
  HOLDER_DISCRIMINATOR,
  type Config,
  type Holder,
} from "../generated";
import type { AccrueInstruction } from "../instructions";
import type { Fund, FundMetadata, HolderAccount, Position } from "../types";

/** What the real client needs from the app's Kit client. */
export type DevnetClientDeps = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  /** The connected wallet's signer, or null when no wallet is connected. */
  getSigner: () => TransactionSigner | null;
};

const EXPLORER = "https://explorer.solana.com";
/** Holder layout: 8-byte discriminator, mint (32), then owner (32). */
const HOLDER_OWNER_OFFSET = 40n;

const base58 = (bytes: ReadonlyUint8Array) => getBase58Decoder().decode(bytes) as Base58EncodedBytes;
const usdcAta = async (owner: Address) =>
  (await findUsdcAta({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
const shareAta = async (owner: Address, mint: Address) =>
  (await findShareAta({ owner, mint, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS }))[0];
const usdc = { usdcMint: USDC_MINT, usdcTokenProgram: TOKEN_PROGRAM_ADDRESS };

function metadataOf(mint: Mint | null): FundMetadata {
  const ext = mint?.extensions.__option === "Some" ? mint.extensions.value : [];
  const meta = ext.find((e) => e.__kind === "TokenMetadata");
  return meta?.__kind === "TokenMetadata"
    ? { name: meta.name, symbol: meta.symbol, image: meta.uri }
    : { name: "Unknown fund", symbol: "?", image: "" };
}

function toFund(address: Address, c: Config, mint: Mint | null): Fund {
  return {
    address,
    mint: c.mint,
    manager: c.manager,
    treasury: c.treasury,
    vault: c.vault,
    price: c.price,
    feeBps: c.feeBps,
    minInvestment: c.minInvestment,
    sizeCap: c.sizeCap,
    streamPeriod: c.streamPeriod,
    totalSupply: c.totalSupply,
    totalRaised: c.totalRaised,
    accPerToken: c.accPerToken,
    streamRemaining: c.streamRemaining,
    streamEnd: c.streamEnd,
    lastUpdate: c.lastUpdate,
    totalIncome: c.totalIncome,
    totalFees: c.totalFees,
    totalClaimed: c.totalClaimed,
    paused: c.paused,
    closed: c.closed,
    createdAt: c.createdAt,
    metadata: metadataOf(mint),
  };
}

function toHolder(address: Address, h: Holder): HolderAccount {
  return {
    address,
    mint: h.mint,
    owner: h.owner,
    lastAcc: h.lastAcc,
    pending: h.pending,
    totalClaimed: h.totalClaimed,
    totalInvested: h.totalInvested,
  };
}

/** Turns a Kit / wallet error into the errors the UI already knows how to show. */
function mapError(e: unknown, signature?: string): unknown {
  for (let cur: unknown = e; cur; cur = (cur as { cause?: unknown }).cause) {
    if (isSolanaError(cur, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM) && cur.context.code in ACCRUE_ERRORS) {
      return new AccrueProgramError(cur.context.code as AccrueErrorCode, signature);
    }
    if (isSolanaError(cur, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED)) return new TransactionDroppedError(signature);
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|declin|cancel/i.test(msg)) return new WalletRejectedError();
  return e;
}

export function createDevnetClient({ rpc, rpcSubscriptions, getSigner }: DevnetClientDeps): AccrueClient {
  const listeners = new Set<() => void>();
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  /** Mint keypairs made by generateMintAddress, kept until initialize_fund signs with them. */
  const mintSigners = new Map<Address, KeyPairSigner>();

  async function tokenBalance(account: Address): Promise<bigint> {
    const { value } = await rpc.getAccountInfo(account, { encoding: "base64" }).send();
    if (!value) return 0n;
    // SPL token account: amount is a u64 at bytes 64..72 (same for Token-2022).
    const data = getBase64Encoder().encode(value.data[0]);
    return new DataView(data.buffer, data.byteOffset).getBigUint64(64, true);
  }

  async function fundsFor(configs: { address: Address; data: Config }[]): Promise<Fund[]> {
    const mints = await fetchAllMaybeMint(rpc, configs.map((c) => c.data.mint));
    return configs.map((c, i) => toFund(c.address, c.data, mints[i].exists ? mints[i].data : null));
  }

  async function fetchFund(mint: Address): Promise<Fund | null> {
    const [config] = await findConfigPda({ mint });
    const account = await fetchMaybeConfig(rpc, config);
    if (!account.exists) return null;
    return (await fundsFor([account]))[0];
  }

  async function requireConfig(mint: Address): Promise<Config> {
    const account = await fetchMaybeConfig(rpc, (await findConfigPda({ mint }))[0]);
    if (!account.exists) throw new Error("This fund does not exist on devnet.");
    return account.data;
  }

  /** Builds the real instructions for one UI descriptor, adding the accounts the UI doesn't track. */
  async function toInstructions(ix: AccrueInstruction, signer: TransactionSigner): Promise<Instruction[]> {
    switch (ix.name) {
      case "initializeFund": {
        const mint = mintSigners.get(ix.accounts.mint);
        if (!mint) throw new Error("Unknown mint keypair. Create the fund again.");
        const { image, ...args } = ix.args;
        const treasury = await usdcAta(signer.address);
        return [
          // The treasury is the manager's USDC ATA; create it if this wallet never held USDC.
          await getCreateAssociatedTokenIdempotentInstructionAsync({
            payer: signer,
            owner: signer.address,
            mint: USDC_MINT,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          }),
          await getInitializeFundInstructionAsync({ manager: signer, mint, treasury, ...usdc, ...args, uri: image }),
        ];
      }
      case "initExtraAccountMetaList":
        return [await getInitExtraAccountMetaListInstructionAsync({ payer: signer, mint: ix.accounts.mint })];
      case "invest": {
        const { treasury } = await requireConfig(ix.accounts.mint);
        return [
          await getInvestInstructionAsync({
            investor: signer,
            mint: ix.accounts.mint,
            investorUsdc: await usdcAta(signer.address),
            treasury,
            ...usdc,
            usdcAmount: ix.args.usdcAmount,
          }),
        ];
      }
      case "registerHolder":
        return [await getRegisterHolderInstructionAsync({ payer: signer, owner: ix.accounts.owner, mint: ix.accounts.mint })];
      case "depositRevenue": {
        const { treasury, vault } = await requireConfig(ix.accounts.mint);
        return [
          await getDepositRevenueInstructionAsync({
            manager: signer,
            mint: ix.accounts.mint,
            managerUsdc: await usdcAta(signer.address),
            vault,
            treasury,
            ...usdc,
            amount: ix.args.amount,
          }),
        ];
      }
      case "claim": {
        const { vault } = await requireConfig(ix.accounts.mint);
        return [
          await getCreateAssociatedTokenIdempotentInstructionAsync({
            payer: signer,
            owner: signer.address,
            mint: USDC_MINT,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          }),
          await getClaimInstructionAsync({
            owner: signer,
            mint: ix.accounts.mint,
            ownerUsdc: await usdcAta(signer.address),
            vault,
            ...usdc,
          }),
        ];
      }
      case "setPrice":
        return [await getSetPriceInstructionAsync({ manager: signer, mint: ix.accounts.mint, price: ix.args.price })];
      case "setPaused":
        return [await getSetPausedInstructionAsync({ manager: signer, mint: ix.accounts.mint, paused: ix.args.paused })];
      case "closeFund":
        return [await getCloseFundInstructionAsync({ manager: signer, mint: ix.accounts.mint })];
      case "transferCheckedWithHook": {
        const { mint, destinationOwner } = ix.accounts;
        const destination = await shareAta(destinationOwner, mint);
        const transfer = getTransferCheckedInstruction(
          {
            source: await shareAta(signer.address, mint),
            mint,
            destination,
            authority: signer,
            amount: ix.args.amount,
            decimals: SHARE_DECIMALS,
          },
          { programAddress: TOKEN_2022_PROGRAM_ADDRESS },
        );
        // The receiver's ATA may not exist yet, so the hook accounts are derived from the
        // owners instead of read from chain. Token-2022 still checks them against the recipe.
        const [config] = await findConfigPda({ mint });
        const [metaList] = await findExtraAccountMetaListPda({ mint });
        const holder = async (owner: Address) => (await findHolderPda({ mint, owner }))[0];
        return [
          await getCreateAssociatedTokenIdempotentInstructionAsync({
            payer: signer,
            owner: destinationOwner,
            mint,
            tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
          }),
          {
            ...transfer,
            accounts: [
              ...transfer.accounts,
              { address: config, role: AccountRole.WRITABLE },
              { address: await holder(signer.address), role: AccountRole.WRITABLE },
              { address: await holder(destinationOwner), role: AccountRole.WRITABLE },
              { address: ACCRUE_PROGRAM_ADDRESS, role: AccountRole.READONLY },
              { address: metaList, role: AccountRole.READONLY },
            ],
          },
        ];
      }
    }
  }

  return {
    mode: "devnet",
    now: () => Date.now(),

    async fetchAllFunds() {
      const accounts = await rpc
        .getProgramAccounts(ACCRUE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [{ memcmp: { offset: 0n, bytes: base58(CONFIG_DISCRIMINATOR), encoding: "base58" } }],
        })
        .send();
      const decoder = getConfigDecoder();
      const configs = accounts.map((a) => ({
        address: a.pubkey,
        data: decoder.decode(getBase64Encoder().encode(a.account.data[0])),
      }));
      const funds = await fundsFor(configs);
      return funds.sort((a, b) => Number(b.createdAt - a.createdAt));
    },

    fetchFund,

    async fetchHolder(mint, owner) {
      const [address] = await findHolderPda({ mint, owner });
      const account = await fetchMaybeHolder(rpc, address);
      return account.exists ? toHolder(address, account.data) : null;
    },

    fetchShareBalance: async (mint, owner) => tokenBalance(await shareAta(owner, mint)),
    fetchUsdcBalance: async (owner) => tokenBalance(await usdcAta(owner)),

    async fetchPositions(owner) {
      const accounts = await rpc
        .getProgramAccounts(ACCRUE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            { memcmp: { offset: 0n, bytes: base58(HOLDER_DISCRIMINATOR), encoding: "base58" } },
            { memcmp: { offset: HOLDER_OWNER_OFFSET, bytes: owner as string as Base58EncodedBytes, encoding: "base58" } },
          ],
        })
        .send();
      const decoder = getHolderDecoder();
      const holders = accounts.map((a) =>
        toHolder(a.pubkey, decoder.decode(getBase64Encoder().encode(a.account.data[0]))),
      );
      const positions = await Promise.all(
        holders.map(async (holder): Promise<Position | null> => {
          const [fund, balance] = await Promise.all([
            fetchFund(holder.mint),
            tokenBalance(await shareAta(owner, holder.mint)),
          ]);
          return fund ? { fund, holder, balance } : null;
        }),
      );
      return positions.filter((p): p is Position => !!p && (p.balance > 0n || p.holder.pending > 0n));
    },

    // Activity feed from transaction logs comes in a later step.
    fetchEvents: async () => [],

    generateMintAddress: async () => {
      const signer = await generateKeyPairSigner();
      mintSigners.set(signer.address, signer);
      return signer.address;
    },

    async send(ixs, { signer: expected, onPhase }) {
      const signer = getSigner();
      if (!signer) throw new Error("Connect a wallet first.");
      if (signer.address !== expected) throw new Error("The connected wallet changed. Reconnect and try again.");

      const instructions = (await Promise.all(ixs.map((ix) => toInstructions(ix, signer)))).flat();
      const { value: blockhash } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) => appendTransactionMessageInstructions(instructions, m),
      );

      onPhase?.("signing");
      let signature: string | undefined;
      try {
        if (isTransactionModifyingSigner(signer) || isTransactionPartialSigner(signer)) {
          const tx = await signTransactionMessageWithSigners(message);
          assertIsTransactionWithBlockhashLifetime(tx);
          signature = getSignatureFromTransaction(tx);
          onPhase?.("confirming", signature);
          await sendAndConfirm(tx, { commitment: "confirmed" });
        } else {
          // Wallets that only sign-and-send: the wallet submits, we wait for confirmation.
          const bytes = await signAndSendTransactionMessageWithSigners(message);
          signature = getBase58Decoder().decode(bytes);
          onPhase?.("confirming", signature);
          await waitForConfirmation(signature, blockhash.lastValidBlockHeight);
        }
      } catch (e) {
        throw mapError(e, signature);
      } finally {
        for (const ix of ixs) if (ix.name === "initializeFund") mintSigners.delete(ix.accounts.mint);
      }
      listeners.forEach((l) => l());
      return { signature };
    },

    subscribe(l) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },

    explorerTxUrl: (signature) => `${EXPLORER}/tx/${signature}?cluster=devnet`,
    explorerAddressUrl: (address) => `${EXPLORER}/address/${address}?cluster=devnet`,
  };

  async function waitForConfirmation(signature: string, lastValidBlockHeight: bigint) {
    for (;;) {
      const { value } = await rpc.getSignatureStatuses([signature as Parameters<typeof rpc.getSignatureStatuses>[0][0]]).send();
      const status = value[0];
      if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
      const height = await rpc.getBlockHeight().send();
      if (height > lastValidBlockHeight) throw new TransactionDroppedError(signature);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
