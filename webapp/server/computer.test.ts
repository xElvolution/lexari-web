import { test } from "node:test";
import assert from "node:assert/strict";
import { actionCmd, computerTask, parseStep, sensitiveText, stripComputer } from "./computer";

test("computer task tag", () => {
  assert.equal(computerTask("On it. <computer>open lexari.ai and read the hero</computer>"), "open lexari.ai and read the hero");
  assert.equal(computerTask("no task"), null);
  assert.equal(stripComputer("On it. <computer>x</computer>"), "On it.");
});

test("parseStep takes the first JSON object, braces in strings included", () => {
  const s = parseStep('Sure {"see":"a {page}","label":"Clicking","actions":[{"do":"click","x":10,"y":20}],"done":false} trailing');
  assert.equal(s?.actions?.[0].do, "click");
  assert.equal(s?.see, "a {page}");
  assert.equal(parseStep("no json"), null);
});

test("coordinates map back from the scaled screenshot", () => {
  const c = actionCmd({ do: "click", x: 640, y: 400 }, { w: 2560, h: 1600, scale: 0.5 });
  assert.match(c.cmd!, /mousemove --sync 1280 800 /);
  const d = actionCmd({ do: "click", x: 5000, y: -3 }, { w: 1280, h: 800, scale: 1 });
  assert.match(d.cmd!, /mousemove --sync 1279 0 /);
});

test("typing is quoted and card numbers are refused", () => {
  assert.match(actionCmd({ do: "type", text: "it's ok" }, { w: 1, h: 1, scale: 1 }).cmd!, /'it'\\''s ok'/);
  assert.equal(sensitiveText("4242 4242 4242 4242"), true);
  assert.equal(sensitiveText("Solana Colosseum deadline 2026"), false);
  assert.equal(actionCmd({ do: "type", text: "4111111111111111" }, { w: 1, h: 1, scale: 1 }).cmd, undefined);
});

test("keys and addresses are checked", () => {
  assert.ok(actionCmd({ do: "key", keys: "ctrl+l" }, { w: 1, h: 1, scale: 1 }).cmd);
  assert.equal(actionCmd({ do: "key", keys: "Return; rm -rf ~" }, { w: 1, h: 1, scale: 1 }).cmd, undefined);
  assert.equal(actionCmd({ do: "navigate", url: "file:///etc/passwd" }, { w: 1, h: 1, scale: 1 }).cmd, undefined);
  assert.match(actionCmd({ do: "navigate", url: "lexari.ai" }, { w: 1, h: 1, scale: 1 }).cmd!, /'https:\/\/lexari\.ai\/'/);
});
