/** Merged protocol integrations (integrations/ kind "dapp") become third-party dApps through the dev connector pipeline. */
import { randomBytes } from "node:crypto";
process.env.MODEL_KEYS_SECRET ||= randomBytes(32).toString("hex");
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { verify, SIGNATURE_HEADER } from "@lexari/manifest/signature";
import { db } from "../../server/db";
import { agentListings, developers } from "../../server/db/marketSchema";
import { publicListings } from "../../server/market/listings";
import { callWebhook, devAgentFor, devToolDefs, forgetDevAgent, intentToCall, proposalFor, setWebhookFetcher } from "../../server/market/devtools";
import { DEV_CAPS, DEV_INTENT_TOOLS } from "../../server/market/config";
import { syncProtocolListings, type ProtocolEntry } from "../../server/market/protocols";
import generated from "@/content/integrations.generated.json";
import { rnd } from "./helpers";

after(() => setTimeout(() => process.exit(0), 50));

const template = JSON.parse(readFileSync(new URL("../../../integrations/TEMPLATE/integration.json", import.meta.url), "utf8"));
function entry(status = "live-testnet", over: Record<string, unknown> = {}): ProtocolEntry {
  const slug = `proto-${rnd()}`;
  return { slug, name: `Proto ${slug.slice(-4)}`, kind: "dapp", status, website: "https://proto.example.com", agent: { ...template.agent, id: slug, name: `Proto ${slug.slice(-4)}`, ...over } };
}

test("the repo's real integrations are all built-in connectors, so syncing them lists nothing new", async () => {
  const r = await syncProtocolListings(generated as ProtocolEntry[]);
  assert.deepEqual(r.listed, []);
  assert.deepEqual(r.skipped, []);
  assert.ok((generated as ProtocolEntry[]).every((e) => e.kind === "built-in"));
});

test("a merged live dApp entry is listed, free and verified, and its tools run as dev connector tools", async () => {
  const e = entry();
  const r = await syncProtocolListings([e]);
  assert.deepEqual(r.listed, [e.slug]);
  assert.equal(r.secrets.length, 1);
  const card = (await publicListings()).find((c) => c.slug === e.slug);
  assert.ok(card?.listing, "shows on the marketplace as a third-party card");
  assert.equal(card!.listing!.priceUsd, 0);
  assert.equal(card!.listing!.developer.handle, `protocol-${e.slug}`);
  assert.ok(card!.listing!.developer.verified);
  const [d] = await db().select().from(developers).where(eq(developers.handle, `protocol-${e.slug}`));
  assert.equal(d.userId, null);
  assert.equal(d.house, false);

  const a = await devAgentFor(e.slug);
  assert.ok(a, "the dev connector picks it up");
  assert.equal(a!.secret, r.secrets[0].secret);
  const defs = devToolDefs(a!);
  assert.equal(defs.length, 2);
  assert.ok(defs.every((t) => t.risk === "read" && t.connector === `dev:${a!.listingId}`), "no tool signs anything itself");
  assert.deepEqual(defs.find((t) => t.name.endsWith("swap"))!.dev!.intents, ["swap"]);
  assert.deepEqual(proposalFor(a!), { label: a!.label, listingId: a!.listingId, perTxUsd: DEV_CAPS.perTxUsd, dailyUsd: DEV_CAPS.dailyUsd });
});

test("a protocol's swap comes back as an intent for a Confirm card, signed, pseudonymous and on testnet", async () => {
  const e = entry();
  await syncProtocolListings([e]);
  const a = (await devAgentFor(e.slug))!;
  const seen = { body: "", sig: "" };
  setWebhookFetcher((async (_url: string, init: { body: string; headers: Record<string, string> }) => {
    seen.body = init.body; seen.sig = init.headers[SIGNATURE_HEADER];
    return new Response(JSON.stringify({ text: "Proposed.", intent: { type: "swap", sell: "USDC", buy: "SOL", amount: 2 } }), { status: 200 });
  }) as never);
  try {
    const userId = "00000000-0000-4000-8000-000000000001";
    const out = await callWebhook(a, a.manifest.tools.find((t) => t.name === "swap")!, { sell: "USDC", buy: "SOL", amount: 2 }, { userId, convo: "c1" });
    assert.equal(out.intent?.type, "swap");
    assert.equal(intentToCall(out.intent!).tool, DEV_INTENT_TOOLS.swap);
    assert.ok(seen.body);
    assert.equal((await verify(a.secret!, seen.body, seen.sig)).ok, true);
    const req = JSON.parse(seen.body);
    assert.equal(req.env, "testnet");
    assert.ok(!seen.body.includes(userId), "the real account never leaves Lexari");
    await assert.rejects(callWebhook(a, a.manifest.tools.find((t) => t.name === "quote")!, { sell: "USDC", buy: "SOL", amount: 2 }, { userId, convo: "c1" }), /isn't allowed/);
  } finally { setWebhookFetcher(null); }
});

test("syncing again changes nothing and never issues a second secret", async () => {
  const e = entry();
  await syncProtocolListings([e]);
  const again = await syncProtocolListings([e]);
  assert.deepEqual(again.unchanged, [e.slug]);
  assert.deepEqual(again.secrets, []);
});

test("entries in review, paid, or with a mismatched id are not listed", async () => {
  const review = entry("in-review");
  const paid = entry("live-testnet", { pricing: { type: "hire", usd: 2 } });
  const wrong = entry("live-testnet", { id: `other-${rnd()}` });
  const r = await syncProtocolListings([review, paid, wrong]);
  assert.deepEqual(r.listed, []);
  assert.deepEqual(r.skipped.map((s) => s.slug).sort(), [paid.slug, wrong.slug].sort());
  const slugs = (await publicListings()).map((c) => c.slug);
  for (const e of [review, paid, wrong]) assert.ok(!slugs.includes(e.slug));
});

test("an entry that leaves integrations/ or stops being live is delisted, and its tools stop", async () => {
  const e = entry();
  await syncProtocolListings([e]);
  const r = await syncProtocolListings([{ ...e, status: "in-review" }]);
  assert.ok(r.delisted.includes(e.slug));
  forgetDevAgent();
  assert.equal(await devAgentFor(e.slug), null);
  const [l] = await db().select().from(agentListings).where(eq(agentListings.slug, e.slug));
  assert.equal(l.status, "delisted");
});

test("a protocol can't take over a slug that belongs to another agent", async () => {
  const e = entry();
  const [d] = await db().insert(developers).values({ handle: `dev-${rnd()}`, name: "Someone" }).returning();
  await db().insert(agentListings).values({ developerId: d.id, slug: e.slug, status: "listed" });
  const r = await syncProtocolListings([e]);
  assert.deepEqual(r.skipped.map((s) => s.slug), [e.slug]);
});
