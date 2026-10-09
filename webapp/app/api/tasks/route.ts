import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { agents } from "@/server/db/schema";
import { HttpError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { addSchedule, listTasks, postedFor, startMeeting, view } from "@/server/tasks/tasks";
import { meetingLink } from "@/server/tasks/meet";

export const runtime = "nodejs";
export const maxDuration = 80;

/** Your agents' tasks (one agent with ?agent=), plus result messages posted in the last minutes for an open chat. */
export const GET = withUser(async (user, req) => {
  const agent = new URL(req.url).searchParams.get("agent") || undefined;
  if (agent && !/^[\w-]{1,60}$/.test(agent)) throw new HttpError(400, "Bad agent.");
  const rows = await listTasks(user.userId, agent);
  return Response.json({ tasks: rows.map(view), posted: await postedFor(user.userId, rows) }, { headers: { "cache-control": "no-store" } });
});

const slug = z.string().regex(/^[\w-]{1,60}$/);
const convo = z.string().min(1).max(120);
const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("meeting"), agent: slug, convo, url: z.string().url().max(600), as: z.enum(["me", "agent"]), messageId: z.string().max(80).optional() }).strict(),
  z.object({ op: z.literal("schedule"), agent: slug, convo, prompt: z.string().min(3).max(1200), every: z.string().min(3).max(60), tz: z.string().max(60) }).strict(),
]);

/** Join a meeting (you tapped Join on the card) or add a recurring task. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`tasks:${user.userId}`, 20, 60_000))) throw new HttpError(429, "Too many requests. Wait a minute.");
  const [a] = await db().select({ id: agents.id, kind: agents.kind }).from(agents).where(and(eq(agents.userId, user.userId), eq(agents.slug, b.agent))).limit(1);
  if (!a && b.agent !== "home") throw new HttpError(403, "That agent is not on your team.");
  if (a?.kind === "hired") throw new HttpError(403, "Only your own agents can do this.");
  if (b.op === "meeting") {
    const link = meetingLink(b.url);
    if (!link) throw new HttpError(400, "That isn't a Zoom, Google Meet, Teams or Jitsi link.");
    const row = await startMeeting(user.userId, { agent: b.agent, convo: b.convo, url: link.url, platform: link.platform, mode: b.as, messageId: b.messageId });
    return Response.json({ task: view(row) });
  }
  const row = await addSchedule(user.userId, { agent: b.agent, convo: b.convo, prompt: b.prompt, every: b.every, tz: b.tz });
  return Response.json({ task: view(row) });
});
