import { test } from "node:test";
import assert from "node:assert/strict";
import { throughWord, INTERRUPTED, SpeechQueue, TurnClock, afterBase, cleanBargeIn, interruptedRecord, isEcho, sentences, spokenUpTo, stripEchoPrefix } from "./callTurn";

test("a newer turn kills the old one; old ids stay dead", () => {
  const c = new TurnClock();
  const a = c.begin(); assert.ok(c.isLive(a));
  const b = c.begin(); assert.ok(!c.isLive(a)); assert.ok(c.isLive(b));
  c.kill(a); assert.ok(c.isLive(b), "a stale kill doesn't touch the newer turn");
  c.kill(b); assert.ok(!c.isLive(b)); assert.ok(!c.isLive(0));
  const d = c.begin(); assert.ok(d > b && c.isLive(d));
});

test("queue drops sentences from dead turns, before and after they were queued", () => {
  const c = new TurnClock(), q = new SpeechQueue(c);
  const t1 = c.begin();
  for (const s of sentences("I'm good, thanks. And you? How was your day?", 0, 44, t1)) q.push(s);
  assert.equal(q.size, 3);
  assert.equal(q.next()!.text, "I'm good, thanks.");
  const t2 = c.begin(); // you interrupted
  assert.equal(q.next(), null, "leftover sentences of the old turn are never spoken");
  assert.equal(q.push({ turn: t1, start: 0, end: 5, text: "late." }), false, "a late sentence from the old stream is refused");
  q.push({ turn: t2, start: 0, end: 10, text: "Let's plan." });
  assert.equal(q.next()!.text, "Let's plan.");
  q.push({ turn: t2, start: 0, end: 4, text: "More." }); q.clear(); assert.equal(q.next(), null);
});

test("sentences split with offsets and keep a trailing piece", () => {
  const t = "Hi there. Today we can plan your week, or";
  const s = sentences(t, 0, t.length, 1);
  assert.deepEqual(s.map((x) => x.text.trim()), ["Hi there.", "Today we can plan your week, or"]);
  assert.equal(t.slice(s[1].start, s[1].end), s[1].text);
  assert.deepEqual(sentences(t, 10, 16, 1).map((x) => x.text), ["Today "]);
});

test("spoken position snaps back to the word in progress", () => {
  const t = "I'm good, and how about you?";
  const s = { start: 0, end: t.length };
  assert.equal(t.slice(0, spokenUpTo(t, s, 11, 0)), "I'm good, ");
  assert.equal(t.slice(0, spokenUpTo(t, s, 0, 800)), "I'm good, "); // ~11 chars from time, no boundary events
  assert.equal(spokenUpTo(t, s, 0, 60_000), t.length);
});

test("interrupted record keeps only spoken words plus the marker", () => {
  assert.equal(interruptedRecord("I'm good, "), `I'm good… ${INTERRUPTED}`);
  assert.equal(interruptedRecord(""), INTERRUPTED);
});

test("your words are not mistaken for the agent's echo", () => {
  assert.ok(!isEcho("Okay, what can we do today?", "I'm good, and"));
  assert.ok(!isEcho("okay what can we do today", "I'm good, and what can I do for you today?"));
  assert.ok(isEcho("I'm good and", "I'm good, and how about you?"));
  assert.ok(isEcho("", "anything"));
});

test("finals from before the interruption are not merged into the new utterance", () => {
  assert.equal(afterBase("I'm good and okay what can we do today", "I'm good and"), "okay what can we do today");
  assert.equal(afterBase("i'm good, and okay what can we do", "I'm good and"), "okay what can we do");
  assert.equal(afterBase("okay what can we do today", ""), "okay what can we do today");
  assert.equal(stripEchoPrefix("good and okay what can we do today", "I'm good, and"), "okay what can we do today");
  assert.equal(stripEchoPrefix("what can we do today", "I'm good, and what can I do"), "what can we do today", "a single shared word is kept");
  assert.equal(cleanBargeIn("I'm good and okay what can we do today", "I'm good and", "I'm good, and"), "okay what can we do today");
  assert.equal(cleanBargeIn("I'm good and", "", "I'm good, and"), "", "pure echo is not an utterance");
  assert.equal(cleanBargeIn("I'm good and", "I'm good and", "I'm good, and"), "", "nothing new after the base");
  const reply = "I'm good, and how about you?";
  assert.equal(throughWord(reply, 10), "I'm good, and");
  assert.equal(cleanBargeIn("good and okay what can we do today", "", throughWord(reply, 10), reply), "okay what can we do today");
});
