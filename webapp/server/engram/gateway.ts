/**
 * OpenRouter gateway: one OpenAI-compatible endpoint for Lamina's engines and the premium models.
 * Streams text, falls back across the route's models (OpenRouter's `models` array, billed at the model that answered)
 * and reports usage with the real cost from the final SSE chunk.
 *
 * Env: OPENROUTER_API_KEY (turns the gateway on), OPENROUTER_BASE_URL (default https://openrouter.ai/api/v1),
 *      OPENROUTER_DATA_COLLECTION ("deny" by default: only providers that do not store prompts), LLM_TIMEOUT_MS.
 * Keep the URL and key in env so a move to another OpenAI-compatible gateway is a config change.
 */
import type { ModelInfo } from "@/content/models";
import { ENGINE_PRICES, routeFor } from "./engines";
import { ModelError, type ChatMessage } from "./cortex";
import { DESKTOP_MARK } from "./grokCli";

export type Usage = {
  /** the engine that actually answered (OpenRouter id, or "grok-cli") */
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** real cost in USD as reported by the gateway; null when the provider gave none */
  costUsd: number | null;
  /** true when tokens were estimated (a provider that reports no usage) */
  estimated: boolean;
};

export const gatewayReady = () => !!process.env.OPENROUTER_API_KEY;
const base = () => (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

/** What a model is told about where it runs, so every model behaves like a Lexari agent. */
export function houseNote(model: ModelInfo, messages: ChatMessage[]) {
  const desktop = messages.some((m) => m.role === "system" && m.content.includes(DESKTOP_MARK));
  const who = model.pool === "lamina"
    ? "If asked which model you are, say you run on Lamina, Lexari's own model, and don't name any other model or company behind it."
    : `If asked which model you are, say you are running on ${model.label} inside Lexari.`;
  const where = desktop
    ? "You are chatting inside the Lexari app. The only ways to use your computer are the <run> and <computer> tags described above; Lexari runs them for you."
    : "You are chatting inside the Lexari app on someone's phone or computer. In this chat you cannot run code, browse the web or open files, so never offer to. Answer, explain, plan, write and remember what the person tells you.";
  return `${where} ${who} Use the Lexari tags exactly as described when you need them, and never show raw tags as examples.`;
}

/** Pulls text, usage and the served model out of one SSE data line. */
export function parseChunk(data: string): { token?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }; model?: string; error?: string } {
  if (!data || data === "[DONE]") return {};
  try {
    const j = JSON.parse(data) as { model?: string; error?: { message?: string; code?: number | string }; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }; choices?: { delta?: { content?: string }; finish_reason?: string; error?: { message?: string } }[] };
    if (j.error) return { error: `${j.error.code ?? ""} ${j.error.message ?? "error"}`.trim() };
    const c = j.choices?.[0];
    if (c?.error) return { error: c.error.message || "error" };
    const token = c?.delta?.content;
    return { ...(typeof token === "string" && token ? { token } : {}), ...(j.usage ? { usage: j.usage } : {}), ...(j.model ? { model: j.model } : {}) };
  } catch {
    return {};
  }
}

/** Streams one completion through the gateway. Calls onUsage once at the end with the real cost. */
export async function* streamGateway(messages: ChatMessage[], model: ModelInfo, opts: { signal?: AbortSignal; maxTokens: number; onUsage?: (u: Usage) => void }): AsyncGenerator<string> {
  const key = process.env.OPENROUTER_API_KEY || "";
  if (!key) throw new ModelError("This model is not available on this server yet.", "no OPENROUTER_API_KEY");
  const route = routeFor(model);
  if (!route.length) throw new ModelError("This model is not available on this server yet.", `no gateway route for ${model.id}`);
  const timeout = AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 90_000));
  const sys = { role: "system" as const, content: houseNote(model, messages) };
  const firstUser = messages.findIndex((m) => m.role !== "system");
  const withNote = firstUser < 0 ? [...messages, sys] : [...messages.slice(0, firstUser), sys, ...messages.slice(firstUser)];
  const dataCollection = (process.env.OPENROUTER_DATA_COLLECTION || "deny") === "allow" ? "allow" : "deny";
  let res: Response;
  try {
    res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`, "content-type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_WEBAPP_URL || "https://app.lexari.ai", "X-Title": "Lexari",
      },
      body: JSON.stringify({
        model: route[0], ...(route.length > 1 ? { models: route } : {}),
        messages: withNote, stream: true, temperature: 0.7, max_tokens: opts.maxTokens,
        provider: { data_collection: dataCollection },
      }),
      signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
    });
  } catch (e) {
    throw new ModelError(`${model.label} did not answer in time. Try again.`, `gateway: ${(e as Error).message}`);
  }
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const friendly = res.status === 429 ? `${model.label} is busy. Try again in a minute.`
      : res.status === 402 ? "The model service needs attention. Try Lamina for now."
      : res.status === 401 || res.status === 403 ? "The model connection needs attention." : `${model.label} could not answer. Try again.`;
    throw new ModelError(friendly, `gateway ${res.status}: ${detail}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", served = route[0], out = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number; cost?: number } | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue; // ": OPENROUTER PROCESSING" keep-alives
        const c = parseChunk(t.slice(5).trim());
        if (c.error) throw new ModelError(`${model.label} could not answer. Try again.`, `gateway stream: ${c.error}`);
        if (c.model) served = c.model;
        if (c.usage) usage = c.usage;
        if (c.token) { out += c.token; yield c.token; }
      }
    }
  } finally {
    // Usage is reported even when the caller stopped early or the stream broke, so a partial answer is still metered.
    const price = ENGINE_PRICES[served] || model.price;
    const promptTokens = usage?.prompt_tokens ?? Math.ceil(withNote.reduce((n, m) => n + m.content.length, 0) / 4);
    const completionTokens = usage?.completion_tokens ?? Math.ceil(out.length / 4);
    const cost = typeof usage?.cost === "number" ? usage.cost : null;
    if (out || usage) opts.onUsage?.({ model: served, promptTokens, completionTokens, costUsd: cost ?? (promptTokens * price.in + completionTokens * price.out) / 1e6, estimated: !usage });
  }
}
