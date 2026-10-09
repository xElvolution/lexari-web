"use client";

/** A failed API call, with the server's friendly message. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) { super(message); }
}

/**
 * Settings > Security step-up: a high-risk action answers 401 { stepup }. The confirm sheet (components/security/
 * StepUpSheet) registers here; api() opens it, and when you confirm (PIN or wallet) the same request runs once more.
 */
type StepUpHandler = (what: string) => Promise<boolean>;
let stepUpHandler: StepUpHandler | null = null;
export function setStepUpHandler(h: StepUpHandler | null) { stepUpHandler = h; }
/** Ask for a fresh confirm before something sensitive that happens in the browser (a wallet send). */
export async function confirmItsYou(what: string) { return stepUpHandler ? stepUpHandler(what) : true; }

/** JSON call to the app's own API. Throws ApiError with a message you can show. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method || (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, "Could not reach Lexari. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  const step = res.status === 401 ? (data as { stepup?: { what?: string } }).stepup : undefined;
  if (step && !retried && stepUpHandler) {
    if (await stepUpHandler(step.what || "continue")) return api<T>(path, init, true);
    throw new ApiError(401, "You didn't confirm, so nothing changed.", data);
  }
  if (!res.ok) throw new ApiError(res.status, typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Something went wrong. Try again.", data);
  return data as T;
}

/** Turns wallet and network errors into one short line. */
export function friendly(error: unknown, fallback = "Something went wrong.") {
  const m = (error as Error)?.message || fallback;
  if (/reject|denied|cancel|declined/i.test(m)) return "You cancelled it in your wallet.";
  if (/insufficient|0x1\b|no record of a prior credit/i.test(m)) return "Not enough devnet SOL for the fee. Get some from the faucet on the Wallets page.";
  if (/blockhash|expired/i.test(m)) return "It took too long. Try again.";
  if (/\b429\b|too many requests|rate.?limit/i.test(m)) return "Solana is busy right now. Wait a few seconds and try again.";
  if (/failed to fetch|network ?error|fetch failed|ECONNRESET|timed? ?out/i.test(m)) return "Couldn't reach Solana. Check your connection and try again.";
  if (/^\s*[{\[]|jsonrpc|custom program error/i.test(m)) return fallback;
  return m.split("\n")[0].slice(0, 160);
}
