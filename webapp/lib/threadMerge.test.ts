import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeThreads } from "./threadMerge";

const m = (id: string, at: number, from = "you") => ({ id, at, from, text: id });

test("a streaming reply stays under the message it answers when the server stamped that message later", () => {
  // Phone: you sent at 1000, the reply bubble opened at 1005. Server saved your message at 3200 (after its reads).
  const local = { home: [m("hello", 1, "home"), m("u1", 1000), m("r1", 1005, "home")] };
  const server = { home: [m("hello", 1, "home"), { ...m("u1", 3200) }] };
  const out = mergeThreads(local, server).home.map((x) => x.id);
  assert.deepEqual(out, ["hello", "u1", "r1"]);
  assert.ok(mergeThreads(local, server).home[2].at > 3200);
});

test("a phone clock far behind the server still keeps local order", () => {
  const local = { c: [m("u1", 1000), m("r1", 1001, "a"), m("u2", 1002), m("r2", 1003, "a")] };
  const server = { c: [m("u1", 90_000), m("r1", 90_500, "a"), m("u2", 91_000)] };
  assert.deepEqual(mergeThreads(local, server).c.map((x) => x.id), ["u1", "r1", "u2", "r2"]);
});

test("server-only messages stay, nothing local is lost, and a thread is never emptied", () => {
  const local = { a: [m("x", 10)], b: [m("only-local", 5)] };
  const server = { a: [m("x", 12), m("y", 20, "home")], b: [] as ReturnType<typeof m>[] };
  const out = mergeThreads(local, server);
  assert.deepEqual(out.a.map((x) => x.id), ["x", "y"]);
  assert.deepEqual(out.b.map((x) => x.id), ["only-local"]);
});

test("a local message with no known neighbour is placed by time", () => {
  const local = { a: [m("new", 15)] };
  const server = { a: [m("s1", 10), m("s2", 20)] };
  assert.deepEqual(mergeThreads(local, server).a.map((x) => x.id), ["s1", "new", "s2"]);
});
