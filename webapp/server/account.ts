import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import { agents, chats, hires, jobs, memories, messages, users } from "./db/schema";
import type { SessionUser } from "./auth/session";
import { currentPlan } from "./plans";

/** Everything the app needs on load. Memories stay encrypted; the browser decrypts them. */
export async function loadAccount(user: SessionUser) {
  const database = db();
  const [me] = await database.select().from(users).where(eq(users.id, user.userId)).limit(1);
  const [agentRows, chatRows, memRows, jobRows, hireRows, plan] = await Promise.all([
    database.select().from(agents).where(eq(agents.userId, user.userId)).orderBy(asc(agents.createdAt)),
    database.select().from(chats).where(eq(chats.userId, user.userId)).orderBy(asc(chats.createdAt)),
    database.select().from(memories).where(and(eq(memories.userId, user.userId), isNull(memories.deletedAt))).orderBy(desc(memories.createdAt)).limit(500),
    database.select().from(jobs).where(eq(jobs.userId, user.userId)).orderBy(desc(jobs.createdAt)).limit(200),
    database.select({ slug: hires.slug, tx: hires.tx, createdAt: hires.createdAt }).from(hires).where(eq(hires.buyerId, user.userId)),
    currentPlan(user.userId),
  ]);
  const chatIds = chatRows.map((c) => c.id);
  const msgRows = chatIds.length
    ? await database.select().from(messages).where(inArray(messages.chatId, chatIds)).orderBy(desc(messages.createdAt)).limit(3000)
    : [];
  const byChat = new Map<string, typeof msgRows>();
  for (const m of msgRows.reverse()) {
    const list = byChat.get(m.chatId) || [];
    list.push(m);
    byChat.set(m.chatId, list);
  }
  const slugOf = new Map(agentRows.map((a) => [a.id, a.slug]));
  return {
    user: {
      wallet: user.wallet,
      referralCode: user.referralCode,
      method: user.privyDid ? ("google" as const) : ("wallet" as const),
      email: me?.email || null,
      createdAt: me?.createdAt?.getTime() ?? Date.now(),
    },
    profile: (me?.profile || {}) as Record<string, unknown>,
    plan,
    lockOn: !!me?.lockHash,
    biometric: (me?.lockCreds || []).length > 0,
    prefs: (me?.prefs || {}) as Record<string, unknown>,
    agents: agentRows.map((a) => ({
      slug: a.slug, kind: a.kind, name: a.name, role: a.role, tone: a.tone, about: a.about, skills: a.skills, memoryOn: a.memoryOn,
      look: (a.lookJson as { v?: unknown })?.v ?? null, meta: a.meta, asset: a.asset, agentPda: a.agentPda,
      mintedAt: a.mintedAt?.getTime() ?? null, createdAt: a.createdAt.getTime(),
    })),
    chats: chatRows.map((c) => ({
      slug: c.slug, kind: c.kind, title: c.title, members: c.memberSlugs, createdAt: c.createdAt.getTime(),
      messages: (byChat.get(c.id) || []).slice(-150).map((m) => ({ id: m.clientId || m.id, from: m.fromId, text: m.text, at: m.createdAt.getTime(), ...((m.metaJson as object) || {}) })),
    })),
    memories: memRows.map((m) => ({
      id: m.id, agent: m.agentId ? slugOf.get(m.agentId) || "home" : "home", tag: m.tag, source: m.source, ciphertext: m.ciphertext, iv: m.iv,
      contentHash: m.contentHash, uri: m.uri, onchainPda: m.onchainPda, chainTx: m.chainTx, at: m.createdAt.getTime(),
    })),
    jobs: jobRows.map((j) => ({
      id: j.id, assignee: j.assignee, title: j.title, prompt: j.prompt, status: j.status, output: j.output,
      startedAt: j.startedAt?.getTime() ?? j.createdAt.getTime(), finishedAt: j.finishedAt?.getTime() ?? null,
    })),
    hires: hireRows.map((h) => ({ slug: h.slug, tx: h.tx, at: h.createdAt.getTime() })),
  };
}
export type Account = Awaited<ReturnType<typeof loadAccount>>;
