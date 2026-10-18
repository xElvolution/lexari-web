/** Per-agent model caps and the cost report, against a real database and the real meter. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../server/db";
import { usageLedger } from "../../server/db/billingSchema";
import { LAMINA } from "@/content/models";
import { beginTurn, isBlocked } from "../../server/billing/meter";
import { costReport, setAgentCap, capFor, overCap } from "../../server/billing/costs";
import { agent, person } from "./helpers";

after(() => setTimeout(() => process.exit(0), 50));
const spend = (userId: string, slug: string, billed: number, model = "lamina", pool = "lamina") =>
  db().insert(usageLedger).values({ userId, agentSlug: slug, convo: "c", kind: "chat", pool, requestedModel: model, servedModel: model, promptTokens: 100, completionTokens: 50, costMicros: Math.floor(billed / 2), billedMicros: billed });
const turn = (userId: string, slug: string, kind: "chat" | "event" = "chat") => beginTurn({ userId, model: LAMINA, convo: "c", agent: slug, kind, prompt: [{ content: "hello" }] });

test("overCap: no cap never blocks; at or past the cap blocks", () => {
  assert.equal(overCap(10, 5, null), false);
  assert.equal(overCap(10, 5, 15), false);
  assert.equal(overCap(10, 6, 15), true);
  assert.equal(overCap(0, 1, 0), true);
});

test("caps: only your own agents, $0 to $500, remove with null", async () => {
  const u = await person(); const v = await person(); const a = await agent(u.id);
  await assert.rejects(() => setAgentCap(v.id, a.slug, 1e6), /isn't on your team/);
  await assert.rejects(() => setAgentCap(u.id, a.slug, 501e6), /between/);
  assert.equal(await setAgentCap(u.id, a.slug, 2.5e6), 2.5e6);
  assert.equal(await capFor(u.id, a.slug), 2.5e6);
  await setAgentCap(u.id, a.slug, null);
  assert.equal(await capFor(u.id, a.slug), null);
});

test("a capped agent is stopped before the model runs; other agents and receipts are not", async () => {
  const u = await person(); const a = await agent(u.id); const b = await agent(u.id, "custom", "Scout");
  const ok = await turn(u.id, a.slug);
  assert.ok(!isBlocked(ok), "no cap: runs");
  if (!isBlocked(ok)) await ok.release();
  await spend(u.id, a.slug, 1_000_000);
  await setAgentCap(u.id, a.slug, 1_000_000);
  const blocked = await turn(u.id, a.slug);
  assert.ok(isBlocked(blocked));
  if (isBlocked(blocked)) {
    assert.equal(blocked.reason, "agent_cap");
    assert.equal(blocked.agentName, "Atlas");
    assert.equal(blocked.cap, 1_000_000);
    assert.equal(blocked.spent, 1_000_000);
  }
  const other = await turn(u.id, b.slug);
  assert.ok(!isBlocked(other), "another agent still runs");
  if (!isBlocked(other)) await other.release();
  const receipt = await turn(u.id, a.slug, "event");
  assert.ok(!isBlocked(receipt), "transaction receipts are never blocked");
  await setAgentCap(u.id, a.slug, 50_000_000);
  const raised = await turn(u.id, a.slug);
  assert.ok(!isBlocked(raised), "raising the cap lets it run again");
  if (!isBlocked(raised)) await raised.release();
});

test("cost report: this cycle by agent, model and day, with caps; your own key costs nothing", async () => {
  const u = await person(); const a = await agent(u.id); const b = await agent(u.id, "custom", "Scout");
  await spend(u.id, a.slug, 300_000);
  await spend(u.id, a.slug, 200_000, "qwen", "premium");
  await spend(u.id, b.slug, 0, "key:openai:gpt-x", "byo");
  await spend(u.id, "deleted-agent", 50_000);
  await setAgentCap(u.id, a.slug, 5_000_000);
  const r = await costReport(u.id);
  assert.equal(r.total.billed, 550_000);
  assert.equal(r.total.turns, 4);
  assert.equal(r.total.tokens, 600);
  const ra = r.agents.find((x) => x.slug === a.slug)!;
  assert.deepEqual([ra.billed, ra.turns, ra.cap, ra.name], [500_000, 2, 5_000_000, "Atlas"]);
  assert.equal(r.agents.find((x) => x.slug === b.slug)!.billed, 0);
  assert.equal(r.agents.find((x) => x.slug === "")!.billed, 50_000, "removed agents still count");
  assert.equal(r.agents[0].slug, a.slug, "biggest spender first");
  assert.deepEqual(r.models.map((m) => m.model).slice(0, 2), ["lamina", "qwen"]);
  assert.equal(r.days.length, 1);
  assert.equal(r.days[0].billed, 550_000);
  assert.ok(r.cycleStart <= Date.now() && r.cycleEnd > Date.now());
});
