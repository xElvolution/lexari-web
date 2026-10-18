/** Shared fixtures for the database tests: people, agents, grants, a chat turn, and an anvil fork of a testnet. */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { db } from "../../server/db";
import { agents, users } from "../../server/db/schema";
import { integrationGrants } from "../../server/db/integrationsSchema";
import { turnTools, runTurnTools } from "../../server/integrations/chat";
import { agentRef } from "../../server/integrations/actions";

export const rnd = () => Math.random().toString(36).slice(2, 10);
export async function person() {
  const [u] = await db().insert(users).values({ wallet: `W${rnd()}`, referralCode: rnd() }).returning();
  return u;
}
export type Agent = typeof agents.$inferSelect;
export async function agent(userId: string, kind = "home", name = "Atlas"): Promise<Agent> {
  const [a] = await db().insert(agents).values({ userId, slug: `${kind}-${rnd()}`, name, kind, tone: "friendly", lookJson: { v: 7 } }).returning();
  return a;
}
export async function grant(userId: string, connector: string, slug: string, limits: { perTxUsd?: number; dailyUsd?: number; maxSlippageBps?: number } = {}) {
  await db().insert(integrationGrants).values({ userId, connector, agentSlugs: [slug], perTxUsd: limits.perTxUsd ?? 25, dailyUsd: limits.dailyUsd ?? 100, maxSlippageBps: limits.maxSlippageBps ?? 300, consentedAt: new Date() });
}
/** One agent reply with tool tags, run through the real turn code. */
export async function say(userId: string, a: Agent, text: string, untrusted = false) {
  const tt = await turnTools(userId, a.slug);
  return runTurnTools(userId, agentRef(userId, a), tt, text, { convo: "", messageId: rnd(), untrusted });
}

/** An anvil fork of a public testnet, or null when Foundry isn't installed (the test then skips). */
export async function fork(rpc: string): Promise<{ url: string; stop: () => void; rpc: (method: string, params: unknown[]) => Promise<unknown> } | null> {
  const bin = process.env.ANVIL_BIN || "anvil";
  if (spawnSync(bin, ["--version"]).status !== 0) return null;
  const port = 30000 + Math.floor(Math.random() * 20000);
  const child: ChildProcess = spawn(bin, ["--fork-url", rpc, "--port", String(port), "--silent", "--no-rate-limit"], { stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  const call = async (method: string, params: unknown[]) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = (await r.json()) as { result?: unknown; error?: { message: string } };
    if (j.error) throw new Error(j.error.message);
    return j.result;
  };
  for (let i = 0; i < 80; i++) {
    try { await call("eth_chainId", []); return { url, stop: () => child.kill(), rpc: call }; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  child.kill();
  return null;
}
