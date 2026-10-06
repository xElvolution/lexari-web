"use client";

import { useCallback, useEffect, useState } from "react";
import { PLANS } from "@/content/appData";
import { TOPUP_PACKS } from "@/content/billing";
import { PREMIUM, turnCostUsd } from "@/content/models";
import { api, friendly } from "@/lib/api";
import { closeBillingSheet, payCrypto, startCard, startCrypto, usdcBalance, verifyPayment, useBilling, type CryptoRequest, type PayStep, type TopUpIntent } from "@/lib/billing";
import { balanceOf, isEmbedded, payer } from "@/lib/pay";
import { setPlan, toast } from "@/lib/store";
import type { PlanId } from "@/content/appData";
import { celebrate } from "../Celebrate";
import Icon from "../Icon";
import { CardGlyph, Sheet, Spinner, UsdcGlyph, dateShort } from "./parts";

type Rail = "card" | "crypto";
const SELLABLE = PLANS.filter((p) => p.usd > 0 && !p.later);
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const sonnetTurns = (usd: number) => Math.floor(usd / (turnCostUsd(PREMIUM[0].price) * 1.2));
/** SOL a USDC payment needs for fees and, the first time, the treasury's token account rent. */
const SOL_FOR_FEES = 3_000_000;

/** Top up: pay Lexari for a plan or extra credits, by card or with USDC on Solana. Separate from agent wallets. */
export default function TopUpSheet({ intent }: { intent: TopUpIntent }) {
  const { state } = useBilling();
  const [product, setProduct] = useState<"plan" | "credits">(intent.product);
  const firstPlan = SELLABLE.find((p) => p.id === intent.id)?.id ?? (state?.plan.id === "pro" ? "plus" : "pro");
  const [planId, setPlanId] = useState<string>(intent.product === "plan" ? firstPlan : "pro");
  const [pack, setPack] = useState<number>(intent.product === "credits" && intent.id ? Number(intent.id) : 10);
  const cardReady = !!state?.rails.card.ready;
  const [rail, setRail] = useState<Rail>("card");
  const [busy, setBusy] = useState(false);
  const usd = product === "plan" ? SELLABLE.find((p) => p.id === planId)!.usd : pack;
  const id = product === "plan" ? planId : String(pack);
  const plan = SELLABLE.find((p) => p.id === planId)!;
  const curPlan = state?.plan.id;
  const sameAsCurrent = product === "plan" && curPlan === planId;
  const smaller = product === "plan" && curPlan && curPlan !== "free" && (PLANS.find((p) => p.id === curPlan)?.seats ?? 0) > plan.seats;

  return (
    <Sheet label="topup" wide title="Top up" sub="Pay Lexari for a plan or extra credits. Your agents' wallets stay separate." icon={<Icon name="wallet" size={20} />} onClose={closeBillingSheet} closable={!busy}>
      <div className="inline-flex w-full rounded-full bg-tint p-1" role="radiogroup" aria-label="What to buy">
        {([["credits", "Extra credits"], ["plan", "Plan"]] as const).map(([k, l]) => (
          <button key={k} role="radio" aria-checked={product === k} disabled={busy} onClick={() => setProduct(k)} className={`h-9 flex-1 rounded-full text-[13.5px] font-bold transition ${product === k ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}>{l}</button>
        ))}
      </div>

      {product === "credits" ? (
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Credit pack">
          {TOPUP_PACKS.map((v) => (
            <button key={v} role="radio" aria-checked={pack === v} data-pack={v} disabled={busy} onClick={() => setPack(v)} className={`rounded-[18px] p-3 text-left transition max-[430px]:p-2.5 ${pack === v ? "bg-grape text-white ring-1 ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
              <span className="display block text-[28px] leading-none tabular-nums max-[430px]:text-[24px]">${v}</span>
              <span className={`mt-1.5 block text-[11.5px] leading-tight ${pack === v ? "text-white/80" : "text-ink/55"}`}>about {sonnetTurns(v).toLocaleString()} Sonnet replies</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Plan">
          {SELLABLE.map((p) => (
            <button key={p.id} role="radio" aria-checked={planId === p.id} data-buy-plan={p.id} disabled={busy} onClick={() => setPlanId(p.id)} className={`flex items-center gap-3 rounded-[18px] p-3 text-left transition ${planId === p.id ? "bg-grape text-white ring-1 ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
              <span className="min-w-0 flex-1"><span className="display block text-[22px] leading-none">{p.name}</span><span className={`mt-1 block text-[12.5px] leading-snug ${planId === p.id ? "text-white/80" : "text-ink/60"}`}>{p.for}</span></span>
              <span className="shrink-0 text-right"><span className="display block text-[24px] leading-none tabular-nums">${p.usd}</span><span className={`text-[11.5px] ${planId === p.id ? "text-white/75" : "text-ink/50"}`}>30 days</span></span>
            </button>
          ))}
          {state?.plan.endsAt && (sameAsCurrent || smaller) && (
            <p className="px-1 text-[12.5px] leading-snug text-ink/60">{sameAsCurrent ? `Renews ${plan.name} for 30 more days from ${dateShort(state.plan.endsAt)}. Nothing you have now is lost.` : `${plan.name} starts on ${dateShort(state.plan.endsAt)}, when your current plan ends.`}</p>
          )}
        </div>
      )}

      <h3 className="label mb-2 mt-5 text-[9.5px] text-ink/50">Pay with</h3>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
        {([["card", "Card", cardReady ? state?.rails.card.label || "Visa, Mastercard" : "Coming soon"], ["crypto", "USDC", state?.rails.crypto.cluster === "mainnet-beta" ? "On Solana" : "On Solana devnet"]] as const).map(([k, l, sub]) => (
          <button key={k} role="radio" aria-checked={rail === k} data-rail={k} disabled={busy} onClick={() => setRail(k)} className={`flex items-center gap-2.5 rounded-[18px] p-3 text-left transition ${rail === k ? "bg-ink text-[var(--bg)] ring-1 ring-ink" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${rail === k ? "bg-white/15" : "bg-tint"}`}>{k === "card" ? <CardGlyph size={19} /> : <UsdcGlyph size={22} />}</span>
            <span className="min-w-0"><span className="block text-[14.5px] font-bold">{l}</span><span className={`block truncate text-[11.5px] ${rail === k ? "opacity-70" : "text-ink/55"}`}>{sub}</span></span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {rail === "card"
          ? <CardPay ready={cardReady} usd={usd} intent={{ product, id }} onCrypto={() => setRail("crypto")} setBusy={setBusy} />
          : <CryptoPay key={`${product}-${id}`} usd={usd} intent={{ product, id }} title={product === "plan" ? `${plan.name} plan, 30 days` : `$${pack} of extra credits`} setBusy={setBusy} />}
      </div>
      <p className="mt-3 text-center text-[11.5px] leading-snug text-ink/45">Credits are spent on Lexari plans and AI usage only. They can&apos;t be withdrawn or sent.</p>
    </Sheet>
  );
}

function CardPay({ ready, usd, intent, onCrypto, setBusy }: { ready: boolean; usd: number; intent: Required<TopUpIntent>; onCrypto: () => void; setBusy: (b: boolean) => void }) {
  const [err, setErr] = useState("");
  const [going, setGoing] = useState(false);
  if (!ready) {
    return (
      <div data-card-soon className="rounded-[20px] bg-tint p-4 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-card text-brand-ink ring-1 ring-line"><CardGlyph size={22} /></span>
        <p className="mt-3 text-[15px] font-bold text-ink">Card payments are coming soon</p>
        <p className="mx-auto mt-1 max-w-[300px] text-[13px] leading-snug text-ink/60">We&apos;re finishing card checkout. You can pay with USDC on Solana today.</p>
        <button onClick={onCrypto} className="btn btn-brand btn-sm mt-4 w-full">Pay ${usd} with USDC</button>
      </div>
    );
  }
  const go = async () => {
    setErr(""); setGoing(true); setBusy(true);
    try { const c = await startCard(intent); window.location.assign(c.url); }
    catch (e) { setErr(friendly(e, "Couldn't open the card checkout.")); setGoing(false); setBusy(false); }
  };
  return (
    <div>
      <button data-card-pay onClick={go} disabled={going} className="btn btn-brand btn-sm w-full disabled:opacity-60">{going ? <><Spinner className="mr-2" />Opening secure checkout…</> : `Pay $${usd} by card`}</button>
      <p className="mt-2 text-center text-[11.5px] text-ink/50">You finish on the card provider&apos;s secure page, then come back here.</p>
      {err && <p role="alert" className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
    </div>
  );
}

type Phase = "loading" | "ready" | "nowallet" | "funding" | PayStep | "done";

function CryptoPay({ usd, intent, title, setBusy }: { usd: number; intent: Required<TopUpIntent>; title: string; setBusy: (b: boolean) => void }) {
  const { state } = useBilling();
  const rails = state?.rails.crypto;
  const need = Math.round(usd * 1e6);
  const [addr, setAddr] = useState("");
  const [usdc, setUsdc] = useState<number | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");
  const [req, setReq] = useState<CryptoRequest | null>(null);
  const [other, setOther] = useState(false);
  const [faucet, setFaucet] = useState<{ on: boolean; left: number } | null>(null);
  const devnet = rails?.cluster !== "mainnet-beta";

  const refresh = useCallback(async () => {
    if (!rails?.mint) return;
    const w = await payer();
    if (!w) { setPhase("nowallet"); return; }
    const a = w.publicKey.toBase58(); setAddr(a);
    const [u, s, f] = await Promise.all([usdcBalance(a, rails.mint), balanceOf(a).catch(() => null), api<{ on: boolean; left: number }>("/api/faucet").catch(() => null)]);
    setUsdc(u); setSol(s); setFaucet(f);
    setPhase((p) => (p === "loading" || p === "nowallet" ? "ready" : p));
  }, [rails?.mint]);
  useEffect(() => { if (rails?.ready) void refresh(); }, [rails?.ready, refresh]);

  const busy = phase === "funding" || phase === "signing" || phase === "sending" || phase === "confirming" || phase === "verifying";
  useEffect(() => { setBusy(busy); }, [busy, setBusy]);

  if (!rails?.ready) {
    return <div className="rounded-[20px] bg-tint p-4 text-center"><p className="text-[15px] font-bold text-ink">USDC payments are not set up here yet</p><p className="mt-1 text-[13px] text-ink/60">This server has no USDC treasury configured.</p></div>;
  }
  const shortUsdc = usdc !== null && usdc < need;
  const shortSol = sol !== null && sol < SOL_FOR_FEES;

  const request = async () => { if (req && req.expiresAt > Date.now() + 60_000) return req; const r = await startCrypto(intent); setReq(r); return r; };
  const done = (s: { plan: { id: string; seats: number; endsAt: number | null; name: string } }, tx: string) => {
    setPhase("done");
    if (intent.product === "plan") {
      setPlan(s.plan.id as PlanId, s.plan.seats, s.plan.endsAt);
      const name = PLANS.find((p) => p.id === intent.id)?.name ?? "your plan";
      setTimeout(() => { closeBillingSheet(); celebrate({ confetti: "big", title: s.plan.id === intent.id ? `You're on ${name}` : `${name} is booked`, body: s.plan.id === intent.id ? `Lamina all month, $${PLANS.find((p) => p.id === intent.id)?.premiumUsd ?? 0} of premium models and ${s.plan.seats} seats, starting now.` : "It starts when your current plan ends. Nothing you have now is lost.", tx }); }, 700);
    } else {
      setTimeout(() => { closeBillingSheet(); celebrate({ confetti: true, title: `$${usd} of credits added`, body: "They kick in after your included usage, within your spend limit.", tx }); }, 700);
    }
  };
  const pay = async () => {
    setErr("");
    try {
      const r = await request();
      let paid = "";
      const out = await payCrypto(r, (st, s) => { setPhase(st); if (s) { paid = s; setSig(s); } });
      done(out.state, paid);
    } catch (e) {
      setErr(friendly(e, "The payment didn't go through."));
      setPhase("ready");
      void refresh();
    }
  };
  const checkOther = async () => {
    if (!req) return;
    setErr(""); setPhase("verifying");
    try { const out = await verifyPayment(req.id, undefined, 2); done(out.state, out.state.payments[0]?.txSig || ""); }
    catch (e) { setErr(friendly(e, "We haven't seen that payment yet.")); setPhase("ready"); }
  };
  const fund = async () => {
    setErr(""); setPhase("funding");
    try {
      await api("/api/faucet", { body: { need: Math.max(0, SOL_FOR_FEES - (sol ?? 0)) } });
      for (let i = 0; i < 8; i++) { const b = await balanceOf(addr).catch(() => null); if (b !== null && b >= SOL_FOR_FEES) break; await new Promise((x) => setTimeout(x, 1200)); }
      await refresh();
      toast({ text: "Devnet SOL for fees added" });
    } catch (e) { setErr(friendly(e, "Couldn't get devnet SOL.")); }
    setPhase("ready");
  };
  const openOther = async () => {
    setOther((v) => !v);
    if (!req) { try { await request(); } catch (e) { setErr(friendly(e, "Couldn't start the payment.")); } }
  };
  const copy = (t: string, what: string) => { void navigator.clipboard?.writeText(t).then(() => toast({ text: `${what} copied` }), () => {}); };

  return (
    <div data-crypto-pay>
      <dl className="divide-y divide-[var(--line)] rounded-2xl bg-tint px-4 text-[14px] max-[430px]:text-[13px]">
        <div className="flex items-center justify-between py-2.5"><dt className="text-ink/65">Amount</dt><dd className="font-bold text-ink">{usd} USDC</dd></div>
        <div className="flex items-center justify-between py-2.5"><dt className="text-ink/65">For</dt><dd className="truncate pl-3 font-semibold text-ink">{title}</dd></div>
        <div className="flex items-center justify-between py-2.5"><dt className="text-ink/65">Network</dt><dd className="font-semibold text-ink">{devnet ? "Solana devnet" : "Solana"}</dd></div>
        <div className="flex items-center justify-between gap-2 py-2.5"><dt className="text-ink/65">From</dt><dd className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink">{addr ? <button onClick={() => copy(addr, "Address")} className="flex items-center gap-1 text-brand-ink">{isEmbedded() ? "Lexari wallet " : ""}{short(addr)}<Icon name="copy" size={12} /></button> : phase === "nowallet" ? "No wallet" : "…"}</dd></div>
        <div className="flex items-center justify-between py-2.5"><dt className="text-ink/65">Your USDC</dt><dd data-usdc-balance className={`font-bold tabular-nums ${shortUsdc ? "text-[#e5484d]" : "text-ink"}`}>{usdc === null ? (phase === "loading" ? "Checking…" : "Unavailable") : (usdc / 1e6).toFixed(2)}</dd></div>
      </dl>

      {phase === "nowallet" && <p role="alert" className="mt-3 rounded-2xl bg-[#e5484d]/10 p-3 text-[13px] leading-snug text-ink">Your wallet is still loading. Wait a moment, or pay from another wallet below.</p>}
      {shortUsdc && phase !== "done" && (
        <div data-need-usdc className="mt-3 rounded-2xl bg-grape/10 p-3.5 ring-1 ring-grape/30">
          <p className="text-[14px] font-bold text-ink">You need {usd} USDC{usdc ? `, you have ${(usdc / 1e6).toFixed(2)}` : ""}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink/65">{devnet ? <>Get free devnet USDC at <a className="font-bold text-brand-ink underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a> for the address above (choose Solana Devnet), or pay from another wallet.</> : "Add USDC on Solana to the address above, or pay from another wallet."}</p>
        </div>
      )}
      {!shortUsdc && shortSol && phase !== "done" && (
        <div className="mt-3 rounded-2xl bg-grape/10 p-3.5 ring-1 ring-grape/30">
          <p className="text-[14px] font-bold text-ink">A little SOL is needed for the network fee</p>
          {devnet && faucet?.on && faucet.left > 0 ? <button onClick={fund} disabled={busy} className="btn btn-ghost btn-sm mt-2.5 w-full !h-10">{phase === "funding" ? "Sending devnet SOL…" : "Get devnet SOL"}</button>
            : <p className="mt-0.5 text-[12.5px] text-ink/65">Add about 0.003 SOL to the address above.</p>}
        </div>
      )}

      {(phase === "signing" || phase === "sending" || phase === "confirming" || phase === "verifying" || phase === "done") && <Steps phase={phase} />}
      {err && <p role="alert" data-pay-error className="mt-3 text-[13px] leading-snug text-[#e5484d]">{err}</p>}

      {phase === "done" ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-grape px-4 py-3 text-[14.5px] font-bold text-white"><Icon name="check" size={18} />Paid{sig ? ` · ${short(sig)}` : ""}</div>
      ) : (
        <button data-usdc-pay onClick={pay} disabled={busy || phase === "loading" || phase === "nowallet" || shortUsdc || shortSol} className="btn btn-brand btn-sm mt-4 w-full disabled:opacity-50 disabled:shadow-none">
          {phase === "signing" ? "Waiting for signature…" : phase === "sending" ? "Sending…" : phase === "confirming" ? "Confirming on Solana…" : phase === "verifying" ? "Checking the payment…" : `Pay ${usd} USDC`}
        </button>
      )}

      {phase !== "done" && (
        <div className="mt-3">
          <button onClick={openOther} aria-expanded={other} className="flex w-full items-center justify-center gap-1.5 text-[12.5px] font-bold text-ink/60 hover:text-ink">Pay from another wallet<Icon name="right" size={12} className={`transition ${other ? "-rotate-90" : "rotate-90"}`} /></button>
          {other && (
            <div className="mt-2 rounded-2xl bg-tint p-3.5 text-[12.5px] leading-snug text-ink/70">
              {!req ? <div className="flex items-center gap-2"><Spinner />Preparing a payment link…</div> : (
                <>
                  <p>Send exactly <b className="text-ink">{usd} USDC</b> with Phantom, Solflare or Backpack using this Solana Pay link. It carries a reference so we can find it.</p>
                  <div className="mt-2.5 flex gap-2">
                    <a href={req.url} className="btn btn-ink btn-sm !h-10 flex-1">Open in wallet</a>
                    <button onClick={() => copy(req.url, "Payment link")} className="btn btn-ghost btn-sm !h-10 flex-1"><Icon name="copy" size={14} />Copy link</button>
                  </div>
                  <button onClick={checkOther} disabled={busy} className="mt-2 w-full text-center text-[13px] font-bold text-brand-ink hover:underline disabled:opacity-50">I&apos;ve paid, check it</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Steps({ phase }: { phase: Phase }) {
  const order: Phase[] = ["signing", "sending", "confirming", "verifying", "done"];
  const at = order.indexOf(phase);
  const labels = ["Sign in your wallet", "Send to Solana", "Confirm on Solana", "Check the payment", "Done"];
  return (
    <ol data-pay-steps className="mt-4 space-y-2 rounded-2xl bg-tint p-3.5" aria-live="polite">
      {labels.map((t, i) => (
        <li key={t} className={`flex items-center gap-2.5 text-[13.5px] font-semibold ${i <= at ? "text-ink" : "text-ink/40"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${i < at || phase === "done" ? "bg-grape text-white" : i === at ? "bg-card ring-2 ring-grape" : "bg-card ring-1 ring-line"}`}>
            {i < at || phase === "done" ? <Icon name="check" size={12} stroke={3} /> : i === at ? <i className="h-3 w-3 animate-spin rounded-full border-2 border-grape border-t-transparent" /> : null}
          </span>{t}
        </li>
      ))}
    </ol>
  );
}
