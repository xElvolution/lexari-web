import { db } from "./db";
import { questEvents } from "./db/schema";

/** Records something the person did. With a ref, the same (kind, ref) only counts once. */
export async function recordEvent(userId: string, kind: string, opts: { ref?: string; amount?: number } = {}) {
  await db().insert(questEvents).values({ userId, kind, ref: opts.ref ?? null, amount: opts.amount ?? 0 }).onConflictDoNothing();
}
