/**
 * The image tool: makes a new picture from a description. Behind XAI_API_KEY (xAI's image API) or OPENROUTER_API_KEY
 * (an image model on OpenRouter). With neither, the tool is hidden and the agent says it isn't switched on yet.
 * Each image is metered like a premium turn (premium usage, then credits). The engine is never named to the person.
 */
import { ModelError } from "./engram/cortex";

const X_MODEL = () => process.env.XAI_IMAGE_MODEL || "grok-imagine-image";
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

/** The description the agent asked for: <imagine>…</imagine>. */
export function imagineTask(text: string) {
  const m = /<imagine>([\s\S]*?)<\/imagine>/i.exec(text);
  const t = m?.[1].replace(/\s+/g, " ").trim().slice(0, 900);
  return t || null;
}
export const stripImagine = (t: string) => t.replace(/<imagine>[\s\S]*?(<\/imagine>|$)/gi, "").trim();

const dataUrl = (u: string) => { const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(u); return m ? Buffer.from(m[2], "base64") : null; };

/** One generated image (PNG or JPEG bytes) and what it cost. */
export async function generateImage(prompt: string, signal?: AbortSignal): Promise<{ data: Buffer; costUsd: number }> {
  const p = imageProvider();
  if (!p) throw new ModelError("AI image generation isn't switched on yet.", "no image provider key");
  const timeout = AbortSignal.timeout(90_000);
  const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
  if (p === "xai") {
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST", signal: sig, headers: { authorization: `Bearer ${process.env.XAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: X_MODEL(), prompt, n: 1, response_format: "b64_json" }),
    });
    if (!res.ok) throw new ModelError("The image couldn't be made right now. Try again in a moment.", `image ${res.status}`);
    const j = await res.json() as { data?: { b64_json?: string }[] };
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) throw new ModelError("The image couldn't be made right now. Try again in a moment.", "image: empty");
    return { data: Buffer.from(b64, "base64"), costUsd: IMAGE_COST_USD };
  }
  const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST", signal: sig, headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: OR_MODEL(), modalities: ["image", "text"], messages: [{ role: "user", content: prompt }], usage: { include: true } }),
  });
  if (!res.ok) throw new ModelError("The image couldn't be made right now. Try again in a moment.", `image ${res.status}`);
  const j = await res.json() as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[]; usage?: { cost?: number } };
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
  const data = dataUrl(url);
  if (!data) throw new ModelError("The image couldn't be made right now. Try again in a moment.", "image: no data url");
  return { data, costUsd: typeof j.usage?.cost === "number" ? j.usage.cost : IMAGE_COST_USD };
}
