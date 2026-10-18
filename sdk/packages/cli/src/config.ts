/** Where the CLI talks to and where it keeps your key (~/.lexari/credentials.json, readable only by you). */
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const API = (process.env.LEXARI_API_URL || "https://app.hooks247.com").replace(/\/$/, "");
const dir = () => process.env.LEXARI_HOME || join(homedir(), ".lexari");
const file = () => join(dir(), "credentials.json");

export type Creds = { key: string; api: string; handle: string };
export function saveCreds(c: Creds) {
  mkdirSync(dir(), { recursive: true, mode: 0o700 });
  writeFileSync(file(), JSON.stringify(c, null, 2), { mode: 0o600 });
  chmodSync(file(), 0o600);
}
export function loadCreds(): Creds | null {
  if (process.env.LEXARI_API_KEY) return { key: process.env.LEXARI_API_KEY, api: API, handle: "" };
  if (!existsSync(file())) return null;
  try { return JSON.parse(readFileSync(file(), "utf8")) as Creds; } catch { return null; }
}
export const clearCreds = () => rmSync(file(), { force: true });

export async function api<T>(path: string, init: { method?: string; body?: unknown; key?: string } = {}): Promise<{ status: number; data: T }> {
  const creds = init.key ? { key: init.key, api: API } : loadCreds();
  const base = creds?.api || API;
  const res = await fetch(base + path, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(creds?.key ? { authorization: `Bearer ${creds.key}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let data: unknown = text; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data: data as T };
}
export function needKey(): Creds {
  const c = loadCreds();
  if (!c) { console.error("Not logged in. Run `lexari login` first."); process.exit(1); }
  return c;
}
