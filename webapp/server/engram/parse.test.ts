import assert from "node:assert/strict";
import test from "node:test";
import { tokenFromData } from "./cortex";
import { splitRemember } from "./hippocampus";
import { buildPrompt } from "./spinal";

test("sse data lines yield only text deltas", () => {
  assert.equal(tokenFromData("[DONE]"), "");
  assert.equal(tokenFromData(JSON.stringify({ choices: [{ delta: { content: "Hi" } }] })), "Hi");
  assert.equal(tokenFromData(JSON.stringify({ choices: [{ delta: { reasoning_content: "think" } }] })), "");
  assert.equal(tokenFromData("not json"), "");
});

test("a remember line is peeled off the reply", () => {
  const split = splitRemember("Noted.\nREMEMBER: Prefers short answers");
  assert.equal(split.reply, "Noted.");
  assert.equal(split.remember, "Prefers short answers");
  assert.equal(splitRemember("Just a reply").remember, null);
});

test("the prompt carries recall and does not invent a system memory dump", () => {
  const messages = buildPrompt({
    agentName: "Juniper",
    role: "Personal agent",
    tone: "short",
    speaker: "Juniper",
    recall: [{ tag: "About you", text: "Lives in Lagos" }],
    history: [{ from: "you", text: "Hi" }],
    text: "Remember I like dawn meetings",
  });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /Lives in Lagos/);
  assert.equal(messages.at(-1)?.content, "Remember I like dawn meetings");
});
