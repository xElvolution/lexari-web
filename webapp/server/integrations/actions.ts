/**
 * Running integration tools for an agent, with every rule applied on the server:
 *  - the grant (added, switched on, this agent allowed) on every call and again at Confirm;
 *  - per-trade and daily dollar limits (summed from today's integration_actions under a per-person lock at Confirm);
 *  - devnet / testnet only: sign tools refuse to run on mainnet;
 *  - every call is recorded in integration_actions (reads as "done", refusals as "rejected" with the reason).
 * Sign tools never execute from chat: they make a confirm card, and only the person's Confirm runs them.
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { SCOPE_INFO, integrationById, scopeOfTool, type ActionCard, type MarketsCard } from "@/content/integrations";
import { db } from "../db";
import { chats, messages } from "../db/schema";
import { integrationActions, integrationGrants } from "../db/integrationsSchema";
import { HttpError, rateLimit } from "../http";
import { connection } from "../hub/chain";
import { ownAgent, solanaKeypair } from "../agentWallets";
import { COUNTED, grantScopes, isBuiltin, isLive, spentToday, type Grant } from "./grants";
import { isOwnWallet, myWalletFor } from "../wallets";
import { overBudget } from "../agentpay/budgets";
import { DEV_CAPS } from "../market/config";
import { recordTx } from "../txlog";
import { TEMPO, tempoReceipt } from "./tempo";
import { HL_NETWORK } from "./hyperliquid";
import { nansenCheck } from "./monad";

/** Trades and swaps get a "Nansen check" row on their Confirm card (smart money flows for the token bought). */
const NANSEN_TOOLS: Record<string, string> = { "orca.swap": "solana", "kuru.swap": "monad", "hyperliquid.order": "ethereum", "intents.route": "solana" };
async function nansenRowFor(tool: string, input: unknown): Promise<[string, string] | null> {
  const chain = NANSEN_TOOLS[tool];
  if (!chain) return null;
  const i = (input || {}) as Record<string, unknown>;
  const sym = String(i.buy || i.coin || i.to || (i.sell === "SOL" ? "USDC" : "SOL") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!sym) return null;
  return ["Nansen check", await Promise.race([nansenCheck(sym, chain), new Promise<string>((r) => setTimeout(() => r("Skipped: Nansen didn't answer in time"), 5000))])];
}
import type { Executed } from "./registry";
import { Reject, toolByName, type AgentRef, type ToolDef } from "./registry";
import { ChainError, SimError, isDevnet, network } from "./solana";
import { EVM, isEvmChain } from "./evm";
import { evmTxState } from "./evmchains";
import { cardOf, type Preview } from "./cards";
import { intentToCall, type DevProposal } from "../market/devtools";
import { checkMoney, type SendCheck } from "../security";

const EXPIRE_MS = 15 * 60_000;
const CONFIRMS_PER_HOUR = Number(process.env.INTEGRATION_CONFIRMS_PER_HOUR || 30);
const usd = (micros: number) => `$${(micros / 1e6).toFixed(2)}`;

export function agentRef(userId: string, a: { slug: string; kind: string; name: string; meta?: unknown }): AgentRef {
  let kp: ReturnType<typeof solanaKeypair> | null = null;
  return { userId, slug: a.slug, kind: a.kind, name: (a.meta as { nick?: string } | null)?.nick || a.name, keypair: () => (kp ??= solanaKeypair(userId, a.slug, a.kind)) };
}

/** untrusted: this turn read content the person didn't write (email, web pages), so the card says why you're asked. */
/**
 * thirdParty: the speaker is a third-party agent (SDK). It may only call read tools and its own tools; money moves
 * only through an intent from one of its tools, which arrives here as `proposal` (lower caps and a "Proposed by" row).
 */
type Ctx = { userId: string; agent: AgentRef; convo: string; messageId: string; untrusted?: boolean; thirdParty?: boolean; proposal?: DevProposal };
export type CallResult =
  | { kind: "read"; tool: string; ok: true; text: string; markets?: MarketsCard }
  | { kind: "read"; tool: string; ok: false; text: string }
  | { kind: "action"; tool: string; card: ActionCard }
  | { kind: "refused"; tool: string; text: string };

async function record(ctx: Ctx, tool: ToolDef | { name: string; connector: string }, input: unknown, status: string, extra: { preview?: Preview; usdMicros?: number; error?: string; chain?: string } = {}) {
  const [row] = await db().insert(integrationActions).values({
    userId: ctx.userId, connector: tool.connector, tool: tool.name, agentSlug: ctx.agent.slug, chain: extra.chain || "", convo: ctx.convo, messageId: ctx.messageId,
    input: (input ?? {}) as object, preview: extra.preview ?? null, usdMicros: extra.usdMicros ?? 0, status, error: extra.error?.slice(0, 300) ?? null, settledAt: status === "prepared" ? null : new Date(),
  }).returning();
  return row;
}

const ME = /^(me|mine|my wallet|my linked wallet|my active wallet|user|owner)$/i;

/** "to":"me" in a transfer means your own wallet (the active one when it fits the chain). */
async function resolveMe(userId: string, tool: ToolDef, input: unknown) {
  if (!/\.transfer$/.test(tool.name) || !input || typeof input !== "object") return input;
  const to = (input as { to?: unknown }).to;
  if (typeof to !== "string" || !ME.test(to.trim())) return input;
  const mine = await myWalletFor(userId, tool.connector === "solana" ? "solana" : "evm");
  if (!mine) throw new Reject(`You haven't linked ${tool.connector === "solana" ? "a Solana" : "an EVM"} wallet yet. Link one in Settings > Wallets and I can send there.`);
  return { ...input, to: mine };
}

/**
 * The consent rules: the grant hasn't expired and covers what this tool does. A transfer to one of your own wallets
 * needs "withdraw" (or "transfer"); to anyone else it needs "transfer". Built-in connectors carry every scope.
 */
export async function scopeDenied(userId: string, grant: Grant, tool: ToolDef, plan: unknown): Promise<string | null> {
  const name = integrationById(tool.connector)?.name || tool.connector;
  if (!isLive(grant)) return `My access to ${name} expired. Allow it again in Settings > Integrations.`;
  const has = grantScopes(grant);
  let need = scopeOfTool(tool.name, tool.risk);
  if (need === "transfer") {
    const to = (plan as { to?: string } | undefined)?.to;
    if (to && (await isOwnWallet(userId, to))) return has.includes("withdraw") || has.includes("transfer") ? null : `You didn't allow ${name} to send to your wallets. Turn on "${SCOPE_INFO.withdraw.title}" in Settings > Integrations.`;
    if (!has.includes("transfer")) return has.includes("withdraw")
      ? `I can only send to wallets you linked (Settings > Wallets). To pay another address, allow "${SCOPE_INFO.transfer.title}" for ${name}.`
      : `You didn't allow ${name} to send money. Change it in Settings > Integrations.`;
    return null;
  }
  return has.includes(need) ? null : `You didn't allow ${name} to ${SCOPE_INFO[need].title.toLowerCase()}. Change it in Settings > Integrations.`;
}

/** One tool call from the agent's reply. `grants` are the integrations this agent may use right now. */
export async function runCall(ctx: Ctx, grants: Grant[], name: string, input: unknown, extra: ToolDef[] = []): Promise<CallResult> {
  const tool = extra.find((t) => t.name === name.trim().toLowerCase()) ?? toolByName(name);
  if (!tool) return { kind: "refused", tool: name, text: `there's no Lexari integration tool called ${name.slice(0, 40)}` };
  const info = integrationById(tool.connector) ?? { name: tool.dev?.label || "this agent's tools" };
  // A third-party agent never signs directly: payments only come from its own tools as intents (below).
  if (ctx.thirdParty && tool.risk === "sign" && !ctx.proposal) {
    await record(ctx, tool, input, "rejected", { error: "Third-party agents can only propose payments through their own tools." }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: "I can only propose payments through my own tools, so nothing was prepared" };
  }
  if (ctx.proposal && (tool.risk !== "sign" || tool.dev || tool.offchain || tool.auto)) return { kind: "refused", tool: tool.name, text: "that proposal isn't something a third-party agent can make" };
  const grant = grants.find((g) => g.connector === tool.connector);
  if (!grant) {
    await record(ctx, tool, input, "rejected", { error: `${info.name} isn't available to this agent.` }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: `I don't have access to ${info.name}. In Settings > Integrations, add it (or switch it on) and give me access` };
  }
  try { input = await resolveMe(ctx.userId, tool, input); }
  catch (e) {
    const why = e instanceof Reject ? e.message : "I couldn't look up your wallets right now.";
    await record(ctx, tool, input, "rejected", { error: why }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: why };
  }
  if (tool.risk === "read" && !isBuiltin(tool.connector) && !tool.dev) {
    const denied = await scopeDenied(ctx.userId, grant, tool, null);
    if (denied) { await record(ctx, tool, input, "rejected", { error: denied }).catch(() => null); return { kind: "refused", tool: tool.name, text: denied }; }
  }
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) {
    await record(ctx, tool, input, "rejected", { error: "The request was missing details." }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: `the ${info.name} request was missing details (${parsed.error.issues[0]?.path.join(".") || "input"})` };
  }
  const limits = ctx.proposal
    ? { perTxUsd: Math.min(grant.perTxUsd, ctx.proposal.perTxUsd), dailyUsd: Math.min(grant.dailyUsd, ctx.proposal.dailyUsd), maxSlippageBps: grant.maxSlippageBps }
    : { perTxUsd: grant.perTxUsd, dailyUsd: grant.dailyUsd, maxSlippageBps: grant.maxSlippageBps };
  if (tool.risk === "read") {
    try {
      const r = await tool.run!(parsed.data as never, ctx.agent, { convo: ctx.convo, messageId: ctx.messageId });
      await record(ctx, tool, parsed.data, "done", { preview: { title: r.summary, rows: [], network: "" } });
      // A third-party tool handed back an intent: the matching built-in sign tool prepares a Confirm card, inside
      // the person's grant and limits and the lower third-party caps, labelled with who proposed it.
      if (r.intent && tool.dev) {
        if (ctx.untrusted) return { kind: "refused", tool: tool.name, text: "I won't propose a payment while reading content you didn't write" };
        const call = intentToCall(r.intent);
        const proposal: DevProposal = { label: tool.dev.label, listingId: tool.dev.listingId, perTxUsd: DEV_CAPS.perTxUsd, dailyUsd: DEV_CAPS.dailyUsd };
        const out = await runCall({ ...ctx, proposal }, grants, call.tool, call.input);
        return out.kind === "action" ? out : { kind: "refused", tool: tool.name, text: `${r.text ? `${r.text.slice(0, 300)} ` : ""}(the proposal didn't go through: ${out.kind === "refused" ? out.text : "it couldn't be prepared"})` };
      }
      return { kind: "read", tool: tool.name, ok: true, text: r.text, markets: r.markets };
    } catch (e) {
      const why = e instanceof Reject ? e.message : `${info.name} didn't answer right now`;
      if (!(e instanceof Reject)) console.error(`[integrations] ${tool.name}: ${(e as Error).message?.slice(0, 200)}`);
      await record(ctx, tool, parsed.data, "failed", { error: why }).catch(() => null);
      return { kind: "read", tool: tool.name, ok: false, text: why };
    }
  }
  // The agent's own settings change only when the person asks in this turn, never from email or web content it read.
  if (tool.offchain && ctx.untrusted) {
    await record(ctx, tool, parsed.data, "rejected", { error: "Asked while reading content the person didn't write." }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: "I only change my own settings when you ask me directly, not from content I read" };
  }
  // sign: prepare a confirm card, inside the limits
  let prep;
  try {
    if (!isDevnet() && !tool.offchain) throw new Reject("Lexari runs integrations on devnet and testnets only right now, so nothing can execute here.");
    prep = await tool.prepare!(parsed.data as never, ctx.agent, limits);
  } catch (e) {
    const why = e instanceof Reject ? e.message : "I couldn't get a live quote right now. Try again in a moment.";
    if (!(e instanceof Reject)) console.error(`[integrations] prepare ${tool.name}: ${(e as Error).message?.slice(0, 200)}`);
    await record(ctx, tool, parsed.data, "rejected", { error: why });
    return { kind: "refused", tool: tool.name, text: why };
  }
  const nansen = await nansenRowFor(tool.name, parsed.data);
  const preview: Preview = { title: prep.title, rows: nansen ? [...prep.rows, nansen] : prep.rows, network: netOf(prep.chain), plan: prep.plan, summary: prep.summary };
  if (ctx.proposal) {
    preview.rows = [["Proposed by", ctx.proposal.label], ...preview.rows, ["Agent caps", `$${ctx.proposal.perTxUsd} each, $${ctx.proposal.dailyUsd} a day for third-party agents`]];
    preview.dev = { listingId: ctx.proposal.listingId, label: ctx.proposal.label, perTxUsd: ctx.proposal.perTxUsd, dailyUsd: ctx.proposal.dailyUsd };
    const over = await devCapExceeded(ctx.userId, ctx.agent.slug, prep.usdMicros, ctx.proposal);
    if (over) { await record(ctx, tool, parsed.data, "rejected", { preview, usdMicros: prep.usdMicros, error: over, chain: prep.chain }); return { kind: "refused", tool: tool.name, text: over }; }
  }
  if (!isBuiltin(tool.connector)) {
    const denied = await scopeDenied(ctx.userId, grant, tool, prep.plan);
    if (denied) {
      await record(ctx, tool, parsed.data, "rejected", { preview, usdMicros: prep.usdMicros, error: denied, chain: prep.chain });
      return { kind: "refused", tool: tool.name, text: denied };
    }
  }
  const toOwn = !!(prep.plan as { to?: string } | undefined)?.to && (await isOwnWallet(ctx.userId, (prep.plan as { to: string }).to).catch(() => false));
  if (toOwn) preview.rows = [...preview.rows, ["Destination", "Your linked wallet"]];
  // The agent's own settings move no money: straight to a Confirm card.
  if (tool.offchain) {
    const row = await record(ctx, tool, parsed.data, "prepared", { preview, usdMicros: 0, chain: prep.chain });
    return { kind: "action", tool: tool.name, card: cardOf(row) };
  }
  // Settings > Security: the daily money limit and "saved addresses only" apply to everything an agent prepares.
  let guard: SendCheck;
  try { guard = await checkMoney(ctx.userId, { usdMicros: prep.usdMicros, to: toOwn ? null : (prep.plan as { to?: string } | undefined)?.to ?? null }); }
  catch (e) {
    if (!(e instanceof HttpError)) throw e;
    await record(ctx, tool, parsed.data, "rejected", { preview, usdMicros: prep.usdMicros, error: e.message, chain: prep.chain });
    return { kind: "refused", tool: tool.name, text: e.message };
  }
  if (toOwn) guard = { ...guard, firstTime: false };
  if (guard.firstTime) preview.rows = [...preview.rows, ["Heads up", "You've never sent to this address. Check every character before you confirm."]];
  if (tool.auto && (guard.firstTime || ctx.untrusted)) {
    // A new payee, or a turn that read email or web content: always your Confirm, never on its own.
    const row = await record(ctx, tool, parsed.data, "prepared", { preview: { ...preview, rows: [...preview.rows, ["Why you're asked", guard.firstTime ? "It's a new payee" : "This came up while reading content you didn't write"]] }, usdMicros: prep.usdMicros, chain: prep.chain });
    return { kind: "action", tool: tool.name, card: cardOf(row) };
  }
  if (tool.auto) {
    // Agent payments always wait for your Confirm card; going over the agent's budget is called out on it.
    const why = await overBudget(ctx.userId, ctx.agent.slug, prep.usdMicros);
    const rows: [string, string][] = why ? [...preview.rows, ["Why you're asked", why[0].toUpperCase() + why.slice(1)]] : preview.rows;
    const row = await record(ctx, tool, parsed.data, "prepared", { preview: { ...preview, rows }, usdMicros: prep.usdMicros, chain: prep.chain });
    return { kind: "action", tool: tool.name, card: cardOf(row) };
  }
  const over = await overLimit(ctx.userId, info.name, grant, prep.usdMicros);
  if (over) {
    await record(ctx, tool, parsed.data, "rejected", { preview, usdMicros: prep.usdMicros, error: over, chain: prep.chain });
    return { kind: "refused", tool: tool.name, text: over };
  }
  const row = await record(ctx, tool, parsed.data, "prepared", { preview, usdMicros: prep.usdMicros, chain: prep.chain });
  return { kind: "action", tool: tool.name, card: cardOf(row) };
}

const netOf = (chain: string) => (isEvmChain(chain) ? EVM[chain].network : chain === "polygon" ? "Polygon mainnet" : chain === "tempo" ? TEMPO.network : chain === "panta" ? "Panta (paper, devnet)" : chain === "lexari" ? "Lexari settings" : chain === "hyperliquid" ? HL_NETWORK : chain === "monad" ? "Monad testnet" : chain === "intents" ? "Aurora Intents" : network());

/** The chat receipt row for something that moved money (agent payments, Tempo). */
async function receipt(userId: string, a: typeof integrationActions.$inferSelect, r: Executed) {
  if (!r.receipt || !a.convo) return;
  await recordTx(userId, a.convo, {
    id: `int-${a.id}`.slice(0, 36), kind: a.tool === "tempo.topup" ? "topup" : a.tool.startsWith("tempo.") ? "send" : "pay", status: a.status === "confirmed" ? "confirmed" : "pending", sol: 0, at: Date.now(),
    agent: a.agentSlug, amount: r.receipt.amount, label: r.receipt.label, ...(r.text ? { detail: r.text.slice(0, 1800) } : {}), ...(r.receipt.net ? { net: r.receipt.net } : {}), ...(r.sig ? { sig: r.sig } : {}), ...(r.receipt.url ? { url: r.receipt.url } : {}),
  }).catch((e) => console.error(`[integrations] receipt: ${(e as Error).message?.slice(0, 200)}`));
}

async function overLimit(userId: string, name: string, g: Grant, micros: number, tx = db()) {
  if (micros > g.perTxUsd * 1e6) return `That's ${usd(micros)}, over your $${g.perTxUsd} per trade limit for ${name}.`;
  const spent = await spentToday(userId, g.connector, tx);
  if (spent + micros > g.dailyUsd * 1e6) return `That would take today's ${name} total to ${usd(spent + micros)}, over your $${g.dailyUsd} daily limit (${usd(spent)} used so far).`;
  return null;
}

/** Third-party caps: per proposal, and today's total of everything this agent proposed that is being sent or was sent. */
export async function devCapExceeded(userId: string, agentSlug: string, micros: number, caps: { perTxUsd: number; dailyUsd: number }, tx = db()) {
  if (micros > caps.perTxUsd * 1e6) return `That's ${usd(micros)}, over the $${caps.perTxUsd} cap for payments a third-party agent proposes.`;
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const [r] = await tx.select({ v: sql<string>`coalesce(sum(${integrationActions.usdMicros}), 0)` }).from(integrationActions)
    .where(and(eq(integrationActions.userId, userId), eq(integrationActions.agentSlug, agentSlug), inArray(integrationActions.status, [...COUNTED]), gte(integrationActions.createdAt, start), sql`${integrationActions.preview} ? 'dev'`));
  const spent = Number(r?.v || 0);
  if (spent + micros > caps.dailyUsd * 1e6) return `That would take today's proposals from this agent to ${usd(spent + micros)}, over the $${caps.dailyUsd} daily cap for third-party agents.`;
  return null;
}

async function ownAction(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "There's no such action.");
  const [a] = await db().select().from(integrationActions).where(and(eq(integrationActions.userId, userId), eq(integrationActions.id, id))).limit(1);
  if (!a) throw new HttpError(404, "There's no such action.");
  return a;
}

/** Keeps the saved chat message in step with the action, so a reload shows the result. */
async function syncMessage(a: typeof integrationActions.$inferSelect) {
  if (!a.convo || !a.messageId) return;
  const card = cardOf(a);
  await db().update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ action: card })}::jsonb` })
    .where(and(eq(messages.clientId, a.messageId), sql`${messages.chatId} in (select ${chats.id} from ${chats} where ${chats.userId} = ${a.userId} and ${chats.slug} = ${a.convo})`)).catch(() => {});
}

async function finish(id: string, set: Partial<typeof integrationActions.$inferInsert>) {
  const [a] = await db().update(integrationActions).set({ ...set, settledAt: new Date() }).where(eq(integrationActions.id, id)).returning();
  await syncMessage(a);
  return a;
}

/** The person tapped Confirm: every rule is checked again, then Lexari executes it from the agent's own wallet. */
export async function confirmAction(userId: string, id: string): Promise<ActionCard> {
  const a = await ownAction(userId, id);
  if (a.status !== "prepared") return cardOf(a.status === "submitted" ? await settle(a) : a);
  const tool = toolByName(a.tool);
  const info = integrationById(a.connector);
  if (!tool?.execute || !info) return cardOf(await finish(a.id, { status: "failed", error: "This integration can't run that any more." }));
  if (Date.now() - a.createdAt.getTime() > EXPIRE_MS) return cardOf(await finish(a.id, { status: "expired", error: "This quote expired. Ask again for a fresh one." }));
  if (!isDevnet() && !tool.offchain) return cardOf(await finish(a.id, { status: "rejected", error: "Execution is off: devnet and testnets only." }));
  if (!(await rateLimit(`int:confirm:${userId}`, CONFIRMS_PER_HOUR, 3_600_000))) throw new HttpError(429, "That's a lot of transactions this hour. Wait a bit and try again.");
  const agentRow = await ownAgent(userId, a.agentSlug).catch(() => null);
  if (!agentRow) return cardOf(await finish(a.id, { status: "rejected", error: "That agent isn't on your team any more." }));
  // Re-check the grant and the limits under a per-person lock, then mark it as being sent (which counts toward today).
  const gate = await db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`integration:${userId}:${a.connector}`}))`);
    if (isBuiltin(a.connector)) {
      // Built-in (agent payments): your Confirm is the approval for going over the agent's budget.
      const [moved] = await tx.update(integrationActions).set({ status: "submitting" }).where(and(eq(integrationActions.id, a.id), eq(integrationActions.status, "prepared"))).returning({ id: integrationActions.id });
      return moved ? null : "busy";
    }
    const [g] = await tx.select().from(integrationGrants).where(and(eq(integrationGrants.userId, userId), eq(integrationGrants.connector, a.connector))).limit(1);
    if (!g) return `${info.name} was removed, so this can't run.`;
    if (!g.enabled) return `${info.name} is switched off in Settings > Integrations.`;
    if (!g.agentSlugs.includes(a.agentSlug)) return `This agent no longer has access to ${info.name}.`;
    const denied = await scopeDenied(userId, g, tool, ((a.preview || {}) as Preview).plan);
    if (denied) return denied;
    const over = await overLimit(userId, info.name, g, a.usdMicros, tx as never);
    if (over) return over;
    const dev = ((a.preview || {}) as Preview).dev;
    if (dev) {
      const devOver = await devCapExceeded(userId, a.agentSlug, a.usdMicros, dev, tx as never);
      if (devOver) return devOver;
    }
    const [moved] = await tx.update(integrationActions).set({ status: "submitting" }).where(and(eq(integrationActions.id, a.id), eq(integrationActions.status, "prepared"))).returning({ id: integrationActions.id });
    return moved ? null : "busy";
  });
  if (gate === "busy") return cardOf(await ownAction(userId, id));
  if (gate) return cardOf(await finish(a.id, { status: "rejected", error: gate }));
  const plan = ((a.preview || {}) as Preview).plan || {};
  try {
    const r = await tool.execute(plan as never, agentRef(userId, agentRow));
    const preview = { ...((a.preview || {}) as Preview), ...(r.rows ? { result: r.rows } : {}) };
    const done = await finish(a.id, { status: r.confirmed ? "confirmed" : "submitted", txSig: r.sig || null, preview });
    await receipt(userId, done, r);
    return cardOf(done);
  } catch (e) {
    if (e instanceof ChainError) return cardOf(await finish(a.id, { status: "failed", txSig: e.sig, error: e.message }));
    const why = e instanceof SimError || e instanceof Reject ? e.message : "It didn't go through. Nothing was sent.";
    if (!(e instanceof SimError || e instanceof Reject)) console.error(`[integrations] execute ${a.tool}: ${(e as Error).message?.slice(0, 300)}`);
    return cardOf(await finish(a.id, { status: "failed", error: why }));
  }
}

export async function cancelAction(userId: string, id: string): Promise<ActionCard> {
  const a = await ownAction(userId, id);
  if (a.status !== "prepared") return cardOf(a);
  const [moved] = await db().update(integrationActions).set({ status: "cancelled", settledAt: new Date() }).where(and(eq(integrationActions.id, a.id), eq(integrationActions.status, "prepared"))).returning();
  if (moved) await syncMessage(moved);
  return cardOf(moved || (await ownAction(userId, id)));
}

/** A transaction that was sent but not yet confirmed: check it on chain. */
async function settle(a: typeof integrationActions.$inferSelect) {
  if (a.status !== "submitted" || !a.txSig || a.chain === "lexari" || a.chain === "hyperliquid" || a.chain === "intents" || a.chain === "polygon") return a;
  if (isEvmChain(a.chain)) {
    if (!a.txSig.startsWith("0x")) return a;
    const st = await evmTxState(a.chain, a.txSig).catch(() => "pending" as const);
    if (st === "confirmed") return finish(a.id, { status: "confirmed" });
    if (st === "failed") return finish(a.id, { status: "failed", error: `The transaction failed on ${EVM[a.chain].network}.` });
    if (Date.now() - a.createdAt.getTime() > 10 * 60_000) return finish(a.id, { status: "failed", error: "The transaction never landed. Nothing moved." });
    return a;
  }
  if (a.chain === "tempo") {
    const rc = await tempoReceipt(a.txSig).catch(() => null);
    if (rc?.status === "0x1") return finish(a.id, { status: "confirmed" });
    if (rc?.status) return finish(a.id, { status: "failed", error: "The transfer failed on Tempo." });
    if (Date.now() - a.createdAt.getTime() > 10 * 60_000) return finish(a.id, { status: "failed", error: "The transfer never landed. Nothing moved." });
    return a;
  }
  const st = (await connection().getSignatureStatuses([a.txSig], { searchTransactionHistory: true }).catch(() => null))?.value[0];
  if (st?.err) return finish(a.id, { status: "failed", error: "The transaction failed on Solana." });
  if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return finish(a.id, { status: "confirmed" });
  if (Date.now() - a.createdAt.getTime() > 10 * 60_000 && !st) return finish(a.id, { status: "failed", error: "The transaction never landed. Nothing moved." });
  return a;
}

export async function actionCard(userId: string, id: string) {
  return cardOf(await settle(await ownAction(userId, id)));
}

export { COUNTED };
