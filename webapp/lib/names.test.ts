import { test } from "node:test";
import assert from "node:assert/strict";
import { addressed, afterStop, isStop, soundKey } from "./names";

const crew = { home: ["Nova"], rika: ["Rika"], bender: ["Bender"], quill: ["Quill"] };

test("speech-to-text spellings map to the right member", () => {
  for (const [said, who] of [
    ["Banda, what do you think?", "bender"], ["hey bander can you help", "bender"], ["Bendr?", "bender"], ["what about you Bender", "bender"],
    ["Rica, what's a good breakfast?", "rika"], ["Reeka what do you think", "rika"], ["hey Rikka", "rika"], ["Nova tell me a joke", "home"],
    ["okay quil, write a tweet", "quill"],
  ] as const) assert.equal(addressed(said, crew), who, said);
});

test("ordinary sentences don't pick anyone", () => {
  for (const said of ["what is the weather today", "tell me about the band", "I need a recap of the day", "can you render this"]) assert.equal(addressed(said, crew), null, said);
});

test("sound keys", () => { assert.equal(soundKey("Banda"), soundKey("Bender")); assert.equal(soundKey("Rica"), soundKey("Rika")); });

test("stop words", () => {
  for (const t of ["stop", "Stop.", "ok wait", "hold on please", "be quiet"]) assert.ok(isStop(t), t);
  for (const t of ["stop the timer at five", "what about the stop"]) assert.ok(!isStop(t), t);
  assert.equal(afterStop("Stop, what about the hackathon?"), "what about the hackathon?");
  assert.equal(afterStop("tell me more"), "tell me more");
});
