/**
 * Grok CLI provider: runs `grok -p` headless with the CLI's own login on this server.
 *
 * The CLI is an agent with tools (shell, files, web). Lexari only wants text, so every run is locked down:
 * an empty temp working dir, only the harmless todo_write tool allowed, shell/subagents/scheduler denied,
 * no web search, no plan mode, two turns max, and a hard timeout. The run's CLI session transcript is deleted afterwards. The prompt goes in as an argument
 * (no shell), the system prompt replaces Grok's own.
 *
 * Env: GROK_CLI_BIN (default "grok"), GROK_CLI_HOME (HOME holding the CLI login, default the process HOME),
 *      GROK_CLI_MODEL (optional), GROK_CLI_TIMEOUT_MS (default 120000), GROK_CLI_CONCURRENCY (default 2),
 *      GROK_CLI_SOCKET (optional: unix socket of deploy/grok-relay.mjs, which runs the same locked-down command).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { ModelError, type ChatMessage } from "./cortex";

export function grokCliConfig() {
  const bin = process.env.GROK_CLI_BIN || "grok";
  const home = process.env.GROK_CLI_HOME || process.env.HOME || "";
  const model = process.env.GROK_CLI_MODEL || "";
  // GROK_CLI_SOCKET: talk to deploy/grok-relay.mjs instead of running the CLI (the login stays with the relay's user)
  const socket = process.env.GROK_CLI_SOCKET || "";
  const ready = socket ? existsSync(socket) : !!home && existsSync(join(home, ".grok", "auth.json"));
  return {
    bin, home, model, ready, socket,
    timeoutMs: Number(process.env.GROK_CLI_TIMEOUT_MS || 120_000),
    concurrency: Math.max(1, Number(process.env.GROK_CLI_CONCURRENCY || 2)),
  };
}

let running = 0;
/** Waiting turns, highest priority first (Quick replies = 1, Priority desk = 2), first come first served within a priority. */
const waiting: { go: () => void; prio: number }[] = [];
async function slot(max: number, prio = 0) {
  if (running < max) { running++; return; }
  if (waiting.length >= max * 8) throw new ModelError("The agent is busy. Try again in a minute.", "grok-cli queue full");
  await new Promise<void>((resolve) => { const at = waiting.findIndex((w) => w.prio < prio); const item = { go: resolve, prio }; if (at < 0) waiting.push(item); else waiting.splice(at, 0, item); });
  running++;
}
function release() {
  running--;
  waiting.shift()?.go();
}

/** Marker in the system prompt when the agent has a Lexari desktop (see app/api/chat). */
export const DESKTOP_MARK = "[lexari-desktop]";

/** One prompt from the transcript: the CLI takes a single message, so earlier turns are quoted. */
export function flatten(messages: ChatMessage[]) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content);
  // An agent with a Lexari desktop asks for shell commands with <run> tags; the server runs them in its sandbox.
  const desktop = sys.some((c) => c.includes(DESKTOP_MARK));
  const wallet = sys.some((c) => c.includes("[lexari-wallet]"));
  const system = [
    ...sys,
    // The CLI is a coding agent at heart; inside Lexari it is only a chat partner.
    desktop
      ? "You are chatting inside the Lexari app. You have your own sandboxed Linux computer that Lexari runs for you. You cannot use your own built-in tools; the only way to use the computer is to write <run>command</run>, and Lexari runs it and shows you the output. Never mention a CLI, Grok or xAI."
      : "You are chatting inside the Lexari app on someone's phone or computer. In this chat you cannot run code, browse the web, open or edit files, or use tools, so never offer to and never mention a workspace, terminal, repository, files on this machine, Grok, xAI or a CLI. Describe what you can do in plain terms: answer questions, explain, plan, write and edit text, brainstorm, and remember what the person tells you.",
    ...(wallet ? ["You CAN use the person's wallet, but only with the <wallet> and <send> tags described above; Lexari handles them."] : []),
  ].join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const last = turns.pop();
  const history = turns.map((m) => `${m.role === "user" ? "Person" : "You"}: ${m.content}`).join("\n");
  const prompt = [
    history ? `Conversation so far:\n${history}\n` : "",
    `Person: ${last?.content ?? ""}`,
    "",
    desktop ? "Reply to the person's last message as yourself. Plain text, plus <run>…</run> lines when you need your computer. Do not use your built-in tools." : "Reply to the person's last message as yourself. Plain text only. Do not use tools.",
    wallet ? "If they ask about their wallet, balance, address or sending SOL, use the <wallet>/<send> tags." : "",
  ].join("\n");
  return { system, prompt };
}

/** Text deltas from the CLI's streaming-messages-json output (NDJSON). */
export function textFromLine(line: string): { text?: string; done?: boolean; error?: string } {
  if (!line.trim()) return {};
  try {
    const j = JSON.parse(line) as { type?: string; is_error?: boolean; result?: string; event?: { type?: string; delta?: { type?: string; text?: string } } };
    if (j.type === "stream_event" && j.event?.type === "content_block_delta" && j.event.delta?.type === "text_delta") return { text: j.event.delta.text || "" };
    if (j.type === "result") return j.is_error ? { done: true, error: String(j.result || "grok-cli error").slice(0, 300) } : { done: true };
  } catch {}
  return {};
}

export function grokArgs(system: string, prompt: string, cwd: string, model: string) {
  const args = [
    "-p", prompt,
    "--output-format", "streaming-messages-json", "--include-partial-messages",
    "--system-prompt-override", system,
    "--disable-web-search", "--no-subagents", "--no-plan", "--max-turns", "2",
    "--tools", "todo_write",
    "--deny", "run_terminal_command", "--deny", "spawn_subagent", "--deny", "scheduler_create",
    "--permission-mode", "dontAsk",
    "--cwd", cwd,
  ];
  if (model) args.push("--model", model);
  return args;
}

type Run = { out: AsyncIterable<unknown>; exited: Promise<number | null>; kill: () => void; stderr: () => string; killed: () => boolean; cleanup: () => void; onLine?: (line: string) => boolean };

function runLocal(cfg: ReturnType<typeof grokCliConfig>, system: string, prompt: string): Run {
  const cwd = mkdtempSync(join(tmpdir(), "lexari-grok-"));
  const child = spawn(cfg.bin, grokArgs(system, prompt, cwd, cfg.model), {
    cwd,
    env: { PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin", HOME: cfg.home, LANG: "C.UTF-8", NO_COLOR: "1" } as unknown as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => { if (stderr.length < 2000) stderr += String(d); });
  const exited = new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
  return {
    out: child.stdout, exited, stderr: () => stderr, killed: () => child.killed,
    kill: () => { if (!child.killed) child.kill("SIGKILL"); },
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
      // The CLI keeps a transcript per working dir under its HOME; drop ours so chats are not stored there.
      if (cfg.home) rmSync(join(cfg.home, ".grok", "sessions", encodeURIComponent(cwd)), { recursive: true, force: true });
    },
  };
}

/** Same run through the relay socket. The relay ends with {"relayExit": code, "stderr": "..."}. */
function runRelay(cfg: ReturnType<typeof grokCliConfig>, system: string, prompt: string): Run {
  const sock = createConnection(cfg.socket);
  sock.setEncoding("utf8");
  sock.on("connect", () => sock.write(JSON.stringify({ system, prompt, model: cfg.model || undefined }) + "\n"));
  let stderr = ""; let code: number | null = null; let killed = false;
  const exited = new Promise<number | null>((resolve) => { sock.on("close", () => resolve(code)); sock.on("error", (e) => { stderr = stderr || `relay: ${e.message}`; }); });
  const onLine = (line: string) => {
    if (!line.startsWith('{"relayExit"')) return false;
    try { const j = JSON.parse(line) as { relayExit: number; stderr?: string }; code = j.relayExit; stderr = j.stderr || ""; } catch {}
    return true;
  };
  return { out: sock, exited, stderr: () => stderr, killed: () => killed, kill: () => { killed = true; sock.destroy(); }, cleanup: () => {}, onLine };
}

const RETRY_MS = [700, 1800, 3500];
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((r) => { const t = setTimeout(r, ms); signal?.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true }); });

/**
 * Streams one reply. A run that fails before any text arrived (the relay was busy, the CLI hit a rate limit or
 * exited with an error) is retried with backoff, so a group where several agents answer in a row, or a call
 * overlapping a chat, still gets every reply. Only when every try fails does the person see an error.
 */
export async function* streamGrokCli(messages: ChatMessage[], signal?: AbortSignal, model?: string, prio = 0): AsyncGenerator<string> {
  let last: unknown;
  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    let any = false;
    try {
      for await (const t of runOnce(messages, signal, model, prio)) { any = true; yield t; }
      return;
    } catch (e) {
      last = e;
      if (any || signal?.aborted || attempt === RETRY_MS.length || (e instanceof ModelError && /not connected|queue full|in time/.test(e.friendly))) throw e;
      console.error(`[grok-cli] try ${attempt + 1} failed, retrying: ${(e as Error).message.slice(0, 200)}`);
      await sleep(RETRY_MS[attempt] + Math.floor(Math.random() * 400), signal);
      if (signal?.aborted) throw e;
    }
  }
  throw last;
}

async function* runOnce(messages: ChatMessage[], signal?: AbortSignal, model?: string, prio = 0): AsyncGenerator<string> {
  const cfg = { ...grokCliConfig() };
  if (model) cfg.model = model;
  if (!cfg.ready) throw new ModelError("The agent is not connected to a model yet.", cfg.socket ? `grok-cli: relay socket ${cfg.socket} missing` : `grok-cli: no login under ${cfg.home || "(no HOME)"}/.grok`);
  await slot(cfg.concurrency, prio);
  const { system, prompt } = flatten(messages);
  const run = cfg.socket ? runRelay(cfg, system, prompt) : runLocal(cfg, system, prompt);
  const timer = setTimeout(run.kill, cfg.timeoutMs);
  signal?.addEventListener("abort", run.kill, { once: true });
  let buf = "";
  let any = false;
  let failure = "";
  try {
    for await (const chunk of run.out) {
      buf += String(chunk);
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (run.onLine?.(line)) continue;
        const r = textFromLine(line);
        if (r.text) { any = true; yield r.text; }
        if (r.error) failure = r.error;
      }
    }
    const code = await run.exited;
    if (failure || (!any && code !== 0)) {
      const timedOut = run.killed() && !signal?.aborted;
      throw new ModelError(timedOut ? "The model did not answer in time. Try again." : "The model could not answer. Try again.", `grok-cli exit ${code}: ${(failure || run.stderr()).slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
    run.kill();
    await run.exited;
    run.cleanup();
    release();
  }
}
