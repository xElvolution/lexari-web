"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api, friendly } from "@/lib/api";
import { get, hire, refreshHub } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { burst } from "../fly";

type Phase = "closed" | "opening" | "open" | "claiming" | "claimed" | "plan";

/** The honest lines shown on the gift. The ORE bot never earns anything on devnet and never mines on Lexari's machines. */
export const ORE_GIFT_FACTS: { icon: "spark" | "server" | "undo"; title: string; body: string }[] = [
  { icon: "spark", title: "Practice mode", body: "Real hashing with real hashrate, but no ORE rewards yet." },
  { icon: "server", title: "Runs on a computer you connect", body: "A one-line install on a machine you own. Nothing mines on Lexari's servers." },
  { icon: "undo", title: "Free, and yours to remove", body: "It takes no seat. Release it or uninstall the miner anytime." },
];

/**
 * Right after your first agent: a wrapped gift opens to reveal the ORE bot (the ORE Miner specialist, free to hire).
 * One tap claims it: the same free hire the marketplace does (free with any paid plan, no seat). On the free plan the
 * gift says so up front and the button opens Plans instead of failing. Skipping is fine; it stays in the marketplace.
 */
export default function OreGift({ agentName, onDone }: { agentName: string; onDone: (claimed: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [err, setErr] = useState("");
  const cta = useRef<HTMLButtonElement>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [needsPlan, setNeedsPlan] = useState(() => get().plan === "free" && !get().paid.includes("ore"));

  // The box wobbles in on its own, then opens after a beat (a tap opens it sooner).
  useEffect(() => {
    if (phase !== "closed") return;
    const t = setTimeout(() => setPhase("opening"), reduced ? 0 : 1400);
    return () => clearTimeout(t);
  }, [phase, reduced]);
  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("open"), reduced ? 0 : 750);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const claim = async () => {
    if (phase === "claiming") return;
    setErr(""); setPhase("claiming");
    try {
      const s = get();
      if (!s.hired.includes("ore")) {
        // Free specialist: no seat and no charge. One you released before comes back with PUT.
        if (s.paid.includes("ore")) await api("/api/hires", { method: "PUT", body: { slug: "ore" } });
        else await api("/api/hires", { body: { slug: "ore", pay: "balance" } });
        hire("ore");
        void refreshHub();
      }
      burst(cta.current, 26);
      setPhase("claimed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 402 && (e.data as { reason?: string } | undefined)?.reason === "plan_required") { setNeedsPlan(true); setPhase("open"); return; }
      setErr(friendly(e, "Couldn't add the ORE bot. Try again."));
      setPhase("open");
    }
  };

  const opened = phase === "open" || phase === "claiming" || phase === "claimed";
  return (
    <div data-ore-gift={phase} className="relative mx-auto flex w-full max-w-[460px] flex-col items-center text-center">
      <p className="label text-brand-ink">{phase === "claimed" ? "Added to your team" : `A gift for ${agentName}`}</p>
      <h1 className="display mt-3 text-[clamp(30px,8vw,46px)] leading-[1.02]">{phase === "claimed" ? "The ORE bot is in." : opened ? "Meet the ORE bot." : "One more thing…"}</h1>

      <div className="relative mt-6 grid h-[250px] w-full place-items-center">
        {opened && <span aria-hidden className="gift-rays" />}
        {!opened && (
          <button type="button" aria-label="Open the gift" onClick={() => setPhase("opening")} className={`relative ${phase === "opening" ? "box-shake" : "box-bounce"}`}>
            <span aria-hidden className="gift-ping absolute inset-6 rounded-[28px] bg-grape/30" />
            <GiftBox lidOff={phase === "opening"} />
          </button>
        )}
        {opened && (
          <div data-ore-card className="gift-card relative w-[min(300px,100%)] overflow-hidden rounded-[26px] bg-card p-5 ring-1 ring-line shadow-[0_24px_60px_-24px_rgba(91,43,255,.55)]">
            <div aria-hidden className="card-sheen pointer-events-none absolute inset-0" />
            <div className="relative flex items-center gap-3.5 text-left">
              <AgentTile id="ore" look={null} size={76} radius={24} status={false} />
              <div className="min-w-0">
                <p className="text-[20px] font-bold leading-tight text-ink">ORE bot</p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-ink/65">A bot that does the mining</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10.5px] font-bold text-[#8a5a00]"><i className="h-1.5 w-1.5 rounded-full bg-[#f5a524]" />Practice mode</span>
              </div>
            </div>
            {phase === "claimed" && <span className="pop absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#22c55e] text-white"><Icon name="check" size={16} stroke={3} /></span>}
          </div>
        )}
      </div>

      <ul className={`mt-2 grid w-full gap-2 text-left transition-all duration-500 ${opened ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
        {ORE_GIFT_FACTS.map((f, i) => (
          <li key={f.title} className="flex items-start gap-3 rounded-2xl bg-card px-3.5 py-3 ring-1 ring-line" style={{ transitionDelay: `${300 + i * 90}ms` }}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name={f.icon} size={15} /></span>
            <span className="min-w-0"><span className="block text-[14px] font-bold text-ink">{f.title}</span><span className="block text-[12.5px] leading-snug text-ink/60">{f.body}</span></span>
          </li>
        ))}
      </ul>

      {err && <p role="alert" className="mt-3 text-[13px] font-semibold text-[#e5484d]">{err}</p>}
      <div className={`mt-5 flex w-full shrink-0 flex-col gap-2 transition-opacity duration-500 sm:flex-row ${opened ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {phase === "claimed" ? (
          <button ref={cta} data-ore-continue onClick={() => onDone(true)} className="btn btn-brand w-full shrink-0 sm:flex-1">Continue →</button>
        ) : (
          <>
            <button data-ore-skip onClick={() => onDone(false)} disabled={phase === "claiming"} className="btn btn-line w-full shrink-0 text-ink disabled:opacity-50 sm:flex-1">Maybe later</button>
            {needsPlan
              ? <a data-ore-plans href="/settings#billing" className="btn btn-brand w-full shrink-0 sm:flex-[1.4]">See plans</a>
              : <button ref={cta} data-ore-claim onClick={() => void claim()} disabled={phase === "claiming"} className="btn btn-brand w-full shrink-0 disabled:opacity-70 sm:flex-[1.4]">{phase === "claiming" ? "Adding…" : "Claim ORE bot"}</button>}
          </>
        )}
      </div>
      <p className="mt-3 text-[12px] text-ink/50">{phase === "claimed" ? "Open its chat to connect a computer when you're ready." : needsPlan ? "The ORE bot is free with any paid plan. Claim it from the marketplace once you have one." : "Free. You can also add it later from the marketplace."}</p>
    </div>
  );
}

/** A wrapped box: purple with a gold ribbon. The lid flies off when it opens. */
function GiftBox({ lidOff }: { lidOff: boolean }) {
  return (
    <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden className="relative drop-shadow-[0_18px_30px_rgba(53,20,176,.45)]">
      <defs>
        <linearGradient id="gift-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7a52ff" /><stop offset="1" stopColor="#4a1fe0" /></linearGradient>
        <linearGradient id="gift-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9b7bff" /><stop offset="1" stopColor="#6a3cff" /></linearGradient>
      </defs>
      <g className={lidOff ? "gift-sink" : ""} style={{ transformOrigin: "84px 120px" }}>
        <rect x="30" y="72" width="108" height="80" rx="14" fill="url(#gift-body)" />
        <rect x="76" y="72" width="16" height="80" fill="#ffd84d" />
        <rect x="30" y="72" width="108" height="10" fill="#000" opacity=".12" />
      </g>
      <g className={lidOff ? "gift-lid" : ""} style={{ transformOrigin: "84px 62px" }}>
        <path d="M84 50c-8-16-30-20-32-6-2 12 20 12 32 6z" fill="#ffd84d" />
        <path d="M84 50c8-16 30-20 32-6 2 12-20 12-32 6z" fill="#ffc21a" />
        <rect x="22" y="50" width="124" height="26" rx="10" fill="url(#gift-lid)" />
        <rect x="76" y="50" width="16" height="26" fill="#ffd84d" />
      </g>
    </svg>
  );
}
