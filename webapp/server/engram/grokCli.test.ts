import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { flatten, grokArgs, streamGrokCli, textFromLine } from "./grokCli";
import { llmConfig, provider } from "./cortex";

test("parses streaming-messages-json lines", () => {
  assert.deepEqual(textFromLine('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}}'), { text: "Hi" });
  assert.deepEqual(textFromLine('{"type":"result","is_error":false,"result":"Hi"}'), { done: true });
  assert.equal(textFromLine('{"type":"result","is_error":true,"result":"auth expired"}').error, "auth expired");
  assert.deepEqual(textFromLine("not json"), {});
});

test("flattens a transcript into one prompt and keeps the system prompt apart", () => {
  const { system, prompt } = flatten([
    { role: "system", content: "You are Juniper." },
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "what's up" },
  ]);
  assert.ok(system.startsWith("You are Juniper.\n\n"));
  assert.match(system, /cannot run code/);
  assert.match(prompt, /Person: hi\nYou: hello/);
  assert.match(prompt, /Person: what's up/);
});

test("every run is locked down", () => {
  const a = grokArgs("sys", "p", "/tmp/x", "");
  for (const flag of ["--disable-web-search", "--no-subagents", "--no-plan", "--permission-mode"]) assert.ok(a.includes(flag), flag);
  assert.equal(a[a.indexOf("--tools") + 1], "todo_write");
  const denied = a.flatMap((v, i) => (v === "--deny" ? [a[i + 1]] : []));
  assert.deepEqual(denied.sort(), ["run_terminal_command", "scheduler_create", "spawn_subagent"]);
  assert.equal(a[a.indexOf("--max-turns") + 1], "2");
  assert.ok(!grokArgs("s", "p", "/tmp", "").includes("--model"));
  assert.equal(grokArgs("s", "p", "/tmp", "grok-4").at(-1), "grok-4");
});

test("spawns the CLI with only PATH/HOME, streams text, and refuses without a login", async () => {
  const home = mkdtempSync(join(tmpdir(), "grokhome-"));
  const bin = join(home, "fake-grok");
  const envOut = join(home, "env.txt");
  writeFileSync(bin, `#!/bin/sh\nenv > ${envOut}\necho '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello "}}}'\necho '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Ada"}}}'\necho '{"type":"result","is_error":false}'\n`);
  chmodSync(bin, 0o755);
  process.env.LLM_PROVIDER = "grok-cli";
  process.env.GROK_CLI_BIN = bin;
  process.env.GROK_CLI_HOME = home;
  process.env.DATABASE_URL = "postgres://secret";
  assert.equal(provider(), "grok-cli");
  assert.equal(llmConfig().ready, false);
  await assert.rejects(async () => { for await (const _ of streamGrokCli([{ role: "user", content: "hi" }])) void _; }, (e: Error & { friendly?: string }) => /not connected/.test(e.friendly || ""));
  mkdirSync(join(home, ".grok"));
  writeFileSync(join(home, ".grok", "auth.json"), "{}");
  let out = "";
  for await (const t of streamGrokCli([{ role: "system", content: "s" }, { role: "user", content: "hi" }])) out += t;
  assert.equal(out, "Hello Ada");
  const env = readFileSync(envOut, "utf8");
  assert.ok(!env.includes("DATABASE_URL"), "server secrets must not reach the CLI");
  assert.match(env, new RegExp(`HOME=${home}`));
});

test("a failing CLI run becomes a friendly error", async () => {
  const home = mkdtempSync(join(tmpdir(), "grokhome-"));
  mkdirSync(join(home, ".grok")); writeFileSync(join(home, ".grok", "auth.json"), "{}");
  const bin = join(home, "fake-grok");
  writeFileSync(bin, `#!/bin/sh\necho '{"type":"result","is_error":true,"result":"session expired"}'\nexit 1\n`);
  chmodSync(bin, 0o755);
  process.env.GROK_CLI_BIN = bin; process.env.GROK_CLI_HOME = home;
  await assert.rejects(async () => { for await (const _ of streamGrokCli([{ role: "user", content: "hi" }])) void _; }, (e: Error & { friendly?: string }) => e.friendly === "The model could not answer. Try again." && /session expired/.test(e.message));
});
