/**
 * Integrations inside a chat turn. The agent only hears about (and can only use) integrations the person added,
 * switched on and granted to THIS agent, behind a linked social account. It calls one with a tag:
 *   <tool name="orca.swap">{"sell":"USDC","buy":"SOL","amount":1}</tool>
 * Read tools answer the agent with live data; sign tools become a confirm card the person approves.
 */
import { integrationById, type ActionCard, type MarketsCard } from "@/content/integrations";
import { TOOLS, toolByName } from "./registry";
import { runCall, type CallResult } from "./actions";
import { spentToday, usableGrants, type Grant } from "./grants";
import { agentSpentToday, budgetOf } from "../agentpay/budgets";
import type { AgentRef } from "./registry";

export const INTEGRATIONS_MARK = "[lexari-integrations]";
const MAX_CALLS = 2;

const ORE_HINT = "You are the ORE Miner. Facts: ORE (ore.supply) is a Solana mainnet token; today it's mined by deploying SOL on a 5x5 board each round (the old CPU proof-of-work miner, ore-cli legacy, is retired). Lexari never mines on its own machines: the person connects a server they own (your profile > Mining > Connect a server gives a one-line install), and you install, start, stop and watch the miner there with ore.control and ore.servers. On devnet the miner runs in practice mode: real keccak hashing on their CPU with real hashrate and best difficulty, but no ORE rewards; mainnet mining comes later. Never claim ORE was earned. Always check ore.servers before saying how a miner is doing.";

export type TurnTools = { social: boolean; grants: Grant[]; hint: string };

/** What this agent may use this turn, and the prompt lines that tell it so. */
export async function turnTools(userId: string, slug: string): Promise<TurnTools> {
  const { social, grants } = await usableGrants(userId, slug).catch(() => ({ social: false, grants: [] as Grant[] }));
  const tools = TOOLS.filter((t) => grants.some((g) => g.connector === t.connector));
  const none = "If the person asks you to trade, swap, send crypto, check prediction markets, prices or another chain, say you don't have that integration yet and they can add it in Settings > Integrations and give you access. Never pretend to use one.";
  if (!tools.length) return { social, grants, hint: `${INTEGRATIONS_MARK} ${none}` };
  const limits = await Promise.all(grants.filter((g) => integrationById(g.connector)?.moves && !integrationById(g.connector)?.builtin).map(async (g) => {
    const used = (await spentToday(userId, g.connector).catch(() => 0)) / 1e6;
    return `${integrationById(g.connector)!.name}: $${g.perTxUsd} per trade, $${g.dailyUsd} a day ($${used.toFixed(2)} used today)${integrationById(g.connector)!.category === "trading" ? `, max slippage ${g.maxSlippageBps / 100}%` : ""}`;
  }));
  let budget = "";
  if (grants.some((g) => g.connector === "payments")) {
    const [b, spent] = await Promise.all([budgetOf(userId, slug), agentSpentToday(userId, slug)]).catch(() => [null, 0] as const);
    if (b) budget = `Your own budget for payments (pay.service, pay.agent): $${(b.perTaskMicros / 1e6).toFixed(2)} per task and $${(b.dailyMicros / 1e6).toFixed(2)} a day ($${(Number(spent) / 1e6).toFixed(2)} used today). Inside it you pay on your own and get the result back; over it, Lexari shows the person a Confirm card. Only pay when it actually helps the person's request.`;
  }
  const hint = [
    INTEGRATIONS_MARK,
    "You can use these Lexari integrations the person added for you. To use one, write one tag with JSON input, at most two per reply:",
    "<tool name=\"TOOL\">{...json...}</tool>",
    "Tools:",
    ...tools.map((t) => `- ${t.hint}`),
    ...(limits.length ? [`Spending limits the person set: ${limits.join("; ")}. Lexari enforces them; stay inside them.`] : []),
    ...(budget ? [budget] : []),
    ...(grants.some((g) => g.connector === "ore") ? [ORE_HINT] : []),
    "Read tools return live data to you, then you answer. Sign tools only prepare a Confirm card for the person: nothing moves until they tap Confirm, so say it's ready to confirm and never claim it went through. Everything runs on devnet or testnets with test funds, not real money.",
    "Only use a tool when the person asks for something it does. Never invent addresses, prices or results.",
    `For anything not listed: ${none}`,
  ].join("\n");
  return { social, grants, hint };
}

/** <tool name="x">{json}</tool>, <tool name="x"/> and <tool name="x"></tool>. */
export function toolTags(text: string): { name: string; input: unknown }[] {
  const out: { name: string; input: unknown }[] = [];
  for (const m of text.matchAll(/<tool\s+name=["']?([a-z0-9_.-]{2,40})["']?\s*(?:\/>|>([\s\S]*?)<\/tool>)/gi)) {
    const body = (m[2] || "").trim().replace(/^```(?:json)?|```$/g, "").trim();
    let input: unknown = {};
    if (body) { try { input = JSON.parse(body); } catch { input = { _raw: body.slice(0, 200) }; } }
    out.push({ name: m[1].toLowerCase(), input });
  }
  return out.slice(0, MAX_CALLS);
}
export const hasToolTag = (t: string) => /<tool\s+name=/i.test(t);
export const stripToolTags = (t: string) => t.replace(/<tool\b[^>]*\/>/gi, "").replace(/<tool\b[^>]*>[\s\S]*?<\/tool>/gi, "").replace(/<tool\b[^>]*>[\s\S]*$/i, "").replace(/[ \t]+\n/g, "\n").trim();

export type TurnResult = { facts: string[]; notes: string[]; actions: ActionCard[]; markets: MarketsCard | null; reads: number };

export async function runTurnTools(userId: string, agent: AgentRef, tt: TurnTools, text: string, ctx: { convo: string; messageId: string }): Promise<TurnResult> {
  const calls = toolTags(text);
  const out: TurnResult = { facts: [], notes: [], actions: [], markets: null, reads: 0 };
  for (const c of calls) {
    let r: CallResult;
    if (out.actions.length && toolByName(c.name)?.risk === "sign") { out.notes.push("one transaction at a time, so I only prepared the first"); continue; }
    try { r = await runCall({ userId, agent, ...ctx }, tt.grants, c.name, c.input); }
    catch (e) { console.error(`[integrations] ${c.name}: ${(e as Error).message?.slice(0, 200)}`); r = { kind: "refused", tool: c.name, text: "that integration didn't answer right now" }; }
    if (r.kind === "read") { out.reads++; out.facts.push(`${r.tool}: ${r.ok ? r.text : `couldn't get it (${r.text})`}`); if (r.ok && r.markets) out.markets = r.markets; }
    else if (r.kind === "action") { out.actions.push(r.card); out.facts.push(`${r.tool}: a Confirm card is ready for the person (${r.card.title}). Nothing has moved yet.`); }
    else { const t = r.text.replace(/[.\s]+$/, ""); out.notes.push(t); out.facts.push(`${r.tool}: refused: ${t}.`); }
  }
  return out;
}
