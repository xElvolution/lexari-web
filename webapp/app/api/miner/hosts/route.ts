import { z } from "zod";
import { jsonError, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { createHost, listHosts, queueCommand, removeHost, MINER_CMDS } from "@/server/miner/hosts";

export const runtime = "nodejs";

/** Your connected mining servers. */
export const GET = withUser(async (user) => Response.json({ hosts: await listHosts(user.userId) }));

const body = z.union([
  z.object({ op: z.literal("connect"), name: z.string().max(40).optional(), id: z.string().uuid().optional() }).strict(),
  z.object({ op: z.literal("command"), id: z.string().uuid(), cmd: z.enum(MINER_CMDS), threads: z.number().int().min(1).max(64).optional() }).strict(),
  z.object({ op: z.literal("remove"), id: z.string().uuid() }).strict(),
]);

export const POST = withUser(async (user, req) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  if (!(await rateLimit(`miner:${user.userId}`, 120, 3_600_000))) return jsonError(429, "That's a lot of changes. Wait a minute.");
  if (b.op === "connect") return Response.json(await createHost(user.userId, b.name, b.id));
  if (b.op === "command") { const c = await queueCommand(user.userId, b.id, b.cmd, { threads: b.threads }); return Response.json({ ok: true, id: c.id }); }
  return Response.json(await removeHost(user.userId, b.id));
});
