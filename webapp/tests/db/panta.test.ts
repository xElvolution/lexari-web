/**
 * Panta paper positions end to end against a local stand-in for Panta's API (real request shapes): open a position
 * at a quote, see it marked to the live price, close it with P&L after Confirm, and never close it twice.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { agent, grant, person, say } from "./helpers";
import { confirmAction } from "../../server/integrations/actions";

let srv: Server;
let yes = 0.4;
const seen: { path: string; key: string | undefined }[] = [];
before(async () => {
  srv = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ path: req.url || "", key: req.headers["x-api-key"] as string | undefined });
      const send = (j: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(j)); };
      if (req.headers["x-api-key"] !== "pk_test_lexari") return send({ detail: "bad key" }, 401);
      if (req.url?.startsWith("/api/v1/markets/?")) return send({ results: [{ id: "btc-100k", title: "Bitcoin above $100k on Dec 31?", yesPrice: yes, noPrice: 1 - yes, status: "open" }] });
      if (req.url === "/api/v1/markets/btc-100k/") return send({ id: "btc-100k", title: "Bitcoin above $100k on Dec 31?", yesPrice: yes, noPrice: +(1 - yes).toFixed(4), status: "open" });
      if (req.url === "/api/v1/primaryorderquote/") { const b = JSON.parse(body); return send({ quoteId: "q1", shares: +(b.amountUsdc / yes).toFixed(4), avgPrice: yes, feeUsdc: 0.02 }); }
      send({ detail: "not found" }, 404);
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  process.env.PANTA_API_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/v1`;
  process.env.PANTA_API_KEY = "pk_test_lexari";
});
after(() => { srv.close(); setTimeout(() => process.exit(0), 50); });

test("open, mark, close with profit, and no second close", async () => {
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "panta", a.slug, { perTxUsd: 25 });
  yes = 0.4;
  const open = (await say(u.id, a, `<tool name="panta.position">{"market":"btc-100k","side":"yes","amount":10}</tool>`)).actions[0];
  assert.ok(open, "a Confirm card");
  assert.ok(open.rows.some(([k, v]) => k === "Mode" && /Paper/.test(v)));
  assert.equal((await confirmAction(u.id, open.id)).status, "confirmed");

  yes = 0.5;
  const pos = await say(u.id, a, `<tool name="panta.positions">{}</tool>`);
  const t = pos.facts.join(" ");
  assert.match(t, /1\. YES "Bitcoin above \$100k on Dec 31\?": \$10\.00 for 25 shares at 40\.0¢, now 50\.0¢, worth \$12\.50 \(\+\$2\.50\)/);
  assert.match(t, /unrealized \+\$2\.50/);

  const close = (await say(u.id, a, `<tool name="panta.close">{"position":"1"}</tool>`)).actions[0];
  assert.ok(close, "close card");
  const row = (k: string) => close.rows.find(([x]) => x === k)?.[1];
  assert.equal(row("You get"), "$12.50");
  assert.equal(row("Profit / loss"), "+$2.50");
  assert.equal(close.usd, 0, "closing doesn't count toward spending limits");
  const second = (await say(u.id, a, `<tool name="panta.close">{"position":"bitcoin"}</tool>`)).actions[0];
  assert.ok(second, "a second card for the same position can be prepared...");
  assert.equal((await confirmAction(u.id, close.id)).status, "confirmed");
  const again = await confirmAction(u.id, second.id);
  assert.equal(again.status, "failed", "...but never confirmed twice");
  assert.match(again.error || "", /already closed|isn't open/);

  const after2 = await say(u.id, a, `<tool name="panta.positions">{}</tool>`);
  assert.match(after2.facts.join(" "), /No open Panta positions\. Closed so far: 1, realized P&L \+\$2\.50/);
  const none = await say(u.id, a, `<tool name="panta.close">{"position":"1"}</tool>`);
  assert.equal(none.actions.length, 0);
  assert.ok(seen.every((s) => s.key === "pk_test_lexari"), "every Panta call carries the key");
});

test("a loss, and ambiguous or unknown positions are refused", async () => {
  const u = await person(); const a = await agent(u.id);
  await grant(u.id, "panta", a.slug, { perTxUsd: 25 });
  yes = 0.5;
  for (const side of ["yes", "no"]) {
    const c = (await say(u.id, a, `<tool name="panta.position">{"market":"btc-100k","side":"${side}","amount":5}</tool>`)).actions[0];
    await confirmAction(u.id, c.id);
  }
  const amb = await say(u.id, a, `<tool name="panta.close">{"position":"bitcoin"}</tool>`);
  assert.equal(amb.actions.length, 0);
  assert.match(amb.notes.join(" "), /matches 2 open positions/);
  const unknown = await say(u.id, a, `<tool name="panta.close">{"position":"ethereum"}</tool>`);
  assert.equal(unknown.actions.length, 0);
  yes = 0.3; // YES fell: the YES position (bought at 50¢ for 10 shares) is now worth $3
  const list = (await say(u.id, a, `<tool name="panta.positions">{}</tool>`)).facts.join(" ");
  const n = /(\d)\. YES/.exec(list)![1];
  const c = (await say(u.id, a, `<tool name="panta.close">{"position":"${n}"}</tool>`)).actions[0];
  assert.equal(c.rows.find(([k]) => k === "Profit / loss")?.[1], "−$2.00");
});

test("without a key: positions say so plainly and nothing is prepared", async () => {
  const keep = process.env.PANTA_API_KEY;
  process.env.PANTA_API_KEY = "";
  try {
    const u = await person(); const a = await agent(u.id);
    await grant(u.id, "panta", a.slug);
    const r = await say(u.id, a, `<tool name="panta.position">{"market":"btc-100k","side":"yes","amount":5}</tool>`);
    assert.equal(r.actions.length, 0);
    assert.match(r.notes.join(" "), /needs a Panta API key/);
  } finally { process.env.PANTA_API_KEY = keep; }
});
