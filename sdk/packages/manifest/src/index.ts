/**
 * The Lexari agent manifest: everything Lexari needs to list, review and run a third-party agent.
 * One schema for the server (webapp/server/market) and the SDK and CLI, so a manifest that validates locally validates on publish.
 *
 * Safety rules that live in the schema:
 *  - models are Lexari models only (no developer or bring-your-own keys);
 *  - tools are HTTPS webhooks on the developer's own server, read-only by default;
 *  - money moves only through intents ("transfer" and "swap" in v1), which Lexari turns into Confirm cards.
 */
import { z } from "zod";

export const MANIFEST_VERSION = 1 as const;

/** Lexari models an agent may ask for. Premium models bill the hirer's premium pool, exactly like their own agents. */
export const LEXARI_MODELS = ["lamina", "grok-fast", "kimi", "qwen", "openai", "claude", "claude-sonnet", "claude-opus", "grok", "gemini-flash"] as const;
/** The same categories the marketplace files agents under. */
export const AGENT_CATEGORIES = ["Research", "Writing", "Data", "Design", "Community", "Onchain", "Video", "Planning", "Code", "Social"] as const;
export const FACE_COLORS = ["orange", "blue", "green", "yellow", "red", "teal", "pink", "lilac", "purple", "sky"] as const;
export const TONES = ["short", "warm", "formal", "playful"] as const;
/** v1: the only money actions a third-party agent can propose. */
export const INTENT_TYPES = ["transfer", "swap"] as const;
export const ASSETS = ["SOL", "USDC"] as const;
/** Highest hire price in the alpha, in US dollars. */
export const MAX_PRICE_USD = 50;
export const MAX_TOOLS = 8;
export const MAX_SYSTEM_CHARS = 4000;

const plain = (min: number, max: number) => z.string().trim().min(min).max(max).refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s), "No control characters.");
/** UI copy rule shared with the app: no em dashes in anything a person reads. */
const copy = (min: number, max: number) => plain(min, max).refine((s) => !s.includes("\u2014"), "Use a comma, colon or full stop instead of an em dash.");

export const slugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,31}$/, "3 to 32 characters: lowercase letters, digits and dashes, starting with a letter.");
export const semverSchema = z.string().regex(/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/, "A version like 1.0.0.");
export const toolNameSchema = z.string().regex(/^[a-z][a-z0-9_]{1,23}$/, "2 to 24 characters: lowercase letters, digits and underscores.");

const httpsUrl = z.string().url().max(500).refine((u) => {
  try { const x = new URL(u); return x.protocol === "https:" && !x.username && !x.password && !x.hash; } catch { return false; }
}, "An https:// address with no login or #fragment.");

/** A small, safe subset of JSON Schema for tool input: flat objects of strings, numbers, integers and booleans. */
const propSchema = z.object({
  type: z.enum(["string", "number", "integer", "boolean"]),
  description: copy(1, 200).optional(),
  enum: z.array(z.union([z.string().max(80), z.number()])).min(1).max(30).optional(),
  maxLength: z.number().int().min(1).max(2000).optional(),
}).strict();
export const toolInputSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/), propSchema).refine((p) => Object.keys(p).length <= 12, "At most 12 inputs."),
  required: z.array(z.string()).max(12).optional(),
}).strict().refine((s) => (s.required || []).every((k) => k in s.properties), "Every required input must be listed in properties.");

export const toolSchema = z.object({
  name: toolNameSchema,
  description: copy(10, 200),
  input: toolInputSchema,
  /** Your HTTPS endpoint. Lexari POSTs a signed request (see signature.ts) and expects { text, intent? } back. */
  url: httpsUrl,
  /** Money actions this tool may propose. Leave it out for a read-only tool. */
  intents: z.array(z.enum(INTENT_TYPES)).max(INTENT_TYPES.length).optional(),
}).strict();

export const manifestSchema = z.object({
  manifestVersion: z.literal(MANIFEST_VERSION),
  id: slugSchema,
  name: copy(2, 32),
  version: semverSchema,
  category: z.enum(AGENT_CATEGORIES),
  face: z.object({ seed: z.number().int().min(0).max(9999), color: z.enum(FACE_COLORS) }).strict(),
  persona: z.object({
    job: copy(2, 40),
    quip: copy(2, 80),
    description: copy(10, 280),
    tone: z.enum(TONES).default("short"),
    /** Extra instructions for the model. Lexari's own rules always come first and can't be overridden. */
    system: copy(1, MAX_SYSTEM_CHARS).optional(),
    examples: z.array(copy(3, 80)).min(1).max(3),
    skills: z.array(z.tuple([copy(2, 30), z.number().int().min(1).max(100)])).max(5).default([]),
  }).strict(),
  model: z.enum(LEXARI_MODELS).default("lamina"),
  tools: z.array(toolSchema).max(MAX_TOOLS).default([]),
  pricing: z.object({ type: z.enum(["free", "hire"]), usd: z.number().min(0).max(MAX_PRICE_USD) }).strict()
    .refine((p) => (p.type === "free" ? p.usd === 0 : p.usd >= 0.5), "Free agents cost 0; paid hires cost at least $0.50.")
    .default({ type: "free", usd: 0 }),
}).strict().superRefine((m, ctx) => {
  const seen = new Set<string>();
  m.tools.forEach((t, i) => {
    if (seen.has(t.name)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tools", i, "name"], message: `Two tools are called ${t.name}.` });
    seen.add(t.name);
  });
});

export type Manifest = z.output<typeof manifestSchema>;
export type ManifestInput = z.input<typeof manifestSchema>;
export type ToolSpec = z.output<typeof toolSchema>;

/* ---------- intents ---------- */
const amount = z.number().finite().positive().max(1_000_000);
const solAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "A Solana address.");
export const transferIntentSchema = z.object({
  type: z.literal("transfer"),
  /** A Solana address, or "me" for the person's own linked wallet. */
  to: z.union([solAddress, z.literal("me")]),
  asset: z.enum(ASSETS),
  amount,
  /** Shown on the Confirm card. */
  note: copy(1, 80).optional(),
}).strict();
export const swapIntentSchema = z.object({
  type: z.literal("swap"),
  sell: z.enum(ASSETS),
  buy: z.enum(ASSETS),
  amount,
  slippageBps: z.number().int().min(1).max(500).optional(),
  note: copy(1, 80).optional(),
}).strict().refine((s) => s.sell !== s.buy, "Sell and buy must be different tokens.");
export const intentSchema = z.union([transferIntentSchema, swapIntentSchema]);
export type Intent = z.output<typeof intentSchema>;

/* ---------- the webhook contract ---------- */
export const webhookRequestSchema = z.object({
  v: z.literal(1),
  /** Unique per call; also the replay nonce. */
  id: z.string().min(8).max(64),
  agent: z.object({ id: slugSchema, version: semverSchema }).strict(),
  tool: toolNameSchema,
  input: z.record(z.unknown()),
  /** Pseudonymous: stable per person and agent, never the real account id, never a wallet or key. */
  user: z.string().min(8).max(64),
  conversation: z.string().min(8).max(64),
  /** "sandbox" from lexari dev and lexari test, "testnet" from the app. */
  env: z.enum(["sandbox", "testnet"]),
}).strict();
export type WebhookRequest = z.output<typeof webhookRequestSchema>;
export const webhookResponseSchema = z.object({
  text: z.string().max(4000),
  intent: intentSchema.optional(),
}).strict();
export type WebhookResponse = z.output<typeof webhookResponseSchema>;

/* ---------- helpers ---------- */
/** Readable problems ("tools.0.url: An https:// address ...") for the CLI and the publish API. */
export function issuesOf(error: z.ZodError): string[] {
  return error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "manifest"}: ${i.message}`);
}
export function parseManifest(input: unknown): { ok: true; manifest: Manifest } | { ok: false; issues: string[] } {
  const r = manifestSchema.safeParse(input);
  return r.success ? { ok: true, manifest: r.data } : { ok: false, issues: issuesOf(r.error) };
}
/** The name the model writes in a tool tag: "<agent id>.<tool name>", e.g. "tip-jar.tip". */
export const qualifiedToolName = (agentId: string, tool: string) => `${agentId}.${tool}`;
/** Validates a tool call's input against the tool's declared input schema. Returns a cleaned copy or a reason. */
export function checkToolInput(spec: ToolSpec, input: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "input must be a JSON object" };
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(spec.input.properties)) {
    const v = src[k];
    if (v === undefined || v === null) { if ((spec.input.required || []).includes(k)) return { ok: false, reason: `${k} is required` }; continue; }
    if (p.type === "string") { if (typeof v !== "string") return { ok: false, reason: `${k} must be text` }; if (v.length > (p.maxLength ?? 2000)) return { ok: false, reason: `${k} is too long` }; }
    if (p.type === "number" && (typeof v !== "number" || !Number.isFinite(v))) return { ok: false, reason: `${k} must be a number` };
    if (p.type === "integer" && (typeof v !== "number" || !Number.isInteger(v))) return { ok: false, reason: `${k} must be a whole number` };
    if (p.type === "boolean" && typeof v !== "boolean") return { ok: false, reason: `${k} must be true or false` };
    if (p.enum && !p.enum.includes(v as string | number)) return { ok: false, reason: `${k} must be one of ${p.enum.join(", ")}` };
    out[k] = v;
  }
  return { ok: true, value: out };
}
/** One prompt line for a tool, in the same shape as Lexari's built-in tool hints. */
export function toolHint(agentId: string, t: ToolSpec): string {
  const example = Object.fromEntries(Object.entries(t.input.properties).map(([k, p]) => [k, p.enum ? p.enum[0] : p.type === "string" ? k.toUpperCase() : p.type === "boolean" ? true : 1]));
  return `${qualifiedToolName(agentId, t.name)} ${JSON.stringify(example)} : ${t.description}${t.intents?.length ? ` It may propose a ${t.intents.join(" or ")} that the person confirms.` : ""}`;
}
