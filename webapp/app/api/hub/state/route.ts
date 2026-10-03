import { hubState } from "@/server/hub/state";
import { withUser } from "@/server/route";

export const runtime = "nodejs";
export const GET = withUser(async (user) => Response.json(await hubState(user), { headers: { "cache-control": "no-store" } }));
