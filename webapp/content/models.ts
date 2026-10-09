/**
 * The models an agent can answer with, as people see them. Lamina is Lexari's own model; which engines serve it lives
 * only on the server (server/engram/engines.ts) and is never shown in the app. Premium models are billed from the
 * premium pool at the Lexari rate. Every model uses the same text-tag tools, so any of them can drive the agent.
 *
 * Prices are USD per million tokens. The meter always prefers the cost reported for each request; these prices are
 * only used to estimate a hold, to draw the burn chips, and when no cost is reported.
 */
/** byo: a model you added with your own key (never billed by Lexari) */
export type ModelPool = "lamina" | "premium" | "byo";
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

/**
 * More models included on every plan (billed like Lamina from the included pool). Served by Lexari's own Grok relay,
 * so they are only offered when that relay is up (server/engram/engines.ts RELAY).
 */
export const INCLUDED: ModelInfo[] = [
  { id: "grok-fast", label: "Grok 4.7 Fast", short: "Grok Fast", maker: "xAI", blurb: "Quickest replies for everyday chat.", pool: "lamina", price: { in: 0.45, out: 2.25 } },
  { id: "grok-4.6", label: "Grok 4.6", short: "Grok 4.6", maker: "xAI", blurb: "The previous Grok. Steady and thorough.", pool: "lamina", price: { in: 0.45, out: 2.25 } },
];

export const MODELS: ModelInfo[] = [LAMINA, ...INCLUDED, ...PREMIUM];
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

/* ---------- your own models (bring your own key) ---------- */

/** Providers you can add with your own API key. Usage on your key never touches your Lexari balance. */
export type ByoProvider = "openai" | "anthropic" | "gemini" | "xai" | "openrouter" | "custom";
export const BYO_PROVIDERS: { id: ByoProvider; name: string; maker: string; hint: string; models: string[]; keyHint: string }[] = [
  { id: "openai", name: "OpenAI", maker: "OpenAI", hint: "GPT models", models: ["gpt-5.2", "gpt-5-mini", "gpt-4.1", "gpt-4o-mini"], keyHint: "sk-..." },
  { id: "anthropic", name: "Anthropic", maker: "Anthropic", hint: "Claude models", models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"], keyHint: "sk-ant-..." },
  { id: "gemini", name: "Google Gemini", maker: "Google", hint: "Gemini models", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"], keyHint: "AIza..." },
  { id: "xai", name: "xAI", maker: "xAI", hint: "Grok models", models: ["grok-4", "grok-4-fast", "grok-3-mini"], keyHint: "xai-..." },
  { id: "openrouter", name: "OpenRouter", maker: "OpenRouter", hint: "Hundreds of models", models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"], keyHint: "sk-or-..." },
  { id: "custom", name: "Custom", maker: "Custom", hint: "Any OpenAI-compatible API", models: [], keyHint: "Your API key" },
];
export const byoProvider = (id: string) => BYO_PROVIDERS.find((p) => p.id === id);
/** A model you added, as the app sees it (the key itself never leaves the server; only its last 4 characters). */
export type CustomModel = { id: string; provider: ByoProvider; label: string; model: string; baseUrl: string | null; last4: string; status: "ok" | "failed" | "untested"; note: string | null; testedAt: number | null };
export const isByoId = (id: string | null | undefined) => !!id && /^byo:[0-9a-f-]{36}$/.test(id);
/** A ModelInfo for one of your models, so pickers and chips can show it like any other. */
export function customInfo(c: Pick<CustomModel, "id" | "provider" | "label" | "model">): ModelInfo {
  const p = byoProvider(c.provider);
  return { id: c.id, label: c.label || c.model, short: (c.label || c.model).slice(0, 14), maker: p?.maker ?? "Custom", blurb: `${p?.name ?? "Custom"} · ${c.model} · your key`, pool: "byo", price: { in: 0, out: 0 } };
}
