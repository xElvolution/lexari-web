# Lexari production plan (Solana devnet)

Status: **in progress**. This is no longer a demo. Every feature below must run against a real backend and the Lexari program on **Solana devnet**. No mocked data, no fake buttons, no `localStorage` stand-in for coins, memories, chats, quests, or identity.

Pulled `origin/main` at `f62af8f` before this plan.

## What already exists (keep it)

- **UI bar:** purple brand (`#5b2bff`), Figtree + Bricolage Grotesque + Martian Mono, animated SVG agent faces (`shared/components`), Hub, marketplace flip cards, Face creator, ID cards. Do not restyle. Extend.
- **Landing** (`landing/`, :3000) and **webapp** (`webapp/`, :3001) as separate Next.js apps. `shared/` for faces, theme, backgrounds.
- **Wallet adapters already wired:** Phantom, Solflare, Backpack (`webapp/components/SolanaProviders.tsx`).
- **Solana program (not deployed):** `contracts/solana` program id `BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po`. Instructions today: `register_agent`, `update_agent`, `write_memory`, `revoke_memory`, `delete_memory`. Tests cover happy path + empty name + stranger update + write/revoke/delete. **Devnet account is empty** (`getAccountInfo` → null). Must deploy.
- **Client chain helpers:** `webapp/lib/chain.ts` already mints Metaplex Core assets, registers the agent PDA, encrypts memories (AES-GCM from a wallet signature), uploads ciphertext (Irys), writes the hash onchain, and can close the memory account.
- **Hub contract-of-record:** `webapp/lib/hub.ts` documents Player / AgentLevel PDAs and `check_in` / `claim_quest` / `level_up` / `claim_referral_tier`. UI talks to `HubAdapter`. Today `hub = localHub` (localStorage). Swap the adapter, keep the UI.
- **Foundry / Arbitrum** under `contracts/` (not `contracts/solana`): unused. Remove cleanly after the Solana path is live.
- **Mobile** (`lexari-wallet`, `mobileapp/`): out of scope.

## Target architecture

```
landing/                 marketing, legal. No secrets.
webapp/                  product UI + API (Vercel)
  app/api/*              Route Handlers: auth, chat stream, hub attest, marketplace
  server/                db, session, Engram, quests, SIWS, attestor
shared/                  faces, theme, copy tokens
contracts/solana         Anchor program (agent + memory + Hub)
```

**Why the backend lives in the webapp, not a second service:** both apps deploy to Vercel. Chat needs streaming (`ReadableStream`). Sessions are httpOnly cookies on the app origin. A second host would split auth, CORS, and deploy. Domain logic sits in `webapp/server/` so route files stay thin. If we later need a worker, it imports the same `server/` package.

```
Wallet (Phantom / Solflare / Backpack)
        │ SIWS (nonce + signature)
        ▼
   webapp session cookie
        │
        ├─ Engram (Cortex LLM stream + Spinal tools + Hippocampus write)
        ├─ Postgres (users, agents, encrypted memories, chats, quests, referrals, listings, hires)
        └─ Solana devnet
              ├─ Metaplex Core asset (ID card NFT)
              ├─ Agent PDA  [b"agent", owner, asset]
              ├─ Memory PDA [b"memory", agent, hash]
              ├─ Player PDA [b"player", owner]
              └─ Level PDA  [b"level", agent]
```

## On-chain accounts (Anchor, extend `programs/lexari`)

Keep existing `Agent` and `Memory`. Add:

| Account | Seeds | Fields |
| --- | --- | --- |
| `Config` | `[b"config"]` | `authority: Pubkey` (server attestor), `bump` |
| `Player` | `[b"player", owner]` | `owner, coins: u64, streak: u16, last_check_in: i64, referrer: Option<Pubkey>, lifetime: u64, bump` |
| `AgentLevel` | `[b"level", agent]` | `agent, owner, level: u8, xp: u32, bump` |
| `QuestClaim` | `[b"quest", player, quest_id_le, period_le]` | `player, quest_id: u16, period: u32, coins: u64, bump` |
| `ReferralClaim` | `[b"ref", player, tier]` | `player, tier: u8, bump` |
| `BoxClaim` | `[b"box", player, day_le]` | `player, day: u32, coins: u64, bump` |

### Instructions

- `init_config(authority)` — once, upgrade authority of the program.
- `init_player(referrer: Option<Pubkey>)` — create Player. Optional referrer must already be a Player. No self-referral.
- `check_in()` — one per UTC day. Streak +1 if yesterday, else reset to 1. Pay `STREAK_PAY[min(streak, 7)-1]` coins (10, 15, 20, 25, 30, 40, 75).
- `claim_quest(quest_id: u16, period: u32, coins: u64)` — **attestor must sign**. Creates QuestClaim PDA so it cannot double-claim. Credits `coins`. Period is a compact day/week/once id the server chooses (e.g. `yyyymmdd` or `yyyyww`).
- `open_box(day: u32, coins: u64)` — **attestor signs**. One per day. Server rolls BOX_ODDS, then attests the amount.
- `level_up(coins: u64)` — burn player coins into AgentLevel.xp, apply `xpFor(level) = 60 + (level-1)*40`, cap level 10.
- `claim_referral_tier(tier: u8)` — attestor signs after server counts attributed signups. Tiers: 1/3/5/10 friends → 100/300/600/1500.

Existing agent/memory instructions stay owner-only. Failure cases that tests must cover: wrong signer, double check-in, double quest claim, insufficient coins, level 10, self-referral, attestor mismatch, empty name.

**Quest anti-cheat:** the user cannot self-claim. The API verifies progress in Postgres, then co-signs `claim_quest` / `open_box` / `claim_referral_tier` with `LEXARI_ATTESTOR_KEY`. The client is fee-payer.

## Postgres data model

```
users            id, wallet (unique), session_nonce, referral_code (unique), referred_by, created_at
sessions         id, user_id, token_hash, expires_at
agents           id, user_id, slug (home | specialist | c-…), name, role, tone, look_json,
                 asset (core pubkey), agent_pda, minted_at, created_at
memories         id, user_id, agent_id, tag, ciphertext, iv, content_hash, uri, onchain_pda,
                 revoked, deleted_at, created_at
chats            id, user_id, kind (dm|group), slug, title, member_slugs[], created_at
messages         id, chat_id, from_id, text, meta_json, created_at
jobs             id, user_id, agent_id, prompt, status, started_at, finished_at
quest_progress   user_id, quest_id, period_key, count, updated_at   PK (user_id, quest_id, period_key)
quest_events     id, user_id, kind (message|memory|hire|checkin|level|agent), created_at
listings         id, seller_id, agent_id, price_lamports, mint (SOL|USDC), active, created_at
hires            id, listing_id, buyer_id, tx, created_at
referrals        id, referrer_id, referee_id, created_at
```

Memories store **ciphertext only**. Plaintext never hits the server. Delete = row `deleted_at` + onchain `delete_memory`. Hippocampus writes ciphertext from the client after the model proposes a note.

## Engram (the brain)

- **Cortex:** streaming LLM. `OPENAI_API_KEY` + optional `OPENAI_BASE_URL` (OpenAI-compatible, so SpaceXAI or OpenAI both work). No canned replies.
- **Spinal cord:** `webapp/server/engram/spinal.ts`. Each user message: load session, recall top-k memories (client sends decrypted summaries **or** server stores embeddings of ciphertext hashes + client-provided labels — production path: client decrypts locally, sends a short recall pack with the chat request, never the full vault). Route tools: `remember`, `search_memory`, `hire_hint`. Stream tokens to the UI.
- **Hippocampus:** after a reply, decide if a durable fact was stated. If yes, return a `remember` proposal. Client encrypts and calls `publishMemory` + `POST /api/memories`.
- **Skills vs memories:** skills live on the agent record (maker-controlled). Memories are user-owned notes. Using a memory increments `use_count` (connection strength) in Postgres.

Chat UI (`ChatPanel`, `Composer`) stays. `ensureReplies` / `cannedReply` go away. Composer posts to `/api/chat` and appends streamed tokens.

## Frontend wiring (extend, don't restyle)

| Surface | Today | Production |
| --- | --- | --- |
| Sign-in | localStorage auth, Google preview | SIWS + session cookie. Google stays labeled preview or is removed from the live path |
| Onboarding | `finishOnboarding` seeds demo jobs/chats | Creates user+home agent in DB. Mint is a real Core + register tx with explorer link |
| Chat | canned lines | Engram stream. Empty/error/loading states |
| Memory / Brain | local notes | list from API (ciphertext decrypted client-side). Edit/delete hits API + chain |
| Marketplace | sample specialists | listings from API; hire = SOL/USDC transfer on devnet + hire row |
| Hub | `localHub` | `chainHub` implementing `HubAdapter` (check-in, quests, level-up, referrals, box) |
| Wallets / cards | demo addresses | show connected wallet + minted assets. Virtual cards stay UI-only unless we add a real issuer (we will not fake a bank) |

`HubAdapter` stays the UI contract. `hub.ts` exports `hub` from a chain-backed module when a wallet+session exist.

Remove `[sample]` / `DemoTag` from live flows. Pref `demoLabels` defaults **false**.

Strip leftover Arbitrum copy and the Foundry tree once Solana mint+Hub are green (`contracts/src`, `contracts/script`, `contracts/test`, `contracts/README.md` Arbitrum section).

## Ops

`.env.example` (repo root + webapp):

```
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_LEXARI_PROGRAM_ID=BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po
NEXT_PUBLIC_LANDING_URL=
NEXT_PUBLIC_WEBAPP_URL=
NEXT_PUBLIC_USDC_MINT=  # devnet USDC
DATABASE_URL=
SESSION_SECRET=
OPENAI_API_KEY=
OPENAI_BASE_URL=        # optional
OPENAI_MODEL=gpt-4o-mini
LEXARI_ATTESTOR_KEY=    # base58 secret, co-signs quests
```

README: install, `anchor build && anchor test`, `anchor deploy --provider.cluster devnet`, migrate db, `npm run dev`, Vercel project pair, how to airdrop.

Lint, `tsc --noEmit`, `next build` for both apps. Anchor tests + API tests + Playwright: create agent, mint, chat, check-in, level up.

## Milestone checklist

Tick in this file as each lands. After every milestone: tests, click the flow, commit, push.

### M0 — Plan
- [x] Pull latest
- [x] Survey repo and write this file

### M1 — Program: Hub + tests
- [x] `Config`, `Player`, `AgentLevel`, `QuestClaim`, `ReferralClaim`, `BoxClaim`
- [x] Instructions listed above, attestor as extra signer. `init_config` is upgrade-authority only.
- [x] Anchor tests: success + wrong signer, double claim, insufficient coins, self-referral, attestor mismatch, stranger `init_config`. 16 passing via `bash contracts/solana/scripts/test.sh` (upgradeable local validator; plain `anchor test` loads `--bpf-program` and sets a zero upgrade authority, so `init_config` cannot succeed there).
- [x] `anchor build` green

### M2 — Deploy program to devnet
- [ ] Deploy, confirm account exists. **Blocked on SOL.** `lexari.so` is 415,808 bytes. `solana rent` says 2.11 SOL for one account of that size, and deploy holds a buffer of the same size (~4.22 SOL) plus fees. Deployer `EbYuw4JQyG8iTwcEnhQLqPaTounTBDV5i3ApKuyjZDb` has 2.81 SOL on devnet. Need about 2 SOL more, 3 if a retry should have room. Public RPC was not retried.
- [ ] Commit program id, IDL (`target/idl/lexari.json`, `target/types/lexari.ts`)
- [ ] **Blocked if:** no deployer key / no devnet SOL — ask, then continue M3

### M3 — Backend skeleton
- [x] Drizzle schema + migrations (`webapp/server/db`, `npm run db:migrate -w webapp`)
- [x] SIWS nonce + verify + httpOnly session (`/api/auth/nonce`, `/api/auth/verify`, `/api/auth/session`, `/api/auth/signout`)
- [x] Zod on every route, rate limit, no secrets in the client
- [x] `.env.example` (repo root and `webapp/`)
- [x] Neon is connected locally and `0001_init.sql` is applied. `GET /api/health` is ok and `POST /api/auth/nonce` writes a real user. The URL stays in `webapp/.env.local`.

### M4 — Engram chat
- [x] Cortex stream route (`POST /api/chat`, OpenAI-compatible SSE)
- [x] Spinal routing + memory recall pack
- [x] Hippocampus remember proposal (`REMEMBER:` line)
- [x] Wire Composer/ChatPanel; live replies no longer use canned lines
- [x] Chat streams from Grok (`grok-4.7` at `api.x.ai`) using the local CLI session copied into `webapp/.env.local`. A live call returned a real sentence. That session token expires, so chat needs a fresh `grok` login when it does.

### M5 — Agents, mint, memory
- [x] Create agent → `POST /api/agents` from onboarding (needs a session)
- [x] Mint Core + register stays the existing client flow, with tx status and explorer link
- [x] Memory ciphertext is posted after the onchain write; delete marks the row and still closes the chain account
- [ ] **Blocked:** no `DATABASE_URL`, and the program is not on devnet, so mint and the DB row cannot be confirmed live

### M6 — Hub adapter on chain
- [x] `chainHub` implements `HubAdapter` (check-in, quest claim, level-up, referral tier, mystery box)
- [x] Quest and box and referral claims are co-signed by `/api/hub/attest` after a database check
- [x] Chat, memory, hire, and agent create record quest events when a session exists
- [ ] **Blocked:** program is not deployed, and `LEXARI_ATTESTOR_KEY` is not set, so Hub buttons return that error instead of minting coins

### M7 — Marketplace + referrals
- [x] Hire pays 0.01 SOL (or 1 USDC when `NEXT_PUBLIC_USDC_MINT` is set) to the treasury, then `POST /api/hires`
- [x] Referral code on signup and tier claims (attestor co-signs once enough real signups exist)
- [ ] **Blocked:** no devnet program, no database, so a paid hire cannot be recorded yet

### M8 — Cleanup + QA
- [ ] Remove Foundry/Arbitrum dead tree (or isolate under `contracts/legacy/` with a one-line README)
- [ ] Loading / empty / error on every product surface
- [ ] Playwright: create, mint, chat, check-in, level up
- [x] Typecheck and both Next production builds pass (`npm run build`, landing and webapp)
- [ ] Playwright is still open. Mint, check-in, and level-up need a wallet, devnet SOL, and the deployed program

### M9 — Ship
- [ ] Vercel landing + webapp, env URLs cross-linked
- [ ] Final report: live URLs, program id, test results, remaining blocks

## Access we will ask for (do not fake)

1. **Devnet SOL** on the deployer and the attestor (and a user wallet for click-through).
2. **`DATABASE_URL`** (Neon or Supabase Postgres).
3. **`OPENAI_API_KEY`** (or SpaceXAI-compatible key + base URL).
4. **Vercel** access (or permission to `vercel --prod` the two apps).
5. **Irys/devnet** may require a small SOL balance on the user wallet for metadata upload (already true of mint).

Work continues on everything that does not need the missing secret.

## Non-goals

- Mobile app / `lexari-wallet`
- Real bank cards / KYC rails
- Mainnet
- Redesigning the Hub, marketplace, or faces
