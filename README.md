# Lexari landing

A standalone marketing site for Lexari: a personalized AI agent with its own persistent computer and memory, a roster of specialist agents you hire into seats, and sign in with Google or a crypto wallet (OKX Wallet is one option).

## Identity

- **Concept:** "Meet your first personalized AI agent. And hire more." Lexari presents your agent like a new employee. It wears a lanyard ID badge, works a shift at its own computer, files memory notes, and sits at desk one on your team floor.
- **Color:** black, purple (`#5b2bff`) and white. Light and dark themes share semantic tokens in `src/app/globals.css` (`--bg`, `--alt`, `--card`, `--tint`, `--ink`, `--line`, `--brand-ink`). The toggle in the nav follows the system theme by default, saves the choice to localStorage, and a script in `layout.tsx` applies it before first paint.
- **Type:** Bricolage Grotesque (display, condensed width axis), Figtree (body), Martian Mono (labels).
- **Motion:** a draggable ID badge on a spring pendulum, eyes that follow the cursor, a scroll-synced computer screen, memory cards dealt by GSAP ScrollTrigger, a pinned horizontal roster with flip cards, an interactive seat floor plan with a generated avatar at every filled desk, a welcome letter that signs itself as you scroll, and agents that occasionally peek in from the screen edges (off for reduced motion).
- **Avatars:** generated in code as SVG from parts (shape, eyes, mouth, extras) in the brand palette. See `src/components/avatar.ts` and `Face.tsx`. A seed always gives the same face.
- **Logo:** placeholder only, isolated in `src/components/Logo.tsx` so the final mark can be dropped in.

## Content

Every word lives in `src/content/copy.ts`.
- `[sample]` marks illustrative data.
- `[placeholder]` marks OKX and wallet specifics that are not final.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
NEXT_PUBLIC_APP_URL=https://your-app.example npm run build && npm start
```

`NEXT_PUBLIC_APP_URL` sets where the "Hire" buttons go (default `https://app.lexari.ai`).
