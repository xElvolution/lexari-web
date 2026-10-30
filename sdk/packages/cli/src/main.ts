/**
 * lexari: the Lexari developer CLI (testnet, invite-only alpha).
 *   lexari init [dir] [--template hello|tip-jar]   start a new agent
 *   lexari validate [--remote]                     check the manifest (and run review's automated checks)
 *   lexari dev [--offline]                         talk to your agent as Lexari runs it; tools run locally
 *   lexari test [--url URL] [--prompts]            the red-team pack
 *   lexari login | logout | whoami                 device-code login; the key stays in ~/.lexari
 *   lexari publish                                 submit this version for review
 *   lexari status                                  your listings and review state
 *   lexari rotate-secret <id>                      new webhook secret, shown once
 * Global: --agent <file> (default agent.ts), --url <tool endpoint> (overrides the manifest url).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { serve, testClient, ManifestError } from "@lexari/sdk";
import { API, api, clearCreds, loadCreds, needKey, saveCreds } from "./config.ts";
import { loadAgent } from "./load.ts";
import { endpointChecks, httpCaller, toolChecks, PROMPT_ATTACKS, type Finding } from "./redteam.ts";
import { TEMPLATES } from "./templates.ts";

const argv = process.argv.slice(2);
const cmd = argv[0] || "help";
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const positional = argv.slice(1).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--") && !["remote", "offline", "prompts", "force"].includes(all[i - 1].slice(2))));
const die = (msg: string): never => { console.error(msg); process.exit(1); };
const tick = (f: Finding) => console.log(`  ${f.ok ? "pass" : "FAIL"}  ${f.name}${f.detail ? `  (${f.detail})` : ""}`);

async function manifest() {
  const agent = await loadAgent(opt("agent"));
  try { return { agent, m: agent.manifest({ url: opt("url") }) }; }
  catch (e) { if (e instanceof ManifestError) die(e.message); throw e; }
}

const commands: Record<string, () => Promise<void>> = {
  async help() { console.log((await import("node:fs")).readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?|^ \* ?/gm, "").trim()); },

  async init() {
    const dir = resolve(positional[0] || ".");
    const tpl = opt("template") || "hello";
    if (existsSync(dir) && readdirSync(dir).length && !flag("force")) die(`${dir} isn't empty (use --force).`);
    mkdirSync(dir, { recursive: true });
    const id = basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "my-agent";
    const name = id.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
    if (tpl === "tip-jar") {
      const src = resolve(dirname(fileURLToPath(import.meta.url)), "../../../examples/tip-jar");
      cpSync(src, dir, { recursive: true });
    } else {
      const files = TEMPLATES[tpl] || die(`Unknown template ${tpl}. Try hello or tip-jar.`);
      for (const [f, body] of Object.entries(files)) writeFileSync(join(dir, f), body.replaceAll("__ID__", id).replaceAll("__NAME__", name));
    }
    console.log(`Made ${tpl} in ${dir}.\nNext: cd ${positional[0] || "."} && lexari dev`);
  },

  async validate() {
    const { m } = await manifest();
    console.log(`Manifest OK: ${m.name} ${m.version}, ${m.tools.length} tool(s), model ${m.model}.`);
    if (!flag("remote")) return;
    needKey();
    const r = await api<{ ok: boolean; issues: string[]; checks: Finding[]; error?: string }>("/api/dev/v1/validate", { body: { manifest: m } });
    if (r.status !== 200) die(`Validate failed: ${r.data.error || r.status}`);
    r.data.issues.forEach((i) => console.log(`  FAIL  ${i}`));
    r.data.checks.forEach(tick);
    if (!r.data.ok) process.exit(1);
  },

  async dev() {
    const { agent, m } = await manifest();
    const secret = process.env.LEXARI_WEBHOOK_SECRET || `lxwh_dev_${randomBytes(16).toString("hex")}`;
    const port = Number(opt("port") || 8787);
    const server = serve(agent, { secret, port });
    const client = testClient(agent, { secret, url: `http://127.0.0.1:${port}/` });
    const offline = flag("offline") || !loadCreds();
    console.log(`${m.name} tools on http://127.0.0.1:${port} (signed with a ${process.env.LEXARI_WEBHOOK_SECRET ? "your" : "throwaway"} secret).`);
    console.log(offline ? "Offline: call tools with  /call <tool> {json}. Run `lexari login` to chat with the Lamina playground." : "Chat with your agent (Lamina, Lexari's rules). /call <tool> {json} runs a tool directly. Ctrl+C quits.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const history: { from: "you" | "agent"; text: string }[] = [];
    const runTool = async (tool: string, input: Record<string, unknown>) => {
      const r = await client.call(tool, input);
      if (r.status !== 200) return console.log(`  [${tool}] ${r.status}: ${JSON.stringify(r.body)}`);
      console.log(`  [${tool}] ${r.body.text}  (${r.ms} ms)`);
      if (r.body.intent) console.log(`  Lexari would show a Confirm card, "Proposed by ${m.name}": ${JSON.stringify(r.body.intent)}`);
      return r.body.text as string;
    };
    rl.setPrompt("you> ");
    let closed = false; rl.on("close", () => { closed = true; });
    const ask = () => { if (!closed) rl.prompt(); };
    ask();
    for await (const raw of rl) {
      const line = raw.trim();
      if (!line) { ask(); continue; }
      const call = line.match(/^\/call\s+([a-z0-9_]+)\s*(\{.*\})?$/i);
      if (call) { try { await runTool(call[1], call[2] ? JSON.parse(call[2]) : {}); } catch (e) { console.log(`  ${(e as Error).message}`); } ask(); continue; }
      if (offline) { console.log("  Offline. Use /call, or run lexari login."); ask(); continue; }
      const r = await api<{ reply: string; tools: { name: string; input: Record<string, unknown> }[]; error?: string }>("/api/dev/v1/playground", { body: { manifest: m, text: line, history: history.slice(-10) } });
      if (r.status !== 200) { console.log(`  ${r.data.error || `playground answered ${r.status}`}`); ask(); continue; }
      if (r.data.reply) console.log(`${m.name}> ${r.data.reply}`);
      history.push({ from: "you", text: line }, { from: "agent", text: r.data.reply });
      for (const t of r.data.tools) {
        if (!t.name.startsWith(`${m.id}.`)) { console.log(`  (asked for ${t.name}, a Lexari integration; not available in dev)`); continue; }
        const text = await runTool(t.name.slice(m.id.length + 1), t.input);
        if (text) history.push({ from: "agent", text: `[${t.name}] ${text}` });
      }
      ask();
    }
    server.close();
  },

  async test() {
    const { agent, m } = await manifest();
    let failed = 0;
    const show = (title: string, list: Finding[]) => { console.log(title); list.forEach(tick); failed += list.filter((f) => !f.ok).length; };
    const remote = opt("url") && !flag("local") ? opt("url")! : null;
    const secret = process.env.LEXARI_WEBHOOK_SECRET || (remote ? die("Set LEXARI_WEBHOOK_SECRET to test a deployed endpoint.") : `lxwh_test_${randomBytes(16).toString("hex")}`);
    let server: ReturnType<typeof serve> | null = null;
    const port = 18000 + Math.floor(Math.random() * 2000);
    if (!remote) server = serve(agent, { secret, port });
    const url = remote || `http://127.0.0.1:${port}/`;
    try {
      console.log(`Red-team pack for ${m.name} ${m.version} against ${url}`);
      show("Manifest", [{ name: "Schema", ok: true }, { name: "Model is a Lexari model", ok: true, detail: m.model }]);
      show("Endpoint", await endpointChecks(agent, secret, httpCaller(url)));
      show("Tools", await toolChecks(agent, secret, httpCaller(url)));
      if (flag("prompts")) {
        needKey();
        const results: Finding[] = [];
        for (const a of PROMPT_ATTACKS) {
          const r = await api<{ reply: string; tools: { name: string }[] }>("/api/dev/v1/playground", { body: { manifest: m, text: a.text } });
          if (r.status !== 200) { results.push({ name: a.name, ok: false, detail: `playground ${r.status}` }); continue; }
          const out = `${r.data.reply}\n${r.data.tools.map((t) => `<tool name="${t.name}">`).join("\n")}`;
          results.push({ name: a.name, ok: !a.fail.test(out), detail: a.fail.test(out) ? out.slice(0, 120) : undefined });
        }
        show("Prompts (Lamina playground)", results);
      }
    } finally { server?.close(); }
    console.log(failed ? `${failed} check(s) failed.` : "All checks passed.");
    if (failed) process.exit(1);
  },

  async login() {
    const start = await api<{ deviceCode: string; userCode: string; verificationUriComplete: string; interval: number; expiresIn: number; error?: string }>("/api/developer/device", { body: { label: hostname().slice(0, 60) } });
    if (start.status !== 200) die(`Couldn't start login: ${start.data.error || start.status}`);
    console.log(`Open ${start.data.verificationUriComplete}\nand approve code ${start.data.userCode} (expires in ${Math.round(start.data.expiresIn / 60)} minutes).`);
    const until = Date.now() + start.data.expiresIn * 1000;
    let wait = start.data.interval * 1000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, wait));
      const r = await api<{ status: string; key?: string; developer?: { handle: string; name: string } }>("/api/developer/device/token", { body: { deviceCode: start.data.deviceCode } });
      if (r.data.status === "slow_down") { wait += 1000; continue; }
      if (r.data.status === "pending") continue;
      if (r.data.status === "approved" && r.data.key) {
        saveCreds({ key: r.data.key, api: API, handle: r.data.developer!.handle });
        return console.log(`Logged in as @${r.data.developer!.handle}. Key saved to ~/.lexari (revoke it any time on the Developer page).`);
      }
      die(r.data.status === "denied" ? "Login was denied." : "That code expired. Run lexari login again.");
    }
    die("That code expired. Run lexari login again.");
  },
  async logout() { clearCreds(); console.log("Logged out. Revoke the key on the Developer page if this machine is lost."); },
  async whoami() {
    needKey();
    const r = await api<{ developer: { handle: string; name: string; status: string } }>("/api/dev/v1/listings");
    if (r.status !== 200) die(`Not logged in (${r.status}).`);
    console.log(`@${r.data.developer.handle} (${r.data.developer.name}), ${r.data.developer.status}, ${API}`);
  },

  async publish() {
    const { m } = await manifest();
    needKey();
    const r = await api<{ listing: { slug: string; status: string }; version: { version: string; status: string }; checks: Finding[]; webhookSecret?: string; error?: string; checksFailed?: Finding[]; issues?: string[] }>("/api/dev/v1/publish", { body: { manifest: m } });
    if (r.status !== 201) {
      console.error(`Not submitted: ${r.data.error || r.status}`);
      (r.data.issues || []).forEach((i) => console.error(`  FAIL  ${i}`));
      ((r.data as { checks?: Finding[] }).checks || []).filter((c) => !c.ok).forEach(tick);
      process.exit(1);
    }
    r.data.checks.forEach(tick);
    console.log(`Submitted ${m.id} ${r.data.version.version} for review. Listing is ${r.data.listing.status}.`);
    if (r.data.webhookSecret) console.log(`\nWebhook secret (shown once, store it as LEXARI_WEBHOOK_SECRET on your server):\n${r.data.webhookSecret}\n`);
  },
  async status() {
    needKey();
    const r = await api<{ listings: { slug: string; status: string; versions?: { version: string; status: string; notes?: string | null }[] }[] }>("/api/dev/v1/listings");
    if (r.status !== 200) die(`Couldn't load listings (${r.status}).`);
    if (!r.data.listings.length) return console.log("No listings yet. Run lexari publish.");
    for (const l of r.data.listings) {
      console.log(`${l.slug}  ${l.status}`);
      for (const v of l.versions || []) console.log(`  ${v.version}  ${v.status}${v.notes ? `  "${v.notes}"` : ""}`);
    }
  },
  async "rotate-secret"() {
    needKey();
    const slug = positional[0] || die("Usage: lexari rotate-secret <agent id>");
    const r = await api<{ webhookSecret: string; error?: string }>(`/api/dev/v1/listings/${encodeURIComponent(slug)}/webhook-secret`, { method: "POST", body: {} });
    if (r.status !== 200) die(r.data.error || `Failed (${r.status}).`);
    console.log(`New webhook secret (shown once; the old one stops working now):\n${r.data.webhookSecret}`);
  },
};

const run = commands[cmd] || (async () => die(`Unknown command ${cmd}. Run lexari help.`));
run().catch((e) => die(`lexari ${cmd}: ${(e as Error).message}`));
