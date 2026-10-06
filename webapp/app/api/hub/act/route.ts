import { applyCosmetic, buy, checkIn, claimQuest, claimTier, openBox, train } from "@/server/hub/offchain";
import { forgetLevel } from "@/server/hub/levels";
import { hubState } from "@/server/hub/state";
import { jsonError, rateLimit } from "@/server/http";
import { withUser } from "@/server/route";

export const runtime = "nodejs";

/**
 * Hub actions, all offchain and instant: check in, claim a quest / box / referral tier, train an agent, buy or wear a cosmetic.
 * Everything the action counts toward is written before answering, and the answer carries the Hub state after it
 * (`state`), so the app shows quests, coins and levels without another request.
 */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`hub:${user.userId}`, 60))) return jsonError(429, "Too many taps at once. Wait a minute.");
  const b = (await req.json().catch(() => null)) as { action?: string; questId?: string; tier?: number; agent?: string; coins?: number; item?: string | null; kind?: string } | null;
  if (!b || typeof b.action !== "string") return jsonError(400, "Missing action.");
  const done = async (r: object) => Response.json({ ...r, state: await hubState(user).catch(() => null) }, { headers: { "cache-control": "no-store" } });
  switch (b.action) {
    case "checkin": return done(await checkIn(user));
    case "quest": if (typeof b.questId !== "string") return jsonError(400, "Missing quest."); return done(await claimQuest(user, b.questId));
    case "box": return done(await openBox(user));
    case "tier": if (!Number.isInteger(b.tier)) return jsonError(400, "Missing tier."); return done(await claimTier(user, b.tier!));
    case "train": { if (typeof b.agent !== "string" || !Number.isFinite(b.coins)) return jsonError(400, "Missing agent or amount."); const r = await train(user, b.agent, Math.min(100_000, Number(b.coins))); forgetLevel(user.userId, b.agent); return done(r); }
    case "buy": if (typeof b.item !== "string") return jsonError(400, "Missing item."); return done(await buy(user, b.item));
    case "wear": if (b.kind !== "bg" && b.kind !== "bubble") return jsonError(400, "Missing kind."); return done(await applyCosmetic(user, b.kind, typeof b.item === "string" ? b.item : null));
    default: return jsonError(400, "Unknown action.");
  }
});
