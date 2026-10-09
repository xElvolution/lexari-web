/**
 * Integrations a person added (integration_grants): which agents may use each one and its limits. Adding or changing
 * one needs a linked X, Discord or Telegram account (the same gate as the badge); removing never does.
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { INTEGRATIONS, LIMITS, integrationById, type ActivityRow, type AddedIntegration, type IntegrationId } from "@/content/integrations";
import { db } from "../db";
import { agents } from "../db/schema";
import { integrationActions, integrationGrants } from "../db/integrationsSchema";
import { HttpError } from "../http";
import { hasVerifiedSocial, requireSocial } from "../social";
import { solanaKeypair } from "../agentWallets";
import { EVM, evmAddress } from "./evm";
import { TEMPO } from "./tempo";
import { addrExplorer } from "./solana";
import { cardOf } from "./cards";

export type Grant = typeof integrationGrants.$inferSelect;
export const COUNTED = ["submitting", "submitted", "confirmed"] as const;
const startOfUtcDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

/** Dollars (micro) already used today (UTC) on one integration: actions being sent or sent. */
export async function spentToday(userId: string, connector: string, tx = db()): Promise<number> {
  const [r] = await tx.select({ v: sql<string>`coalesce(sum(${integrationActions.usdMicros}), 0)` }).from(integrationActions)
    .where(and(eq(integrationActions.userId, userId), eq(integrationActions.connector, connector), inArray(integrationActions.status, [...COUNTED]), gte(integrationActions.createdAt, startOfUtcDay())));
  return Number(r?.v || 0);
}

/** Your agents, for the picker: name (your nickname for it first) and kind. */
export async function teamOf(userId: string) {
  const rows = await db().select({ slug: agents.slug, kind: agents.kind, name: agents.name, meta: agents.meta }).from(agents).where(eq(agents.userId, userId));
  return rows.sort((a, b) => Number(b.slug === "home") - Number(a.slug === "home")).map((r) => ({ slug: r.slug, kind: r.kind, name: (r.meta as { nick?: string } | null)?.nick || r.name }));
}

const CHAIN_OF: Partial<Record<IntegrationId, "solana" | "base" | "ethereum" | "tempo">> = { solana: "solana", orca: "solana", base: "base", ethereum: "ethereum", tempo: "tempo", panta: "solana" };

function addressesFor(userId: string, g: Grant, team: { slug: string; kind: string }[]) {
  const chain = CHAIN_OF[g.connector as IntegrationId];
  if (!chain) return [];
  return g.agentSlugs.flatMap((slug) => {
    const a = team.find((t) => t.slug === slug);
    if (!a) return [];
    try {
      if (chain === "solana") { const addr = solanaKeypair(userId, slug, a.kind).publicKey.toBase58(); return [{ agent: slug, chain: "Solana", address: addr, explorer: addrExplorer(addr) }]; }
      const addr = evmAddress(userId, slug);
      if (chain === "tempo") return [{ agent: slug, chain: TEMPO.network, address: addr, explorer: TEMPO.explorerAddr(addr) }];
      return [{ agent: slug, chain: EVM[chain].network, address: addr, explorer: `${EVM[chain].explorer}${addr}` }];
    } catch { return []; }
  });
}

export async function listIntegrations(userId: string) {
  const database = db();
  const [unlocked, grants, team] = await Promise.all([
    hasVerifiedSocial(userId),
    database.select().from(integrationGrants).where(eq(integrationGrants.userId, userId)).orderBy(integrationGrants.createdAt),
    teamOf(userId),
  ]);
  const recent = grants.length ? await database.select().from(integrationActions).where(eq(integrationActions.userId, userId)).orderBy(desc(integrationActions.createdAt)).limit(120) : [];
  const added: AddedIntegration[] = await Promise.all(grants.filter((g) => integrationById(g.connector)).map(async (g) => ({
    id: g.id, connector: g.connector as IntegrationId, enabled: g.enabled, agents: g.agentSlugs.filter((s) => team.some((t) => t.slug === s)),
    perTxUsd: g.perTxUsd, dailyUsd: g.dailyUsd, maxSlippageBps: g.maxSlippageBps,
    spentTodayUsd: integrationById(g.connector)?.moves ? (await spentToday(userId, g.connector)) / 1e6 : 0,
    addresses: addressesFor(userId, g, team),
    activity: recent.filter((a) => a.connector === g.connector).slice(0, 6).map((a): ActivityRow => {
      const c = cardOf(a);
      return { id: a.id, tool: a.tool, agent: a.agentSlug, status: c.status, usd: c.usd, title: c.title, sig: c.sig, explorer: c.explorer, error: c.error, at: a.createdAt.getTime() };
    }),
    at: g.createdAt.getTime(),
  })));
  return { locked: !unlocked, added, agents: team };
}

export type GrantInput = { agents?: string[]; enabled?: boolean; perTxUsd?: number; dailyUsd?: number; maxSlippageBps?: number };

async function cleanInput(userId: string, input: GrantInput, current?: Grant) {
  const out: Partial<Grant> = {};
  if (input.agents) {
    const team = await teamOf(userId);
    const bad = input.agents.filter((s) => !team.some((t) => t.slug === s));
    if (bad.length) throw new HttpError(400, "One of those agents isn't on your team.");
    out.agentSlugs = [...new Set(input.agents)];
  }
  if (input.enabled !== undefined) out.enabled = input.enabled;
  const perTx = input.perTxUsd ?? current?.perTxUsd ?? LIMITS.perTx.def;
  const daily = input.dailyUsd ?? current?.dailyUsd ?? LIMITS.daily.def;
  const slip = input.maxSlippageBps ?? current?.maxSlippageBps ?? LIMITS.slippageBps.def;
  if (!Number.isInteger(perTx) || perTx < LIMITS.perTx.min || perTx > LIMITS.perTx.max) throw new HttpError(400, `Per trade has to be between $${LIMITS.perTx.min} and $${LIMITS.perTx.max}.`);
  if (!Number.isInteger(daily) || daily < LIMITS.daily.min || daily > LIMITS.daily.max) throw new HttpError(400, `Daily has to be between $${LIMITS.daily.min} and $${LIMITS.daily.max}.`);
  if (daily < perTx) throw new HttpError(400, "The daily limit can't be lower than the per trade limit.");
  if (!Number.isInteger(slip) || slip < LIMITS.slippageBps.min || slip > LIMITS.slippageBps.max) throw new HttpError(400, `Max slippage has to be between ${LIMITS.slippageBps.min / 100}% and ${LIMITS.slippageBps.max / 100}%.`);
  return { ...out, perTxUsd: perTx, dailyUsd: daily, maxSlippageBps: slip };
}

export async function addIntegration(userId: string, connector: string, input: GrantInput) {
  await requireSocial(userId, "add integrations");
  const info = integrationById(connector);
  if (!info) throw new HttpError(404, "There's no integration with that name.");
  if (!info.addable) throw new HttpError(409, `${info.name} is coming soon, so it can't be added yet.`);
  const clean = await cleanInput(userId, input);
  const [row] = await db().insert(integrationGrants).values({ userId, connector, enabled: input.enabled ?? true, agentSlugs: clean.agentSlugs ?? [], perTxUsd: clean.perTxUsd, dailyUsd: clean.dailyUsd, maxSlippageBps: clean.maxSlippageBps })
    .onConflictDoNothing().returning();
  if (!row) throw new HttpError(409, `${info.name} is already added.`);
  return row;
}

async function ownGrant(userId: string, id: string) {
  const [g] = await db().select().from(integrationGrants).where(and(eq(integrationGrants.userId, userId), eq(integrationGrants.id, id))).limit(1);
  if (!g) throw new HttpError(404, "That integration isn't added.");
  return g;
}

export async function updateIntegration(userId: string, id: string, input: GrantInput) {
  await requireSocial(userId, "change integrations");
  const g = await ownGrant(userId, id);
  const clean = await cleanInput(userId, input, g);
  const [row] = await db().update(integrationGrants).set({ ...clean, updatedAt: new Date() }).where(eq(integrationGrants.id, g.id)).returning();
  return row;
}

/** Removes it. Any confirm card it left in chat can no longer be confirmed. */
export async function removeIntegration(userId: string, id: string) {
  const g = await ownGrant(userId, id);
  await db().transaction(async (tx) => {
    await tx.delete(integrationGrants).where(eq(integrationGrants.id, g.id));
    await tx.update(integrationActions).set({ status: "cancelled", error: "The integration was removed.", settledAt: new Date() })
      .where(and(eq(integrationActions.userId, userId), eq(integrationActions.connector, g.connector), eq(integrationActions.status, "prepared")));
  });
  return { removed: g.connector };
}

/** Integrations this agent can use right now: you linked a social account, added it, switched it on and granted it this agent. */
export async function usableGrants(userId: string, slug: string) {
  const own = builtinGrants(userId, slug);
  // Built-ins don't need the social gate: agent payments spend only what you funded the agent with, inside its budget.
  if (!(await hasVerifiedSocial(userId))) return { social: false, grants: own };
  const rows = await db().select().from(integrationGrants).where(and(eq(integrationGrants.userId, userId), eq(integrationGrants.enabled, true), sql`${slug} = any(${integrationGrants.agentSlugs})`));
  return { social: true, grants: [...rows.filter((g) => INTEGRATIONS.some((i) => i.id === g.connector && i.addable)), ...own] };
}

/** Built-in connectors this agent always has (agent payments for everyone, the ORE Miner's servers): never in the
 * integration_grants table; payments are limited by the agent's budget instead of grant limits. */
export const isBuiltin = (connector: string) => !!integrationById(connector)?.builtin;
export function builtinGrants(userId: string, slug: string): Grant[] {
  const now = new Date();
  return INTEGRATIONS.filter((i) => i.builtin === "all" || (Array.isArray(i.builtin) && i.builtin.includes(slug))).map((i) => ({
    id: `builtin-${i.id}`, userId, connector: i.id, enabled: true, agentSlugs: [slug], perTxUsd: LIMITS.perTx.max, dailyUsd: LIMITS.daily.max, maxSlippageBps: LIMITS.slippageBps.def, createdAt: now, updatedAt: now,
  }) as Grant);
}
