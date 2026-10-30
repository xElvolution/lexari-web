import { env } from "./env";
import { takeSse } from "./sse";

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * Settings > Security step-up, as on the web: a high-risk action answers 401 { stepup }. The confirm sheet
 * (components/StepUpSheet) registers here; api() opens it, and once you confirm (PIN or wallet) the same request runs once more.
 */
type StepUpHandler = (what: string) => Promise<boolean>;
let stepUpHandler: StepUpHandler | null = null;
export function setStepUpHandler(h: StepUpHandler | null) { stepUpHandler = h; }

let agent = "LexariAndroid/1.0.0 (Android)";
export function setUserAgent(value: string) {
  agent = value;
}

export async function api<T>(path: string, init: RequestInit = {}, token?: string | null, retried = false): Promise<T> {
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
  const step = res.status === 401 && data && typeof data === "object" ? (data as { stepup?: { what?: string } }).stepup : undefined;
  if (step && !retried && stepUpHandler) {
    if (await stepUpHandler(step.what || "continue")) return api<T>(path, init, token, true);
    throw new ApiError(401, "You didn't confirm, so nothing changed.", data);
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
      ? (data as { error: string }).error
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
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
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    const error = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "";
    throw new ApiError(res.status, error.slice(0, 180) || "Chat did not start", data);
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
