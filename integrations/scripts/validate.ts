/**
 * Validates every integrations/<slug>/ folder and builds what the app reads.
 *
 *   npx tsx integrations/scripts/validate.ts            check everything (CI runs this on every pull request)
 *   npx tsx integrations/scripts/validate.ts --write    also write webapp/content/integrations.generated.json and
 *                                                       copy logos to webapp/public/integrations/
 *   npx tsx integrations/scripts/validate.ts --check    fail when those generated files are out of date
 *
 * The rules mirror integrations/schema.json, plus what a JSON schema can't say: the folder is the slug, only Lexari's
 * own connectors may be built-in, a dapp's agent block is a valid Lexari manifest with the same id, free, HTTPS tools on
 * public hosts, money only through declared intents, safe logos, and no em dashes anywhere.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseManifest, type Manifest } from "../../sdk/packages/manifest/src/index.ts";
import { INTEGRATIONS } from "../../webapp/content/integrations.ts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(ROOT, "..");
export const GENERATED = join(REPO, "webapp/content/integrations.generated.json");
export const PUBLIC_LOGOS = join(REPO, "webapp/public/integrations");
/** Lexari's own connectors (webapp/content/integrations.ts) plus the model router. Only these can be built-in. */
export const BUILTIN_CONNECTORS = new Set([...INTEGRATIONS.filter((i) => !i.builtin).map((i) => i.id as string), "0g"]);
const DASH = /[\u2013\u2014]/;
const https = z.string().url().refine((u) => u.startsWith("https://"), "must be https://");
const text = (min: number, max: number) => z.string().min(min).max(max).refine((s) => !DASH.test(s), "no em or en dashes");

export const entrySchema = z.object({
  $schema: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,31}$/),
  name: text(2, 40),
  kind: z.enum(["built-in", "dapp"]),
  connector: z.string().optional(),
  category: z.enum(["chains", "trading", "prediction", "data", "compute", "payments"]),
  status: z.enum(["live-devnet", "live-testnet", "live", "market-data", "setup-needed", "coming-soon", "in-review"]),
  description: text(20, 600),
  website: https, docs: https, api: https.optional(),
  chains: z.array(text(2, 40)).min(1).max(12),
  contracts: z.array(z.object({ chain: text(2, 40), address: z.string().min(8).max(80), label: text(2, 60) }).strict()).max(30),
  contact: z.object({ name: text(2, 60), github: z.string().regex(/^[A-Za-z0-9-]{1,39}$/), email: z.string().email().optional(), x: z.string().regex(/^[A-Za-z0-9_]{1,15}$/).optional() }).strict(),
  logo: z.enum(["logo.svg", "logo.png"]),
  actions: z.array(z.object({ text: text(4, 120), live: z.boolean() }).strict()).min(1).max(10),
  agent: z.unknown().optional(),
}).strict();
export type Entry = z.output<typeof entrySchema> & { agent?: Manifest };

const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const OTHER = /^[A-Za-z0-9:._-]{8,80}$/;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|.*\.local$|.*\.internal$)/i;

function pngSize(buf: Buffer) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Problems with one folder (empty when it's good). */
export function validateEntry(dir: string): { entry: Entry | null; problems: string[] } {
  const slug = dir.split("/").pop()!;
  const p: string[] = [];
  const file = join(dir, "integration.json");
  if (!existsSync(file)) return { entry: null, problems: [`${slug}: missing integration.json`] };
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, "utf8")); } catch (e) { return { entry: null, problems: [`${slug}: integration.json is not valid JSON (${(e as Error).message})`] }; }
  const r = entrySchema.safeParse(raw);
  if (!r.success) return { entry: null, problems: r.error.issues.slice(0, 20).map((i) => `${slug}: ${i.path.join(".") || "entry"}: ${i.message}`) };
  const e = r.data as Entry;
  if (e.slug !== slug) p.push(`${slug}: slug "${e.slug}" must match the folder name`);
  if (!existsSync(join(dir, "README.md"))) p.push(`${slug}: missing README.md`);
  else if (DASH.test(readFileSync(join(dir, "README.md"), "utf8"))) p.push(`${slug}: README.md: no em or en dashes`);
  if (e.kind === "built-in") {
    if (!e.connector || !BUILTIN_CONNECTORS.has(e.connector)) p.push(`${slug}: built-in entries are Lexari's own connectors; use kind "dapp" for a new protocol`);
    if (e.agent) p.push(`${slug}: built-in entries have no agent block`);
  } else {
    if (e.connector) p.push(`${slug}: a dapp has no connector field`);
    if (!["in-review", "live-testnet", "live-devnet"].includes(e.status)) p.push(`${slug}: a dapp's status is in-review (Lexari sets live-testnet or live-devnet when merging)`);
    if (!e.agent) p.push(`${slug}: a dapp needs an agent block (a Lexari agent manifest with your tools)`);
    else {
      const m = parseManifest(e.agent);
      if (!m.ok) m.issues.forEach((i) => p.push(`${slug}: agent.${i}`));
      else {
        e.agent = m.manifest;
        if (m.manifest.id !== slug) p.push(`${slug}: agent.id must be "${slug}"`);
        if (m.manifest.pricing.type !== "free") p.push(`${slug}: dapps are free to use (agent.pricing.type "free")`);
        if (!m.manifest.tools.length) p.push(`${slug}: agent needs at least one tool`);
        for (const t of m.manifest.tools) if (PRIVATE_HOST.test(new URL(t.url).hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(new URL(t.url).hostname)) p.push(`${slug}: tool ${t.name} must use a public HTTPS host name`);
      }
    }
  }
  for (const c of e.contracts) {
    const evm = /eth|base|arbitrum|polygon|monad|optimism|bnb|avalanche|sepolia|robinhood|tempo|hyper/i.test(c.chain);
    const sol = /solana/i.test(c.chain);
    if ((evm && !EVM.test(c.address)) || (sol && !SOL.test(c.address)) || (!evm && !sol && !OTHER.test(c.address))) p.push(`${slug}: contract "${c.label}" on ${c.chain} isn't a valid address`);
  }
  const logo = join(dir, e.logo);
  if (!existsSync(logo)) p.push(`${slug}: missing ${e.logo}`);
  else {
    const buf = readFileSync(logo);
    if (statSync(logo).size > 200 * 1024) p.push(`${slug}: ${e.logo} is over 200 KB`);
    if (e.logo.endsWith(".png")) {
      const s = pngSize(buf);
      if (!s) p.push(`${slug}: logo.png isn't a PNG`);
      else if (s.w !== s.h || s.w < 64) p.push(`${slug}: logo.png must be square and at least 64 px (it's ${s.w}x${s.h})`);
    } else {
      const svg = buf.toString("utf8");
      if (!/<svg[\s>]/i.test(svg)) p.push(`${slug}: logo.svg isn't an SVG`);
      if (/<script|\son[a-z]+\s*=|javascript:|<foreignObject|(?:href|src)\s*=\s*["'](?:https?:)?\/\//i.test(svg)) p.push(`${slug}: logo.svg can't contain scripts, event handlers or external references`);
    }
  }
  return { entry: p.length ? null : e, problems: p };
}

export function validateAll() {
  const dirs = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && !["scripts", "TEMPLATE", "ci", "node_modules"].includes(d.name)).map((d) => join(ROOT, d.name)).sort();
  const entries: Entry[] = []; const problems: string[] = [];
  for (const d of dirs) { const r = validateEntry(d); if (r.entry) entries.push(r.entry); problems.push(...r.problems); }
  const names = new Map<string, string>();
  for (const e of entries) { const k = e.name.toLowerCase(); if (names.has(k)) problems.push(`${e.slug}: name "${e.name}" is already used by ${names.get(k)}`); names.set(k, e.slug); }
  return { entries, problems };
}

/** What the app reads: one sorted list, logos served from /integrations/<slug>.<ext>. */
export function generated(entries: Entry[]) {
  const order = ["live-devnet", "live-testnet", "live", "market-data", "setup-needed", "in-review", "coming-soon"];
  return [...entries]
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name))
    .map(({ $schema, ...e }) => ({ ...e, logo: `/integrations/${e.slug}.${e.logo.split(".").pop()}` }));
}

function main() {
  const args = new Set(process.argv.slice(2));
  const { entries, problems } = validateAll();
  if (problems.length) { console.error(`Integration checks failed:\n- ${problems.join("\n- ")}`); process.exit(1); }
  const out = JSON.stringify(generated(entries), null, 2) + "\n";
  if (args.has("--write")) {
    writeFileSync(GENERATED, out);
    rmSync(PUBLIC_LOGOS, { recursive: true, force: true }); mkdirSync(PUBLIC_LOGOS, { recursive: true });
    for (const e of entries) copyFileSync(join(ROOT, e.slug, e.logo), join(PUBLIC_LOGOS, `${e.slug}.${e.logo.split(".").pop()}`));
  }
  if (args.has("--check")) {
    const stale = !existsSync(GENERATED) || readFileSync(GENERATED, "utf8") !== out
      || entries.some((e) => { const f = join(PUBLIC_LOGOS, `${e.slug}.${e.logo.split(".").pop()}`); return !existsSync(f) || !readFileSync(f).equals(readFileSync(join(ROOT, e.slug, e.logo))); });
    if (stale) { console.error("Generated files are out of date. Run: npx tsx integrations/scripts/validate.ts --write"); process.exit(1); }
  }
  console.log(`${entries.length} integrations OK.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
