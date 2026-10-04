import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { agents, userMedia, users } from "./db/schema";

/** Who sent the invite: their profile name and (png/jpeg) picture. Nothing else about them is shown. */
export async function inviter(code: string, withAvatar = false): Promise<{ inviter?: string; avatar?: string }> {
  if (!/^[A-Za-z0-9-]{4,16}$/.test(code) || !process.env.DATABASE_URL) return {};
  try {
    const [u] = await db().select({ id: users.id, profile: users.profile }).from(users).where(eq(users.referralCode, code.toUpperCase())).limit(1);
    if (!u) return {};
    let raw = String((u.profile as { name?: string }).name || "");
    // No profile name yet: the name they gave their agent to call them (as the app shows it).
    if (!raw.trim()) { const [h] = await db().select({ meta: agents.meta }).from(agents).where(and(eq(agents.userId, u.id), eq(agents.slug, "home"))).limit(1); raw = String((h?.meta as { you?: string } | null)?.you || ""); }
    const name = raw.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
    if (!name) return {};
    if (!withAvatar) return { inviter: name };
    const [m] = await db().select({ mime: userMedia.mime, data: userMedia.data }).from(userMedia).where(and(eq(userMedia.userId, u.id), eq(userMedia.kind, "avatar"), inArray(userMedia.mime, ["image/png", "image/jpeg"]))).limit(1);
    return { inviter: name, avatar: m ? `data:${m.mime};base64,${Buffer.from(m.data).toString("base64")}` : undefined };
  } catch { return {}; }
}
