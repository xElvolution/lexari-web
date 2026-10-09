"use client";

/**
 * Top up with any coin (content/topup.ts): the coin picker (search, then the network), Solana coin payments from the
 * Lexari wallet, and deposit addresses for every other chain with live confirmation status.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAINS, COINS, coinById, coinDigits, payKind, railById, railId, railsFor, type CoinId, type Rail } from "@/content/topup";
import { friendly } from "@/lib/api";
import { closeBillingSheet, type PayStep } from "@/lib/billing";
import { payer } from "@/lib/pay";
import { depositAddress, payToken, solanaHolding, startToken, testTokens, topupInChat, type DepositView, type TokenRequest } from "@/lib/topup";
import { toast } from "@/lib/store";
import { celebrate } from "../Celebrate";
import Icon from "../Icon";
import { Spinner, UsdcGlyph } from "./parts";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;
const fmt = (n: number, r: Pick<Rail, "decimals" | "coin">) => (+n.toFixed(coinDigits(r))).toLocaleString("en-US", { maximumFractionDigits: coinDigits(r) });
const copy = (t: string, what: string) => { void navigator.clipboard?.writeText(t).then(() => toast({ text: `${what} copied` }), () => {}); };

/** A coin's round mark. */
export function CoinGlyph({ coin, size = 32 }: { coin: CoinId; size?: number }) {
  if (coin === "USDC") return <UsdcGlyph size={size} />;
  const c = coinById(coin)!;
  const t = c.symbol.replace(/USD$/i, "$").slice(0, coin === "PATHUSD" || coin === "ALPHAUSD" ? 2 : 4);
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, background: c.color, fontSize: size * (t.length > 3 ? 0.27 : t.length > 2 ? 0.31 : 0.38), letterSpacing: "-0.02em" }}>{t}</span>
  );
}

/** Coin, then network. Search covers names, symbols and chains. */
export function CoinPicker({ value, onPick, onBack }: { value: string; onPick: (railKey: string) => void; onBack: () => void }) {
  const [q, setQ] = useState("");
  const [coin, setCoin] = useState<CoinId | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return COINS.filter((c) => !s || `${c.symbol} ${c.name} ${c.tags} ${railsFor(c.id).map((r) => CHAINS[r.chain].name).join(" ")}`.toLowerCase().includes(s));
  }, [q]);
  const pickCoin = (id: CoinId) => {
    const rails = railsFor(id);
    const open = rails.filter((r) => r.live && CHAINS[r.chain].live);
    if (rails.length === 1 && open.length === 1) { onPick(railId(open[0])); return; }
    setCoin(id);
  };
  if (coin) {
    const c = coinById(coin)!;
    return (
      <div data-chain-picker>
        <button onClick={() => setCoin(null)} className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-ink/60 hover:text-ink"><Icon name="back" size={15} />All coins</button>
        <div className="mb-3 flex items-center gap-2.5"><CoinGlyph coin={coin} size={34} /><div><div className="text-[15px] font-bold text-ink">{c.symbol}</div><div className="text-[12px] text-ink/55">Choose the network you&apos;ll send on</div></div></div>
        <div className="space-y-2">
          {railsFor(coin).map((r) => {
            const ch = CHAINS[r.chain];
            const open = r.live && ch.live;
            const on = railId(r) === value;
            return (
              <button key={railId(r)} data-rail-opt={railId(r)} disabled={!open} onClick={() => onPick(railId(r))} className={`flex w-full items-center gap-3 rounded-[16px] p-3 text-left transition ${on ? "bg-grape/10 ring-2 ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"} disabled:opacity-50`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint text-[11px] font-extrabold text-ink/70">{ch.name.slice(0, 3).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{ch.name}</span>
                  <span className="block truncate text-[11.5px] text-ink/55">{open ? `${ch.network}${r.test && r.chain === "solana" ? " · Lexari test token" : ""}` : r.why || ch.why}</span>
                </span>
                {open ? <span className="shrink-0 text-[11px] font-semibold text-ink/45">{ch.eta}</span> : <span className="shrink-0 rounded-full bg-tint px-2 py-0.5 text-[10.5px] font-bold text-ink/55">Mainnet</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div data-coin-picker>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint text-ink/70"><Icon name="back" size={16} /></button>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-tint px-3.5 ring-1 ring-line focus-within:ring-grape">
          <Icon name="search" size={15} className="text-ink/45" />
          <input data-coin-search autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coins or networks" className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/40" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {list.map((c) => {
          const rails = railsFor(c.id);
          const open = rails.filter((r) => r.live && CHAINS[r.chain].live);
          const sel = railById(value)?.coin === c.id;
          return (
            <button key={c.id} data-coin={c.id} disabled={!open.length} onClick={() => pickCoin(c.id)} className={`flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition ${sel ? "bg-grape/10 ring-1 ring-grape" : "hover:bg-tint"} disabled:opacity-50`}>
              <CoinGlyph coin={c.id} size={34} />
              <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-bold text-ink">{c.symbol}</span><span className="block truncate text-[12px] text-ink/55">{c.name}</span></span>
              <span className="max-w-[46%] truncate text-right text-[11.5px] text-ink/50">{open.length ? (rails.length > 1 ? `${open.length} network${open.length > 1 ? "s" : ""}` : CHAINS[open[0].chain].name) : "With mainnet"}</span>
              <Icon name="right" size={13} className="shrink-0 text-ink/35" />
            </button>
          );
        })}
        {!list.length && <p className="py-6 text-center text-[13px] text-ink/50">No coin matches “{q}”.</p>}
      </div>
    </div>
  );
}

/** The chosen coin, as the Pay with tile shows it. */
export function CoinTileLabel({ railKey }: { railKey: string }) {
  const r = railById(railKey)!;
  const c = coinById(r.coin)!;
  return <><span className="block text-[14.5px] font-bold">{c.symbol}</span><span className="block text-[11.5px] leading-tight opacity-70">{CHAINS[r.chain].name}{r.chain === "solana" ? " devnet" : " testnet"}</span></>;
}

function Steps({ phase }: { phase: string }) {
  const order = ["signing", "sending", "confirming", "verifying", "done"];
  const at = order.indexOf(phase);
  const labels = ["Sign in your wallet", "Send to Solana", "Confirm on Solana", "Check the payment", "Done"];
  return (
    <ol className="mt-3 space-y-1.5 rounded-2xl bg-tint p-3" aria-live="polite">
      {labels.map((t, i) => (
        <li key={t} className={`flex items-center gap-2.5 text-[13px] font-semibold ${i <= at ? "text-ink" : "text-ink/40"}`}>
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${i < at || phase === "done" ? "bg-grape text-white" : i === at ? "bg-card ring-2 ring-grape" : "bg-card ring-1 ring-line"}`}>
            {i < at || phase === "done" ? <Icon name="check" size={11} stroke={3} /> : i === at ? <i className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-grape border-t-transparent" /> : null}
          </span>{t}
        </li>
      ))}
    </ol>
  );
}

/** A Solana coin other than USDC (SOL, test SKR, ORE, ...), priced live and paid from the Lexari wallet. */
export function TokenPay({ usd, railKey, setBusy, after }: { usd: number; railKey: string; setBusy: (b: boolean) => void; after?: () => void }) {
  const r = railById(railKey)!;
  const c = coinById(r.coin)!;
  const [req, setReq] = useState<TokenRequest | null>(null);
  const [have, setHave] = useState<number | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "drip" | PayStep | "done">("loading");
  const [err, setErr] = useState("");
  const [other, setOther] = useState(false);
  const load = useCallback(async () => {
    setErr("");
    try {
      const [q, w] = await Promise.all([startToken(usd, railKey), payer()]);
      setReq(q);
      if (w) {
        const a = w.publicKey.toBase58();
        const [h, s] = await Promise.all([solanaHolding(a, q.mint || null), solanaHolding(a, null)]);
        setHave(h); setSol(s);
      }
      setPhase("ready");
    } catch (e) { setErr(friendly(e, "Couldn't price that coin right now.")); setPhase("ready"); }
  }, [usd, railKey]);
  useEffect(() => { setPhase("loading"); setReq(null); void load(); }, [load]);
  const busy = ["drip", "signing", "sending", "confirming", "verifying"].includes(phase);
  useEffect(() => { setBusy(busy); }, [busy, setBusy]);
  const amount = req ? req.amountMinor / 10 ** req.decimals : 0;
  const fee = r.coin === "SOL" ? 10_000 : 3_000_000;
  const short = have !== null && req ? have < req.amountMinor + (r.coin === "SOL" ? fee : 0) : false;
  const noSol = r.coin !== "SOL" && sol !== null && sol < fee;
  const pay = async () => {
    if (!req) return;
    setErr("");
    try {
      const fresh = req.expiresAt > Date.now() + 60_000 ? req : await startToken(usd, railKey);
      setReq(fresh);
      let sig = "";
      await payToken(fresh, (st, s) => { setPhase(st); if (s) sig = s; });
      setPhase("done");
      void topupInChat({ paymentId: fresh.id });
      setTimeout(() => { closeBillingSheet(); if (after) { toast({ text: `$${usd} added to your balance` }); after(); } else celebrate({ confetti: true, title: `$${usd} added to your balance`, body: `Paid with ${fmt(amount, r)} ${r.test ? "test " : ""}${c.symbol}.`, tx: sig }); }, 600);
    } catch (e) { setErr(friendly(e, "The payment didn't go through.")); setPhase("ready"); void load(); }
  };
  const drip = async () => {
    setErr(""); setPhase("drip");
    try { const d = await testTokens(railKey); toast({ text: `${fmt(d.amount, r)} test ${c.symbol} added to your wallet` }); await load(); }
    catch (e) { setErr(friendly(e, "Couldn't get test tokens.")); setPhase("ready"); }
  };
  return (
    <div data-token-pay={railKey}>
      <dl className="divide-y divide-[var(--line)] rounded-2xl bg-tint px-4 text-[13.5px]">
        <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-ink/65">You pay</dt><dd data-token-amount className="font-bold tabular-nums text-ink">{req ? `${fmt(amount, r)} ${c.symbol}` : phase === "loading" ? "Pricing…" : "—"}</dd></div>
        <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-ink/65">Price</dt><dd className="text-right text-ink">{req ? `1 ${c.symbol} = $${req.price.toLocaleString("en-US", { maximumFractionDigits: req.price < 1 ? 6 : 2 })}` : "…"}<span className="block text-[11px] text-ink/45">Live, locked for 30 min</span></dd></div>
        <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-ink/65">Network</dt><dd className="font-semibold text-ink">Solana devnet</dd></div>
        <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-ink/65">Your {c.symbol}</dt><dd className={`font-bold tabular-nums ${short ? "text-[#e5484d]" : "text-ink"}`}>{have === null ? "…" : fmt(have / 10 ** r.decimals, r)}</dd></div>
      </dl>
      {r.test && <p className="mt-2 text-[11.5px] leading-snug text-ink/50">Devnet uses a Lexari test {c.symbol} token, valued at the real {c.symbol} price.</p>}
      {short && phase !== "done" && (
        <div className="mt-3 rounded-2xl bg-grape/10 p-3 ring-1 ring-grape/30">
          <p className="text-[13.5px] font-bold text-ink">Not enough {r.test ? "test " : ""}{c.symbol} in your wallet</p>
          {r.test ? <button data-drip onClick={drip} disabled={busy} className="btn btn-ghost btn-sm mt-2 w-full !h-10">{phase === "drip" ? <><Spinner className="mr-2" />Minting test {c.symbol}…</> : `Get test ${c.symbol}`}</button>
            : <p className="mt-0.5 text-[12.5px] text-ink/65">{r.coin === "SOL" ? "Get devnet SOL at faucet.solana.com, or pay from another wallet." : "Add some to your Lexari wallet, or pay from another wallet."}</p>}
        </div>
      )}
      {!short && noSol && <p className="mt-3 rounded-2xl bg-grape/10 p-3 text-[12.5px] text-ink/70 ring-1 ring-grape/30">A little SOL (about 0.003) is needed for the network fee.</p>}
      {(["signing", "sending", "confirming", "verifying", "done"] as string[]).includes(phase) && <Steps phase={phase} />}
      {err && <p role="alert" className="mt-3 text-[13px] leading-snug text-[#e5484d]">{err}</p>}
      {phase === "done"
        ? <div className="mt-4 flex items-center gap-2 rounded-2xl bg-grape px-4 py-3 text-[14.5px] font-bold text-white"><Icon name="check" size={18} />Paid</div>
        : <button data-token-paybtn onClick={pay} disabled={!req || busy || short || noSol} className="btn btn-brand btn-sm mt-4 w-full disabled:opacity-50 disabled:shadow-none">{phase === "signing" ? "Waiting for signature…" : phase === "sending" ? "Sending…" : phase === "confirming" ? "Confirming on Solana…" : phase === "verifying" ? "Checking the payment…" : req ? `Pay ${fmt(amount, r)} ${c.symbol}` : "Pricing…"}</button>}
      {req && phase !== "done" && (
        <div className="mt-3">
          <button onClick={() => setOther((v) => !v)} aria-expanded={other} className="flex w-full items-center justify-center gap-1.5 text-[12.5px] font-bold text-ink/60 hover:text-ink">Pay from another wallet<Icon name="right" size={12} className={`transition ${other ? "-rotate-90" : "rotate-90"}`} /></button>
          {other && (
            <div className="mt-2 rounded-2xl bg-tint p-3 text-[12.5px] leading-snug text-ink/70">
              <p>Send exactly <b className="text-ink">{fmt(amount, r)} {c.symbol}</b> on <b className="text-ink">Solana devnet</b> with this Solana Pay link. It carries a reference so we can find it.</p>
              <div className="mt-2 flex gap-2"><a href={req.url} className="btn btn-ink btn-sm !h-10 flex-1">Open in wallet</a><button onClick={() => copy(req.url, "Payment link")} className="btn btn-ghost btn-sm !h-10 flex-1"><Icon name="copy" size={14} />Copy</button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Any other chain: your deposit address (XRP: address + tag), what to send, and live status until it's credited. */
export function DepositPay({ usd, railKey }: { usd: number; railKey: string }) {
  const r = railById(railKey)!;
  const c = coinById(r.coin)!;
  const ch = CHAINS[r.chain];
  const [v, setV] = useState<DepositView | null>(null);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);
  const [added, setAdded] = useState<{ usd: number; amount: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useCallback(async (first = false) => {
    try {
      const d = await depositAddress(railKey, !first);
      setV(d); setErr("");
      if (d.credited) { setAdded(d.credited); void topupInChat({ creditId: d.credited.id }); celebrate({ confetti: true, title: `$${d.credited.usd.toFixed(2)} added to your balance`, body: `${fmt(d.credited.amount, r)} ${c.symbol} arrived on ${ch.network}.` }); }
    } catch (e) { setErr(friendly(e, "Couldn't reach that network right now. We'll keep trying.")); }
  }, [railKey, r, c.symbol, ch.network]);
  useEffect(() => {
    let live = true;
    setV(null); setAdded(null);
    const loop = async (first: boolean) => { await tick(first); if (live) timer.current = setTimeout(() => void loop(false), r.chain === "bitcoin" || r.chain === "litecoin" ? 20_000 : 8_000); };
    void loop(true);
    return () => { live = false; if (timer.current) clearTimeout(timer.current); };
  }, [tick, r.chain]);
  const check = async () => { setChecking(true); await tick(false); setChecking(false); };
  const est = v?.price ? usd / v.price : null;
  return (
    <div data-deposit-pay={railKey}>
      <div data-network-warn className="flex gap-2.5 rounded-2xl bg-[#fff4d6] p-3 text-[12.5px] leading-snug text-[#5c4300] ring-1 ring-[#f5d27a]">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        <span>Send only <b>{c.symbol}</b> on <b>{ch.network}</b>.{r.tag ? <> Include the <b>destination tag</b> or it can&apos;t be credited.</> : " Anything sent on another network is lost."}</span>
      </div>
      <div className="mt-3 rounded-2xl bg-tint p-3.5">
        <div className="flex items-center justify-between"><span className="label text-[9.5px] text-ink/50">{r.tag ? "Lexari XRP address" : `Your ${ch.name} deposit address`}</span>{v && <a href={v.explorer} target="_blank" rel="noreferrer" className="text-[11.5px] font-bold text-brand-ink">Explorer</a>}</div>
        {v ? (
          <button data-deposit-address onClick={() => copy(v.address, "Address")} className="mt-1.5 flex w-full items-center gap-2 text-left">
            <span className="min-w-0 flex-1 break-all font-mono text-[13px] font-semibold leading-snug text-ink">{v.address}</span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-brand-ink ring-1 ring-line"><Icon name="copy" size={15} /></span>
          </button>
        ) : <div className="mt-2 flex items-center gap-2 text-[13px] text-ink/55"><Spinner />Getting your address…</div>}
        {v?.tag !== undefined && (
          <button data-deposit-tag onClick={() => copy(String(v.tag), "Destination tag")} className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-card p-2.5 text-left ring-1 ring-grape/40">
            <span className="min-w-0 flex-1"><span className="block text-[10.5px] font-bold uppercase tracking-wide text-ink/50">Destination tag (required)</span><span className="block font-mono text-[16px] font-bold text-ink">{v.tag}</span></span>
            <Icon name="copy" size={15} className="text-brand-ink" />
          </button>
        )}
      </div>
      <dl className="mt-3 divide-y divide-[var(--line)] rounded-2xl bg-tint px-3.5 text-[13px]">
        <div className="flex items-center justify-between gap-3 py-2"><dt className="text-ink/60">For ${usd}</dt><dd className="font-bold tabular-nums text-ink">{est ? `≈ ${fmt(est, r)} ${c.symbol}` : "…"}</dd></div>
        <div className="flex items-center justify-between gap-3 py-2"><dt className="text-ink/60">Minimum</dt><dd className="tabular-nums text-ink">{fmt(r.min, r)} {c.symbol}</dd></div>
        <div className="flex items-center justify-between gap-3 py-2"><dt className="text-ink/60">Credited after</dt><dd className="text-ink">{ch.family === "tron" ? "it's irreversible" : ch.family === "xrpl" ? "a validated ledger" : `${ch.confirmations} confirmation${ch.confirmations > 1 ? "s" : ""}`} · {ch.eta}</dd></div>
      </dl>
      <p className="mt-2 text-[11.5px] leading-snug text-ink/50">Send any amount. It&apos;s added in dollars at the live price when it confirms.{r.token ? ` Token contract ${short(r.token)}.` : ""}</p>
      <div data-deposit-status className={`mt-3 flex items-center gap-2.5 rounded-2xl p-3 text-[13px] font-semibold ${added ? "bg-grape text-white" : "bg-card text-ink ring-1 ring-line"}`} aria-live="polite">
        {added ? <><Icon name="check" size={17} />${added.usd.toFixed(2)} added to your balance</>
          : v?.status === "incoming" ? <><Spinner />{v.incoming ? `${fmt(v.incoming, r)} ${c.symbol} on its way, confirming…` : "Arrived, confirming…"}</>
          : v?.status === "below" ? <><Icon name="info" size={16} />{fmt(v.waitingUi, r)} {c.symbol} arrived. Send at least {fmt(r.min, r)} in total.</>
          : v?.status === "capped" ? <><Icon name="info" size={16} />Arrived. Testnet top ups are capped at $50 a day; it&apos;s added tomorrow.</>
          : <><i className="h-2 w-2 animate-pulse rounded-full bg-grape" />Waiting for your deposit…</>}
      </div>
      {err && <p role="alert" className="mt-2 text-[12.5px] text-[#e5484d]">{err}</p>}
      {!added && <button data-deposit-check onClick={check} disabled={checking || !v} className="btn btn-ghost btn-sm mt-3 w-full !h-10">{checking ? <><Spinner className="mr-2" />Checking {ch.name}…</> : "I've sent it, check now"}</button>}
    </div>
  );
}

export const isWalletRail = (k: string) => { const r = railById(k); return !!r && payKind(r) === "wallet"; };
