/** The database-backed marketplace: the house seed matches the app, listing visibility, cards and the revenue split. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../../server/db";
import { agentListings, developers, hireEvents, listingReviews, listingVersions } from "../../server/db/marketSchema";
import { SPECIALISTS, storeMeta } from "@/content/appData";
import { cardsForSlugs, invalidateListings, listingBySlug, publicListings } from "../../server/market/listings";
import { REVENUE_SPLIT, splitRevenue } from "../../server/market/config";
import { parseManifest } from "@lexari/manifest";
import { person, rnd } from "./helpers";

after(() => setTimeout(() => process.exit(0), 50));

const manifest = (id: string) => {
  const r = parseManifest({ manifestVersion: 1, id, name: "Tip Jar", version: "1.0.0", category: "Onchain", face: { seed: 42, color: "teal" }, persona: { job: "Tips creators", quip: "Small thanks, sent fast.", description: "Prepares a small tip for you to confirm.", examples: ["Tip Ada 1 USDC"] }, pricing: { type: "hire", usd: 2 } });
  assert.ok(r.ok); return r.manifest;
};
async function devListing(status: "listed" | "in_review" | "delisted" = "listed", approved = true) {
  const u = await person();
  const [d] = await db().insert(developers).values({ userId: u.id, handle: `dev-${rnd()}`, name: "Acme Agents" }).returning();
  const m = manifest(`tip-${rnd()}`);
  const [l] = await db().insert(agentListings).values({ developerId: d.id, slug: m.id, status }).returning();
  const [v] = await db().insert(listingVersions).values({ listingId: l.id, version: "1.0.0", manifest: m as never, card: {}, contentHash: "x", status: approved ? "approved" : "pending" }).returning();
  await db().update(agentListings).set({ currentVersionId: v.id }).where(eq(agentListings.id, l.id));
  invalidateListings();
  return { d, l, v, m, u };
}

test("the house specialists in the database are exactly the app's, in the same order", async () => {
  const list = (await publicListings()).filter((c) => !c.listing);
  assert.equal(list.length, SPECIALISTS.length);
  assert.deepEqual(list, JSON.parse(JSON.stringify(SPECIALISTS)));
  // storeMeta (hires, maker, version...) is the same for the database copy as for the shipped object
  list.forEach((c, i) => assert.deepEqual(storeMeta(c), storeMeta(SPECIALISTS[i])));
  const [house] = await db().select().from(developers).where(eq(developers.handle, "lexari"));
  assert.ok(house.house && house.verified && house.userId === null);
});

test("third-party listings show only when listed, approved and the developer is active", async () => {
  const live = await devListing();
  const review = await devListing("in_review", false);
  const gone = await devListing("delisted");
  const slugs = (await publicListings()).map((c) => c.slug);
  assert.ok(slugs.includes(live.m.id));
  assert.ok(!slugs.includes(review.m.id));
  assert.ok(!slugs.includes(gone.m.id));
  await db().update(developers).set({ status: "suspended" }).where(eq(developers.id, live.d.id));
  invalidateListings();
  assert.ok(!(await publicListings()).some((c) => c.slug === live.m.id));
  assert.equal((await listingBySlug(live.m.id))?.live, false);
});

test("a third-party card carries real hires, ratings, price and developer", async () => {
  const x = await devListing();
  const buyer = await person();
  await db().insert(hireEvents).values({ listingId: x.l.id, versionId: x.v.id, buyerId: buyer.id, ref: `hire:${rnd()}`, grossMicros: 2e6, developerMicros: 1.6e6, lexariMicros: 0.4e6, splitBps: 8000 });
  await db().insert(listingReviews).values({ listingId: x.l.id, userId: buyer.id, stars: 4, body: "Quick and careful." });
  const [card] = await cardsForSlugs([x.m.id]);
  assert.equal(card.name, "Tip Jar");
  assert.equal(card.jobs, 1);
  assert.equal(card.rating, 4);
  assert.equal(card.reviews, 1);
  assert.equal(card.listing?.priceUsd, 2);
  assert.equal(card.listing?.developer.name, "Acme Agents");
  assert.deepEqual(card.listing?.dist, [0, 100, 0, 0, 0]);
  assert.equal(storeMeta(card).maker, "Acme Agents");
  assert.equal(storeMeta(card).hires, 1);
});

test("revenue split: 80/20, whole micro-dollars that add up", () => {
  assert.deepEqual(REVENUE_SPLIT, { developerBps: 8000, lexariBps: 2000 });
  assert.deepEqual(splitRevenue(1_000_000), { gross: 1_000_000, developer: 800_000, lexari: 200_000, bps: 8000 });
  const odd = splitRevenue(1_234_567);
  assert.equal(odd.developer + odd.lexari, 1_234_567);
  assert.equal(splitRevenue(0).developer, 0);
});

test("hire_events refuse a split that doesn't add up", async () => {
  const x = await devListing();
  const buyer = await person();
  await assert.rejects(() => db().insert(hireEvents).values({ listingId: x.l.id, buyerId: buyer.id, ref: `bad:${rnd()}`, grossMicros: 100, developerMicros: 90, lexariMicros: 20, splitBps: 8000 }));
});
