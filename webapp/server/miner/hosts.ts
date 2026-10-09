/**
 * ORE Miner: servers people connect themselves. Mining NEVER runs on Lexari's VPS or agent containers: the person runs
 * a one-line install on their own machine, which starts a small host agent (server/miner/agent.py) that polls Lexari
 * for commands and reports back.
 *
 * Connect flow: createHost() makes a one-time install code (30 min). The install script URL carries only that code;
 * fetching it once trades the code for a long-lived host token (stored hashed) baked into the script. Every poll
 * authenticates with that token. Removing a host revokes the token and tells the agent to uninstall itself.
 *
 * Honest status: ORE (ore.supply) is mined on Solana mainnet (today by deploying SOL on the 5x5 board each round).
 * On devnet the miner runs in practice mode: real keccak hashing on your CPU, real hashrate and best difficulty,
 * no ORE rewards. Mainnet mining is a later step.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { minerCommands, minerHosts } from "../db/minerSchema";
import { HttpError } from "../http";
import { appOrigin } from "../config";
import { AGENT_PY } from "./agentSource";

export const MINER_CMDS = ["install", "start", "stop", "status", "uninstall"] as const;
export type MinerCmd = (typeof MINER_CMDS)[number];
const MAX_HOSTS = 5;
const ONLINE_MS = 45_000;
const INSTALL_MS = 30 * 60_000;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export type MinerReport = { host?: string; os?: string; arch?: string; cpus?: number; python?: string; installed?: boolean; running?: boolean; load?: number | null; agentUptime?: number; threads?: number; hashrate?: number; hashes?: number; best?: number; minerSince?: number | null; mode?: string; removed?: boolean };
export type HostView = { id: string; name: string; status: "waiting" | "online" | "offline"; lastSeen: number | null; report: MinerReport | null; installing: boolean; commands: { id: number; cmd: string; state: string; output: string | null; at: number }[] };

const origin = () => appOrigin()?.uri || "https://app.lexari.ai";

function view(h: typeof minerHosts.$inferSelect, cmds: (typeof minerCommands.$inferSelect)[]): HostView {
  const seen = h.lastSeen?.getTime() ?? null;
  return {
    id: h.id, name: h.name, lastSeen: seen, report: (h.report as MinerReport) ?? null,
    status: !h.tokenHash ? "waiting" : seen && Date.now() - seen < ONLINE_MS ? "online" : "offline",
    installing: !h.tokenHash && !!h.installExpires && h.installExpires.getTime() > Date.now(),
    commands: cmds.filter((c) => c.hostId === h.id).slice(0, 6).map((c) => ({ id: c.id, cmd: c.cmd, state: c.state, output: c.output, at: c.createdAt.getTime() })),
  };
}

export async function listHosts(userId: string): Promise<HostView[]> {
  const hosts = await db().select().from(minerHosts).where(eq(minerHosts.userId, userId)).orderBy(asc(minerHosts.createdAt));
  if (!hosts.length) return [];
  const cmds = await db().select().from(minerCommands).where(inArray(minerCommands.hostId, hosts.map((h) => h.id))).orderBy(desc(minerCommands.id)).limit(60);
  return hosts.map((h) => view(h, cmds));
}

/** The one-line install for a new server (or a fresh code for a host that never connected). */
export async function createHost(userId: string, name?: string, hostId?: string) {
  const code = randomBytes(18).toString("base64url");
  const exp = new Date(Date.now() + INSTALL_MS);
  const clean = (name || "My server").replace(/[^\w .-]/g, "").trim().slice(0, 40) || "My server";
  let id = hostId;
  if (id) {
    const [h] = await db().update(minerHosts).set({ installHash: hash(code), installExpires: exp }).where(and(eq(minerHosts.id, id), eq(minerHosts.userId, userId), sql`${minerHosts.tokenHash} is null`)).returning({ id: minerHosts.id });
    if (!h) throw new HttpError(404, "That server is already connected, or it's gone.");
  } else {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(minerHosts).where(eq(minerHosts.userId, userId));
    if (n >= MAX_HOSTS) throw new HttpError(409, `You can connect up to ${MAX_HOSTS} servers. Remove one first.`);
    const [h] = await db().insert(minerHosts).values({ userId, name: clean, installHash: hash(code), installExpires: exp }).returning({ id: minerHosts.id });
    id = h.id;
  }
  return { id, command: `curl -fsSL ${origin()}/api/miner/install/${code} | sh`, expires: exp.getTime() };
}

/** Trades a one-time install code for the install script with a fresh host token in it. */
export async function installScript(code: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(code)) return null;
  const token = randomBytes(32).toString("base64url");
  const [h] = await db().update(minerHosts).set({ tokenHash: hash(token), installHash: null, installExpires: null })
    .where(and(eq(minerHosts.installHash, hash(code)), sql`${minerHosts.installExpires} > now()`, sql`${minerHosts.tokenHash} is null`)).returning({ id: minerHosts.id });
  if (!h) return null;
  await db().insert(minerCommands).values({ hostId: h.id, cmd: "install" });
  return script(token);
}

function script(token: string) {
  const b64 = Buffer.from(AGENT_PY).toString("base64");
  return `#!/bin/sh
# Lexari ORE Miner: connects THIS server to your Lexari account. Runs as the current user, no root needed.
# It installs a small agent in ~/.lexari-miner that polls Lexari over HTTPS for install / start / stop / status.
# Remove it any time: python3 ~/.lexari-miner/agent.py --uninstall
set -e
command -v python3 >/dev/null 2>&1 || { echo "Lexari: python3 is required (apt install python3)." >&2; exit 1; }
D="$HOME/.lexari-miner"
mkdir -p "$D" && chmod 700 "$D"
echo '${b64}' | (base64 -d 2>/dev/null || base64 -D) > "$D/agent.py"
umask 077
printf '%s' '${token}' > "$D/token"
printf '%s' '${origin()}' > "$D/origin"
pkill -f "$D/agent.py" 2>/dev/null || true
nohup python3 "$D/agent.py" >> "$D/agent.log" 2>&1 &
if command -v crontab >/dev/null 2>&1; then
  ( crontab -l 2>/dev/null | grep -v lexari-miner; echo "@reboot nohup python3 $D/agent.py >> $D/agent.log 2>&1 &" ) | crontab - 2>/dev/null || true
fi
echo "Lexari: connected. Your ORE Miner will see this server in a few seconds."
`;
}

/** A command from you (or the ORE Miner agent on your behalf). */
export async function queueCommand(userId: string, hostId: string, cmd: MinerCmd, args: { threads?: number } = {}) {
  if (!MINER_CMDS.includes(cmd)) throw new HttpError(400, "Unknown command.");
  const [h] = await db().select().from(minerHosts).where(and(eq(minerHosts.id, hostId), eq(minerHosts.userId, userId))).limit(1);
  if (!h) throw new HttpError(404, "That server isn't connected.");
  if (!h.tokenHash) throw new HttpError(409, "That server hasn't run the install line yet.");
  const pending = await db().select({ id: minerCommands.id }).from(minerCommands).where(and(eq(minerCommands.hostId, h.id), eq(minerCommands.state, "queued")));
  if (pending.length >= 5) throw new HttpError(429, "That server has commands waiting. Give it a moment.");
  const threads = args.threads ? Math.max(1, Math.min(64, Math.round(args.threads))) : undefined;
  const [c] = await db().insert(minerCommands).values({ hostId: h.id, cmd, args: threads ? { threads } : {} }).returning();
  return c;
}

/** Removes a server: revokes its token, and the agent uninstalls itself on its next poll. */
export async function removeHost(userId: string, hostId: string) {
  const [h] = await db().delete(minerHosts).where(and(eq(minerHosts.id, hostId), eq(minerHosts.userId, userId))).returning({ id: minerHosts.id });
  if (!h) throw new HttpError(404, "That server isn't connected.");
  return { removed: h.id };
}

/** The host agent's poll: results of earlier commands in, new commands out. */
export async function agentPoll(token: string, body: { results?: { id?: number; ok?: boolean; output?: string }[]; report?: MinerReport }) {
  if (!token || token.length > 80) return { revoked: true };
  const [h] = await db().select().from(minerHosts).where(eq(minerHosts.tokenHash, hash(token))).limit(1);
  if (!h) return { revoked: true };
  const d = db();
  for (const r of (body.results || []).slice(0, 10)) {
    if (!Number.isInteger(r.id)) continue;
    await d.update(minerCommands).set({ state: r.ok ? "done" : "failed", output: String(r.output ?? "").slice(0, 400), doneAt: new Date() })
      .where(and(eq(minerCommands.id, r.id!), eq(minerCommands.hostId, h.id)));
  }
  const report = sanitize(body.report);
  if (report?.removed) { await d.delete(minerHosts).where(eq(minerHosts.id, h.id)); return { revoked: true }; }
  await d.update(minerHosts).set({ lastSeen: new Date(), ...(report ? { report } : {}) }).where(eq(minerHosts.id, h.id));
  const cmds = await d.update(minerCommands).set({ state: "sent" })
    .where(and(eq(minerCommands.hostId, h.id), eq(minerCommands.state, "queued"))).returning();
  // A command sent but never answered (the agent restarted) is closed after 2 minutes.
  await d.update(minerCommands).set({ state: "failed", output: "The server didn't answer.", doneAt: new Date() })
    .where(and(eq(minerCommands.hostId, h.id), eq(minerCommands.state, "sent"), sql`${minerCommands.createdAt} < now() - interval '2 minutes'`));
  return { commands: cmds.sort((a, b) => a.id - b.id).map((c) => ({ id: c.id, cmd: c.cmd, args: c.args })), interval: 8 };
}

function sanitize(r: unknown): MinerReport | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 60) : undefined);
  return { host: s(o.host), os: s(o.os), arch: s(o.arch), cpus: n(o.cpus), python: s(o.python), installed: o.installed === true, running: o.running === true, load: n(o.load) ?? null,
    agentUptime: n(o.agentUptime), threads: n(o.threads), hashrate: n(o.hashrate), hashes: n(o.hashes), best: n(o.best), minerSince: n(o.minerSince) ?? null, mode: s(o.mode), removed: o.removed === true || undefined };
}

/** A plain summary the ORE Miner agent reads. */
export function describeHosts(hosts: HostView[]) {
  if (!hosts.length) return "No servers connected yet. The person connects one from the ORE Miner's profile: Mining > Connect a server, which gives a one-line install to run on their own Linux or macOS server.";
  return hosts.map((h, i) => {
    const r = h.report;
    const base = `${i + 1}. "${h.name}" (id ${h.id.slice(0, 8)}): ${h.status}`;
    if (h.status === "waiting") return `${base}, waiting for the install line to be run`;
    const spec = r ? `, ${r.host || "server"} ${r.os || ""} ${r.cpus ? `${r.cpus} CPUs` : ""}`.replace(/\s+/g, " ") : "";
    const mine = r?.running ? `, miner running on ${r.threads} threads at ${(r.hashrate || 0).toLocaleString("en-US")} hashes/s, best difficulty ${r.best || 0}, ${(r.hashes || 0).toLocaleString("en-US")} hashes so far (practice mode, devnet)` : r?.installed ? ", miner installed and stopped" : ", miner not installed yet";
    const last = h.commands[0] ? `; last command ${h.commands[0].cmd}: ${h.commands[0].state}${h.commands[0].output ? ` (${h.commands[0].output})` : ""}` : "";
    return base + spec + mine + last;
  }).join("\n");
}

export async function hostByRef(userId: string, ref?: string) {
  const hosts = await listHosts(userId);
  const live = hosts.filter((h) => h.status !== "waiting");
  if (!ref) { if (live.length === 1) return live[0]; if (!live.length) throw new HttpError(404, "No connected server yet."); throw new HttpError(400, `Say which server: ${live.map((h) => h.name).join(", ")}.`); }
  const r = ref.toLowerCase();
  const h = live.find((x) => x.id.startsWith(r) || x.name.toLowerCase() === r) || live.find((x) => x.name.toLowerCase().includes(r));
  if (!h) throw new HttpError(404, `No connected server called ${ref.slice(0, 30)}.`);
  return h;
}
