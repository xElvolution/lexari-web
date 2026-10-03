import { Connection } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { currentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { agents, hires, listings } from "@/server/db/schema";
import { recordEvent } from "@/server/events";
import { configError, jsonError, readJson, toErrorResponse } from "@/server/http";
import { hireBody } from "@/server/validate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readJson(req, hireBody);
  if (body instanceof Response) return body;
  const missing = configError();
  if (missing) return jsonError(503, missing);
  try {
    const session = await currentSession();
    if (!session) return jsonError(401, "Not signed in.");
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");
    const tx = await connection.getTransaction(body.tx, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) return jsonError(400, "That payment is not on devnet yet.");
    const database = db();
    let listing = await database.select().from(listings).where(and(eq(listings.active, true), eq(listings.mint, body.mint), eq(listings.priceLamports, body.priceLamports))).limit(1);
    if (!listing[0]) {
      const sellerAgent = await database.select().from(agents).where(eq(agents.slug, body.slug)).limit(1);
      const created = await database.insert(listings).values({
        sellerId: session.userId,
        agentId: sellerAgent[0]?.id,
        priceLamports: body.priceLamports,
        mint: body.mint,
      }).returning();
      listing = created;
    }
    const listingId = listing[0]?.id;
    if (!listingId) return jsonError(500, "Could not record the listing.");
    await database.insert(hires).values({ listingId, buyerId: session.userId, tx: body.tx });
    await recordEvent(session.userId, "hire");
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
