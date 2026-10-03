import { attestorKeypair } from "@/server/hub/keys";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const key = attestorKeypair();
  if (!key) return jsonError(503, "LEXARI_ATTESTOR_KEY is not set");
  return Response.json({ attestor: key.publicKey.toBase58() });
}
