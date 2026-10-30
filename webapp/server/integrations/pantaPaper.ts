/**
 * Panta paper positions (devnet): a position is a confirmed panta.position action at Panta's real quote; closing one
 * is a confirmed panta.close action at the live price. No money moves either way, and every card says "paper".
 *   panta.positions : open positions marked to Panta's live prices, with unrealized and realized P&L. Read only.
 *   panta.close     : close one open position at the live price; the Confirm card shows the P&L first.
 * A position can be closed once: the close re-checks under a per-position lock at Confirm.
 */
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { integrationActions } from "../db/integrationsSchema";
import { PantaError, pantaMarket, pantaReady } from "./panta";
import { Reject } from "./reject";
import type { AgentRef, Executed, Prepared, ToolDef } from "./registry";

export type PaperPosition = { id: string; market: string; title: string; side: "yes" | "no"; amount: number; shares: number; avgPrice: number; at: number };
type ClosePlan = { kind: "panta-close"; position: string; market: string; title: string; side: "yes" | "no"; shares: number; amount: number; price: number; proceeds: number; pnl: number };

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
const cents = (p: number) => `${(p * 100).toFixed(1)}¢`;
const planOf = (r: typeof integrationActions.$inferSelect) => ((r.preview as { plan?: Record<string, unknown> } | null)?.plan || {}) as Record<string, unknown>;

/** Confirmed closes for this agent, keyed by the position they closed. */
async function closesOf(userId: string, slug: string) {
  const rows = await db().select().from(integrationActions).where(and(eq(integrationActions.userId, userId), eq(integrationActions.agentSlug, slug), eq(integrationActions.tool, "panta.close"), eq(integrationActions.status, "confirmed")));
  return new Map(rows.map((r) => [String(planOf(r).position), planOf(r) as unknown as ClosePlan]));
}

/** The agent's open paper positions, newest first. */
export async function openPositions(userId: string, slug: string): Promise<PaperPosition[]> {
  const [rows, closed] = await Promise.all([
    db().select().from(integrationActions).where(and(eq(integrationActions.userId, userId), eq(integrationActions.agentSlug, slug), eq(integrationActions.tool, "panta.position"), eq(integrationActions.status, "confirmed"))).orderBy(desc(integrationActions.createdAt)).limit(50),
    closesOf(userId, slug),
  ]);
  return rows.filter((r) => !closed.has(r.id)).map((r) => {
    const p = planOf(r);
    return { id: r.id, market: String(p.market), title: String(p.title), side: p.side === "no" ? "no" : "yes", amount: Number(p.amount) || 0, shares: Number(p.shares) || 0, avgPrice: Number(p.avgPrice) || 0, at: r.createdAt.getTime() };
  });
}

/** "1", a market id, a few words of the title, or the position id: which open position the person means. */
export function pickPosition(list: PaperPosition[], ref: string): PaperPosition {
  if (!list.length) throw new Reject("There are no open Panta positions to close.");
  const q = ref.trim().toLowerCase();
  const n = /^\d{1,2}$/.test(q) ? Number(q) : NaN;
  const hits = Number.isInteger(n) && n >= 1 && n <= list.length ? [list[n - 1]]
    : list.filter((p) => p.id === q || p.market.toLowerCase() === q || (q.length >= 3 && p.title.toLowerCase().includes(q)));
  if (!hits.length) throw new Reject(`I couldn't find an open Panta position matching "${ref.slice(0, 40)}". panta.positions lists them by number.`);
  if (hits.length > 1) throw new Reject(`That matches ${hits.length} open positions. Say which one by its number from panta.positions.`);
  return hits[0];
}

async function livePrice(p: PaperPosition) {
  const m = await pantaMarket(p.market).catch((e) => { throw new Reject(e instanceof PantaError ? e.message : "Panta didn't answer. Try again in a moment."); });
  return p.side === "yes" ? m.yes : m.no;
}

export const pantaPositions: ToolDef = {
  name: "panta.positions", connector: "panta", risk: "read", input: z.object({}).passthrough(),
  hint: `panta.positions {} : your open Panta positions (paper on devnet), numbered, marked to live prices with profit and loss.`,
  run: async (_i: never, agent: AgentRef) => {
    const [open, closed] = await Promise.all([openPositions(agent.userId, agent.slug), closesOf(agent.userId, agent.slug)]);
    const realized = [...closed.values()].reduce((s, c) => s + (Number(c.pnl) || 0), 0);
    if (!open.length) return { summary: "Checked its Panta positions", text: `No open Panta positions.${closed.size ? ` Closed so far: ${closed.size}, realized P&L ${signed(realized)} (paper).` : ""}` };
    const marks = await Promise.all(open.map((p) => (pantaReady() ? livePrice(p).catch(() => null) : Promise.resolve(null))));
    let stake = 0, value = 0, priced = 0;
    const lines = open.map((p, i) => {
      const now = marks[i];
      stake += p.amount;
      if (now === null) return `${i + 1}. ${p.side.toUpperCase()} "${p.title}": ${usd(p.amount)} for ${+p.shares.toFixed(4)} shares at ${cents(p.avgPrice)} (live price unavailable)`;
      const v = p.shares * now; value += v; priced += p.amount;
      return `${i + 1}. ${p.side.toUpperCase()} "${p.title}": ${usd(p.amount)} for ${+p.shares.toFixed(4)} shares at ${cents(p.avgPrice)}, now ${cents(now)}, worth ${usd(v)} (${signed(v - p.amount)})`;
    });
    return { summary: "Checked its Panta positions", text: `Your open Panta positions (paper, devnet; no money moved):\n${lines.join("\n")}\nTotal staked ${usd(stake)}${priced ? `, marked value ${usd(value)}, unrealized ${signed(value - priced)}` : ""}${closed.size ? `. Realized so far ${signed(realized)} on ${closed.size} closed` : ""}.` };
  },
};

const closeIn = z.object({ position: z.union([z.string(), z.number()]).transform(String) }).passthrough();
export const pantaClose: ToolDef = {
  name: "panta.close", connector: "panta", risk: "sign", input: closeIn,
  hint: `panta.close {"position":"1"} : close one open Panta position (its number from panta.positions, or its market) at the live price; the person confirms it (paper on devnet).`,
  prepare: async (i: z.output<typeof closeIn>, agent: AgentRef): Promise<Prepared> => {
    if (!pantaReady()) throw new Reject("Panta isn't connected on this server yet: it needs a Panta API key.");
    const p = pickPosition(await openPositions(agent.userId, agent.slug), i.position);
    const price = await livePrice(p);
    const proceeds = +(p.shares * price).toFixed(6), pnl = +(proceeds - p.amount).toFixed(6);
    return {
      title: `Close ${p.side.toUpperCase()} on "${p.title.slice(0, 60)}"`, chain: "panta", usdMicros: 0, summary: "Close a Panta position",
      rows: [["Market", p.title.slice(0, 80)], ["Side", p.side.toUpperCase()], ["Shares", `${+p.shares.toFixed(4)} bought at ${cents(p.avgPrice)}`], ["Live price", cents(price)], ["You get", usd(proceeds)], ["Profit / loss", signed(pnl)], ["Mode", "Paper position (devnet): no money moves"]],
      plan: { kind: "panta-close", position: p.id, market: p.market, title: p.title, side: p.side, shares: p.shares, amount: p.amount, price, proceeds, pnl } satisfies ClosePlan,
    };
  },
  execute: async (pl: never, agent: AgentRef): Promise<Executed> => {
    const p = pl as ClosePlan;
    if (p.kind !== "panta-close") throw new Reject("That close can't run any more.");
    // Once per position, even with two cards open: under a per-position lock, this close (already "submitting") must be
    // the only close of the position that is confirmed or being sent. Two racing closes both stop; one can be retried.
    await db().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`panta-close:${p.position}`}))`);
      const [pos] = await tx.select({ id: integrationActions.id }).from(integrationActions).where(and(eq(integrationActions.id, p.position), eq(integrationActions.userId, agent.userId), eq(integrationActions.agentSlug, agent.slug), eq(integrationActions.status, "confirmed"))).limit(1);
      if (!pos) throw new Reject("That position isn't open any more.");
      const closes = await tx.select({ preview: integrationActions.preview }).from(integrationActions).where(and(eq(integrationActions.userId, agent.userId), eq(integrationActions.tool, "panta.close"), inArray(integrationActions.status, ["confirmed", "submitting"])));
      if (closes.filter((d) => String(((d.preview as { plan?: { position?: string } } | null)?.plan || {}).position) === p.position).length > 1) throw new Reject("That position is already closed.");
    });
    return { sig: "", confirmed: true, rows: [["Closed", `${+p.shares.toFixed(4)} shares at ${cents(p.price)}`], ["Realized", signed(p.pnl)]] };
  },
};
