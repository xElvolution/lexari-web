import { z } from "zod";
import { noStore, readJson } from "@/server/http";
import { withUser } from "@/server/route";
import { addAddress, removeAddress } from "@/server/security";

export const runtime = "nodejs";

/** Save a send address (needs a fresh confirm) or remove one. */
export const POST = withUser(async (user, req) => {
  const b = await readJson(req, z.union([
    z.object({ address: z.string().trim().min(32).max(44), label: z.string().max(40).regex(/^[^<>]*$/).default("") }).strict(),
    z.object({ remove: z.string().uuid() }).strict(),
  ]));
  if (b instanceof Response) return b;
  const addresses = "remove" in b ? await removeAddress(user, b.remove) : await addAddress(user, b.address, b.label);
  return Response.json({ addresses }, { headers: noStore });
});
