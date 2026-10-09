/**
 * Agent desktops: each person gets one locked-down Docker container (a graphical Linux desktop with Chromium,
 * shown over VNC; 1 CPU, 1.5 GB, no network except the relay's filtering web proxy) run by the local desktop relay
 * (desktop-relay/relay.mjs). The webapp signs short-lived websocket tickets (terminal and screen) and runs the
 * agent's commands through the relay with a shared secret.
 */
import crypto from "node:crypto";

const secret = () => process.env.DESKTOP_SECRET || "";
const relay = () => process.env.DESKTOP_RELAY_URL || "";
export const desktopOn = () => secret().length >= 32 && !!relay();
export const desktopUser = (userId: string) => userId.replace(/-/g, "").toLowerCase();

/** A ticket for the terminal websocket: the user's id and a 60-second expiry, HMAC-signed. */
export function desktopTicket(userId: string) {
  const body = Buffer.from(JSON.stringify({ u: desktopUser(userId), exp: Date.now() + 60_000 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

async function call<T>(path: string, body: Record<string, unknown>, ms = 30_000): Promise<T> {
  const res = await fetch(relay() + path, {
    method: "POST", headers: { "content-type": "application/json", "x-desktop-secret": secret() },
    body: JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`desktop relay ${res.status}`);
  return res.json() as Promise<T>;
}

/** Runs an agent command. `env`: vault secrets the command references, injected at exec time (see server/secrets.ts). */
export const runInDesktop = (userId: string, cmd: string, env?: Record<string, string>) => call<{ code: number; out: string }>("/exec", { user: desktopUser(userId), cmd, ...(env && Object.keys(env).length ? { env } : {}) });
/** Single-quote a string for bash. */
export const shq = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
export const runQuiet = (userId: string, cmd: string) => call<{ code: number; out: string }>("/exec", { user: desktopUser(userId), cmd, quiet: true });
export const openInDesktop = (userId: string, url: string) => call<{ code: number; out: string }>("/exec", { user: desktopUser(userId), cmd: `browse ${shq(url)}`, quiet: true });
export const listDesktop = (userId: string, path?: string) => call<{ path: string; entries: { name: string; dir: boolean; size: number; mtime: number }[] }>("/files", { user: desktopUser(userId), path });
export const readDesktop = (userId: string, path: string) => call<{ text: string; code: number }>("/read", { user: desktopUser(userId), path });

/** Commands the agent asked for in its reply: <run>…</run>, at most three. */
export function runRequests(text: string) {
  return [...text.matchAll(/<run>([\s\S]*?)<\/run>/g)].map((m) => m[1].trim()).filter(Boolean).slice(0, 3);
}
/** A PNG screenshot of the agent's screen (base64), taken inside the container. */
export const shotDesktop = (userId: string) => call<{ png?: string; error?: string }>("/shot", { user: desktopUser(userId) }, 20_000);

/** One file from the agent's computer (base64), or why not. Paths must be under /home/agent. */
export const pullDesktop = (userId: string, path: string) => call<{ b64?: string; size?: number; error?: string }>("/pull", { user: desktopUser(userId), path }, 45_000);
/** Puts an upload on the agent's computer, in ~/Uploads only. */
export const pushDesktop = (userId: string, path: string, data: Buffer) => call<{ ok?: boolean; path?: string; error?: string }>("/push", { user: desktopUser(userId), path, b64: data.toString("base64") }, 45_000);
