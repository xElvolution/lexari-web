# Lexari landing

A standalone marketing site for Lexari: a named AI agent with its own persistent computer and memory, a roster of specialist agents you hire into seats, and an OKX-centred story.

## Identity

- **Concept:** "Meet your first hire." Lexari presents your agent like a new employee. It wears a lanyard ID badge, works a shift at its own computer, files memory notes, and sits at desk one on your team floor.
- **Color:** electric grape `#5b2bff` field, midnight plum `#170a38` ink, frost `#f3efff`, candy pink `#ffa8ea` accent, tangerine `#ff8a3d` for small flags.
- **Type:** Bricolage Grotesque (display, condensed width axis), Figtree (body), Martian Mono (labels).
- **Motion:** a draggable ID badge on a spring pendulum, eyes that follow the cursor, a scroll-synced computer screen, memory cards dealt by GSAP ScrollTrigger, a pinned horizontal roster with flip cards, an interactive seat floor plan, and an offer letter that signs itself as you scroll.

## Content

Every word lives in `src/content/copy.ts`.
- `[sample]` marks illustrative data.
- `[placeholder]` marks OKX specifics that are not final.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
NEXT_PUBLIC_APP_URL=https://your-app.example npm run build && npm start
```

`NEXT_PUBLIC_APP_URL` sets where the "Hire" buttons go (default `https://app.lexari.ai`).
