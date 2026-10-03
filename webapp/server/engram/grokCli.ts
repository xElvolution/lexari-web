/**
 * Grok CLI provider: runs `grok -p` headless with the CLI's own login on this server.
 *
 * The CLI is an agent with tools (shell, files, web). Lexari only wants text, so every run is locked down:
 * an empty temp working dir, only the harmless todo_write tool allowed, shell/subagents/scheduler denied,
 * no web search, no plan mode, two turns max, and a hard timeout. The prompt goes in as an argument
 * (no shell), the system prompt replaces Grok's own.
 *
 * Env: GROK_CLI_BIN (default "grok"), GROK_CLI_HOME (HOME holding the CLI login, default the process HOME),
 *      GROK_CLI_MODEL (optional), GROK_CLI_TIMEOUT_MS (default 120000), GROK_CLI_CONCURRENCY (default 2).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelError, type ChatMessage } from "./cortex";

export function grokCliConfig() {
  const bin = process.env.GROK_CLI_BIN || "grok";
  const home = process.env.GROK_CLI_HOME || process.env.HOME || "";
  const model = process.env.GROK_CLI_MODEL || "";
  const ready = !!home && existsSync(join(home, ".grok", "auth.json"));
  return {
    bin, home, model, ready,
    timeoutMs: Number(process.env.GROK_CLI_TIMEOUT_MS || 120_000),
    concurrency: Math.max(1, Number(process.env.GROK_CLI_CONCURRENCY || 2)),
  };
}

let running = 0;
const waiting: (() => void)[] = [];
async function slot(max: number) {
  if (running < max) { running++; return; }
  if (waiting.length >= max * 8) throw new ModelError("The agent is busy. Try again in a minute.", "grok-cli queue full");
  await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
}
function release() {
  running--;
  waiting.shift()?.();
}

/** One prompt from the transcript: the CLI takes a single message, so earlier turns are quoted. */
export function flatten(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const last = turns.pop();
  const history = turns.map((m) => `${m.role === "user" ? "Person" : "You"}: ${m.content}`).join("\n");
  const prompt = [
    history ? `Conversation so far:\n${history}\n` : "",
    `Person: ${last?.content ?? ""}`,
    "",
    "Reply to the person's last message as yourself. Plain text only. Do not use tools.",
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

export async function* streamGrokCli(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  const cfg = grokCliConfig();
  if (!cfg.ready) throw new ModelError("The agent is not connected to a model yet.", `grok-cli: no login under ${cfg.home || "(no HOME)"}/.grok`);
  await slot(cfg.concurrency);
  const cwd = mkdtempSync(join(tmpdir(), "lexari-grok-"));
  const { system, prompt } = flatten(messages);
  const child = spawn(cfg.bin, grokArgs(system, prompt, cwd, cfg.model), {
    cwd,
    env: { PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin", HOME: cfg.home, LANG: "C.UTF-8", NO_COLOR: "1" } as unknown as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const kill = () => { if (!child.killed) child.kill("SIGKILL"); };
  const timer = setTimeout(kill, cfg.timeoutMs);
  signal?.addEventListener("abort", kill, { once: true });
  let stderr = "";
  child.stderr.on("data", (d) => { if (stderr.length < 2000) stderr += String(d); });
  const exited = new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
  let buf = "";
  let any = false;
  let failure = "";
  try {
    for await (const chunk of child.stdout) {
      buf += String(chunk);
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const r = textFromLine(line);
        if (r.text) { any = true; yield r.text; }
        if (r.error) failure = r.error;
      }
    }
    const code = await exited;
    if (failure || (!any && code !== 0)) {
      const timedOut = child.killed && !signal?.aborted;
      throw new ModelError(timedOut ? "The model did not answer in time. Try again." : "The model could not answer. Try again.", `grok-cli exit ${code}: ${(failure || stderr).slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
    kill();
    rmSync(cwd, { recursive: true, force: true });
    release();
  }
}
