/**
 * SERVER ONLY. Which engines serve each model through the OpenRouter gateway, in fallback order, and their list prices
 * (USD per million tokens, checked 6 Oct 2026). Lamina is a Lexari route: Kimi K2.5 first, then DeepSeek V4.1 Flash,
 * then Grok 4.3, and the Grok CLI relay as the last resort (cortex.ts). These names stay on the server and in internal
 * logs; the app only ever says "Lamina".
 */
import type { ModelInfo, Price } from "@/content/models";

const ROUTES: Record<string, string[]> = {
  lamina: ["moonshotai/kimi-k2.5", "deepseek/deepseek-v4.1-flash", "x-ai/grok-4.3"],
  "claude-sonnet": ["anthropic/claude-sonnet-5.5"],
  "claude-opus": ["anthropic/claude-opus-5.5"],
  grok: ["x-ai/grok-4.7"],
  "gemini-flash": ["google/gemini-3.8-flash"],
};
/** OpenRouter model ids for a model, in fallback order. */
export const routeFor = (m: ModelInfo) => ROUTES[m.id] ?? [];

/** Engine prices, for whichever engine a fallback ends up serving. */
export const ENGINE_PRICES: Record<string, Price> = {
  "moonshotai/kimi-k2.5": { in: 0.45, out: 2.25 },
  "deepseek/deepseek-v4.1-flash": { in: 0.029, out: 1.32 },
  "x-ai/grok-4.3": { in: 1.25, out: 2.5 },
  "anthropic/claude-sonnet-5.5": { in: 2, out: 10 },
  "anthropic/claude-opus-5.5": { in: 4, out: 20 },
  "x-ai/grok-4.7": { in: 2, out: 6 },
  "google/gemini-3.8-flash": { in: 0.75, out: 3.75 },
};
