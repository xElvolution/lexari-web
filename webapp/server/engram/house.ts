/**
 * SERVER ONLY. Open models Lexari serves on its own provider keys (content/models.ts HOUSE). All three speak the
 * OpenAI Chat Completions API, so they stream through the same code as models on your own key (server/engram/byo.ts),
 * but usage is billed like Lamina at the model's price (the meter prices it; the person's key is never involved).
 *
 * Env (server only, never in the repo):
 *   MOONSHOT_API_KEY   Kimi (Moonshot AI)            MOONSHOT_BASE_URL   default https://api.moonshot.ai/v1     KIMI_MODEL   default kimi-k3
 *   DASHSCOPE_API_KEY  Qwen (Alibaba Model Studio)   DASHSCOPE_BASE_URL  default https://dashscope-intl.aliyuncs.com/compatible-mode/v1   QWEN_MODEL default qwen3.8-max
 *   ZG_COMPUTE_API_KEY 0G Compute Router (sk-...)    ZG_COMPUTE_BASE_URL default https://router-api.0g.ai/v1     ZG_COMPUTE_MODEL default glm-5.2
 * Kimi and Qwen also run through 0G Compute: with no MOONSHOT_API_KEY / DASHSCOPE_API_KEY they use ZG_COMPUTE_API_KEY
 * (models ZG_KIMI_MODEL default kimi-k3, ZG_QWEN_MODEL default qwen3.8-max, ids from router-api.0g.ai/v1/models), so one
 * 0G key covers all three. The direct keys are optional overrides.
 * A model with neither key is listed as unavailable and can't be picked.
 *
 * Fallback chains (which models a turn tries when the picked one fails before any text):
 *   HOUSE_FALLBACKS        overrides the chains in content/models.ts, per model: "kimi=qwen,openai;qwen=openai;claude="
 *                          (an empty list means no fallback; unknown ids, repeats and the model itself are dropped; at most 4)
 *   HOUSE_FALLBACK_LAMINA  "0" stops a failed chain from answering with Lamina; the person then sees the error instead.
 */
import { HOUSE, modelById, type HouseProvider, type ModelInfo } from "@/content/models";
import type { ByoTarget } from "./byo";

type Spec = { key: string; base: string; baseDefault: string; model: string; modelDefault: string; who: string; extra?: Record<string, unknown>; viaZg?: { model: string; modelDefault: string; extra?: Record<string, unknown> } };
const SPECS: Record<HouseProvider, Spec> = {
  moonshot: { key: "MOONSHOT_API_KEY", base: "MOONSHOT_BASE_URL", baseDefault: "https://api.moonshot.ai/v1", model: "KIMI_MODEL", modelDefault: "kimi-k3", who: "Kimi",
    // K3 always reasons; "low" keeps chat replies quick (temperature is fixed by Moonshot, so none is sent).
    extra: { reasoning_effort: "low" }, viaZg: { model: "ZG_KIMI_MODEL", modelDefault: "kimi-k3", extra: { reasoning_effort: "low" } } },
  dashscope: { key: "DASHSCOPE_API_KEY", base: "DASHSCOPE_BASE_URL", baseDefault: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "QWEN_MODEL", modelDefault: "qwen3.8-max", who: "Qwen",
    extra: { enable_thinking: false }, viaZg: { model: "ZG_QWEN_MODEL", modelDefault: "qwen3.8-max", extra: { enable_thinking: false } } },
  zg: { key: "ZG_COMPUTE_API_KEY", base: "ZG_COMPUTE_BASE_URL", baseDefault: "https://router-api.0g.ai/v1", model: "ZG_COMPUTE_MODEL", modelDefault: "glm-5.2", who: "0G Compute",
    extra: { chat_template_kwargs: { enable_thinking: false } } },
  // OpenAI and Claude in the picker run on the 0G router too, on the cheaper tiers (ids from router-api.0g.ai/v1/models).
  "zg-openai": { key: "ZG_COMPUTE_API_KEY", base: "ZG_COMPUTE_BASE_URL", baseDefault: "https://router-api.0g.ai/v1", model: "ZG_OPENAI_MODEL", modelDefault: "gpt-5.4-mini", who: "OpenAI on 0G Compute" },
  "zg-claude": { key: "ZG_COMPUTE_API_KEY", base: "ZG_COMPUTE_BASE_URL", baseDefault: "https://router-api.0g.ai/v1", model: "ZG_CLAUDE_MODEL", modelDefault: "claude-sonnet-5", who: "Claude on 0G Compute" },
};

/** The env var names, for setup docs and the health page. */
export const HOUSE_ENV = Object.fromEntries(Object.entries(SPECS).map(([p, s]) => [p, { key: s.key, baseUrl: s.base, model: s.model }])) as Record<HouseProvider, { key: string; baseUrl: string; model: string }>;

const env = (k: string) => process.env[k]?.trim() || "";
export function houseReady(m: ModelInfo) {
  if (!m.house) return false;
  const s = SPECS[m.house.provider];
  return !!env(s.key) || (!!s.viaZg && !!env(SPECS.zg.key));
}

/** The provider call for one open model, or null when its key isn't set. */
export function houseTarget(m: ModelInfo): ByoTarget | null {
  if (!m.house) return null;
  const s = SPECS[m.house.provider];
  const key = env(s.key);
  if (!key) {
    const zg = SPECS.zg, zkey = env(zg.key);
    if (!s.viaZg || !zkey) return null;
    const base = (env(zg.base) || zg.baseDefault).replace(/\/+$/, "");
    return { provider: "custom", model: env(s.viaZg.model) || s.viaZg.modelDefault, key: zkey, baseUrl: base, label: m.label, who: `${s.who} on 0G Compute`, extra: s.viaZg.extra, house: true };
  }
  const base = (process.env[s.base]?.trim() || s.baseDefault).replace(/\/+$/, "");
  return { provider: "custom", model: process.env[s.model]?.trim() || s.modelDefault, key, baseUrl: base, label: m.label, who: s.who, extra: s.extra, house: true };
}

const MAX_FALLBACKS = 4;
/** HOUSE_FALLBACKS parsed: model id to its fallback ids. Entries for unknown or non-house models are ignored. */
export function fallbackOverrides(raw = env("HOUSE_FALLBACKS")): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of raw.split(/[;\n]/)) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    const id = part.slice(0, at).trim().toLowerCase();
    if (!modelById(id)?.house) continue;
    const list = part.slice(at + 1).split(",").map((x) => x.trim().toLowerCase()).filter((x) => x && x !== id && !!modelById(x)?.house);
    out[id] = [...new Set(list)].slice(0, MAX_FALLBACKS);
  }
  return out;
}
/** The fallback ids for one model: the HOUSE_FALLBACKS override when it names the model, else content/models.ts. */
export function fallbacksOf(m: ModelInfo): string[] {
  if (!m.house) return [];
  return fallbackOverrides()[m.id] ?? m.house.fallback;
}
/** False when HOUSE_FALLBACK_LAMINA=0: a failed chain errors instead of answering with Lamina. */
export const laminaLastResort = () => env("HOUSE_FALLBACK_LAMINA") !== "0";

/**
 * The order a turn on an open model tries: the model itself, then its fallbacks that are ready on this server.
 * Lamina is the caller's last resort (unless HOUSE_FALLBACK_LAMINA=0).
 */
export function houseChain(m: ModelInfo): ModelInfo[] {
  if (!m.house) return [];
  const out = [m, ...fallbacksOf(m).map((id) => modelById(id)).filter((x): x is ModelInfo => !!x && !!x.house)];
  return out.filter((x, i) => out.findIndex((y) => y.id === x.id) === i && houseReady(x));
}

export const houseModels = () => HOUSE.map((m) => ({ id: m.id, ready: houseReady(m), chain: houseChain(m).map((x) => x.id) }));
