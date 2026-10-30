/**
 * Publishing a version (lexari publish) and the review that lists it.
 *
 *  publishVersion: validate the manifest with the shared schema, run the automated checks, store the version as
 *  "pending" and put the listing in review. The listing's webhook secret is made on first publish and returned once.
 *  decideVersion: a Lexari reviewer approves (the version goes live, the previous one is replaced) or asks for changes.
 */
import { createHash, randomBytes } from "node:crypto";
import dns from "node:dns/promises";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { parseManifest, type Manifest } from "@lexari/manifest";
import { SPECIALISTS } from "@/content/appData";
import { scanSecrets, isBlockedKind } from "@/lib/secretScan";
import { db } from "../db";
import { agentListings, developers, listingVersions } from "../db/marketSchema";
import { HttpError } from "../http";
import { privateIp } from "../net/safeFetch";
import { open, seal, secretBoxReady } from "../secretBox";
import type { Developer } from "./developers";
import { cardFromManifest, invalidateListings } from "./listings";
import { forgetDevAgent } from "./devtools";

export type Check = { name: string; ok: boolean; detail?: string };

/** Stable JSON (sorted keys) so the same manifest always hashes the same. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
export const contentHash = (m: Manifest) => createHash("sha256").update(canonical(m)).digest("hex");

const semverParts = (v: string) => v.split(".").map(Number);
export function newerThan(a: string, b: string) {
  const x = semverParts(a), y = semverParts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** Phrases a reviewed agent must never carry in its own instructions: overriding Lexari's rules, keys, or draining funds. */
const RED_FLAGS: [RegExp, string][] = [
  [/ignore (all |any )?(previous|prior|above|lexari'?s?|system) (instructions|rules|prompts?)/i, "tries to override Lexari's rules"],
  [/(you are|act as) (now )?(dan|jailbroken|unrestricted)/i, "jailbreak language"],
  [/(seed|recovery|secret) phrase|mnemonic|private key|api key|password/i, "mentions keys, recovery phrases or passwords"],
  [/(send|transfer|move|withdraw) (all|every|the (entire|whole)) (funds?|balance|money|tokens?)/i, "asks to move all funds"],
  [/without (asking|confirm|a confirm card|the person'?s? (ok|approval))/i, "asks to act without the person's confirmation"],
  [/(skip|bypass|disable|raise) (the )?(confirm(ation)? cards?|limits?|caps?)/i, "asks to bypass Confirm cards or limits"],
  [/<\/?tool\b/i, "contains raw tool tags"],
];

/** Text a person or the model will read from this manifest. */
function readableText(m: Manifest) {
  return [m.name, m.persona.job, m.persona.quip, m.persona.description, m.persona.system || "", ...m.persona.examples, ...m.persona.skills.map((s) => s[0]), ...m.tools.flatMap((t) => [t.description, ...Object.values(t.input.properties).map((p) => p.description || "")])].join("\n");
}

async function hostIsPublic(url: string): Promise<string | null> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return `${host} is a private host`;
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length) return `${host} doesn't resolve`;
    const bad = addrs.find((a) => privateIp(a.address));
    return bad ? `${host} resolves to a private address` : null;
  } catch { return `${host} doesn't resolve`; }
}

/** The automated checks every version runs before a person reviews it. Any failure blocks the submission. */
export async function automatedChecks(m: Manifest, opts: { dns?: boolean } = {}): Promise<Check[]> {
  const text = readableText(m);
  const checks: Check[] = [{ name: "Manifest schema", ok: true }];
  const secrets = scanSecrets(text).filter((f) => isBlockedKind(f.kind) || f.kind === "key");
  checks.push({ name: "No secrets in the manifest", ok: !secrets.length, ...(secrets.length ? { detail: `Found what looks like ${secrets[0].label}. Remove it.` } : {}) });
  const flags = RED_FLAGS.filter(([re]) => re.test(text)).map(([, why]) => why);
  checks.push({ name: "Instructions follow the safety rules", ok: !flags.length, ...(flags.length ? { detail: `The text ${flags.join("; ")}.` } : {}) });
  const house = SPECIALISTS.some((s) => s.slug === m.id || s.name.toLowerCase() === m.name.toLowerCase());
  checks.push({ name: "Name and id don't impersonate a Lexari specialist", ok: !house && !/lexari/i.test(m.name), ...(house || /lexari/i.test(m.name) ? { detail: "Pick a name that isn't a Lexari specialist or the Lexari brand." } : {}) });
  if (opts.dns !== false) {
    const hosts = [...new Set(m.tools.map((t) => t.url))];
    const problems = (await Promise.all(hosts.map(hostIsPublic))).filter((x): x is string => !!x);
    checks.push({ name: "Tool endpoints are public HTTPS", ok: !problems.length, ...(problems.length ? { detail: problems.join("; ") } : {}) });
  }
  const moneyTools = m.tools.filter((t) => t.intents?.length).map((t) => t.name);
  checks.push({ name: "Money only through intents", ok: true, detail: moneyTools.length ? `${moneyTools.join(", ")} may propose ${[...new Set(m.tools.flatMap((t) => t.intents || []))].join(" and ")}; each one is a Confirm card.` : "Read-only agent." });
  return checks;
}

export type PublishResult = { listing: { id: string; slug: string; status: string }; version: { id: string; version: string; status: string; contentHash: string }; checks: Check[]; webhookSecret?: string };

/** lexari publish: one new version, waiting for review. */
export async function publishVersion(dev: Developer, raw: unknown, opts: { dns?: boolean } = {}): Promise<PublishResult> {
  const parsed = parseManifest(raw);
  if (!parsed.ok) throw new HttpError(422, "The manifest isn't valid.", { issues: parsed.issues });
  const m = parsed.manifest;
  const checks = await automatedChecks(m, opts);
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) throw new HttpError(422, "The automated checks failed. Fix these and publish again.", { checks });
  if (m.tools.length && !secretBoxReady()) throw new HttpError(503, "Webhook tools can't be published on this server yet.");
  const hash = contentHash(m);
  return db().transaction(async (tx) => {
    const [existing] = await tx.select().from(agentListings).where(eq(agentListings.slug, m.id)).for("update").limit(1);
    if (existing && existing.developerId !== dev.id) throw new HttpError(409, `The id ${m.id} is taken. Pick another id in your manifest.`);
    let listing = existing;
    let webhookSecret: string | undefined;
    if (!listing) {
      [listing] = await tx.insert(agentListings).values({ developerId: dev.id, slug: m.id, status: "in_review" }).returning();
    }
    if (m.tools.length && !listing.webhookSecret) {
      webhookSecret = `lxwh_${randomBytes(32).toString("base64url")}`;
      await tx.update(agentListings).set({ webhookSecret: seal(webhookSecret, `webhook:${listing.id}`) }).where(eq(agentListings.id, listing.id));
    }
    const versions = await tx.select({ version: listingVersions.version, status: listingVersions.status, hash: listingVersions.contentHash }).from(listingVersions).where(eq(listingVersions.listingId, listing.id));
    if (versions.some((v) => v.version === m.version)) throw new HttpError(409, `Version ${m.version} was already published. Bump the version in your manifest.`);
    const top = versions.filter((v) => v.status !== "rejected").map((v) => v.version).sort((a, b) => (newerThan(a, b) ? -1 : 1))[0];
    if (top && !newerThan(m.version, top)) throw new HttpError(409, `Version ${m.version} has to be newer than ${top}.`);
    // A newer submission replaces any version still waiting for review.
    await tx.update(listingVersions).set({ status: "superseded", reviewNotes: "Replaced by a newer submission." }).where(and(eq(listingVersions.listingId, listing.id), eq(listingVersions.status, "pending")));
    const [v] = await tx.insert(listingVersions).values({ listingId: listing.id, version: m.version, manifest: m as unknown as Record<string, unknown>, card: cardFromManifest(m) as unknown as Record<string, unknown>, contentHash: hash, status: "pending", checks }).returning();
    const status = listing.status === "listed" ? "listed" : "in_review";
    await tx.update(agentListings).set({ status, updatedAt: new Date() }).where(eq(agentListings.id, listing.id));
    return { listing: { id: listing.id, slug: listing.slug, status }, version: { id: v.id, version: v.version, status: v.status, contentHash: hash }, checks, ...(webhookSecret ? { webhookSecret } : {}) };
  });
}

/** A new webhook secret (shown once); the old one stops working at once. */
export async function rotateWebhookSecret(dev: Developer, slug: string) {
  const [l] = await db().select().from(agentListings).where(and(eq(agentListings.slug, slug), eq(agentListings.developerId, dev.id))).limit(1);
  if (!l) throw new HttpError(404, "You have no listing with that id.");
  const secret = `lxwh_${randomBytes(32).toString("base64url")}`;
  await db().update(agentListings).set({ webhookSecret: seal(secret, `webhook:${l.id}`), updatedAt: new Date() }).where(eq(agentListings.id, l.id));
  return secret;
}

/** SERVER ONLY: the listing's webhook secret, for signing calls. */
export function webhookSecretOf(listing: { id: string; webhookSecret: string | null }): string | null {
  if (!listing.webhookSecret) return null;
  try { return open(listing.webhookSecret, `webhook:${listing.id}`); } catch { return null; }
}

/* ---------- review ---------- */
export async function reviewQueue() {
  const rows = await db().select({ v: listingVersions, l: agentListings, d: developers }).from(listingVersions)
    .innerJoin(agentListings, eq(agentListings.id, listingVersions.listingId)).innerJoin(developers, eq(developers.id, agentListings.developerId))
    .where(and(eq(listingVersions.status, "pending"), eq(agentListings.house, false))).orderBy(asc(listingVersions.createdAt)).limit(100);
  const recent = await db().select({ v: listingVersions, l: agentListings }).from(listingVersions).innerJoin(agentListings, eq(agentListings.id, listingVersions.listingId))
    .where(and(ne(listingVersions.status, "pending"), eq(agentListings.house, false))).orderBy(desc(listingVersions.reviewedAt)).limit(20);
  return {
    pending: rows.map(({ v, l, d }) => ({ id: v.id, version: v.version, slug: l.slug, listingStatus: l.status, developer: { handle: d.handle, name: d.name, verified: d.verified }, manifest: v.manifest as unknown as Manifest, checks: v.checks, createdAt: v.createdAt.getTime() })),
    recent: recent.filter((r) => r.v.reviewedAt).map(({ v, l }) => ({ id: v.id, version: v.version, slug: l.slug, status: v.status, notes: v.reviewNotes, reviewedAt: v.reviewedAt!.getTime() })),
  };
}

export async function decideVersion(reviewerId: string, versionId: string, approve: boolean, notes: string) {
  if (!approve && notes.trim().length < 5) throw new HttpError(400, "Tell the developer what to change.");
  const out = await db().transaction(async (tx) => {
    const [v] = await tx.select().from(listingVersions).where(eq(listingVersions.id, versionId)).for("update").limit(1);
    if (!v || v.status !== "pending") throw new HttpError(409, "That version isn't waiting for review any more.");
    const now = new Date();
    if (!approve) {
      await tx.update(listingVersions).set({ status: "rejected", reviewNotes: notes.trim().slice(0, 1000), reviewedBy: reviewerId, reviewedAt: now }).where(eq(listingVersions.id, v.id));
      const [l] = await tx.select().from(agentListings).where(eq(agentListings.id, v.listingId)).limit(1);
      if (l && l.status === "in_review" && !l.currentVersionId) await tx.update(agentListings).set({ status: "draft", updatedAt: now }).where(eq(agentListings.id, l.id));
      return { status: "rejected" as const };
    }
    await tx.update(listingVersions).set({ status: "superseded" }).where(and(eq(listingVersions.listingId, v.listingId), eq(listingVersions.status, "approved")));
    await tx.update(listingVersions).set({ status: "approved", reviewNotes: notes.trim().slice(0, 1000), reviewedBy: reviewerId, reviewedAt: now }).where(eq(listingVersions.id, v.id));
    await tx.update(agentListings).set({ status: "listed", currentVersionId: v.id, updatedAt: now }).where(eq(agentListings.id, v.listingId));
    return { status: "approved" as const };
  });
  invalidateListings(); forgetDevAgent();
  return out;
}

/** Take a listing off the marketplace (reviewer). Hired copies stop calling its tools. */
export async function delist(slug: string, reason: string) {
  const [l] = await db().update(agentListings).set({ status: "delisted", updatedAt: new Date() }).where(and(eq(agentListings.slug, slug), eq(agentListings.house, false))).returning();
  if (!l) throw new HttpError(404, "No such third-party listing.");
  invalidateListings(); forgetDevAgent();
  return { ok: true, reason };
}
