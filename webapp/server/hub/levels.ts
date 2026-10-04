import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { hubLevels } from "../db/schema";

/** An agent's level (1 when it never trained; hired specialists stay at 1). Cached briefly so a chat turn doesn't add a round trip each time. */
const cache = new Map<string, { level: number; at: number }>();
export async function agentLevel(userId: string, slug: string): Promise<number> {
  const k = `${userId}:${slug}`;
  const c = cache.get(k);
  if (c && Date.now() - c.at < 15_000) return c.level;
  const [r] = await db().select({ level: hubLevels.level }).from(hubLevels).where(and(eq(hubLevels.userId, userId), eq(hubLevels.slug, slug))).limit(1).catch(() => []);
  const level = r?.level ?? 1;
  cache.set(k, { level, at: Date.now() });
  return level;
}
export function forgetLevel(userId: string, slug: string) { cache.delete(`${userId}:${slug}`); }

/** Second shift: how many replies one agent works on at once. Extra turns wait for a free shift. */
const busy = new Map<string, number>();
const queue = new Map<string, (() => void)[]>();
export async function takeShift(key: string, max: number, timeoutMs = 90_000) {
  if ((busy.get(key) ?? 0) < max) { busy.set(key, (busy.get(key) ?? 0) + 1); return () => giveShift(key); }
  await new Promise<void>((resolve, reject) => {
    const q = queue.get(key) ?? []; queue.set(key, q);
    const go = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(() => { const i = q.indexOf(go); if (i >= 0) q.splice(i, 1); reject(new Error("shift timeout")); }, timeoutMs);
    q.push(go);
  });
  busy.set(key, (busy.get(key) ?? 0) + 1);
  return () => giveShift(key);
}
function giveShift(key: string) {
  busy.set(key, Math.max(0, (busy.get(key) ?? 1) - 1));
  queue.get(key)?.shift()?.();
}
