/**
 * Files in chat. An agent sends a file it made on its computer by writing <file>/home/agent/…</file> in its reply;
 * Lexari copies it out of the container (size-capped), stores it for its owner and the chat shows a file card. Photos
 * you upload are stored the same way and put on the agent's computer in ~/Uploads so it can edit them.
 * Content types come from the bytes (magic numbers), never from the name alone; nothing is served as HTML or SVG.
 */
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "./db";
import { agentFiles } from "./db/schema";
import { desktopOn, pullDesktop, pushDesktop } from "./desktop";
import { HttpError } from "./http";

export const FILE_MAX = Number(process.env.LEXARI_FILE_MAX || 10 * 1024 * 1024);
const KEEP = 200; // newest files kept per person
const HOME = "/home/agent";

export type FileKind = "image" | "video" | "text" | "code" | "pdf" | "other";
export type FileItem = { id: string; name: string; size: number; mime: string; kind: FileKind };

const CODE = /\.(py|js|mjs|cjs|ts|tsx|jsx|sh|bash|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sql|swift|lua|r|pl|yaml|yml|toml|ini|json|css|scss)$/i;
const TEXT = /\.(txt|md|csv|tsv|log|xml|env\.example)$/i;

/** What the bytes are. Images and PDFs by magic number; text when it decodes as UTF-8 without NULs. */
export function sniff(name: string, b: Buffer): { mime: string; kind: FileKind } {
  const h = b.subarray(0, 12);
  if (h[0] === 0x89 && h.toString("latin1", 1, 4) === "PNG") return { mime: "image/png", kind: "image" };
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return { mime: "image/jpeg", kind: "image" };
  if (h.toString("latin1", 0, 6) === "GIF87a" || h.toString("latin1", 0, 6) === "GIF89a") return { mime: "image/gif", kind: "image" };
  if (h.toString("latin1", 0, 4) === "RIFF" && h.toString("latin1", 8, 12) === "WEBP") return { mime: "image/webp", kind: "image" };
  if (h.toString("latin1", 0, 5) === "%PDF-") return { mime: "application/pdf", kind: "pdf" };
  // MP4 / MOV (ISO base media: "ftyp" box first) and WebM (EBML): videos the agent made play inline
  if (h.toString("latin1", 4, 8) === "ftyp" && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |qt  |dash|mmp4)$/.test(h.toString("latin1", 8, 12))) return { mime: "video/mp4", kind: "video" };
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3 && /\.webm$/i.test(name)) return { mime: "video/webm", kind: "video" };
  const head = b.subarray(0, 16384);
  const textish = !head.includes(0) && (() => { try { new TextDecoder("utf-8", { fatal: true }).decode(head.length === b.length ? head : head.subarray(0, lastBoundary(head))); return true; } catch { return false; } })();
  if (textish) {
    if (/\.csv$/i.test(name)) return { mime: "text/csv; charset=utf-8", kind: "text" };
    return { mime: "text/plain; charset=utf-8", kind: CODE.test(name) ? "code" : TEXT.test(name) || !/\.\w+$/.test(name) ? "text" : "code" };
  }
  return { mime: "application/octet-stream", kind: "other" };
}
/** Don't cut a UTF-8 sequence in half when checking the first chunk of a big file. */
function lastBoundary(b: Buffer) { let i = b.length; while (i > 0 && (b[i - 1] & 0xc0) === 0x80) i--; return Math.max(0, i - 1); }

/** A safe file name: no folders, no control characters, at most 120 characters, never empty. */
export function safeName(name: string) {
  const base = String(name || "").split(/[\\/]/).pop() || "";
  const clean = base.replace(/[\u0000-\u001f\u007f"'`<>|:*?]/g, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  return (clean || "file").slice(-120);
}

/** Paths the agent named with <file>…</file> or <file path="…"/>, under /home/agent only, at most four. */
export function fileTags(text: string) {
  const out: string[] = [];
  for (const m of text.matchAll(/<file(?:\s+path=["']([^"']{1,400})["'])?\s*\/?>(?:([^<]{1,400})<\/file>)?/gi)) {
    let p = (m[1] || m[2] || "").trim();
    if (!p) continue;
    if (p.startsWith("~/")) p = `${HOME}/${p.slice(2)}`;
    else if (!p.startsWith("/")) p = `${HOME}/${p}`;
    if (!p.startsWith(`${HOME}/`) || p.includes("..") || /[\0\n]/.test(p)) continue;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 4);
}
export const stripFileTags = (t: string) => t.replace(/<file\b[^>]*\/>/gi, "").replace(/<file\b[^>]*>[^<]*<\/file>/gi, "").replace(/<file\b[^>]*>?$/i, "").replace(/[ \t]+\n/g, "\n").trim();

export const view = (r: { id: string; name: string; size: number; mime: string }): FileItem => ({ id: r.id, name: r.name, size: r.size, mime: r.mime, kind: kindOf(r.name, r.mime) });
export function kindOf(name: string, mime: string): FileKind {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return CODE.test(name) ? "code" : "text";
  return "other";
}

async function store(userId: string, v: { source: "agent" | "upload" | "generated"; agent?: string; convo?: string; messageId?: string; name: string; data: Buffer; path?: string }) {
  const { mime } = sniff(v.name, v.data);
  const [row] = await db().insert(agentFiles).values({ userId, source: v.source, agentSlug: v.agent || "", convo: v.convo || "", messageId: v.messageId || "", name: safeName(v.name), mime, size: v.data.length, path: v.path || "", data: v.data })
    .returning({ id: agentFiles.id, name: agentFiles.name, size: agentFiles.size, mime: agentFiles.mime });
  if (Math.random() < 0.1) void prune(userId).catch(() => {});
  return view(row);
}
async function prune(userId: string) {
  const keep = await db().select({ id: agentFiles.id }).from(agentFiles).where(eq(agentFiles.userId, userId)).orderBy(desc(agentFiles.createdAt)).limit(KEEP);
  if (keep.length < KEEP) return;
  await db().delete(agentFiles).where(and(eq(agentFiles.userId, userId), notInArray(agentFiles.id, keep.map((k) => k.id))));
}

/** Copies the files the agent named out of its computer. Returns the cards and a note for each one that failed. */
export async function attachFromComputer(userId: string, ctx: { agent: string; convo: string; messageId: string }, paths: string[]) {
  const items: FileItem[] = [], notes: string[] = [];
  if (!paths.length || !desktopOn()) return { items, notes };
  for (const p of paths) {
    const name = safeName(p);
    const r = await pullDesktop(userId, p).catch((e: Error) => ({ error: e.message } as { b64?: string; size?: number; error?: string }));
    if (!r.b64 && r.size !== 0) { notes.push(r.error === "too big" ? `${name} is bigger than ${Math.round(FILE_MAX / 1048576)} MB, so I couldn't attach it` : `I couldn't find ${name} on my computer`); continue; }
    const data = Buffer.from(r.b64 || "", "base64");
    if (data.length > FILE_MAX) { notes.push(`${name} is too big to attach`); continue; }
    items.push(await store(userId, { source: "agent", ...ctx, name, data, path: p }));
  }
  return { items, notes };
}

/** An image the image tool made: stored for you and (when the computer is on) put in ~/Uploads so the agent can edit it. */
export async function saveGenerated(userId: string, ctx: { agent: string; convo: string; messageId: string }, name: string, data: Buffer) {
  let path = "";
  if (desktopOn()) path = (await pushDesktop(userId, `${HOME}/Uploads/${safeName(name)}`, data).catch(() => ({ path: "" } as { path?: string }))).path || "";
  return store(userId, { source: "generated", ...ctx, name, data, path });
}

/** A file you upload in chat: checked, stored, and copied to the agent's computer in ~/Uploads. */
export async function saveUpload(userId: string, rawName: string, data: Buffer, convo = "") {
  if (!data.length) throw new HttpError(400, "That file is empty.");
  if (data.length > FILE_MAX) throw new HttpError(413, `Files can be up to ${Math.round(FILE_MAX / 1048576)} MB.`);
  const s = sniff(rawName, data);
  let name = safeName(rawName);
  // the name follows what the bytes are (a PNG called .jpg becomes .png), so the agent's tools read it right
  const ext = s.mime === "image/png" ? ".png" : s.mime === "image/jpeg" ? ".jpg" : s.mime === "image/gif" ? ".gif" : s.mime === "image/webp" ? ".webp" : s.mime === "application/pdf" ? ".pdf" : "";
  if (ext && !name.toLowerCase().endsWith(ext) && !(ext === ".jpg" && /\.jpe?g$/i.test(name))) name = `${name.replace(/\.[A-Za-z0-9]{1,5}$/, "")}${ext}`;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(2);
  const onComputer = `${HOME}/Uploads/${stamp}-${name}`.slice(0, 380);
  let path = "";
  if (desktopOn()) path = (await pushDesktop(userId, onComputer, data).catch(() => ({ path: "" } as { path?: string }))).path || "";
  const item = await store(userId, { source: "upload", convo, name, data, path });
  return { ...item, path };
}

/** Your file, for the download route (owner only). */
export async function ownFile(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db().select().from(agentFiles).where(and(eq(agentFiles.userId, userId), eq(agentFiles.id, id))).limit(1);
  return row ?? null;
}
/** Uploads named in a chat message (owner only), with their bytes, for the vision step. */
export async function ownFiles(userId: string, ids: string[]) {
  const ok = ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, 4);
  if (!ok.length) return [];
  return db().select().from(agentFiles).where(and(eq(agentFiles.userId, userId), inArray(agentFiles.id, ok)));
}
