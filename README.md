# Accrue

Accrue pays income to the holders of a tokenized investment fund on Solana, such as an on-chain private-credit fund. Investors put in USDC and receive Token-2022 share tokens. The fund manager deposits income in USDC, and every holder earns their share of it based on how many shares they held **and for how long**, even when shares change hands in the middle of a period. Income is paid out as separate USDC; the share count never changes.

It is a Solana program (Anchor) plus a Next.js web app. It runs on **devnet only**, with Test USDC.

- Program ID (devnet): `FcMSQ71YR9UPF1N27AicJSjuRVA8xcikS1V3Eza43mmh`
- Test USDC: Circle's devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## How it works

### The flow

1. **Create a fund.** A manager sets a name, symbol, share price, management fee (up to 10%), minimum investment, size cap and stream period. This creates a Token-2022 share mint with a Transfer Hook and on-chain metadata.
2. **Invest.** Anyone can invest; funds are open, with no approval step. Shares are minted at the set price (`shares = USDC ÷ price`) and the invested USDC goes to the manager's treasury.
3. **Deposit income.** The manager deposits USDC income. The fee goes to the treasury and the rest goes into the fund's income vault. That income is released gradually over the stream period, not all at once.
4. **Hold, transfer, claim.** Income builds up second by second for every holder. Shares can be sent to any wallet at any time, and the split stays fair. Holders claim their USDC whenever they like.

### Fair split: the accumulator

The program keeps one running number per fund, `acc_per_token`: the total income paid per share since the fund started (fixed-point, scaled by 1e12). Each holder stores the value they last saw (`last_acc`) and any income already settled but not claimed (`pending`).

```
earned = shares × (acc_per_token now − last_acc)
```

Before any balance or the total supply changes, the affected holders are **settled**: their earnings so far move into `pending` and `last_acc` is reset to the current value. So shares only earn for the time they were actually held. All amounts round down.

### Streaming

A deposit is not added to `acc_per_token` immediately. The fund tracks `stream_remaining`, `stream_end` and `last_update`, and every instruction first releases the share of the remaining income that matches the time passed:

```
released = stream_remaining × elapsed ÷ (stream_end − last_update)
```

A new deposit adds any unreleased income to the new amount and streams the total over a fresh period. Everything is released by `stream_end`.

### Transfer Hook

Share tokens use the Token-2022 Transfer Hook extension. On every `transfer_checked`, Token-2022 calls Accrue's `execute` instruction, which settles both the sender and the receiver before the new balances count. Without this, someone could buy shares just before a payout and collect income they didn't earn.

- The hook can't create accounts, so the app adds `register_holder` in the same transaction when the receiver is new to the fund.
- Shares only live in the owners' associated token accounts, so one Holder record always matches one balance.

### Accounts

| Account | Address / seeds | Holds |
|---|---|---|
| Config | PDA `["config", mint]` | Fund settings, accumulator, stream state, totals, paused/closed flags |
| Holder | PDA `["holder", mint, owner]` | `last_acc`, `pending`, totals per investor |
| Extra account metas | PDA `["extra-account-metas", mint]` | Which accounts Token-2022 passes to the hook |
| Share mint | Token-2022 mint | TransferHook + MetadataPointer + TokenMetadata; mint authority is the Config PDA |
| Income vault | Config PDA's USDC token account | Deposited income; claims pay from here only |
| Treasury | Manager's USDC token account | Invested principal and fees |

### Instructions

| Instruction | Who | What it does |
|---|---|---|
| `initialize_fund` | Manager | Creates the share mint, Config and vault |
| `init_extra_account_meta_list` | Manager | Registers the hook's extra accounts |
| `invest` | Anyone | Pays USDC, mints shares, creates the Holder if needed |
| `register_holder` | Anyone | Creates a Holder for a wallet about to receive shares |
| `deposit_revenue` | Manager | Takes the fee, adds income to the stream |
| `claim` | Holder | Pays out settled income in USDC |
| `set_price` | Manager | Changes the price for new investments |
| `set_paused` | Manager | Pauses or resumes invest, deposit and transfers |
| `close_fund` | Manager | Stops new investment (one-way) |
| `execute` | Token-2022 | The transfer hook (direct calls are rejected) |

**Rules:** pausing blocks investing, deposits and transfers, but never claims. Income cannot be deposited before anyone holds shares. A closed fund still accepts deposits and claims.

### The web app

The app reads fund and holder accounts directly from devnet RPC and sends transactions signed by the user's wallet (Phantom, Backpack, Solflare or any Wallet Standard wallet). The activity feed is built from the program's events in transaction logs, so there is no backend, indexer or database.

## Project structure

```
app/                         Next.js web app
  lib/accrue/devnet/         Client for the deployed program (reads, transactions, events)
  lib/accrue/mock/           Simulated in-browser ledger (optional demo mode)
  lib/accrue/generated/      Typed program client generated from the IDL (Codama)
  lib/accrue/math.ts         Income math, mirrors the program
  scripts/smoke.ts           End-to-end run on a local network
  scripts/client-smoke.ts    Same run through the app's own client
program/                     Anchor workspace
  programs/accrue/src/       Program source (instructions/, state, math, events, errors)
  programs/accrue/tests/     LiteSVM tests
```

## Setup

### Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 20.9 or newer | The web app |
| A Solana wallet extension set to **devnet** | Phantom, Backpack or Solflare | Using the app |
| Rust | installed with [rustup](https://rustup.rs) (the pinned toolchain installs itself) | Building and testing the program |
| Solana CLI | 3.x | Deploying, local network |
| Anchor CLI | 1.2.0 | Building the program |
| Surfpool | 1.5 | Optional: local network runs |
| Bun | any recent | Optional: running the smoke scripts |

To only run the web app against the deployed program, you need Node.js and a wallet.

### 1. Run the web app

```bash
git clone https://github.com/RahulKrishna15/accrue.git
cd accrue/app
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The app talks to the program already deployed on devnet.

`.env.local` settings (both optional):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Use a faster devnet RPC (for example a free Helius key) if the public one rate-limits you |
| `NEXT_PUBLIC_ACCRUE_MODE` | devnet | Set to `mock` to run against a simulated ledger in the browser, with demo wallets and no wallet extension needed |

### 2. Get test funds

Each wallet needs a little devnet SOL for fees and account rent, and Test USDC to invest or deposit:

- Devnet SOL: https://faucet.solana.com
- Devnet USDC: https://faucet.circle.com (choose Solana devnet)

### 3. Try the full flow

1. **Funds → Create a fund**, fill in the form and approve in your wallet.
2. **Invest** from one or more wallets.
3. As the manager, open **Manage** and **deposit income**. Watch the earnings counter grow.
4. **Transfer** shares to another wallet in the middle of the period.
5. **Claim** from each wallet and compare the split.
6. Try **set price**, **pause** and **close** from Manage.

### 4. Build and test the program

```bash
cd program
anchor build --arch v0
cargo test
```

`--arch v0` is required: Anchor 1.2 builds for SBPF v3 by default, which devnet does not run yet. `cargo test` runs the LiteSVM tests against the built `.so`, so build first. After any change to the program's interface, regenerate the app's client:

```bash
cd app
npm run generate:client
```

### 5. Run on a local network (optional)

In one terminal, start Surfpool (a local network that pulls missing accounts, such as devnet USDC, from devnet):

```bash
cd program
NO_DNA=1 surfpool start --network devnet --no-deploy
```

In another terminal, deploy the program to it and run the end-to-end scripts:

```bash
cd program
solana program deploy --url http://127.0.0.1:8899 target/deploy/accrue.so --program-id target/deploy/accrue-keypair.json
cd ../app
bun scripts/smoke.ts
bun scripts/client-smoke.ts
```

Both scripts use Surfpool cheatcodes to fund wallets and move the clock forward, so they only run against Surfpool.

### 6. Deploy your own copy (optional)

The program keypair isn't in the repository, so deploying your own copy means a new program ID:

```bash
cd program
solana-keygen new -o target/deploy/accrue-keypair.json
anchor keys sync
anchor build --arch v0
solana config set --url devnet
solana airdrop 2
solana program deploy target/deploy/accrue.so --program-id target/deploy/accrue-keypair.json
cd ../app
npm run generate:client
```

`anchor keys sync` writes the new ID into the program and `Anchor.toml`. Regenerating the client points the app at it. Deploying needs a few devnet SOL in your CLI wallet (`~/.config/solana/id.json`).
