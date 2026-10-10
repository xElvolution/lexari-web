import { env } from "./env";
import { userAgent } from "./device";
import { takeSse } from "./sse";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let agent = "LexariAndroid/1.0.0 (Android)";
export function setUserAgent(value: string) {
  agent = value;
}

export async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("user-agent", agent);
  headers.set("x-lexari-client", "android");
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 180) }; }
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
      ? (data as { error: string }).error
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export function msgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 40);
}

export type ChatEvent = {
  token?: string;
  replace?: string;
  error?: string;
  done?: boolean;
  send?: Record<string, unknown>;
  secret?: { id?: string; name?: string; reason?: string };
  takeover?: { reason?: string };
  action?: Record<string, unknown>;
  shots?: { id: string; n: number[] };
};

/** POST /api/chat and yield each SSE object. Does not log the body. */
export async function streamChat(body: Record<string, unknown>, token: string, onEvent: (ev: ChatEvent) => void): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      authorization: `Bearer ${token}`,
      "user-agent": agent,
      "x-lexari-client": "android",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text.slice(0, 180) || "Chat did not start");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let carry = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const split = takeSse(carry);
    carry = split.rest;
    for (const raw of split.events) {
      try { onEvent(JSON.parse(raw) as ChatEvent); } catch { /* ignore a partial frame */ }
    }
  }
}
