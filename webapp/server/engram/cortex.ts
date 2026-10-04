/**
 * Model providers. LLM_PROVIDER picks one:
 *   openai   - any OpenAI-compatible API (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL)
 *   xai      - xAI's API (XAI_API_KEY, XAI_MODEL)
 *   grok-cli - the Grok CLI already logged in on this server (GROK_CLI_*). No API key in the app.
 * Without LLM_PROVIDER: xai if XAI_API_KEY is set, else openai.
 */
import { grokCliConfig, streamGrokCli } from "./grokCli";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type Provider = "openai" | "xai" | "grok-cli";

/** A model failure safe to show a person. The detail goes to the server log only. */
export class ModelError extends Error {
  constructor(public friendly: string, detail?: string) {
    super(detail || friendly);
    this.name = "ModelError";
  }
}

export function provider(): Provider {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "openai" || p === "xai" || p === "grok-cli") return p;
  return process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY ? "xai" : "openai";
}

export function llmConfig() {
  const p = provider();
  if (p === "grok-cli") return { provider: p, key: "", base: "", model: grokCliConfig().model, ready: grokCliConfig().ready };
  if (p === "xai") {
    const key = process.env.XAI_API_KEY || "";
    return { provider: p, key, base: (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, ""), model: process.env.XAI_MODEL || process.env.OPENAI_MODEL || "grok-4", ready: !!key };
  }
  const key = process.env.OPENAI_API_KEY || "";
  return { provider: p, key, base: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""), model: process.env.OPENAI_MODEL || "gpt-4o-mini", ready: !!key };
}

/** Pull a text delta out of one OpenAI-compatible SSE data line. */
export function tokenFromData(data: string): string {
  if (!data || data === "[DONE]") return "";
  try {
    const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
    const token = json.choices?.[0]?.delta?.content;
    return typeof token === "string" ? token : "";
  } catch {
    return "";
  }
}

async function* streamApi(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  const { key, base, model } = llmConfig();
  if (!key) throw new ModelError("The agent is not connected to a model yet.", "no API key for the selected provider");
  const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const timeout = AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 90_000));
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (e) {
    throw new ModelError("The model did not answer in time. Try again.", (e as Error).message);
  }
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const friendly = res.status === 429 ? "The model is busy. Try again in a minute." : res.status === 401 || res.status === 403 ? "The agent's model connection needs attention." : "The model could not answer. Try again.";
    throw new ModelError(friendly, `model ${res.status}: ${detail}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const token = tokenFromData(trimmed.slice(5).trim());
      if (token) yield token;
    }
  }
}

/** fast: a live voice call turn, where the first words matter most (Grok CLI uses GROK_CLI_CALL_MODEL, default grok-4.7-build-fast). */
export async function* streamCompletion(messages: ChatMessage[], signal?: AbortSignal, opts: { fast?: boolean } = {}): AsyncGenerator<string> {
  if (provider() === "grok-cli") yield* streamGrokCli(messages, signal, opts.fast ? (process.env.GROK_CLI_CALL_MODEL ?? "grok-4.7-build-fast") : undefined);
  else yield* streamApi(messages, signal);
}

/** Whole reply as one string (jobs). */
export async function complete(messages: ChatMessage[], signal?: AbortSignal) {
  let out = "";
  for await (const t of streamCompletion(messages, signal)) out += t;
  return out.trim();
}
