#!/usr/bin/env node
/**
 * Lexari Grok relay. Lets the web app (user lexariweb) use the Grok CLI login of this server's root account
 * without copying that login anywhere and without giving the app any other access.
 *
 * The app writes one JSON line {system, prompt, model?} to a unix socket; the relay runs
 * `grok -p` with a fixed, locked-down set of flags (only todo_write, no shell, no web, no subagents,
 * two turns, empty temp working dir) and streams the CLI's NDJSON back. The client cannot pass flags.
 * Ends with one line {"relayExit": code, "stderr": "..."}. The run's CLI session transcript is deleted.
 *
 * Runs under systemd (deploy/lexari-grok-relay.service) with no capabilities, a read-only filesystem
 * except ~/.grok, and a private /tmp. Env: RELAY_SOCKET, GROK_CLI_BIN, GROK_HOME, RELAY_CONCURRENCY.
 */
import net from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SOCK = process.env.RELAY_SOCKET || "/run/lexari-grok/grok.sock";
const BIN = process.env.GROK_CLI_BIN || "/opt/grok/grok";
const HOME = process.env.GROK_HOME || "/root";
const MAX = Math.max(1, Number(process.env.RELAY_CONCURRENCY || 2));
const TIMEOUT_MS = 120_000;
let running = 0;
const QUEUE_MS = 45_000;
const queue = [];
const next = () => { while (running < MAX && queue.length) queue.shift()(); };

const lockdown = (system, prompt, cwd, model) => [
  "-p", prompt,
  "--output-format", "streaming-messages-json", "--include-partial-messages",
  "--system-prompt-override", system,
  "--disable-web-search", "--no-subagents", "--no-plan", "--max-turns", "2",
  "--tools", "todo_write",
  "--deny", "run_terminal_command", "--deny", "spawn_subagent", "--deny", "scheduler_create",
  "--permission-mode", "dontAsk",
  "--cwd", cwd,
  ...(model ? ["--model", model] : []),
];

const end = (sock, obj) => { try { sock.end(JSON.stringify(obj) + "\n"); } catch {} };

function run(sock, line) {
  let req;
  try { req = JSON.parse(line); } catch { return end(sock, { relayExit: -1, stderr: "bad request" }); }
  if (req?.ping) return end(sock, { ready: fs.existsSync(path.join(HOME, ".grok", "auth.json")), running, max: MAX });
  const { system, prompt, model } = req || {};
  if (typeof system !== "string" || typeof prompt !== "string" || !prompt || Buffer.byteLength(system) > 60_000 || Buffer.byteLength(prompt) > 120_000) return end(sock, { relayExit: -1, stderr: "bad request" });
  if (model != null && (typeof model !== "string" || !/^[\w.-]{1,64}$/.test(model))) return end(sock, { relayExit: -1, stderr: "bad model" });
  if (running >= MAX) {
    // Wait for a free slot instead of failing straight away (several agents in a group, or two app processes during a deploy).
    if (queue.length >= MAX * 6) return end(sock, { relayExit: -1, stderr: "busy" });
    const item = () => { if (!sock.destroyed) run(sock, line); };
    queue.push(item);
    const drop = () => { const i = queue.indexOf(item); if (i >= 0) queue.splice(i, 1); };
    sock.on("close", drop);
    setTimeout(() => { if (queue.includes(item)) { drop(); end(sock, { relayExit: -1, stderr: "busy" }); } }, QUEUE_MS);
    return;
  }
  running++;
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "lexari-grok-"));
  const child = spawn(BIN, lockdown(system, prompt, cwd, model || ""), { cwd, env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME, LANG: "C.UTF-8", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  const kill = () => { if (child.exitCode === null && !child.killed) child.kill("SIGKILL"); };
  const timer = setTimeout(kill, TIMEOUT_MS);
  sock.on("close", kill);
  child.stderr.on("data", (d) => { if (stderr.length < 2000) stderr += String(d); });
  child.stdout.on("data", (d) => { try { sock.write(d); } catch {} });
  child.on("error", (e) => { stderr += String(e?.message || e); });
  child.on("close", (code) => {
    clearTimeout(timer);
    running--;
    setImmediate(next);
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(path.join(HOME, ".grok", "sessions", encodeURIComponent(cwd)), { recursive: true, force: true });
    end(sock, { relayExit: code, stderr: stderr.slice(0, 300) });
  });
}

try { fs.unlinkSync(SOCK); } catch {}
const server = net.createServer((sock) => {
  let buf = "", started = false;
  sock.setEncoding("utf8");
  sock.setTimeout(TIMEOUT_MS + 10_000, () => sock.destroy());
  sock.on("error", () => {});
  sock.on("data", (d) => {
    if (started) return;
    buf += d;
    if (buf.length > 400_000) { started = true; return end(sock, { relayExit: -1, stderr: "too large" }); }
    const i = buf.indexOf("\n");
    if (i < 0) return;
    started = true;
    run(sock, buf.slice(0, i));
  });
});
server.listen(SOCK, () => { fs.chmodSync(SOCK, 0o660); console.log(`grok relay on ${SOCK}`); });
const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop); process.on("SIGINT", stop);
