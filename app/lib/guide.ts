/**
 * "How this page works" content for each app page: where to start, then the words the page uses.
 * Plain language for someone who has never used a tokenized fund. Keep definitions to one or two
 * sentences and in step with the program's real rules (see docs/progress.md section 5).
 */

export type GuideTerm = { term: string; meaning: string };
export type Guide = {
  /** One or two sentences: what this page is for. */
  intro: string;
  /** Only when the page really is a sequence of actions. */
  steps?: string[];
  terms: GuideTerm[];
};

const TERMS = {
  fund: { term: "Fund", meaning: "A pool of money run by a manager. Investors buy its shares, and the manager pays income to everyone holding them." },
  share: { term: "Share", meaning: "A token that stands for your part of a fund. The more shares you hold, and the longer you hold them, the more income you earn." },
  price: { term: "Price per share", meaning: "What one share costs in Test USDC. The manager sets it, and a change only affects new investments." },
  fee: { term: "Management fee", meaning: "The manager's cut of each income deposit, at most 10%. It comes out of income, never out of the money you invested." },
  testUsdc: { term: "Test USDC", meaning: "A practice version of the USDC dollar token on Solana devnet. Get it free from the faucet in your wallet menu." },
  principal: { term: "Principal", meaning: "The Test USDC you put in to buy shares. It goes to the manager's treasury; income is paid separately." },
  income: { term: "Income", meaning: "Money the manager deposits for holders, for example interest a credit fund has collected. It is paid in Test USDC, and your share count stays the same." },
  stream: { term: "Income stream", meaning: "Each deposit is not paid out at once. It is released bit by bit over the stream period, so people who hold longer earn more of it." },
  streamPeriod: { term: "Stream period", meaning: "How long one income deposit takes to be fully released, for example 30 days." },
  claimable: { term: "Claimable", meaning: "Income that has been released to you and not collected yet. It keeps growing while a stream is running." },
  claim: { term: "Claim", meaning: "Moves your claimable income into your wallet. It always works, even when a fund is paused or closed." },
  status: { term: "Open, paused, closed", meaning: "Open funds accept new investment. Paused funds block investing, deposits and transfers for a while. Closed funds take no new money ever again, but keep paying income." },
  minimum: { term: "Minimum and size cap", meaning: "The smallest amount one investment can be, and the most Test USDC the fund accepts in total." },
  outstanding: { term: "Shares outstanding", meaning: "All shares that exist for this fund. Your part of each income payment is your shares divided by this number." },
  vault: { term: "Income vault", meaning: "The account that holds deposited income until holders claim it. Only the program can pay out of it." },
  treasury: { term: "Treasury", meaning: "The manager's own USDC account. Invested principal and management fees go here." },
  gross: { term: "Gross and net income", meaning: "Gross is what the manager deposits. Net is what is left for holders after the management fee." },
  transfer: { term: "Transfer", meaning: "Sending shares to another wallet. Income you earned before the transfer stays yours; the receiver earns from that moment on." },
  holder: { term: "Holder account", meaning: "A small record the program keeps for each wallet in each fund, tracking what it has earned. It is created the first time the wallet gets shares." },
  hook: { term: "Transfer hook", meaning: "Code that runs on every share transfer and settles both sides' income first, so the split stays fair." },
  signature: { term: "Transaction", meaning: "The on-chain record of an action. Click it to see the details on Solana Explorer." },
  event: { term: "Event", meaning: "A short message the program writes to the chain whenever something happens, such as an investment or a claim. This page reads them directly." },
  wallet: { term: "Wallet", meaning: "An app like Phantom, Solflare or Backpack that holds your accounts and approves each transaction. Set it to Solana devnet for Accrue." },
} satisfies Record<string, GuideTerm>;

export const GUIDES = {
  funds: {
    intro: "Every fund on Accrue. Pick one to invest in, or create your own and manage it.",
    steps: [
      "Connect a wallet set to Solana devnet.",
      "Get Test USDC from the faucet in your wallet menu.",
      "Open a fund and check its price, fee and status.",
      "Invest. Your shares and live income then appear in Portfolio.",
    ],
    terms: [TERMS.fund, TERMS.share, TERMS.price, TERMS.fee, TERMS.status, TERMS.testUsdc],
  },
  fund: {
    intro: "One fund's terms, how much income it is paying out, and its recent activity. Invest from the panel on this page.",
    steps: [
      "Check the price per share, the fee and the minimum.",
      "Enter how much Test USDC to invest. The panel shows how many shares you get.",
      "Approve the transaction in your wallet.",
      "You earn from any running income stream from the moment your shares arrive.",
    ],
    terms: [TERMS.price, TERMS.fee, TERMS.minimum, TERMS.outstanding, TERMS.stream, TERMS.streamPeriod, TERMS.status],
  },
  createFund: {
    intro: "Set up a new fund. The connected wallet becomes its manager: it receives invested money and fees, and deposits income for holders.",
    steps: [
      "Name the fund and give it a short symbol.",
      "Set the price per share, fee, minimum and size cap.",
      "Choose a stream period for income deposits.",
      "Create the fund and approve it in your wallet. It then appears in Funds and Manage.",
    ],
    terms: [TERMS.fund, TERMS.price, TERMS.fee, TERMS.minimum, TERMS.streamPeriod, TERMS.treasury],
  },
  portfolio: {
    intro: "Your shares in every fund and the income they are earning right now.",
    steps: [
      "Invest in a fund to get shares.",
      "When the manager deposits income, your claimable amount starts to grow.",
      "Claim whenever you like. The Test USDC lands in your wallet.",
    ],
    terms: [TERMS.claimable, TERMS.claim, TERMS.principal, TERMS.income, TERMS.stream, TERMS.share],
  },
  manage: {
    intro: "Run the funds this wallet manages: deposit income for holders, change the price, pause or close.",
    steps: [
      "Pick one of your funds.",
      "Deposit income. The fee goes to your treasury and the rest streams to holders.",
      "Change the price or pause the fund when you need to.",
    ],
    terms: [TERMS.gross, TERMS.fee, TERMS.vault, TERMS.treasury, TERMS.stream, TERMS.status],
  },
  transfer: {
    intro: "Send fund shares to another wallet. Income earned so far stays with each side.",
    steps: [
      "Choose the fund and how many shares to send.",
      "Paste the recipient's Solana devnet address.",
      "Approve in your wallet. The recipient starts earning on those shares right away.",
    ],
    terms: [TERMS.transfer, TERMS.holder, TERMS.hook, TERMS.share],
  },
  activity: {
    intro: "Everything that has happened in Accrue funds, newest first, read straight from the chain.",
    terms: [TERMS.event, TERMS.signature, TERMS.income, TERMS.claim, TERMS.transfer, TERMS.holder, TERMS.wallet],
  },
} satisfies Record<string, Guide>;

export type GuideKey = keyof typeof GUIDES;
