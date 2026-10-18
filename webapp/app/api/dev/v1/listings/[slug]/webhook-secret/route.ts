import { authKey } from "@/server/market/developers";
import { rotateWebhookSecret } from "@/server/market/publish";
import { noStore, toErrorResponse } from "@/server/http";
import { forgetDevAgent } from "@/server/market/devtools";

export const runtime = "nodejs";

/** Rotate a listing's webhook signing secret (key scope "publish"). The new secret is shown once. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { developer } = await authKey(req, "publish");
    const { slug } = await ctx.params;
    const webhookSecret = await rotateWebhookSecret(developer, slug);
    forgetDevAgent(slug);
    return Response.json({ webhookSecret }, { headers: noStore });
  } catch (e) { return toErrorResponse(e); }
}
