import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { userMedia, users } from "./db/schema";

/** Who sent the invite: their profile name and (png/jpeg) picture. Nothing else about them is shown. */
export async function inviter(code: string, withAvatar = false): Promise<{ inviter?: string; avatar?: string }> {
  if (!/^[A-Za-z0-9-]{4,16}$/.test(code) || !process.env.DATABASE_URL) return {};
  try {
    const [u] = await db().select({ id: users.id, profile: users.profile }).from(users).where(eq(users.referralCode, code.toUpperCase())).limit(1);
    if (!u) return {};
    const name = String((u.profile as { name?: string }).name || "").replace(/[\u0000-\u001f]/g, "").trim();
    if (!name) return {};
    if (!withAvatar) return { inviter: name };
    const [m] = await db().select({ mime: userMedia.mime, data: userMedia.data }).from(userMedia).where(and(eq(userMedia.userId, u.id), eq(userMedia.kind, "avatar"), inArray(userMedia.mime, ["image/png", "image/jpeg"]))).limit(1);
    return { inviter: name, avatar: m ? `data:${m.mime};base64,${Buffer.from(m.data).toString("base64")}` : undefined };
  } catch { return {}; }
}
