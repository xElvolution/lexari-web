import { z } from "zod";
import { readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { actOnTask, view } from "@/server/tasks/tasks";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ op: z.enum(["stop", "pause", "resume", "delete"]) }).strict();

/** Stop a meeting or job, pause/resume a schedule, or delete a task. */
export const POST = withUser<Ctx>(async (user, req, ctx) => {
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const row = await actOnTask(user.userId, (await ctx.params).id, b.op);
  return Response.json({ task: row ? view(row) : null });
});
