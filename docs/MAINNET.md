# Lexari mainnet: network mode, env and rollout

One codebase, two deployments that never share anything:

| | Testnet | Mainnet |
| --- | --- | --- |
| Host | testnet.lexari.ai | app.lexari.ai |
| `LEXARI_NETWORK` | `testnet` | `mainnet` |
| Solana | devnet | mainnet-beta |
| Monad | testnet, chain 10143 | mainnet, chain 143 |
| Base / Ethereum / Arbitrum | Sepolia chains (84532 / 11155111 / 421614) | 8453 / 1 / 42161 |
| Robinhood Chain | testnet 46630 | hidden (no public mainnet) |
| Faucets (devnet SOL, test tokens) | on | off: routes answer 404, `faucetOn()` is false |
| ORE practice mining | on | hidden: no ORE Miner in the marketplace, no gift, no miner row |
| Spend limits (per trade / daily, default and max) | $5 / $20, max $25 / $100 | $2 / $10, max $10 / $50 |
| Slippage default / max | 1% / 5% | 0.5% / 3% |
| Banner | persistent "Testnet" strip on every page | none |
| Database, secrets, wallets, memory | its own | its own |

## How it works

- `webapp/lib/network.ts` is the single source of truth: chain ids, RPC defaults, USDC addresses, Solana mints,
  explorer URLs, spend limits and feature switches for each mode. Every other file reads it; no file holds a second
  copy of a chain id.
- The mode is fixed at **build time**. `next.config.ts` reads `LEXARI_NETWORK`, writes `NEXT_PUBLIC_LEXARI_NETWORK`
  and `NEXT_PUBLIC_SOLANA_CLUSTER` into the bundle, and **fails the build** if `NEXT_PUBLIC_SOLANA_CLUSTER` or
  `NEXT_PUBLIC_LEXARI_NETWORK` disagree with it. Build once per mode.
- The server checks itself at runtime (`webapp/server/network.ts`). Any of these makes every API answer the standard
  "not set up" 503, and stops background jobs, until fixed:
  - `LEXARI_NETWORK` at runtime differs from the build (or is missing on a mainnet server);
  - `DATABASE_URL` equals `LEXARI_TESTNET_DATABASE_URL`;
  - `sha256(SESSION_SECRET)` equals `LEXARI_TESTNET_SESSION_SECRET_SHA256` (agent wallets are derived from
    `SESSION_SECRET`, so reusing it would give mainnet agents the same keys as testnet agents);
  - `LEXARI_FAUCET_KEY` set on mainnet;
  - `NEXT_PUBLIC_USDC_MINT` set to anything but mainnet USDC on mainnet;
  - the database is stamped for the other network.
- **Database network lock**: migration `0036_network_lock.sql` adds a one-row `lexari_network` table. `npm run
  db:migrate` stamps it with `LEXARI_NETWORK` (default `testnet`) and refuses to continue on a database stamped for the
  other mode; the server checks it on start and in `/api/health` (which now also reports `network`).
- **Integrations**: `content/integrations.ts` keeps one catalog and a `MAINNET_INTEGRATIONS` set. On mainnet the
  others are removed from the catalog, cannot be granted, and their tools are not offered to agents
  (`server/integrations/registry.ts` filters `TOOLS`).
- **Top up**: `content/topup.ts` has a testnet table and a mainnet table. Mainnet lists real tokens only.

## Mainnet integration audit

| Integration | Mainnet | Wiring |
| --- | --- | --- |
| Solana wallets and transfers | yes | cluster mainnet-beta; Helius / Solami / `SOLANA_RPC` |
| Base, Ethereum, Arbitrum | yes | chain ids 8453 / 1 / 42161, Circle USDC, `BASE_RPC` / `ETHEREUM_RPC` / `ARBITRUM_RPC` or Alchemy |
| Monad | yes | chain 143, `https://rpc.monad.xyz`, USDC `0x7547...b603`, explorer monadscan.com |
| Alchemy Token API | yes | `monad-mainnet` subdomain (override `ALCHEMY_MONAD_NETWORK`) |
| Jupiter quotes, LI.FI cross-chain quotes, market prices, Polymarket, Zcash, Nansen | yes | already read mainnet data; Polymarket orders and ZEC buys stay behind `POLYMARKET_LIVE` / `ZCASH_LIVE` |
| Aurora Intents | yes | already mainnet (`NEXT_PUBLIC_INTENTS_READY`) |
| Agent payments (x402), SKR, Solami, Mera, self settings | yes | USDC from `NEXT_PUBLIC_USDC_MINT` |
| Orca | hidden | code pins devnet whirlpools |
| Uniswap | hidden | quoter / router addresses are Sepolia only |
| Tempo | hidden | mainnet exists (chain 4217, rpc.tempo.xyz) but the card / MPP code is only verified on Moderato |
| Hyperliquid / HyperEVM | hidden | mainnet exists; code defaults to the testnet API |
| Agora AUSD, Kuru | hidden | testnet contract addresses only |
| Panta | hidden | paper trading on devnet |
| ORE mining | hidden | practice mode only |
| Top up on Bitcoin, Litecoin, Tron, XRP Ledger, Dogecoin, Tempo, HyperEVM | not live | deposit addresses are derived in testnet formats today (see custody proposals) |

## Mainnet env

Everything below goes in the **mainnet** env file only (for example `/opt/lexari-app/shared/webapp.env`), never in the
testnet one, and never in git.

Required:

| Variable | Value |
| --- | --- |
| `LEXARI_NETWORK` | `mainnet` (at build and at runtime) |
| `DATABASE_URL` | a **new** Postgres database, never the testnet one |
| `SESSION_SECRET` | a **new** 32+ character secret. Agent wallets derive from it: a new secret means new wallets |
| `NEXT_PUBLIC_WEBAPP_URL`, `LEXARI_APP_ORIGIN` | `https://app.lexari.ai` |
| `NEXT_PUBLIC_USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| `LEXARI_TREASURY`, `NEXT_PUBLIC_LEXARI_TREASURY` | a mainnet treasury address held in a multisig |
| `HELIUS_API_KEY` or `SOLANA_RPC` | a mainnet Solana RPC (the public endpoint is rate limited) |
| `NEXT_PUBLIC_LEXARI_PROGRAM_ID`, `LEXARI_ATTESTOR_KEY` | the Lexari Solana program deployed on mainnet, and a new attestor key for it |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY` | a separate Privy app (or at least a separate allowed origin) for app.lexari.ai |
| LLM keys (`XAI_API_KEY` and so on) | as on testnet, ideally separate keys for separate billing |

Recommended:

| Variable | Why |
| --- | --- |
| `LEXARI_TESTNET_DATABASE_URL` | lets the server refuse to start if `DATABASE_URL` was copied from testnet |
| `LEXARI_TESTNET_SESSION_SECRET_SHA256` | `sha256` of the testnet `SESSION_SECRET` (the hash only); refuses a reused secret |
| `ALCHEMY_API_KEY` | Monad, Base, Ethereum and Arbitrum mainnet RPC through Alchemy |
| `BASE_RPC`, `ETHEREUM_RPC`, `ARBITRUM_RPC`, `MONAD_RPC`, `TOPUP_RPC_BNB` | private RPCs (override the public ones) |
| `SOLAMI_API_KEY` | Solami RPC and Beam on mainnet |
| `MAINNET_TOPUP_DAILY_USD` | optional per-person daily cap on credited deposits during launch |

Must **not** be set on mainnet: `LEXARI_FAUCET_KEY`, `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`, any `*_SEPOLIA_RPC` value
reused as a mainnet RPC, and the testnet `MONAD_RPC` (on mainnet `MONAD_RPC` must point at chain 143).

Testnet keeps its current env plus `LEXARI_NETWORK=testnet` and the new host `https://testnet.lexari.ai` for
`NEXT_PUBLIC_WEBAPP_URL` / `LEXARI_APP_ORIGIN`.

## Rollout

1. **Merge** the `mainnet` branch after review. With `LEXARI_NETWORK` unset, a build is testnet and behaves as today,
   plus the Testnet banner.
2. **Move testnet to testnet.lexari.ai**: DNS, TLS, and a vhost for the existing app. Set `LEXARI_NETWORK=testnet`,
   update `NEXT_PUBLIC_WEBAPP_URL` and `LEXARI_APP_ORIGIN`, add the origin in Privy, run `npm run db:migrate` (stamps
   the existing database as `testnet`). Keep a redirect from app.lexari.ai to testnet.lexari.ai until mainnet opens.
   Note that sign-in messages are bound to the origin, so people sign in again once.
3. **Provision mainnet**: new database, new secrets (table above), new Privy origin, mainnet RPC keys, treasury
   multisig. Deploy the Solana program to mainnet and set its id and attestor.
4. **Build and migrate mainnet** in its own directory and process (for example `/opt/lexari-app`, its own pm2 name
   and port): `LEXARI_NETWORK=mainnet npm run build -w webapp`, then `LEXARI_NETWORK=mainnet npm run db:migrate -w
   webapp` (stamps the new database `mainnet`).
5. **Check before opening**: `/api/health` shows `"network":"mainnet"` and `"ok":true`; Settings > Integrations lists
   only the mainnet set; the top-up sheet shows no test coins; `/api/faucet` answers 404; no Testnet banner.
6. **Soft launch** behind an allowlist with `MAINNET_TOPUP_DAILY_USD` set, then point app.lexari.ai at the mainnet
   process and remove the cap.
7. **EVM contracts** (`contracts/evm`): deploy to Monad testnet first, then mainnet with a Safe as admin, after an
   audit.

## Custody proposals (not implemented)

Wallet custody and key handling were deliberately left unchanged on this branch. Changes worth deciding before
mainnet:

1. **Domain-separate wallet derivation by network.** Agent keys are `HMAC(SESSION_SECRET, "lexari-agent-wallet:v1:...")`
   (`server/integrations/evm.ts`, `server/agentWallets.ts` for Solana, plus Zcash and Hyperliquid). Separation today relies on a different
   `SESSION_SECRET` per deployment (now enforced when `LEXARI_TESTNET_SESSION_SECRET_SHA256` is set). Proposal: a
   dedicated `AGENT_WALLET_SECRET` per network, separate from the session-cookie secret, so rotating sessions never
   moves wallets, and the network name inside the HMAC label.
2. **Keys out of the web process.** Signing with real funds from the Next.js process means any RCE can sign.
   Proposal: a small signer service (or KMS / HSM with secp256k1 and ed25519) that only signs transactions matching
   a Confirm card the person approved, with its own rate limits.
3. **Enforce limits on chain.** Fund agents through `LexariSpendVault`, so the per-trade and daily caps hold even if
   the server key leaks; the server's `spend` call replaces a plain transfer.
4. **Deposit addresses for BTC, LTC, Tron, XRPL and Dogecoin** need mainnet derivation (address version bytes and
   HRPs) and a sweeping policy before those rails open.
5. **Payout and attestor keys** (`LEXARI_ATTESTOR_KEY`, payout keys in `server/agentWallets.ts`) should be new keys
   on mainnet, held outside the env file where possible.

## Open decisions

- Which integrations to add back first on mainnet (Hyperliquid and Tempo have mainnets; Uniswap needs per-chain
  router addresses).
- Mainnet spend limit defaults ($2 / $10) and maximums ($10 / $50).
- Whether app.lexari.ai shows a waitlist until step 6.
- Contract admin multisig and protocol fee (see `contracts/evm/README.md`).
