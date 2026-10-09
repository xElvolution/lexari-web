/**
 * SERVER ONLY. Models people add with their own API key (Settings > Models): OpenAI, xAI, OpenRouter and any
 * OpenAI-compatible base URL, Anthropic's Messages API and Google's Gemini API. All stream text the same way the
 * built-in models do, so every Lexari tool tag works with them. Usage goes on the person's own key, never their
 * Lexari balance (server/billing/meter.ts logs it with pool "byo").
 *
 * A custom base URL is checked before every call: https only, and never a private, loopback or link-local address
 * (so nobody can point Lexari at its own server or network). BYO_ALLOW_PRIVATE=1 lifts that for local tests only.
 */
import { lookup } from "node:dns/promises";
import { privateIp, safeFetch } from "../net/safeFetch";
import { isIP } from "node:net";
import type { ByoProvider } from "@/content/models";
import { ModelError, type ChatMessage } from "./cortex";
import type { Usage } from "./gateway";

export type ByoTarget = { provider: ByoProvider; model: string; key: string; baseUrl?: string | null; label: string; /** who to name in errors (the provider, or your name for a custom API) */ who?: string };

const BASES: Record<Exclude<ByoProvider, "custom" | "anthropic" | "gemini">, string> = {
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};
const ANTHROPIC = "https://api.anthropic.com/v1";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const allowPrivate = () => process.env.BYO_ALLOW_PRIVATE === "1" && process.env.NODE_ENV !== "production";

/** True for addresses Lexari must never call on someone's behalf. */
export function privateAddress(ip: string) {
  return privateIp(ip);
}
/** (older inline rule, kept for reference in tests) */
export function privateAddressLegacy(ip: string) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x.startsWith("::ffff:")) return privateAddress(x.slice(7));
    return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff");
  }
  return true;
}

/** Cleans a custom base URL ("https://host/v1", trailing /chat/completions dropped). Throws a friendly error. */
export function cleanBaseUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new ModelError("That base URL doesn't look right. Use something like https://api.example.com/v1.", "bad url"); }
  if (u.protocol !== "https:" && !(allowPrivate() && u.protocol === "http:")) throw new ModelError("The base URL must start with https://.", "not https");
  if (u.username || u.password) throw new ModelError("Put the key in the API key field, not in the URL.", "credentials in url");
  u.hash = ""; u.search = "";
  const path = u.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  return `${u.origin}${path}`;
}

async function checkHost(url: string) {
  if (allowPrivate()) return;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new ModelError("That base URL points to a private address.", `private host ${host}`);
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new ModelError("Couldn't find that base URL's server. Check the address.", `dns ${host}`); });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address))) throw new ModelError("That base URL points to a private address.", `private address for ${host}`);
}

/** Merges neighbouring turns from the same side (Anthropic and Gemini want them alternating, starting with the person). */
function turns(messages: ChatMessage[]) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system" || !m.content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  if (out[0]?.role === "assistant") out.unshift({ role: "user", content: "(conversation continues)" });
  return out;
}
const systemOf = (messages: ChatMessage[]) => messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");

type Req = { url: string; headers: Record<string, string>; body: unknown; parse: (data: string) => { token?: string; usage?: { p?: number; c?: number }; error?: string } };

export function buildRequest(t: ByoTarget, messages: ChatMessage[], maxTokens: number): Req {
  if (t.provider === "anthropic") {
    const base = (t.baseUrl || ANTHROPIC).replace(/\/$/, "");
    return {
      url: `${base}/messages`,
      headers: { "x-api-key": t.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: { model: t.model, system: systemOf(messages) || undefined, messages: turns(messages), max_tokens: maxTokens, stream: true, temperature: 0.7 },
      parse: (data) => {
        try {
          const j = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string }; message?: { usage?: { input_tokens?: number } }; usage?: { output_tokens?: number; input_tokens?: number }; error?: { message?: string } };
          if (j.type === "error") return { error: j.error?.message || "error" };
          if (j.type === "content_block_delta" && j.delta?.type === "text_delta") return { token: j.delta.text || "" };
          if (j.type === "message_start") return { usage: { p: j.message?.usage?.input_tokens } };
          if (j.type === "message_delta") return { usage: { c: j.usage?.output_tokens } };
        } catch {}
        return {};
      },
    };
  }
  if (t.provider === "gemini") {
    const base = (t.baseUrl || GEMINI).replace(/\/$/, "");
    const sys = systemOf(messages);
    return {
      url: `${base}/models/${encodeURIComponent(t.model)}:streamGenerateContent?alt=sse`,
      headers: { "x-goog-api-key": t.key, "content-type": "application/json" },
      body: {
        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
        contents: turns(messages).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      },
      parse: (data) => {
        try {
          const j = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }; error?: { message?: string } };
          if (j.error) return { error: j.error.message || "error" };
          const token = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
          return { ...(token ? { token } : {}), ...(j.usageMetadata ? { usage: { p: j.usageMetadata.promptTokenCount, c: j.usageMetadata.candidatesTokenCount } } : {}) };
        } catch {}
        return {};
      },
    };
  }
  const base = (t.provider === "custom" ? t.baseUrl || "" : t.baseUrl || BASES[t.provider]).replace(/\/$/, "");
  return {
    url: `${base}/chat/completions`,
    headers: { Authorization: `Bearer ${t.key}`, "content-type": "application/json", ...(t.provider === "openrouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_WEBAPP_URL || "https://app.lexari.ai", "X-Title": "Lexari" } : {}) },
    // OpenAI's newer models take max_completion_tokens; everyone else max_tokens.
    body: { model: t.model, messages, stream: true, ...(t.provider === "openai" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }), stream_options: { include_usage: true } },
    parse: (data) => {
      if (!data || data === "[DONE]") return {};
      try {
        const j = JSON.parse(data) as { error?: { message?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { delta?: { content?: string } }[] };
        if (j.error) return { error: j.error.message || "error" };
        const token = j.choices?.[0]?.delta?.content;
        return { ...(typeof token === "string" && token ? { token } : {}), ...(j.usage ? { usage: { p: j.usage.prompt_tokens, c: j.usage.completion_tokens } } : {}) };
      } catch { return {}; }
    },
  };
}

function friendlyStatus(t: ByoTarget, status: number, detail: string) {
  const who = t.who || t.label;
  if (status === 401 || status === 403) return `${who} rejected your API key. Check it in Settings > Models.`;
  if (status === 404) return `${who} couldn't find the model "${t.model}". Check the model id in Settings > Models.`;
  if (status === 429) return `${who} says you're over your rate limit or quota on your key. Try again in a minute.`;
  if (status === 400 && /model/i.test(detail)) return `${who} didn't accept the model "${t.model}". Check the model id.`;
  if (status === 402) return `Your ${who} account is out of credit.`;
  return `${who} couldn't answer (error ${status}). Try again.`;
}

/** Streams one reply from a model on the person's own key. Calls onUsage once at the end (cost 0 to Lexari). */
export async function* streamByo(messages: ChatMessage[], t: ByoTarget, opts: { signal?: AbortSignal; maxTokens: number; onUsage?: (u: Usage) => void; timeoutMs?: number }): AsyncGenerator<string> {
  const r = buildRequest(t, messages, opts.maxTokens);
  await checkHost(r.url);
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS || 90_000));
  let res: Response;
  try {
    const sig = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    // A custom base URL is checked again at connect time (no DNS-rebinding way to a private address).
    res = t.baseUrl && !allowPrivate()
      ? await safeFetch(r.url, { method: "POST", headers: r.headers, body: JSON.stringify(r.body), signal: sig })
      : await fetch(r.url, { method: "POST", headers: r.headers, body: JSON.stringify(r.body), redirect: "error", signal: sig });
  } catch (e) {
    throw new ModelError(`${t.label} didn't answer in time. Try again.`, `byo ${t.provider}: ${(e as Error).message}`);
  }
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new ModelError(friendlyStatus(t, res.status, detail), `byo ${t.provider} ${res.status}: ${detail}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  let p: number | undefined, c: number | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const x = r.parse(s.slice(5).trim());
        if (x.error) throw new ModelError(`${t.label} couldn't answer. Try again.`, `byo ${t.provider} stream: ${x.error}`);
        if (x.usage?.p !== undefined) p = x.usage.p;
        if (x.usage?.c !== undefined) c = x.usage.c;
        if (x.token) { out += x.token; yield x.token; }
      }
    }
  } finally {
    if (out || p !== undefined) opts.onUsage?.({ model: `${t.provider}/${t.model}`.slice(0, 120), promptTokens: p ?? Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4), completionTokens: c ?? Math.ceil(out.length / 4), costUsd: 0, estimated: p === undefined });
  }
}

/** Test connection: one tiny real call. */
export async function testByo(t: ByoTarget): Promise<{ ok: true; ms: number; sample: string } | { ok: false; error: string }> {
  const t0 = Date.now();
  try {
    let out = "";
    for await (const tok of streamByo([{ role: "system", content: "You are a connection test." }, { role: "user", content: "Reply with just the word OK." }], t, { maxTokens: 400, timeoutMs: 25_000 })) { out += tok; if (out.length > 200) break; }
    if (!out.trim()) return { ok: false, error: `${t.label} answered with no text. Check the model id.` };
    return { ok: true, ms: Date.now() - t0, sample: out.trim().slice(0, 80) };
  } catch (e) {
    if (e instanceof ModelError) { console.error(`[byo] test ${t.provider}: ${e.message.slice(0, 200)}`); return { ok: false, error: e.friendly }; }
    return { ok: false, error: `${t.label} couldn't be reached.` };
  }
}

/**
 * Verify: checks a key with the provider's model list (no tokens used). With an OpenAI base URL override it asks that
 * endpoint instead; one without a /models list still counts as reachable.
 */
export async function verifyKey(provider: Exclude<ByoProvider, "custom">, key: string, baseUrl?: string | null): Promise<{ ok: true; ms: number; note: string } | { ok: false; error: string }> {
  const t0 = Date.now();
  const name = baseUrl ? "Your OpenAI-compatible endpoint" : ({ openai: "OpenAI", anthropic: "Anthropic", gemini: "Google", xai: "xAI", openrouter: "OpenRouter" } as const)[provider];
  let url: string, headers: Record<string, string>;
  if (baseUrl) { url = `${baseUrl.replace(/\/$/, "")}/models`; headers = { Authorization: `Bearer ${key}` }; }
  else if (provider === "anthropic") { url = `${ANTHROPIC}/models?limit=1`; headers = { "x-api-key": key, "anthropic-version": "2023-06-01" }; }
  else if (provider === "gemini") { url = `${GEMINI}/models?pageSize=1`; headers = { "x-goog-api-key": key }; }
  else if (provider === "openrouter") { url = `${BASES.openrouter}/key`; headers = { Authorization: `Bearer ${key}` }; }
  else { url = `${BASES[provider]}/models`; headers = { Authorization: `Bearer ${key}` }; }
  try {
    await checkHost(url);
    const res = baseUrl && !allowPrivate()
      ? await safeFetch(url, { headers, signal: AbortSignal.timeout(15_000), maxBytes: 2_000_000 })
      : await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(15_000) });
    const ms = Date.now() - t0;
    if (res.ok) return { ok: true, ms, note: `Verified in ${(ms / 1000).toFixed(1)}s` };
    if (baseUrl && (res.status === 404 || res.status === 405)) return { ok: true, ms, note: "Reachable. This endpoint has no model list." };
    if (res.status === 401 || res.status === 403 || (provider === "gemini" && res.status === 400)) return { ok: false, error: `${name} rejected this key.` };
    if (res.status === 429) return { ok: false, error: `${name} says this key is over its rate limit. Try again in a minute.` };
    if (res.status === 402) return { ok: false, error: `Your ${name} account is out of credit.` };
    return { ok: false, error: `${name} answered with error ${res.status}. Try again.` };
  } catch (e) {
    if (e instanceof ModelError) return { ok: false, error: e.friendly };
    return { ok: false, error: `${name} couldn't be reached. Try again.` };
  }
}
