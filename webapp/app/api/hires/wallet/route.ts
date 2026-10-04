import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { agents, chats, messages } from "@/server/db/schema";
import { hireWalletInfo, returnLeftover } from "@/server/hireWallet";
import { jsonError, rateLimit } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

async function ownsHire(userId: string, slug: string) {
  if (!/^[a-z0-9-]{2,40}$/.test(slug) || slug === "home" || slug.startsWith("c-")) return false;
  const [row] = await db().select({ kind: agents.kind }).from(agents).where(and(eq(agents.userId, userId), eq(agents.slug, slug))).limit(1);
  return row?.kind === "hired";
}

/** A hired agent's task wallet: address and devnet balance. */
export const GET = withUser(async (user, req) => {
  const slug = new URL(req.url).searchParams.get("slug") || "";
  if (!(await ownsHire(user.userId, slug))) return jsonError(404, "That hired agent is not on your team.");
  return Response.json(await hireWalletInfo(user.userId, slug), { headers: { "cache-control": "no-store" } });
});

/** Sends what's left in a hired agent's task wallet back to your wallet. */
export const POST = withUser(async (user, req) => {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; action?: string; convo?: string; clientId?: string };
  const slug = String(body.slug || "");
  if (body.action !== "return") return jsonError(400, "Unknown action.");
  if (!(await ownsHire(user.userId, slug))) return jsonError(404, "That hired agent is not on your team.");
  if (!(await rateLimit(`hirewallet:${user.userId}`, 6))) return jsonError(429, "Wait a minute and try again.");
  try {
    const r = await returnLeftover(user.userId, slug, user.wallet);
    // Mark the funding card in the chat, so it shows "returned" after a reload.
    if (r.sig && typeof body.convo === "string" && typeof body.clientId === "string" && body.clientId.length <= 40) {
      const [chat] = await db().select({ id: chats.id }).from(chats).where(and(eq(chats.userId, user.userId), eq(chats.slug, body.convo.slice(0, 80)))).limit(1);
      if (chat) {
        const [row] = await db().select().from(messages).where(and(eq(messages.chatId, chat.id), eq(messages.clientId, body.clientId))).limit(1);
        const cur = (row?.metaJson as { send?: Record<string, unknown> } | null)?.send;
        if (row && cur?.kind === "fund" && cur.agent === slug) {
          const send = { ...cur, returned: { sig: r.sig, sol: r.lamports / 1e9 } };
          await db().update(messages).set({ metaJson: sql`coalesce(${messages.metaJson}, '{}'::jsonb) || ${JSON.stringify({ send })}::jsonb` }).where(eq(messages.id, row.id));
        }
      }
    }
    const info = await hireWalletInfo(user.userId, slug);
    return Response.json({ ok: true, sig: r.sig, sol: r.lamports / 1e9, address: info.address, balance: info.sol });
  } catch (e) {
    console.error(`[hire-wallet] return failed: ${(e as Error).message.slice(0, 200)}`);
    return jsonError(502, "The leftover couldn't be sent back right now. Try again in a minute.");
  }
});
