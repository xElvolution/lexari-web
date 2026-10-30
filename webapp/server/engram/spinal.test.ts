import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, nameRule, unGreet } from "./spinal";

test("old replies lose an email or name salutation", () => {
  assert.equal(unGreet("ada@example.com, you're welcome.", "Ada"), "You're welcome.");
  assert.equal(unGreet("Ada, checking the Bitcoin price now.", "Ada"), "Checking the Bitcoin price now.");
  assert.equal(unGreet("Hi Ada! Your top up is confirmed.", "Ada"), "Your top up is confirmed.");
  assert.equal(unGreet("Adam is here.", "Ada"), "Adam is here.");
  assert.equal(unGreet("The price is $64k.", ""), "The price is $64k.");
});

test("an email is never used as a name", () => {
  assert.match(nameRule("ada@example.com"), /don't know the person's name/);
  assert.match(nameRule("Ada"), /name is Ada\. Use it only now and then/);
  const p = buildPrompt({ agentName: "Juniper", role: "", tone: "short", speaker: "Juniper", you: "ada@example.com", recall: [{ tag: "About you", text: "Calls you ada@example.com" } as never], history: [], text: "hi" });
  assert.ok(!p[0].content.includes("ada@example.com"));
});
