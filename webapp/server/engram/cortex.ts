export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function llmConfig() {
  const key = process.env.OPENAI_API_KEY || process.env.XAI_API_KEY || "";
  const base = (process.env.OPENAI_BASE_URL || (process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY ? "https://api.x.ai/v1" : "https://api.openai.com/v1")).replace(/\/$/, "");
  const host = (() => { try { return new URL(base).host; } catch { return ""; } })();
  const model = process.env.OPENAI_MODEL
    || (host.includes("x.ai") ? "grok-4.7" : host.includes("freemodel") ? "gpt-6-luna" : "gpt-4o-mini");
  return { key, base, model };
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

export async function* streamCompletion(messages: ChatMessage[]): AsyncGenerator<string> {
  const { key, base, model } = llmConfig();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
  });
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 180);
    throw new Error(detail || `The model returned ${res.status}`);
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
