import { z } from "zod";
import { lockHashOf } from "@/server/lock";
import { noStore, rateLimit, jsonError, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { DEFAULT_DAILY_CAP_USD, MAX_DAILY_CAP_USD, STEPUP_SEND_USD, listAddresses, listSessions, movedToday, recentEvents, securityOf, updateSecurity } from "@/server/security";

export const runtime = "nodejs";

/** Settings > Security: your sessions, money limit, saved addresses, anti-phishing phrase and recent security activity. */
export const GET = withUser(async (user) => {
  const [settings, sessionsList, addresses, events, moved, pin] = await Promise.all([
    securityOf(user.userId), listSessions(user.userId, user.sessionId), listAddresses(user.userId), recentEvents(user.userId), movedToday(user.userId), lockHashOf(user.userId),
  ]);
  return Response.json({
    settings, sessions: sessionsList, addresses,
    events: events.filter((e) => e.kind !== "walletsend").map((e) => ({ ...e, at: e.at.getTime() })),
    movedTodayMicros: moved, pin: !!pin,
    stepup: { until: user.stepupUntil?.getTime() ?? 0, sendUsd: STEPUP_SEND_USD },
    limits: { defaultCapUsd: DEFAULT_DAILY_CAP_USD, maxCapUsd: MAX_DAILY_CAP_USD },
  }, { headers: noStore });
});

const patch = z.object({
  phrase: z.string().max(40).regex(/^[^<>]*$/, "no < or >").optional(),
  dailySendCapUsd: z.number().int().min(0).max(MAX_DAILY_CAP_USD).optional(),
  allowlistOnly: z.boolean().optional(),
}).strict();

export const PATCH = withUser(async (user, req) => {
  const b = await readJson(req, patch);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`sec:patch:${user.userId}`, 20))) return jsonError(429, "Too many changes. Wait a minute.");
  return Response.json({ settings: await updateSecurity(user, b) }, { headers: noStore });
});
