/**
 * The models an agent can answer with. Lamina is Lexari's house model: a branded route over a fast open-weights engine
 * (Kimi K2.5 first, then DeepSeek V4.1 Flash and Grok 4.3 as fallbacks through OpenRouter, and the Grok relay as the
 * last resort), running Lexari's prompt, memory and tag tools. Premium models are billed from the premium pool at the
 * Lexari rate. Every model uses the same text-tag tools, so any of them can drive the agent.
 *
 * Prices are OpenRouter list prices in USD per million tokens (checked 6 Oct 2026). The meter always prefers the cost
 * OpenRouter reports for each request; these prices are only used to estimate a hold and when a provider reports no cost.
 */
export type ModelPool = "lamina" | "premium";
export type Price = { in: number; out: number };
export type ModelInfo = {
  id: string;
  label: string;
  /** short name for tight spaces (the chat header chip on a phone) */
  short: string;
  /** who makes the engine, for the picker */
  maker: string;
  blurb: string;
  pool: ModelPool;
  /** OpenRouter model ids in fallback order */
  route: string[];
  /** price of the first engine in the route */
  price: Price;
};

export const LAMINA: ModelInfo = {
  id: "lamina",
  label: "Lamina",
  short: "Lamina",
  maker: "Lexari",
  blurb: "Lexari's house model. Fast, tuned for your agents, included on every plan.",
  pool: "lamina",
  route: ["moonshotai/kimi-k2.5", "deepseek/deepseek-v4.1-flash", "x-ai/grok-4.3"],
  price: { in: 0.45, out: 2.25 },
};

export const PREMIUM: ModelInfo[] = [
  { id: "claude-sonnet", label: "Claude Sonnet 5.5", short: "Sonnet", maker: "Anthropic", blurb: "Careful writing and reasoning. The everyday premium pick.", pool: "premium", route: ["anthropic/claude-sonnet-5.5"], price: { in: 2, out: 10 } },
  { id: "claude-opus", label: "Claude Opus 5.5", short: "Opus", maker: "Anthropic", blurb: "Anthropic's strongest model for hard, long tasks.", pool: "premium", route: ["anthropic/claude-opus-5.5"], price: { in: 4, out: 20 } },
  { id: "grok", label: "Grok 4.7", short: "Grok", maker: "xAI", blurb: "Quick, direct and current. Strong on live topics.", pool: "premium", route: ["x-ai/grok-4.7"], price: { in: 2, out: 6 } },
  { id: "gemini-flash", label: "Gemini 3.8 Flash", short: "Gemini", maker: "Google", blurb: "Fast and light on usage, with a huge context window.", pool: "premium", route: ["google/gemini-3.8-flash"], price: { in: 0.75, out: 3.75 } },
];

export const MODELS: ModelInfo[] = [LAMINA, ...PREMIUM];
export const modelById = (id: string | null | undefined): ModelInfo | null => (id ? MODELS.find((m) => m.id === id) ?? null : null);
export const isModelId = (id: string) => MODELS.some((m) => m.id === id);

/** Known engine prices, for engines a fallback may serve. */
export const ENGINE_PRICES: Record<string, Price> = {
  "moonshotai/kimi-k2.5": { in: 0.45, out: 2.25 },
  "deepseek/deepseek-v4.1-flash": { in: 0.029, out: 1.32 },
  "x-ai/grok-4.3": { in: 1.25, out: 2.5 },
  "anthropic/claude-sonnet-5.5": { in: 2, out: 10 },
  "anthropic/claude-opus-5.5": { in: 4, out: 20 },
  "x-ai/grok-4.7": { in: 2, out: 6 },
  "google/gemini-3.8-flash": { in: 0.75, out: 3.75 },
};

/** A typical Lexari turn: system prompt, 12 turns of history and recall in, a short reply out. */
export const TYPICAL_TURN = { prompt: 3000, completion: 400 };
export const turnCostUsd = (p: Price, t = TYPICAL_TURN) => (t.prompt * p.in + t.completion * p.out) / 1e6;
/** How fast a model burns usage compared with Claude Sonnet (the "1x" reference), rounded for a chip. */
export function burnVsSonnet(m: ModelInfo) {
  const ref = turnCostUsd(PREMIUM[0].price);
  const x = turnCostUsd(m.price) / ref;
  return x >= 0.95 && x <= 1.05 ? 1 : Math.round(x * 10) / 10;
}
