# Lexari

Two Next.js apps, plus the contracts. `npm run dev` starts both.

| Folder | What lives there | Local address |
| --- | --- | --- |
| `landing/` | Its own Next.js app: marketing page and legal pages | http://localhost:3000 |
| `webapp/` | Its own Next.js app: sign-in, onboarding, and the product at `/app` | http://localhost:3001 |
| `shared/` | Faces, logo, theme, and ID-card backgrounds used by both apps | |
| `contracts/solana/` | The Lexari Anchor program: agent registry, memory records, Hub coins, quests and referrals | |
| `mobileapp/` | Reserved for the phone app. Nothing is built here yet | |

A personalized AI agent with its own persistent computer and memory, a roster of specialist agents you hire into seats, and sign in with Phantom, Solflare or Backpack. Google sign-in is still a preview.

## Identity

- **Concept:** "Meet your first personalized AI agent. And hire more." Lexari presents your agent like a new employee. It wears a lanyard ID badge, works a shift at its own computer, files memory notes, and sits at desk one on your team floor.
- **Color:** black, purple (`#5b2bff`) and white. Light and dark themes share semantic tokens in `shared/styles/theme.css` (`--bg`, `--alt`, `--card`, `--tint`, `--ink`, `--line`, `--brand-ink`). The toggle in the nav follows the system theme by default, saves the choice to localStorage, and a script in each app's `app/layout.tsx` applies it before first paint.
- **Type:** Bricolage Grotesque (display, condensed width axis), Figtree (body), Martian Mono (labels).
- **Motion:** a draggable ID badge on a spring pendulum, eyes that follow the cursor, a scroll-synced computer screen, memory cards dealt by GSAP ScrollTrigger, a pinned horizontal roster with flip cards, an interactive seat floor plan with a generated avatar at every filled desk, a welcome letter that signs itself as you scroll, and agents that occasionally peek in from the screen edges (off for reduced motion).
- **Avatars:** generated in code as SVG from parts (shape, eyes, mouth, extras) in the brand palette. See `shared/components/avatar.ts` and `Face.tsx`. A seed always gives the same face.
- **Logo:** placeholder only, isolated in `shared/components/Logo.tsx` so the final mark can be dropped in.

## Content

Every landing word lives in `landing/content/copy.ts`. Product copy and sample data live in `webapp/content/appData.ts`.
- `[sample]` marks illustrative data.
- Wallet sign-in is Phantom, Solflare and Backpack on Solana. The agent ID card is a Metaplex Core NFT. The registry and memory records live in `contracts/solana`.

## Run

```bash
npm install
npm run dev            # landing on :3000, web app on :3001
npm run dev:landing    # marketing site only
npm run dev:webapp     # product only
npm run build && npm start
```

Hire, sign-in, and "back to Lexari" jump between the two origins. For a deployed pair, set `NEXT_PUBLIC_LANDING_URL` and `NEXT_PUBLIC_WEBAPP_URL` (no trailing slash) before building. Locally they default to `http://localhost:3000` and `http://localhost:3001`.

## Solana program

Program id `BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po`. Local tests:

```bash
bash contracts/solana/scripts/test.sh
```

Use that script. Plain `anchor test` loads the program with upgrades turned off, and `init_config` then has no upgrade authority that can sign.

Devnet deploy is not done. The built program is about 416 KB, so the program account and the temporary buffer each need about 2.11 SOL of rent at the same time. The deployer wallet has less than that on devnet.

## Backend

Copy `.env.example` to `webapp/.env.local`. Wallet sign-in is `POST /api/auth/nonce`, a wallet signature of that exact message, then `POST /api/auth/verify`, which sets an httpOnly `lexari_session` cookie. Chat streams from `POST /api/chat`. Hiring an agent pays 0.01 SOL to the treasury. Hub claims are co-signed by the server. Without `DATABASE_URL` and `SESSION_SECRET` those routes return 503 and do not create a session. Google on the sign-in page stays a labeled preview.

```bash
npm run db:migrate -w webapp
```
