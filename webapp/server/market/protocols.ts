/**
 * Merged protocol integrations become dApps agents can use.
 *
 * integrations/<slug>/integration.json entries of kind "dapp" with a live status (live-testnet or live-devnet, set by
 * Lexari when the PR is reviewed and merged) are synced into the marketplace as normal third-party listings: one
 * developer per protocol, one approved version per manifest version. From there they run through the exact same
 * dev connector pipeline as any reviewed agent (server/market/devtools.ts): signed webhook calls with pseudonymous ids,
 * no personal tools, money only through intents that become Confirm cards under DEV_CAPS, never a direct signature,
 * and testnet only. An entry that is removed or no longer live is delisted.
 */
import { randomBytes } from "node:crypto";
import { and, eq, inArray, like, notInArray } from "drizzle-orm";
import { parseManifest, type Manifest } from "@lexari/manifest";
import generatedEntries from "@/content/integrations.generated.json";
import { db } from "../db";
import { agentListings, developers, listingVersions } from "../db/marketSchema";
import { seal, secretBoxReady } from "../secretBox";
import { automatedChecks, contentHash } from "./publish";
import { cardFromManifest, invalidateListings } from "./listings";
import { forgetDevAgent } from "./devtools";

export const LIVE_DAPP = new Set(["live-testnet", "live-devnet"]);
export const PROTOCOL_DEV_PREFIX = "protocol-";

export type ProtocolEntry = { slug: string; name: string; kind: string; status: string; website?: string; agent?: unknown };
export type SyncResult = {
  listed: string[]; unchanged: string[]; delisted: string[];
  skipped: { slug: string; reason: string }[];
  /** new webhook secrets, to hand to each protocol privately; never logged */
  secrets: { slug: string; secret: string }[];
};

/** The manifest a merged entry runs as, or the reason it can't run. Pricing is always free for protocol dApps. */
export async function protocolManifest(e: ProtocolEntry): Promise<{ ok: true; manifest: Manifest } | { ok: false; reason: string }> {
  if (e.kind !== "dapp") return { ok: false, reason: "not a dApp entry" };
  const parsed = parseManifest(e.agent);
  if (!parsed.ok) return { ok: false, reason: "the agent manifest isn't valid" };
  const m = parsed.manifest;
  if (m.id !== e.slug) return { ok: false, reason: "agent.id has to be the folder slug" };
  if (m.pricing.type !== "free") return { ok: false, reason: "protocol dApps are free to add" };
  const failed = (await automatedChecks(m, { dns: false })).filter((c) => !c.ok);
  if (failed.length) return { ok: false, reason: failed.map((c) => c.detail || c.name).join("; ") };
  return { ok: true, manifest: m };
}

async function developerFor(e: ProtocolEntry) {
  const handle = `${PROTOCOL_DEV_PREFIX}${e.slug}`;
  const [found] = await db().select().from(developers).where(eq(developers.handle, handle)).limit(1);
  if (found) {
    if (found.name !== e.name || found.url !== (e.website || "")) await db().update(developers).set({ name: e.name, url: e.website || "" }).where(eq(developers.id, found.id));
    return found;
  }
  // Reviewed through a merged pull request, so the protocol shows as verified. No user account: nobody signs in as it.
  const [d] = await db().insert(developers).values({ handle, name: e.name, url: e.website || "", verified: true }).returning();
  return d;
}

/** Bring the marketplace in line with integrations/. Safe to run on every deploy. */
export async function syncProtocolListings(entries: ProtocolEntry[] = generatedEntries as ProtocolEntry[]): Promise<SyncResult> {
  const out: SyncResult = { listed: [], unchanged: [], delisted: [], skipped: [], secrets: [] };
  const keep: string[] = [];
  for (const e of entries.filter((x) => x.kind === "dapp" && LIVE_DAPP.has(x.status))) {
    const r = await protocolManifest(e);
    if (!r.ok) { out.skipped.push({ slug: e.slug, reason: r.reason }); continue; }
    const m = r.manifest;
    if (m.tools.length && !secretBoxReady()) { out.skipped.push({ slug: e.slug, reason: "webhook secrets can't be sealed on this server" }); continue; }
    const dev = await developerFor(e);
    const hash = contentHash(m);
    const res = await db().transaction(async (tx) => {
      let [l] = await tx.select().from(agentListings).where(eq(agentListings.slug, m.id)).for("update").limit(1);
      if (l && l.developerId !== dev.id) return { skip: "that slug already belongs to another agent" };
      if (!l) [l] = await tx.insert(agentListings).values({ developerId: dev.id, slug: m.id, status: "listed" }).returning();
      let secret: string | undefined;
      if (m.tools.length && !l.webhookSecret) {
        secret = `lxwh_${randomBytes(32).toString("base64url")}`;
        await tx.update(agentListings).set({ webhookSecret: seal(secret, `webhook:${l.id}`) }).where(eq(agentListings.id, l.id));
      }
      const [same] = await tx.select().from(listingVersions).where(and(eq(listingVersions.listingId, l.id), eq(listingVersions.version, m.version))).limit(1);
      if (same && same.contentHash !== hash) return { skip: `version ${m.version} changed without a version bump`, secret };
      const now = new Date();
      if (same && same.status === "approved" && l.currentVersionId === same.id && l.status === "listed") return { unchanged: true, secret };
      await tx.update(listingVersions).set({ status: "superseded" }).where(and(eq(listingVersions.listingId, l.id), eq(listingVersions.status, "approved")));
      const checks = await automatedChecks(m, { dns: false });
      const v = same
        ? (await tx.update(listingVersions).set({ status: "approved", reviewedAt: now }).where(eq(listingVersions.id, same.id)).returning())[0]
        : (await tx.insert(listingVersions).values({ listingId: l.id, version: m.version, manifest: m as unknown as Record<string, unknown>, card: cardFromManifest(m) as unknown as Record<string, unknown>, contentHash: hash, status: "approved", checks, reviewNotes: "Reviewed and merged through integrations/ on GitHub.", reviewedAt: now }).returning())[0];
      await tx.update(agentListings).set({ status: "listed", currentVersionId: v.id, updatedAt: now }).where(eq(agentListings.id, l.id));
      return { listed: true, secret };
    });
    if (res.secret) out.secrets.push({ slug: e.slug, secret: res.secret });
    if ("skip" in res && res.skip) { out.skipped.push({ slug: e.slug, reason: res.skip }); continue; }
    keep.push(m.id);
    ("unchanged" in res ? out.unchanged : out.listed).push(m.id);
  }
  // Protocol listings whose entry is gone or no longer live come off the marketplace. Hired copies stop calling them.
  const protocolDevs = db().select({ id: developers.id }).from(developers).where(like(developers.handle, `${PROTOCOL_DEV_PREFIX}%`));
  const gone = await db().update(agentListings).set({ status: "delisted", updatedAt: new Date() })
    .where(and(inArray(agentListings.developerId, protocolDevs), eq(agentListings.status, "listed"), eq(agentListings.house, false), ...(keep.length ? [notInArray(agentListings.slug, keep)] : [])))
    .returning({ slug: agentListings.slug });
  out.delisted = gone.map((g) => g.slug);
  invalidateListings(); forgetDevAgent();
  return out;
}
