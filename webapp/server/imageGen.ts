/**
 * The image tool: makes a new picture from a description, or edits a photo on the agent's computer. Uses the person's own
 * key from Settings > Models when they added one (xAI, OpenAI, Google or OpenRouter; not metered by Lexari), else
 * Lexari's XAI_API_KEY / OPENROUTER_API_KEY (metered like a premium turn). With none, the tool is hidden and the agent
 * says how to switch it on. The engine is never named to the person.
 */
import { ModelError } from "./engram/cortex";

const X_MODEL = () => process.env.XAI_IMAGE_MODEL || "grok-imagine-image-2.0";
const OR_MODEL = () => process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image";
/** What one image costs Lexari, when the provider doesn't say (USD). */
export const IMAGE_COST_USD = Number(process.env.LEXARI_IMAGE_COST_USD || 0.04);

export function imageProvider(): "xai" | "openrouter" | null {
  if (process.env.LEXARI_IMAGE_GEN === "off") return null;
  if (process.env.XAI_API_KEY) return "xai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return null;
}
export const imageGenOn = () => imageProvider() !== null;

/** The description the agent asked for: <imagine>…</imagine>, or <imagine edit="/home/agent/…">the change</imagine> for a photo edit. */
export function imagineTask(text: string): { prompt: string; edit?: string } | null {
  const m = /<imagine\b([^>]*)>([\s\S]*?)<\/imagine>/i.exec(text);
  const t = m?.[2].replace(/\s+/g, " ").trim().slice(0, 900);
  if (!t) return null;
  const edit = /edit\s*=\s*"([^"]+)"/i.exec(m![1])?.[1]?.trim();
  return edit ? { prompt: t, edit } : { prompt: t };
}
export const stripImagine = (t: string) => t.replace(/<imagine\b[^>]*>[\s\S]*?(<\/imagine>|$)/gi, "").trim();

const dataUrl = (u: string) => { const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(u); return m ? Buffer.from(m[2], "base64") : null; };

/** A provider key for pictures: Lexari's own (server env) or the person's (Settings > Models). */
export type ImageKey = { provider: "xai" | "openai" | "gemini" | "openrouter"; key: string; own: boolean };
export function serverImageKey(): ImageKey | null {
  const p = imageProvider();
  if (p === "xai") return { provider: "xai", key: process.env.XAI_API_KEY || "", own: false };
  if (p === "openrouter") return { provider: "openrouter", key: process.env.OPENROUTER_API_KEY || "", own: false };
  return null;
}
const O_MODEL = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const G_MODEL = () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const FAIL = "The image couldn't be made right now. Try again in a moment.";
const b64Of = (src: { data: Buffer; mime: string }) => `data:${src.mime};base64,${src.data.toString("base64")}`;

async function fromJsonData(res: Response, what: string) {
  if (!res.ok) throw new ModelError(FAIL, `${what} ${res.status}`);
  const j = await res.json() as { data?: { b64_json?: string; url?: string }[] };
  const d = j.data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d?.url && /^https:\/\//.test(d.url)) { const r = await fetch(d.url, { signal: AbortSignal.timeout(30_000) }); if (r.ok) return Buffer.from(await r.arrayBuffer()); }
  throw new ModelError(FAIL, `${what}: empty`);
}

/**
 * One picture (PNG or JPEG bytes) and what it cost. With `source`, it edits that photo as the prompt says instead of
 * making a new one. `key` picks the provider (the person's own key when they added one), else Lexari's.
 */
export async function generateImage(prompt: string, signal?: AbortSignal, opt: { key?: ImageKey | null; source?: { data: Buffer; mime: string } } = {}): Promise<{ data: Buffer; costUsd: number }> {
  const k = opt.key || serverImageKey();
  if (!k) throw new ModelError("AI image generation isn't switched on yet.", "no image provider key");
  const timeout = AbortSignal.timeout(120_000);
  const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const src = opt.source;
  if (k.provider === "xai") {
    const res = await fetch(`https://api.x.ai/v1/images/${src ? "edits" : "generations"}`, {
      method: "POST", signal: sig, headers: { authorization: `Bearer ${k.key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: X_MODEL(), prompt, n: 1, response_format: "b64_json", ...(src ? { image: { type: "image_url", url: b64Of(src) } } : {}) }),
    });
    return { data: await fromJsonData(res, "xai image"), costUsd: IMAGE_COST_USD };
  }
  if (k.provider === "openai") {
    let res: Response;
    if (src) {
      const form = new FormData();
      form.set("model", O_MODEL()); form.set("prompt", prompt); form.set("n", "1");
      form.set("image", new Blob([new Uint8Array(src.data)], { type: src.mime }), src.mime === "image/jpeg" ? "photo.jpg" : src.mime === "image/webp" ? "photo.webp" : "photo.png");
      res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", signal: sig, headers: { authorization: `Bearer ${k.key}` }, body: form });
    } else {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", signal: sig, headers: { authorization: `Bearer ${k.key}`, "content-type": "application/json" },
        body: JSON.stringify({ model: O_MODEL(), prompt, n: 1, size: "1024x1024" }),
      });
    }
    return { data: await fromJsonData(res, "openai image"), costUsd: IMAGE_COST_USD };
  }
  if (k.provider === "gemini") {
    const parts: unknown[] = [{ text: prompt }];
    if (src) parts.push({ inline_data: { mime_type: src.mime, data: src.data.toString("base64") } });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(G_MODEL())}:generateContent`, {
      method: "POST", signal: sig, headers: { "x-goog-api-key": k.key, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    if (!res.ok) throw new ModelError(FAIL, `gemini image ${res.status}`);
    const j = await res.json() as { candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[] };
    const part = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data || x.inline_data?.data);
    const b64 = part?.inlineData?.data || part?.inline_data?.data;
    if (!b64) throw new ModelError(FAIL, "gemini image: empty");
    return { data: Buffer.from(b64, "base64"), costUsd: IMAGE_COST_USD };
  }
  const base = (k.own ? "https://openrouter.ai/api/v1" : (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1")).replace(/\/$/, "");
  const content = src ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: b64Of(src) } }] : prompt;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST", signal: sig, headers: { authorization: `Bearer ${k.key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: OR_MODEL(), modalities: ["image", "text"], messages: [{ role: "user", content }], usage: { include: true } }),
  });
  if (!res.ok) throw new ModelError(FAIL, `image ${res.status}`);
  const j = await res.json() as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[]; usage?: { cost?: number } };
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
  const data = dataUrl(url);
  if (!data) throw new ModelError(FAIL, "image: no data url");
  return { data, costUsd: typeof j.usage?.cost === "number" ? j.usage.cost : IMAGE_COST_USD };
}
