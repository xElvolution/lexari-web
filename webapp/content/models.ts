/**
 * The models an agent can answer with, as people see them. Lamina is Lexari's own model; which engines serve it lives
 * only on the server (server/engram/engines.ts) and is never shown in the app. Premium models are billed from the
 * premium pool at the Lexari rate. Every model uses the same text-tag tools, so any of them can drive the agent.
 *
 * Prices are USD per million tokens. The meter always prefers the cost reported for each request; these prices are
 * only used to estimate a hold, to draw the burn chips, and when no cost is reported.
 */
export type ModelPool = "lamina" | "premium";
export type Price = { in: number; out: number };
export type ModelInfo = {
  id: string;
  label: string;
  /** short name for tight spaces (the chat header chip on a phone) */
  short: string;
  /** who makes it, for the picker */
  maker: string;
  blurb: string;
  pool: ModelPool;
  /** list price (Lamina: what a turn typically costs Lexari to serve) */
  price: Price;
};

export const LAMINA: ModelInfo = {
  id: "lamina",
  label: "Lamina",
  short: "Lamina",
  maker: "Lexari",
  blurb: "Lexari's own model. Fast, tuned for your agents, included on every plan.",
  pool: "lamina",
  price: { in: 0.45, out: 2.25 },
};

export const PREMIUM: ModelInfo[] = [
  { id: "claude-sonnet", label: "Claude Sonnet 5.5", short: "Sonnet", maker: "Anthropic", blurb: "Careful writing and reasoning. The everyday premium pick.", pool: "premium", price: { in: 2, out: 10 } },
  { id: "claude-opus", label: "Claude Opus 5.5", short: "Opus", maker: "Anthropic", blurb: "Anthropic's strongest model for hard, long tasks.", pool: "premium", price: { in: 4, out: 20 } },
  { id: "grok", label: "Grok 4.7", short: "Grok", maker: "xAI", blurb: "Quick, direct and current. Strong on live topics.", pool: "premium", price: { in: 2, out: 6 } },
  { id: "gemini-flash", label: "Gemini 3.8 Flash", short: "Gemini", maker: "Google", blurb: "Fast and light on usage, with a huge context window.", pool: "premium", price: { in: 0.75, out: 3.75 } },
];

export const MODELS: ModelInfo[] = [LAMINA, ...PREMIUM];
export const modelById = (id: string | null | undefined): ModelInfo | null => (id ? MODELS.find((m) => m.id === id) ?? null : null);
export const isModelId = (id: string) => MODELS.some((m) => m.id === id);

/** A typical Lexari turn: system prompt, 12 turns of history and recall in, a short reply out. */
export const TYPICAL_TURN = { prompt: 3000, completion: 400 };
export const turnCostUsd = (p: Price, t = TYPICAL_TURN) => (t.prompt * p.in + t.completion * p.out) / 1e6;
/** How fast a model burns usage compared with Claude Sonnet (the "1x" reference), rounded for a chip. */
export function burnVsSonnet(m: ModelInfo) {
  const ref = turnCostUsd(PREMIUM[0].price);
  const x = turnCostUsd(m.price) / ref;
  return x >= 0.95 && x <= 1.05 ? 1 : Math.round(x * 10) / 10;
}
