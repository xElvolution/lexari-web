/**
 * Running integration tools for an agent, with every rule applied on the server:
 *  - the social gate, the grant (added, switched on, this agent allowed) on every call and again at Confirm;
 *  - per-trade and daily dollar limits (summed from today's integration_actions under a per-person lock at Confirm);
 *  - devnet / testnet only: sign tools refuse to run on mainnet;
 *  - every call is recorded in integration_actions (reads as "done", refusals as "rejected" with the reason).
 * Sign tools never execute from chat: they make a confirm card, and only the person's Confirm runs them.
 */
import { and, eq, sql } from "drizzle-orm";
import { integrationById, type ActionCard, type MarketsCard } from "@/content/integrations";
import { db } from "../db";
import { chats, messages } from "../db/schema";
import { integrationActions, integrationGrants } from "../db/integrationsSchema";
import { HttpError, rateLimit } from "../http";
import { connection } from "../hub/chain";
import { ownAgent, solanaKeypair } from "../agentWallets";
import { hasVerifiedSocial } from "../social";
import { COUNTED, isBuiltin, spentToday, type Grant } from "./grants";
import { overBudget } from "../agentpay/budgets";
import { recordTx } from "../txlog";
import { TEMPO, tempoReceipt } from "./tempo";
import type { Executed } from "./registry";
import { Reject, toolByName, type AgentRef, type ToolDef } from "./registry";
import { ChainError, SimError, isDevnet, network } from "./solana";
import { cardOf, type Preview } from "./cards";
import { checkMoney, type SendCheck } from "../security";

const EXPIRE_MS = 15 * 60_000;
const CONFIRMS_PER_HOUR = Number(process.env.INTEGRATION_CONFIRMS_PER_HOUR || 30);
const usd = (micros: number) => `$${(micros / 1e6).toFixed(2)}`;

export function agentRef(userId: string, a: { slug: string; kind: string; name: string; meta?: unknown }): AgentRef {
  let kp: ReturnType<typeof solanaKeypair> | null = null;
  return { userId, slug: a.slug, kind: a.kind, name: (a.meta as { nick?: string } | null)?.nick || a.name, keypair: () => (kp ??= solanaKeypair(userId, a.slug, a.kind)) };
}

/** untrusted: this turn read content the person didn't write (email, web pages), so nothing pays on its own. */
type Ctx = { userId: string; agent: AgentRef; convo: string; messageId: string; untrusted?: boolean };
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

/** One tool call from the agent's reply. `grants` are the integrations this agent may use right now. */
export async function runCall(ctx: Ctx, grants: Grant[], name: string, input: unknown): Promise<CallResult> {
  const tool = toolByName(name);
  if (!tool) return { kind: "refused", tool: name, text: `there's no Lexari integration tool called ${name.slice(0, 40)}` };
  const info = integrationById(tool.connector)!;
  const grant = grants.find((g) => g.connector === tool.connector);
  if (!grant) {
    await record(ctx, tool, input, "rejected", { error: `${info.name} isn't available to this agent.` }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: `I don't have access to ${info.name}. In Settings > Integrations, add it (or switch it on) and give me access` };
  }
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) {
    await record(ctx, tool, input, "rejected", { error: "The request was missing details." }).catch(() => null);
    return { kind: "refused", tool: tool.name, text: `the ${info.name} request was missing details (${parsed.error.issues[0]?.path.join(".") || "input"})` };
  }
  const limits = { perTxUsd: grant.perTxUsd, dailyUsd: grant.dailyUsd, maxSlippageBps: grant.maxSlippageBps };
  if (tool.risk === "read") {
    try {
      const r = await tool.run!(parsed.data as never, ctx.agent);
      await record(ctx, tool, parsed.data, "done", { preview: { title: r.summary, rows: [], network: "" } });
      return { kind: "read", tool: tool.name, ok: true, text: r.text, markets: r.markets };
    } catch (e) {
      const why = e instanceof Reject ? e.message : `${info.name} didn't answer right now`;
      if (!(e instanceof Reject)) console.error(`[integrations] ${tool.name}: ${(e as Error).message?.slice(0, 200)}`);
      await record(ctx, tool, parsed.data, "failed", { error: why }).catch(() => null);
      return { kind: "read", tool: tool.name, ok: false, text: why };
    }
  }
  // sign: prepare a confirm card, inside the limits
  let prep;
  try {
    if (!isDevnet()) throw new Reject("Lexari runs integrations on devnet and testnets only right now, so nothing can execute here.");
    prep = await tool.prepare!(parsed.data as never, ctx.agent, limits);
  } catch (e) {
    const why = e instanceof Reject ? e.message : "I couldn't get a live quote right now. Try again in a moment.";
    if (!(e instanceof Reject)) console.error(`[integrations] prepare ${tool.name}: ${(e as Error).message?.slice(0, 200)}`);
    await record(ctx, tool, parsed.data, "rejected", { error: why });
    return { kind: "refused", tool: tool.name, text: why };
  }
  const preview: Preview = { title: prep.title, rows: prep.rows, network: netOf(prep.chain), plan: prep.plan, summary: prep.summary };
  // Settings > Security: the daily money limit and "saved addresses only" apply to everything an agent prepares.
  let guard: SendCheck;
  try { guard = await checkMoney(ctx.userId, { usdMicros: prep.usdMicros, to: (prep.plan as { to?: string } | undefined)?.to ?? null }); }
  catch (e) {
    if (!(e instanceof HttpError)) throw e;
    await record(ctx, tool, parsed.data, "rejected", { preview, usdMicros: prep.usdMicros, error: e.message, chain: prep.chain });
    return { kind: "refused", tool: tool.name, text: e.message };
  }
  if (guard.firstTime) preview.rows = [...preview.rows, ["Heads up", "You've never sent to this address. Check every character before you confirm."]];
  if (tool.auto && (guard.firstTime || ctx.untrusted)) {
    // A new payee, or a turn that read email or web content: always your Confirm, never on its own.
    const row = await record(ctx, tool, parsed.data, "prepared", { preview: { ...preview, rows: [...preview.rows, ["Why you're asked", guard.firstTime ? "It's a new payee" : "This came up while reading content you didn't write"]] }, usdMicros: prep.usdMicros, chain: prep.chain });
    return { kind: "action", tool: tool.name, card: cardOf(row) };
  }
  if (tool.auto) {
    // Inside the agent's budget it pays on its own (with a receipt); over it, you get a Confirm card.
    const why = await overBudget(ctx.userId, ctx.agent.slug, prep.usdMicros);
    if (!why) return autoRun(ctx, tool, parsed.data, preview, prep);
    const row = await record(ctx, tool, parsed.data, "prepared", { preview: { ...preview, rows: [...preview.rows, ["Why you're asked", why[0].toUpperCase() + why.slice(1)]] }, usdMicros: prep.usdMicros, chain: prep.chain });
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

const netOf = (chain: string) => (chain === "tempo" ? TEMPO.network : chain === "panta" ? "Panta (paper, devnet)" : network());

/** A payment inside the agent's budget: counted toward today first, then executed, with a receipt in the chat. */
async function autoRun(ctx: Ctx, tool: ToolDef, input: unknown, preview: Preview, prep: { usdMicros: number; chain: string; summary: string }): Promise<CallResult> {
  const row = await record(ctx, tool, input, "submitting", { preview, usdMicros: prep.usdMicros, chain: prep.chain });
  try {
    const r = await tool.execute!(preview.plan as never, ctx.agent);
    const a = await finish(row.id, { status: r.confirmed ? "confirmed" : "submitted", txSig: r.sig || null, preview: { ...preview, ...(r.rows ? { result: r.rows } : {}) } });
    await receipt(ctx.userId, a, r);
    return { kind: "read", tool: tool.name, ok: true, text: r.text || `${prep.summary}.` };
  } catch (e) {
    const why = e instanceof SimError || e instanceof Reject ? e.message : e instanceof ChainError ? e.message : "It didn't go through. Nothing was paid.";
    if (!(e instanceof SimError || e instanceof Reject)) console.error(`[integrations] auto ${tool.name}: ${(e as Error).message?.slice(0, 300)}`);
    await finish(row.id, { status: "failed", error: why, ...(e instanceof ChainError && e.sig ? { txSig: e.sig } : {}) });
    return { kind: "read", tool: tool.name, ok: false, text: why };
  }
}

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
  if (!isDevnet()) return cardOf(await finish(a.id, { status: "rejected", error: "Execution is off: devnet and testnets only." }));
  if (!isBuiltin(a.connector) && !(await hasVerifiedSocial(userId))) throw new HttpError(403, "Link an X, Discord or Telegram account in Settings to use integrations.");
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
    const over = await overLimit(userId, info.name, g, a.usdMicros, tx as never);
    if (over) return over;
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
  if (a.status !== "submitted" || !a.txSig) return a;
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
