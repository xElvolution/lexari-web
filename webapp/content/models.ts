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

/* ---------- models on your own API keys (Settings > Models) ---------- */

/** How a reply is requested: the 5 key providers, plus "custom" for an OpenAI-compatible base URL (the OpenAI override). */
export type ByoProvider = "openai" | "anthropic" | "gemini" | "xai" | "openrouter" | "custom";
export type KeyProvider = Exclude<ByoProvider, "custom">;
type CatalogModel = { id: string; label: string; /** switched on as soon as the key is added */ on?: boolean };
/**
 * One row per provider in API Keys. Each provider's models appear in the list once its key is added. Model ids are the
 * providers' own current API ids (checked October 2026); anything else can be added by name from the search field.
 */
export const KEY_PROVIDERS: { id: KeyProvider; name: string; maker: string; keyHint: string; keyUrl: string; models: CatalogModel[] }[] = [
  { id: "openai", name: "OpenAI", maker: "OpenAI", keyHint: "sk-...", keyUrl: "https://platform.openai.com/api-keys", models: [
    { id: "gpt-6-astra", label: "GPT-6 Astra", on: true }, { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", on: true }, { id: "gpt-6-luna", label: "GPT-6 Luna", on: true },
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" }, { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" }, { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
  ] },
  { id: "anthropic", name: "Anthropic", maker: "Anthropic", keyHint: "sk-ant-...", keyUrl: "https://console.anthropic.com/settings/keys", models: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", on: true }, { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", on: true }, { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", on: true },
    { id: "claude-fable-5-1", label: "Claude Fable 5.1" }, { id: "claude-sonnet-5", label: "Claude Sonnet 5" }, { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ] },
  { id: "gemini", name: "Google", maker: "Google", keyHint: "AIza...", keyUrl: "https://aistudio.google.com/apikey", models: [
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", on: true }, { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", on: true },
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" }, { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  ] },
  { id: "xai", name: "xAI", maker: "xAI", keyHint: "xai-...", keyUrl: "https://console.x.ai", models: [
    { id: "grok-4.7", label: "Grok 4.7", on: true }, { id: "grok-4.6", label: "Grok 4.6" },
  ] },
  { id: "openrouter", name: "OpenRouter", maker: "OpenRouter", keyHint: "sk-or-...", keyUrl: "https://openrouter.ai/settings/keys", models: [
    { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", on: true }, { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", on: true },
    { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", on: true }, { id: "x-ai/grok-4.7", label: "Grok 4.7" },
    { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" }, { id: "moonshotai/kimi-k3", label: "Kimi K3" },
    { id: "qwen/qwen3.8-flash", label: "Qwen 3.8 Flash" }, { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
  ] },
];
export const keyProvider = (id: string) => KEY_PROVIDERS.find((p) => p.id === id);
export const KEY_MODEL_RE = /^key:(openai|anthropic|gemini|xai|openrouter):([\w.:/@+-]{1,120})$/;
export const MODEL_NAME_RE = /^[\w.:/@+-]{1,120}$/;
/** A model on your key has the id "key:<provider>:<provider's model id>". */
export const keyModelId = (provider: KeyProvider, model: string) => `key:${provider}:${model}`;
export function parseKeyModel(id: string | null | undefined): { provider: KeyProvider; model: string } | null {
  const m = id ? KEY_MODEL_RE.exec(id) : null;
  return m ? { provider: m[1] as KeyProvider, model: m[2] } : null;
}
/** A saved key, as the app sees it (only its last 4 characters ever leave the server). */
export type KeyInfo = { provider: KeyProvider; last4: string; status: "ok" | "failed" | "untested"; note: string | null; testedAt: number | null; /** OpenAI only: the override base URL */ baseUrl: string | null };
/** Your on/off switches. Ids not listed use their default. extra: model names you added by hand ("key:..." ids). */
export type ModelPrefs = { on?: string[]; off?: string[]; extra?: string[] };

function prettyName(model: string) {
  const tail = model.split("/").pop() || model;
  return tail.split(/[-_]/).map((w) => (/^(gpt|ai|xl)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ").replace(/^GPT /, "GPT-");
}
/** A ModelInfo for a model on your key, so pickers and chips show it like any other. */
export function keyModelInfo(id: string): ModelInfo | null {
  const k = parseKeyModel(id);
  if (!k) return null;
  const p = keyProvider(k.provider)!;
  const label = p.models.find((m) => m.id === k.model)?.label ?? prettyName(k.model);
  return { id, label, short: label.replace(/^(Claude|Gemini) /, "").slice(0, 14), maker: p.maker, blurb: `${p.name} · your key`, pool: "byo", price: { in: 0, out: 0 } };
}

export type CatalogRow = { m: ModelInfo; enabled: boolean; /** Lamina is always on */ locked: boolean; provider: KeyProvider | null; /** you added it by name */ added: boolean };
/**
 * Every model you can switch on: Lamina and the built-ins this server can serve, then each keyed provider's models and
 * the ones you added by name. Used by Settings and, on the server, to check a pick.
 */
export function modelCatalog(keys: KeyProvider[], prefs: ModelPrefs | null | undefined, available: Record<string, boolean>): CatalogRow[] {
  const on = new Set(prefs?.on ?? []), off = new Set(prefs?.off ?? []);
  const state = (id: string, def: boolean) => (off.has(id) ? false : on.has(id) ? true : def);
  const rows: CatalogRow[] = [{ m: LAMINA, enabled: true, locked: true, provider: null, added: false }];
  for (const m of [...INCLUDED, ...PREMIUM]) if (available[m.id]) rows.push({ m, enabled: state(m.id, true), locked: false, provider: null, added: false });
  for (const p of KEY_PROVIDERS) {
    if (!keys.includes(p.id)) continue;
    const seen = new Set<string>();
    for (const c of p.models) { const id = keyModelId(p.id, c.id); seen.add(id); rows.push({ m: keyModelInfo(id)!, enabled: state(id, !!c.on), locked: false, provider: p.id, added: false }); }
    for (const id of prefs?.extra ?? []) {
      if (seen.has(id) || parseKeyModel(id)?.provider !== p.id) continue;
      seen.add(id); rows.push({ m: keyModelInfo(id)!, enabled: state(id, true), locked: false, provider: p.id, added: true });
    }
  }
  return rows;
}
export const enabledIds = (rows: CatalogRow[]) => new Set(rows.filter((r) => r.enabled).map((r) => r.m.id));
