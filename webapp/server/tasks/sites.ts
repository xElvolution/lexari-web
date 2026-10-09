/**
 * Build & deploy, the free way: a site the agent built on its computer is published as a preview at
 * app.lexari.ai/p/<id>/. The folder is tarred in the container, copied out (size-capped), unpacked here and stored per
 * file. Re-publishing the same folder name keeps the link. Pages are served with `Content-Security-Policy: sandbox`
 * (an opaque origin: they can't read Lexari cookies, storage or call its API as you) — see app/p/[id]/[[...path]].
 */
import crypto from "node:crypto";
import zlib from "node:zlib";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { agentSiteFiles, agentSites } from "../db/tasksSchema";
import { pullDesktop, runQuiet, shq } from "../desktop";
import { HttpError } from "../http";

export const SITES_MAX = 20;
const FILES_MAX = 400;
const BYTES_MAX = 25 * 1024 * 1024;
const TGZ = "/home/agent/.lexari/site.tgz";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", xml: "application/xml", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg",
  jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", pdf: "application/pdf", wasm: "application/wasm", map: "application/json",
  csv: "text/csv; charset=utf-8", webmanifest: "application/manifest+json",
};
export const mimeOf = (p: string) => TYPES[(/\.([a-z0-9]+)$/i.exec(p)?.[1] || "").toLowerCase()] || "application/octet-stream";

/** Regular files from a ustar/gnu tar (enough for GNU tar's output; links and devices are skipped). */
export function untar(buf: Buffer): { path: string; data: Buffer }[] {
  const out: { path: string; data: Buffer }[] = [];
  let off = 0, longName = "";
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a: number, b: number) => h.toString("utf8", a, b).replace(/\0[\s\S]*$/, "");
    const size = parseInt(str(124, 136).trim() || "0", 8) || 0;
    const type = String.fromCharCode(h[156] || 48);
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") { longName = body.toString("utf8").replace(/\0[\s\S]*$/, ""); continue; }
    const name = longName || (str(345, 500) ? `${str(345, 500)}/${str(0, 100)}` : str(0, 100));
    longName = "";
    if (type !== "0" && type !== "\0" && type !== "7") continue;
    const path = cleanPath(name);
    if (path) out.push({ path, data: Buffer.from(body) });
  }
  return out;
}
/** "./a/b.html" → "a/b.html"; anything climbing out, hidden or odd is dropped. */
export function cleanPath(p: string) {
  const parts = p.replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
  if (!parts.length || parts.some((s) => s === ".." || s.startsWith(".") || s.length > 120 || /[\0-\x1f]/.test(s))) return "";
  const out = parts.join("/");
  return out.length <= 300 ? out : "";
}
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "site";
const newId = () => crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase();

export function siteUrl(id: string) {
  const base = (process.env.LEXARI_APP_ORIGIN || process.env.NEXT_PUBLIC_WEBAPP_URL || "https://app.lexari.ai").replace(/\/$/, "");
  return `${base}/p/${id}/`;
}

/** Publishes a folder on the agent's computer (must contain index.html). Returns the preview link. */
export async function publishSite(userId: string, agent: string, dir: string, title?: string) {
  const d = dir.trim().replace(/\/+$/, "").replace(/^~(?=\/|$)/, "/home/agent");
  if (!/^\/home\/agent(\/[^\0]*)?$/.test(d) || d.split("/").includes("..")) throw new HttpError(400, "the site has to be a folder in my home folder");
  const pack = await runQuiet(userId, `d=${shq(d)}; [ -f "$d/index.html" ] || { echo NOINDEX; exit 3; }; mkdir -p ~/.lexari && tar --exclude=node_modules --exclude=.git -czf ${TGZ} -C "$d" . && stat -c %s ${TGZ}`);
  if (/NOINDEX/.test(pack.out)) throw new HttpError(400, `there's no index.html in ${d}`);
  if (pack.code !== 0) throw new HttpError(502, "my computer couldn't pack the site");
  const got = await pullDesktop(userId, TGZ);
  if (!got.b64) throw new HttpError(413, got.error === "too big" ? "the site is too big to publish (keep it under 8 MB packed; leave out videos and node_modules)" : "my computer didn't hand the site over");
  let files: { path: string; data: Buffer }[];
  try { files = untar(zlib.gunzipSync(Buffer.from(got.b64, "base64"), { maxOutputLength: BYTES_MAX + 1 })); } catch { throw new HttpError(413, "the site is too big or not readable"); }
  if (!files.length || !files.some((f) => f.path === "index.html")) throw new HttpError(400, "the site has no index.html");
  if (files.length > FILES_MAX) throw new HttpError(413, `the site has too many files (max ${FILES_MAX})`);
  const bytes = files.reduce((n, f) => n + f.data.length, 0);
  if (bytes > BYTES_MAX) throw new HttpError(413, "the site is too big (max 25 MB)");

  const database = db();
  const slug = slugOf(title || d.split("/").pop() || "site");
  const [had] = await database.select().from(agentSites).where(and(eq(agentSites.userId, userId), eq(agentSites.slug, slug))).limit(1);
  if (!had) {
    const [{ n }] = await database.select({ n: sql<number>`count(*)::int` }).from(agentSites).where(eq(agentSites.userId, userId));
    if (n >= SITES_MAX) throw new HttpError(409, `you have ${SITES_MAX} published sites; delete one first`);
  }
  const id = had?.id || newId();
  await database.transaction(async (tx) => {
    if (had) {
      await tx.delete(agentSiteFiles).where(eq(agentSiteFiles.siteId, id));
      await tx.update(agentSites).set({ name: (title || had.name).slice(0, 80), files: files.length, bytes, updatedAt: new Date() }).where(eq(agentSites.id, id));
    } else {
      await tx.insert(agentSites).values({ id, userId, agent, slug, name: (title || slug).slice(0, 80), files: files.length, bytes });
    }
    for (let i = 0; i < files.length; i += 50) {
      await tx.insert(agentSiteFiles).values(files.slice(i, i + 50).map((f) => ({ siteId: id, path: f.path, mime: mimeOf(f.path), data: f.data })));
    }
  });
  return { id, url: siteUrl(id), files: files.length, bytes, updated: !!had };
}

/** A file of a published site (index.html for folders). */
export async function siteFile(id: string, path: string) {
  if (!/^[a-z0-9]{6,12}$/.test(id)) return null;
  const p = cleanPath(path);
  const tries = !p ? ["index.html"] : /\.[a-z0-9]+$/i.test(p) ? [p] : [p, `${p}/index.html`, `${p}.html`];
  for (const t of tries) {
    const [f] = await db().select().from(agentSiteFiles).where(and(eq(agentSiteFiles.siteId, id), eq(agentSiteFiles.path, t))).limit(1);
    if (f) return f;
  }
  return null;
}
