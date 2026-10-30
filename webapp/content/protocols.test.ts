/** The public Integrations page shows only what agents can use now, with no internal setup state. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROTOCOLS, PROTOCOL_STATUS, publicProtocols, type Protocol } from "./protocols";

const base = PROTOCOLS[0];
const p = (status: Protocol["status"], actions: Protocol["actions"]): Protocol => ({ ...base, slug: status, status, actions });

test("protocols waiting on setup, coming soon or in review are hidden", () => {
  const out = publicProtocols([p("live-testnet", [{ text: "a", live: true }]), p("setup-needed", [{ text: "b", live: true }]), p("coming-soon", [{ text: "c", live: false }]), p("in-review", [{ text: "d", live: true }])]);
  assert.deepEqual(out.map((x) => x.status), ["live-testnet"]);
});

test("only actions that work today are shown, and a protocol with none is hidden", () => {
  const out = publicProtocols([p("market-data", [{ text: "read", live: true }, { text: "trade", live: false }]), p("live-devnet", [{ text: "later", live: false }])]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].actions, [{ text: "read", live: true }]);
});

test("nothing public mentions keys, servers or setup", () => {
  for (const x of publicProtocols()) {
    assert.notEqual(PROTOCOL_STATUS[x.status].tone, "wait", x.slug);
    assert.doesNotMatch(`${x.description} ${x.actions.map((a) => a.text).join(" ")}`, /api key|on the server|per server|setup needed|env var|switched on/i, x.slug);
  }
});
