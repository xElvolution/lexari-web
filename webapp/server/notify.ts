import webpush from "web-push";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { chainLedger, notifications, pushSubs, users } from "./db/schema";
import { QUEST_RULES } from "./hub/catalog";
import { periodNumber } from "./hub/catalog";
import { questProgress } from "./hub/rules";

export type NoteKind = "quest" | "box" | "hire" | "payment" | "card" | "reply" | "faucet";
export type Note = { kind: NoteKind; title: string; body?: string; url?: string; key?: string };

/** Which Settings › Notifications toggle silences the push for a kind. The bell always keeps it. */
const PREF: Partial<Record<NoteKind, string>> = { reply: "replies", hire: "wallet", payment: "wallet", faucet: "wallet", card: "cards" };

let vapidReady: boolean | null = null;
export function vapidPublicKey() { return process.env.VAPID_PUBLIC_KEY || ""; }
function vapid() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = !!(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@lexari.ai", pub!, priv!);
  return vapidReady;
}

/** Saves a notification for the bell, then pushes it (in the background) to every browser the person allowed. Never throws. */
export async function notify(userId: string, note: Note): Promise<boolean> {
  try {
    const database = db();
    const row = await database.insert(notifications).values({
      userId, kind: note.kind, title: note.title.slice(0, 120), body: (note.body || "").slice(0, 300), url: note.url || "/agents", key: note.key ?? null,
    }).onConflictDoNothing().returning({ id: notifications.id });
    if (!row.length) return false; // already sent this one
    const pref = PREF[note.kind];
    if (pref) {
      const [u] = await database.select({ prefs: users.prefs }).from(users).where(eq(users.id, userId)).limit(1);
      const n = (u?.prefs as { notif?: Record<string, boolean> } | undefined)?.notif;
      if (n && n[pref] === false) return true;
    }
    void push(userId, { id: row[0].id, kind: note.kind, title: note.title, body: note.body || "", url: note.url || "/agents" }).catch(() => {});
    return true;
  } catch (e) {
    console.error(`[notify] ${(e as Error)?.message || "failed"}`);
    return false;
  }
}

export async function push(userId: string, payload: Record<string, unknown>) {
  if (!vapid()) return 0;
  const database = db();
  const subs = await database.select().from(pushSubs).where(eq(pushSubs.userId, userId));
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await database.delete(pushSubs).where(eq(pushSubs.id, s.id)); // the browser dropped it
      else console.error(`[push] ${code || ""} ${(e as Error)?.message || "failed"}`);
    }
  }));
  return sent;
}

/** After something counts toward a quest: tell the person once per period when a quest is ready to claim. */
const KIND_TO_COUNT: Record<string, string[]> = { message: ["message"], memory: ["memory"], hire: ["hire"], agent: ["team", "agent"], job: ["job"] };
export async function questReadyCheck(userId: string, kind: string) {
  const counts = KIND_TO_COUNT[kind];
  if (!counts) return;
  for (const rule of QUEST_RULES.filter((r) => counts.includes(r.count))) {
    try {
      const have = await questProgress(userId, rule, { streak: 0, maxLevel: 0 });
      if (have < rule.goal) continue;
      await notify(userId, {
        kind: "quest", title: "Quest ready to claim", body: `${QUEST_NAMES[rule.id] || "A quest"} is done. Claim ${rule.reward} coins in the Hub.`,
        url: "/hub", key: `quest:${rule.id}:${periodNumber(rule.period)}`,
      });
    } catch { /* best effort */ }
  }
}
const QUEST_NAMES: Record<string, string> = {
  "d-chat": "Send 3 messages", "d-memory": "Save 2 memories", "w-chat": "Send 25 messages this week", "w-jobs": "Finish 3 jobs this week",
  "h-memory": "Save 30 memories", "h-team": "Build a team of 5", "h-hire": "Hire your first specialist",
};

/** Once a day (from 09:00 Lagos): remind people with push on that today's mystery box is waiting. */
export async function boxReminders() {
  if (!vapid()) return;
  const now = new Date();
  if (now.getUTCHours() < 8) return;
  const day = Math.floor(now.getTime() / 86_400_000);
  const database = db();
  const ids = (await database.selectDistinct({ id: pushSubs.userId }).from(pushSubs)).map((r) => r.id);
  if (!ids.length) return;
  const since = new Date(day * 86_400_000);
  const opened = new Set((await database.select({ id: chainLedger.userId }).from(chainLedger)
    .where(and(inArray(chainLedger.userId, ids), eq(chainLedger.kind, "open_box"), gte(chainLedger.createdAt, since)))).map((r) => r.id));
  for (const id of ids) {
    if (opened.has(id)) continue;
    await notify(id, { kind: "box", title: "Your mystery box is ready", body: "Open today's box in the Hub for free coins.", url: "/hub", key: `box:${day}` });
  }
}

export async function unreadCount(userId: string) {
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`));
  return r?.n || 0;
}
