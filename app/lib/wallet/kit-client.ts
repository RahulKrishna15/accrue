import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { RPC_URL, WALLET_CHAIN } from "@/lib/accrue/constants";

/**
 * One Kit client for the app. The connected Wallet Standard wallet fills payer + identity.
 * Kept apart from the wallet context so the Accrue client can use it without an import cycle.
 */
export const kitClient = createClient()
  .use(walletSigner({ chain: WALLET_CHAIN }))
  .use(solanaRpc({ rpcUrl: RPC_URL }));
export type AppClient = typeof kitClient;
