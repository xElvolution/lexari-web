import { z } from "zod";
import { finishSecretRequest, listSecrets, pendingRequest, saveSecret } from "@/server/secrets";
import { jsonError, noStore, rateLimit, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { findSecrets, isBlockedKind } from "@/lib/secretScan";

export const runtime = "nodejs";

/** Your saved secrets: names, services, last 4, agents. Never values. */
export const GET = withUser(async (user) => Response.json({ secrets: await listSecrets(user.userId) }, { headers: noStore }));

const agentId = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);
const body = z.object({
  name: z.string().trim().min(2).max(64),
  value: z.string().min(1).max(8192),
  label: z.string().trim().max(80).optional(),
  service: z.string().trim().max(40).optional(),
  agents: z.array(agentId).max(40).optional(),
  /** the secure card in chat this answers */
  requestId: z.string().uuid().optional(),
}).strict();

/** Saves a secret (from the secure card, the composer's "Save securely", or Settings). The response never echoes it. */
export const POST = withUser(async (user, req) => {
  if (!(await rateLimit(`secrets:save:${user.userId}`, 40, 3_600_000))) return jsonError(429, "That's a lot of secrets. Try again later.");
  const b = await readJson(req, body);
  if (b instanceof Response) return b;
  const blocked = (await findSecrets(b.value)).find((f) => isBlockedKind(f.kind));
  if (blocked) return jsonError(400, `That looks like ${blocked.label}. Lexari never stores those, and no agent needs one. Keep it private.`);
  let agents = b.agents;
  if (b.requestId) {
    const r = await pendingRequest(user.userId, b.requestId);
    if (!r) return jsonError(404, "That request is gone.");
    if (r.status !== "pending") return jsonError(409, r.status === "saved" ? "Already saved." : "This request was cancelled.");
    if (!agents) agents = []; // a card answer is usable by every agent unless you narrow it in Settings
  }
  const secret = await saveSecret(user.userId, { name: b.name, value: b.value, label: b.label, service: b.service, agents });
  const card = b.requestId ? await finishSecretRequest(user.userId, b.requestId, "saved", secret.name) : null;
  return Response.json({ secret, ...(card ? { card } : {}) }, { headers: noStore });
});
