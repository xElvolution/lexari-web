/**
 * Marketplace listings from the database. House specialists are stored with their store card exactly as the app
 * shipped it, so the marketplace renders the same; third-party listings get a card built from their approved
 * manifest plus real hires and reviews.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Manifest } from "@lexari/manifest";
import type { ListingInfo, Specialist } from "@/content/appData";
export type { ListingInfo };
import { db } from "../db";
import { agentListings, developers, hireEvents, listingReviews, listingVersions } from "../db/marketSchema";

/** A store card: house cards have no `listing`; third-party cards carry their listing details. */
export type StoreCard = Specialist & { listing?: ListingInfo };

export type ListingRow = {
  id: string; slug: string; house: boolean; status: string; developerId: string;
  developer: { handle: string; name: string; verified: boolean; status: string };
  version: { id: string; version: string; manifest: Manifest | null; card: Specialist; createdAt: Date } | null;
};

const TTL = 30_000;
let cache: { at: number; list: StoreCard[] } | null = null;
export const invalidateListings = () => { cache = null; };

/** Builds the store card for a third-party manifest. */
export function cardFromManifest(m: Manifest, stats: { hires: number; rating: number; reviews: number; review: Specialist["review"] } = { hires: 0, rating: 0, reviews: 0, review: [] }): Specialist {
  return {
    slug: m.id, name: m.name, job: m.persona.job, cat: m.category, quip: m.persona.quip, back: m.persona.description,
    rating: stats.rating, jobs: stats.hires, reviews: stats.reviews, seed: m.face.seed, color: m.face.color,
    speed: m.tools.length ? "Uses live tools" : "Answers in chat",
    skills: m.persona.skills.length ? m.persona.skills : [[m.persona.job, 90]],
    tools: m.tools.length ? m.tools.map((t) => t.name.replace(/_/g, " ")) : ["Chat"],
    examples: m.persona.examples, words: [], review: stats.review,
  };
}

function distOf(counts: number[]) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return [0, 0, 0, 0, 0];
  return counts.map((c) => Math.round((c / total) * 100));
}

async function stats(listingIds: string[]) {
  if (!listingIds.length) return new Map<string, { hires: number; rating: number; reviews: number; counts: number[]; review: Specialist["review"] }>();
  const database = db();
  const [hireRows, starRows, recent] = await Promise.all([
    database.select({ id: hireEvents.listingId, n: sql<number>`count(*)::int` }).from(hireEvents).where(inArray(hireEvents.listingId, listingIds)).groupBy(hireEvents.listingId),
    database.select({ id: listingReviews.listingId, stars: listingReviews.stars, n: sql<number>`count(*)::int` }).from(listingReviews).where(inArray(listingReviews.listingId, listingIds)).groupBy(listingReviews.listingId, listingReviews.stars),
    database.select({ id: listingReviews.listingId, stars: listingReviews.stars, body: listingReviews.body, userId: listingReviews.userId }).from(listingReviews).where(inArray(listingReviews.listingId, listingIds)).orderBy(desc(listingReviews.createdAt)).limit(200),
  ]);
  const out = new Map<string, { hires: number; rating: number; reviews: number; counts: number[]; review: Specialist["review"] }>();
  for (const id of listingIds) out.set(id, { hires: 0, rating: 0, reviews: 0, counts: [0, 0, 0, 0, 0], review: [] });
  for (const r of hireRows) out.get(r.id)!.hires = Number(r.n);
  for (const r of starRows) { const s = out.get(r.id)!; s.counts[5 - r.stars] += Number(r.n); s.reviews += Number(r.n); }
  for (const s of out.values()) s.rating = s.reviews ? Math.round((s.counts.reduce((a, n, i) => a + n * (5 - i), 0) / s.reviews) * 10) / 10 : 0;
  for (const r of recent) {
    const s = out.get(r.id)!;
    if (s.review.length < 3 && r.body) s.review.push({ who: "Lexari member", seed: parseInt(r.userId.slice(0, 6), 16) % 997, text: r.body, stars: r.stars });
  }
  return out;
}

async function rows(where: ReturnType<typeof and> | undefined): Promise<ListingRow[]> {
  const r = await db().select({
    id: agentListings.id, slug: agentListings.slug, house: agentListings.house, status: agentListings.status, developerId: agentListings.developerId, sortOrder: agentListings.sortOrder,
    dHandle: developers.handle, dName: developers.name, dVerified: developers.verified, dStatus: developers.status,
    vId: listingVersions.id, vVersion: listingVersions.version, vManifest: listingVersions.manifest, vCard: listingVersions.card, vCreated: listingVersions.createdAt,
  }).from(agentListings)
    .innerJoin(developers, eq(developers.id, agentListings.developerId))
    .leftJoin(listingVersions, and(eq(listingVersions.id, agentListings.currentVersionId), eq(listingVersions.status, "approved")))
    .where(where)
    .orderBy(desc(agentListings.house), asc(agentListings.sortOrder), asc(agentListings.createdAt));
  return r.map((x) => ({
    id: x.id, slug: x.slug, house: x.house, status: x.status, developerId: x.developerId,
    developer: { handle: x.dHandle, name: x.dName, verified: x.dVerified, status: x.dStatus },
    version: x.vId ? { id: x.vId, version: x.vVersion!, manifest: (x.vManifest as Manifest | null) ?? null, card: x.vCard as unknown as Specialist, createdAt: x.vCreated! } : null,
  }));
}

async function toCards(list: ListingRow[]): Promise<StoreCard[]> {
  const third = list.filter((l) => !l.house && l.version?.manifest);
  const st = await stats(third.map((l) => l.id));
  return list.flatMap((l): StoreCard[] => {
    if (!l.version) return [];
    if (l.house || !l.version.manifest) return [l.version.card];
    const s = st.get(l.id)!;
    const m = l.version.manifest;
    return [{
      ...cardFromManifest(m, s),
      listing: { id: l.id, developer: { handle: l.developer.handle, name: l.developer.name, verified: l.developer.verified }, version: m.version, priceUsd: m.pricing.usd, hires: s.hires, updatedAt: l.version.createdAt.getTime(), dist: distOf(s.counts) },
    }];
  });
}

/** Everything on the marketplace now: listed, with an approved version, from an active developer. Cached briefly. */
export async function publicListings(): Promise<StoreCard[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.list;
  const list = await toCards(await rows(and(eq(agentListings.status, "listed"), eq(developers.status, "active"))));
  cache = { at: Date.now(), list };
  return list;
}

/** One listing for the server (hire, chat), listed or not. Null when the slug isn't a listing. */
export async function listingBySlug(slug: string): Promise<(ListingRow & { card: StoreCard | null; live: boolean }) | null> {
  const [l] = await rows(eq(agentListings.slug, slug));
  if (!l) return null;
  const [card] = await toCards([l]);
  return { ...l, card: card ?? null, live: l.status === "listed" && l.developer.status === "active" && !!l.version };
}

/** Store cards for third-party agents you already hired, so your team can show them even if they were delisted later. */
export async function cardsForSlugs(slugs: string[]): Promise<StoreCard[]> {
  if (!slugs.length) return [];
  const list = await rows(and(inArray(agentListings.slug, slugs), eq(agentListings.house, false)));
  return toCards(list);
}
