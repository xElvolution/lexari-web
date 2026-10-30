# Lexari mainnet environment (mainnet.lexari.ai)

A second, fully separate deployment of the web app in **mainnet** mode on the same VPS. The testnet site
(app.lexari.ai, `/opt/lexari-web`, pm2 `lexari-webapp` :3211 and `lexari-landing` :3210, database `lexari`) is never
touched by anything here.

| | Testnet (unchanged) | Mainnet (this folder) |
|---|---|---|
| Host | app.lexari.ai | mainnet.lexari.ai |
| Code | `/opt/lexari-web` (main) | `/opt/lexari-mainnet` (branch `mainnet`) |
| pm2 | `lexari-webapp` :3211, `lexari-landing` :3210 | `lexari-mainnet-webapp` :3212 (user `lexarimain`) |
| Smoke port | 3290 / 3291 | 3292 |
| Env | `/opt/lexari-web/shared/webapp.env` | `/opt/lexari-mainnet/shared/webapp.env` (new secrets) |
| Database | `lexari` (PG18 :5433) | `lexari_mainnet` (PG18 :5433, own role, stamped `mainnet`) |
| nginx | `/etc/nginx/sites-available/lexari` | `/etc/nginx/sites-available/lexari-mainnet` |
| Deploy | `/opt/lexari-web/deploy.sh` | `/opt/lexari-mainnet/deploy-mainnet.sh` |

## Files
- `provision-mainnet.sh`: one-time setup (user, directories, database and role, env file with NEW secrets, backups, nginx vhost).
- `make-mainnet-env.py`: writes the env file; copies only network-neutral settings from testnet.
- `deploy-mainnet.sh [ref]`: build, back up, migrate, smoke test (must report `network: mainnet`), switch. `--rollback` switches code back.
- `ecosystem.mainnet.cjs`: the pm2 app. `nginx-mainnet.lexari.ai.conf`: the vhost (HTTP until DNS and TLS).
- `lexari-db-backup.sh` + `lexari-db-backup.cron`: daily dumps of `lexari` and `lexari_mainnet`, 14 days, two directories, weekly restore tests.

## Real money switches (env, mainnet only)
- `LEXARI_MAINNET_EXECUTION=1`: agent sign tools (sends, x402 payments) execute with real funds, always behind a Confirm card and the per trade ($2 default, $10 max) and daily ($10 default, $50 max) limits.
- `LEXARI_MAINNET_FUNDING=1` plus a funded `LEXARI_PAYOUT_KEY`: "Fund agent" sends real USDC from Lexari's payout wallet.
- `CARD_PROVIDER=stripe|paystack` plus live keys (a mainnet build refuses test keys).
- x402 on mainnet uses network `solana` and serves nothing until the payment is confirmed on chain.

## Owner inputs
1. DNS: `A mainnet.lexari.ai -> 5.189.170.85` in Vercel DNS (lexari.ai uses ns1/ns2.vercel-dns.com). Then `certbot --nginx -d mainnet.lexari.ai`.
2. Card processor: Stripe (`STRIPE_SECRET_KEY` sk_live_, `STRIPE_WEBHOOK_SECRET` whsec_ for `https://mainnet.lexari.ai/api/billing/webhook/stripe`) or Paystack (`PAYSTACK_SECRET_KEY` sk_live_, webhook `https://mainnet.lexari.ai/api/billing/webhook/paystack`).
3. Treasury multisig address (`LEXARI_TREASURY`, `NEXT_PUBLIC_LEXARI_TREASURY`).
4. Payout / fee-payer wallet (`LEXARI_PAYOUT_KEY`), funded with SOL for fees and USDC for agent funding.
5. Privy: its own app (or mainnet.lexari.ai added to the allowed origins): `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`.
6. Private RPCs: `HELIUS_API_KEY`, `ALCHEMY_API_KEY` (public endpoints are used until then).
7. Program and contracts (below), then `NEXT_PUBLIC_LEXARI_PROGRAM_ID` and a new `LEXARI_ATTESTOR_KEY`.

## Chain deployments (prepared, not run; real funds)
Measured 30 Oct 2026 (prices: SOL $96.69, ETH $2,225.79, MON $0.0193):

| What | Script | Network cost | Fund the deployer with |
|---|---|---|---|
| Solana program (413,165 byte program data) | `contracts/solana/scripts/deploy-mainnet.sh` | 2.0995 SOL rent + ~0.01 SOL fees (about $204) | 2.5 SOL |
| EVM contracts on Base (9,884,418 gas at 0.006 gwei) | `contracts/evm/script/Deploy.s.sol` (`NETWORK=base`) | ~0.00006 ETH (~$0.13) | 0.002 ETH |
| EVM contracts on Arbitrum One (0.0202 gwei) | same, `NETWORK=arbitrum` | ~0.0002 ETH (~$0.45) | 0.003 ETH |
| EVM contracts on Ethereum (0.856 gwei) | same, `NETWORK=ethereum` | ~0.0085 ETH (~$19) | 0.03 ETH (gas spikes) |
| EVM contracts on Monad (102 gwei) | same, `NETWORK=monad` | ~1.01 MON (~$0.02) | 5 MON |

EVM: `cd contracts/evm && NETWORK=base LEXARI_ADMIN=<Safe> LEXARI_TREASURY=<treasury> forge script script/Deploy.s.sol --rpc-url base --account <keystore>` (dry run), then add `--broadcast --verify`. The script refuses a chain id that does not match the config and hands every role to `LEXARI_ADMIN`.
Before either: decide on an audit, the Safe / Squads signers and threshold, and the 10% protocol fee (`protocolFeeBps` in `contracts/evm/deployments/config/*.json`).
