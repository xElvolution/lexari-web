/**
 * @lexari/sdk: build an agent for the Lexari Marketplace.
 *
 *   const agent = defineAgent({ id: "tip-jar", name: "Tip Jar", ..., url: "https://tips.example.com/lexari",
 *     tools: [defineTool({ name: "tip", description: "...", input: {...}, intents: ["transfer"],
 *       run: async ({ input }) => ({ text: "Ready", intent: intents.transfer({ to, asset: "USDC", amount: 1 }) }) })] });
 *   serve(agent, { secret: process.env.LEXARI_WEBHOOK_SECRET!, port: 8787 });
 *
 * Your code runs on your server. Lexari calls it over HTTPS, signed with your listing's webhook secret, and sends
 * only the tool input and pseudonymous ids. It never sees a key or a wallet. To move money, return an intent:
 * Lexari turns it into a Confirm card, checks every limit, and only the person's tap runs it.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import {
  checkToolInput, intentSchema, manifestSchema, parseManifest, webhookRequestSchema, webhookResponseSchema,
  type Intent, type Manifest, type WebhookRequest, type WebhookResponse,
} from "@lexari/manifest";
import { memoryNonceStore, sign, verify, SIGNATURE_HEADER, type NonceStore } from "@lexari/manifest/signature";

export type { Intent, Manifest, WebhookRequest, WebhookResponse, NonceStore };
export { memoryNonceStore, sign, verify, SIGNATURE_HEADER, parseManifest };

type JsonSchema = Manifest["tools"][number]["input"];
export type ToolContext = { input: Record<string, unknown>; user: string; conversation: string; env: WebhookRequest["env"]; request: WebhookRequest };
export type ToolResult = string | WebhookResponse;
export type Tool = {
  name: string; description: string; input: JsonSchema; intents?: ("transfer" | "swap")[]; url?: string;
  run: (ctx: ToolContext) => ToolResult | Promise<ToolResult>;
};
export type AgentSpec = Omit<Manifest, "tools" | "manifestVersion" | "model" | "persona"> & {
  manifestVersion?: 1; model?: Manifest["model"]; persona: Omit<Manifest["persona"], "tone" | "skills"> & Partial<Pick<Manifest["persona"], "tone" | "skills">>;
  /** your public HTTPS endpoint; every tool uses it unless a tool sets its own url */
  url?: string;
  tools: Tool[];
};
export type Agent = { spec: AgentSpec; tools: Map<string, Tool>; manifest(opts?: { url?: string }): Manifest };

export const defineTool = (t: Tool): Tool => t;

/** Your agent: the manifest Lexari reviews, plus the code behind each tool. Throws with readable issues when invalid. */
export function defineAgent(spec: AgentSpec): Agent {
  const tools = new Map(spec.tools.map((t) => [t.name, t]));
  if (tools.size !== spec.tools.length) throw new Error("Two tools share a name.");
  const manifest = (opts: { url?: string } = {}): Manifest => {
    const { url, tools: list, ...rest } = spec;
    const raw = {
      manifestVersion: 1, ...rest,
      tools: list.map((t) => ({ name: t.name, description: t.description, input: t.input, url: t.url || opts.url || url, ...(t.intents?.length ? { intents: t.intents } : {}) })),
    };
    const p = parseManifest(raw);
    if (!p.ok) throw new ManifestError(p.issues);
    return p.manifest;
  };
  return { spec, tools, manifest };
}

export class ManifestError extends Error {
  constructor(public issues: string[]) { super(`The agent manifest has problems:\n- ${issues.join("\n- ")}`); }
}

/** Intents: the only way an agent moves money. Each becomes a Confirm card the person approves. */
export const intents = {
  transfer: (i: { to: string; asset: "SOL" | "USDC"; amount: number; note?: string }): Intent => intentSchema.parse({ type: "transfer", ...i }),
  swap: (i: { sell: "SOL" | "USDC"; buy: "SOL" | "USDC"; amount: number; slippageBps?: number; note?: string }): Intent => intentSchema.parse({ type: "swap", ...i }),
};

export type HandlerOptions = { secret: string; nonces?: NonceStore; now?: () => number; onError?: (e: unknown, req?: WebhookRequest) => void };
export type HandlerResult = { status: number; body: unknown };

const json = (status: number, body: unknown): HandlerResult => ({ status, body });

/**
 * The core: verify Lexari's signature (constant time, 5 minute window, replay nonces), validate the request and the
 * tool input, run the tool, and validate what it returns. Framework free; see createWebhookHandler and serve.
 */
export async function handleWebhook(agent: Agent, rawBody: string, signature: string | null | undefined, opts: HandlerOptions): Promise<HandlerResult> {
  if (!opts.secret) return json(500, { error: "LEXARI_WEBHOOK_SECRET is not set" });
  const v = await verify(opts.secret, rawBody, signature, { nonces: opts.nonces, now: opts.now?.() });
  if (!v.ok) return json(401, { error: `signature ${v.reason}` });
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return json(400, { error: "body is not JSON" }); }
  const req = webhookRequestSchema.safeParse(parsed);
  if (!req.success) return json(400, { error: "not a Lexari tool request" });
  const tool = agent.tools.get(req.data.tool);
  if (!tool) return json(404, { error: `no tool called ${req.data.tool}` });
  if (req.data.agent.id !== agent.spec.id) return json(400, { error: "request is for another agent" });
  const spec = { name: tool.name, description: tool.description, input: tool.input, url: "https://x.invalid", intents: tool.intents };
  const input = checkToolInput(spec as never, req.data.input);
  if (!input.ok) return json(400, { error: `bad input: ${input.reason}` });
  try {
    const r = await tool.run({ input: input.value, user: req.data.user, conversation: req.data.conversation, env: req.data.env, request: req.data });
    const out = webhookResponseSchema.safeParse(typeof r === "string" ? { text: r } : r);
    if (!out.success) throw new Error(`tool ${tool.name} returned an invalid result: ${out.error.issues[0]?.message}`);
    if (out.data.intent && !(tool.intents || []).includes(out.data.intent.type)) throw new Error(`tool ${tool.name} returned a ${out.data.intent.type} intent but doesn't declare it`);
    return json(200, out.data);
  } catch (e) {
    opts.onError?.(e, req.data);
    return json(500, { error: "tool failed" });
  }
}

/** A Fetch API handler (Next.js route handlers, Hono, Bun, Deno, Cloudflare Workers with nodejs_compat). */
export function createWebhookHandler(agent: Agent, opts: HandlerOptions) {
  const o = { ...opts, nonces: opts.nonces ?? memoryNonceStore() };
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const r = await handleWebhook(agent, await req.text(), req.headers.get(SIGNATURE_HEADER), o);
    return Response.json(r.body, { status: r.status });
  };
}

const MAX_BODY = 256 * 1024;
async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) { size += (c as Buffer).length; if (size > MAX_BODY) throw new Error("too large"); chunks.push(c as Buffer); }
  return Buffer.concat(chunks).toString("utf8");
}

/** A plain Node HTTP server for your agent. Put it behind HTTPS (a reverse proxy or your host's TLS). */
export function serve(agent: Agent, opts: HandlerOptions & { port?: number; host?: string; path?: string }): Server {
  const o = { ...opts, nonces: opts.nonces ?? memoryNonceStore() };
  const server = createServer(async (req, res) => {
    const send = (s: number, b: unknown) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(b)); };
    if (req.method === "GET" && req.url === "/healthz") return send(200, { ok: true, agent: agent.spec.id });
    if (opts.path && req.url?.split("?")[0] !== opts.path) return send(404, { error: "not found" });
    if (req.method !== "POST") return send(405, { error: "POST only" });
    let body: string;
    try { body = await readBody(req); } catch { return send(413, { error: "body too large" }); }
    const r = await handleWebhook(agent, body, req.headers[SIGNATURE_HEADER] as string | undefined, o);
    send(r.status, r.body);
  });
  server.listen(opts.port ?? 8787, opts.host ?? "127.0.0.1");
  return server;
}

/**
 * Call your tools locally exactly as Lexari would: a signed request with pseudonymous ids. Point it at a running
 * server (url) or at the agent itself (in process).
 */
export function testClient(agent: Agent, opts: { secret: string; url?: string; user?: string; conversation?: string }) {
  const local = opts.url ? null : createWebhookHandler(agent, { secret: opts.secret });
  return {
    async call(tool: string, input: Record<string, unknown>, extra: { signature?: string | null; body?: string } = {}): Promise<{ status: number; body: any; ms: number; bytes: number }> {
      const req: WebhookRequest = { v: 1, id: crypto.randomUUID().replace(/-/g, ""), agent: { id: agent.spec.id, version: agent.spec.version }, tool, input, user: opts.user || "test-user-0000", conversation: opts.conversation || "test-convo-0000", env: "testnet" };
      const body = extra.body ?? JSON.stringify(req);
      const headers: Record<string, string> = { "content-type": "application/json" };
      const sig = extra.signature === undefined ? sign(opts.secret, body) : extra.signature;
      if (sig) headers[SIGNATURE_HEADER] = sig;
      const t0 = Date.now();
      const res = local ? await local(new Request("http://local/", { method: "POST", body, headers })) : await fetch(opts.url!, { method: "POST", body, headers, signal: AbortSignal.timeout(15_000) });
      const text = await res.text();
      let parsed: unknown = text; try { parsed = JSON.parse(text); } catch {}
      return { status: res.status, body: parsed, ms: Date.now() - t0, bytes: Buffer.byteLength(text) };
    },
  };
}

export { manifestSchema };
