/**
 * Panta prediction markets (https://docs.panta.market). Every API route needs an X-Api-Key (pk_test_… or pk_live_…)
 * from a Panta account: set PANTA_API_KEY (and PANTA_API_URL if Panta gives you another base). Panta settles in
 * mainnet USDC on Solana, so on devnet Lexari takes REAL Panta quotes and records the position as a paper position
 * (no money moves). MAINNET: build the order with /primaryorderbuild/, sign with the agent's key, /primaryordersubmit/.
 */
export class PantaError extends Error {}
const base = () => (process.env.PANTA_API_URL || "https://live-api.panta.market/api/v1").replace(/\/$/, "");
export const pantaKey = () => (process.env.PANTA_API_KEY || "").trim();
export const pantaReady = () => /^pk_(test|live)_/.test(pantaKey());

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!pantaReady()) throw new PantaError("Panta isn't connected on this server yet: it needs a Panta API key (PANTA_API_KEY).");
  const r = await fetch(`${base()}${path}`, {
    method: init?.method || "GET",
    headers: { "X-Api-Key": pantaKey(), accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(12000),
  });
  const j = (await r.json().catch(() => null)) as (T & { message?: string; detail?: string }) | null;
  if (r.status === 401 || r.status === 403) throw new PantaError("Panta refused the API key.");
  if (!r.ok || !j) throw new PantaError(`Panta answered ${r.status}${j?.message || j?.detail ? `: ${String(j.message || j.detail).slice(0, 120)}` : ""}.`);
  return j;
}

export type PantaMarket = { id: string; title: string; category?: string; status?: string; yes: number; no: number; volume?: number; ends?: string };
type RawMarket = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(+v) ? +v : undefined);
function market(m: RawMarket): PantaMarket {
  const yes = num(m.yesPrice ?? m.yes_price ?? (m.prices as RawMarket | undefined)?.yes) ?? 0.5;
  const no = num(m.noPrice ?? m.no_price ?? (m.prices as RawMarket | undefined)?.no) ?? 1 - yes;
  return { id: String(m.id ?? m.marketId ?? ""), title: String(m.title ?? m.question ?? m.name ?? "Market"), category: m.category as string | undefined, status: m.status as string | undefined,
    yes, no, volume: num(m.volume ?? m.volumeUsdc), ends: (m.endDate ?? m.end_date ?? m.closesAt) as string | undefined };
}
const list = (j: unknown): RawMarket[] => (Array.isArray(j) ? j : ((j as { results?: RawMarket[]; data?: RawMarket[]; markets?: RawMarket[] })?.results || (j as { data?: RawMarket[] })?.data || (j as { markets?: RawMarket[] })?.markets || [])) as RawMarket[];

export async function pantaMarkets(opts: { category?: string; query?: string; limit?: number }) {
  const q = new URLSearchParams({ status: "open", limit: String(Math.min(20, opts.limit || 6)) });
  if (opts.category) q.set("category", opts.category);
  let items = list(await call(`/markets/?${q}`)).map(market);
  if (opts.query) { const w = opts.query.toLowerCase(); items = items.filter((m) => m.title.toLowerCase().includes(w)); }
  return items;
}
export async function pantaMarket(id: string) {
  if (!/^[\w-]{1,64}$/.test(id)) throw new PantaError("That isn't a Panta market id.");
  return market(await call<RawMarket>(`/markets/${id}/`));
}
export type PantaQuote = { quoteId: string; shares: number; avgPrice: number; feeUsdc: number };
export async function pantaQuote(wallet: string, marketId: string, side: "yes" | "no", amountUsdc: number): Promise<PantaQuote> {
  const j = await call<RawMarket>("/primaryorderquote/", { method: "POST", body: { wallet, marketId, side, amountUsdc } });
  return { quoteId: String(j.quoteId ?? j.id ?? ""), shares: num(j.shares) ?? 0, avgPrice: num(j.avgPrice ?? j.avg_price) ?? 0, feeUsdc: num(j.feeUsdc ?? j.fee) ?? 0 };
}
