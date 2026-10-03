"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Face from "@shared/components/Face";
import type { ColorKey } from "@shared/components/avatar";
import { WEBAPP_URL } from "@shared/sites";
import { toast, type State } from "@/lib/store";
import { TIERS, hub, hubOf, inviteCode, useHubBusy } from "@/lib/hub";
import { AgentFace } from "@/components/faces";
import Icon from "@/components/Icon";
import { burst } from "@/components/fly";
import { Coin, flyCoins } from "./coin";

const SHARE = [
  { id: "x", label: "X", href: (t: string, u: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`, glyph: <path d="M4 4l16 16M20 4L4 20" /> },
  { id: "tg", label: "Telegram", href: (t: string, u: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`, glyph: <path d="M21 4L3 11l6 2 2 6 3-4 5 4z" /> },
  { id: "wa", label: "WhatsApp", href: (t: string, u: string) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`, glyph: <path d="M4 20l1.4-4A8 8 0 1 1 8 18.6zM9 9c0 3 3 6 6 6" /> },
  { id: "mail", label: "Email", href: (t: string, u: string) => `mailto:?subject=${encodeURIComponent("Join me on Lexari")}&body=${encodeURIComponent(`${t}\n${u}`)}`, glyph: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></> },
];

export default function Referral({ s }: { s: State }) {
  const h = hubOf(s);
  const code = inviteCode(s);
  const link = `${WEBAPP_URL}/signin?ref=${code}`;
  const msg = `I've got my own AI agent on Lexari. Join with my code ${code} and we both get coins.`;
  const friends = h.invited;
  const nextTier = TIERS.find((t) => friends.length < t.friends);
  const slots = Math.min(10, Math.max(friends.length + 1, nextTier?.friends ?? friends.length, 4));
  const busy = useHubBusy();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const orbit = useRef<HTMLDivElement>(null);
  const prev = useRef(friends.length);

  useEffect(() => {
    if (friends.length > prev.current) {
      const el = orbit.current?.querySelector<HTMLElement>(`[data-slot="${friends.length - 1}"] [data-friend]`);
      if (el) { gsap.fromTo(el, { scale: 0 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, .5)" }); burst(el, 16); }
    }
    prev.current = friends.length;
  }, [friends.length]);

  const copy = (what: "code" | "link") => {
    const text = what === "code" ? code : link;
    const ok = () => { setCopied(what); setTimeout(() => setCopied(null), 1600); toast({ text: what === "code" ? `Code ${code} copied` : "Invite link copied", face: "home" }); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, () => toast({ text: "Couldn't copy. Long-press to copy instead.", face: "home" }));
    else toast({ text: "Couldn't copy. Long-press to copy instead.", face: "home" });
  };
  const more = () => {
    if (navigator.share) navigator.share({ title: "Lexari", text: msg, url: link }).catch(() => {});
    else copy("link");
  };
  const claim = (i: number, el: HTMLElement) => {
    void hub.claimTier(i).then((r) => {
      if (!r.ok) { toast({ text: r.error || "That tier is not ready.", face: "home" }); return; }
      flyCoins(el, r.coins); burst(el, 22);
      toast({ text: `${TIERS[i].title} · +${r.coins} coins`, face: "home" });
    });
  };

  // fill along the road: nodes sit at the centres of four equal columns
  const fill = (() => {
    const n = TIERS.length, have = friends.length;
    if (have < TIERS[0].friends) return 0;
    let i = 0; while (i < n - 1 && have >= TIERS[i + 1].friends) i++;
    return i === n - 1 ? 1 : (i + (have - TIERS[i].friends) / (TIERS[i + 1].friends - TIERS[i].friends)) / (n - 1);
  })();

  return (
    <section data-rise id="invite" className="relative scroll-mt-24 overflow-hidden rounded-[30px] bg-[#0a0a0a] text-white ring-1 ring-white/10">
      <span className="pointer-events-none absolute -left-20 top-10 h-80 w-80 rounded-full bg-grape/50 blur-[90px]" />
      <span className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[#8f6bff]/30 blur-[90px]" />
      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-12">
        {/* the orbit */}
        <div ref={orbit} className="relative mx-auto h-[290px] w-[290px] sm:h-[330px] sm:w-[330px]">
          <span className="absolute inset-[14%] rounded-full border border-dashed border-white/20" />
          <span className="absolute inset-[30%] rounded-full bg-grape/25 blur-2xl" />
          <span className="absolute left-1/2 top-1/2 grid h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[30px] bg-grape shadow-[0_14px_40px_-10px_rgba(91,43,255,.9)]">
            <AgentFace look={s.agent?.look} size={86} animated state={friends.length ? "happy" : "idle"} />
          </span>
          <div className="hub-orbit absolute inset-0">
            {Array.from({ length: slots }, (_, i) => {
              const a = (i / slots) * Math.PI * 2 - Math.PI / 2, r = 36; const f = friends[i];
              return (
                <span key={i} data-slot={i} className="absolute" style={{ left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%`, width: 0, height: 0 }}>
                  <span className="absolute -left-[26px] -top-[26px] block h-[52px] w-[52px]">
                    {f ? (
                      <span data-friend className="relative grid h-[52px] w-[52px] place-items-center rounded-full bg-white ring-4 ring-[#0a0a0a]" title={f.name}>
                        <Face seed={f.seed} variant={{ color: f.color as ColorKey }} size={42} />
                        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0a0a0a] px-1.5 text-[10.5px] font-bold text-white/85">{f.name}</span>
                      </span>
                    ) : (
                      <button type="button" onClick={() => copy("link")} aria-label="Copy your invite link" className="grid h-[52px] w-[52px] place-items-center rounded-full border-2 border-dashed border-white/30 text-white/45 transition hover:border-lilac hover:text-lilac"><Icon name="plus" size={18} /></button>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <p className="label text-[10px] text-lilac">Invite friends</p>
          <h2 className="display mt-1 text-[40px] leading-[0.95] sm:text-[52px]">Fill your orbit.</h2>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">Every friend who joins with your code lands in your orbit with their own agent. They start with 50 coins, and you collect a bonus at each milestone.</p>

          {/* ticket */}
          <div className="relative mt-5 flex flex-col rounded-[22px] bg-white text-[#0a0a0a] sm:flex-row">
            <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#0a0a0a]" /><span aria-hidden className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#0a0a0a]" />
            <div className="min-w-0 flex-1 px-6 py-4">
              <span className="label text-[9px] text-black/50">Your code</span>
              <button type="button" onClick={() => copy("code")} className="display mt-1 block max-w-full truncate text-left text-[34px] leading-none tracking-[-0.02em] text-[#3514b0] transition hover:text-grape sm:text-[40px]" aria-label={`Copy code ${code}`}>{code}</button>
              <span className="mt-2 block truncate font-mono text-[12px] text-black/50">{link.replace(/^https?:\/\//, "")}</span>
            </div>
            <div className="flex items-center gap-2 border-t-2 border-dashed border-black/15 px-5 py-3 sm:border-l-2 sm:border-t-0 sm:py-0">
              <button type="button" onClick={() => copy("link")} className={`flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-full px-4 text-[14.5px] font-extrabold transition ${copied ? "bg-[#0a0a0a] text-white" : "bg-grape text-white hover:-translate-y-0.5"}`}>
                <Icon name={copied ? "check" : "copy"} size={16} stroke={copied ? 3 : 2} />{copied === "link" ? "Copied!" : copied === "code" ? "Code copied" : "Copy link"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {SHARE.map((x) => (
              <a key={x.id} href={x.href(msg, link)} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-full bg-white/10 pl-3 pr-4 text-[13.5px] font-bold ring-1 ring-white/15 transition hover:bg-white hover:text-[#0a0a0a]">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{x.glyph}</svg>{x.label}
              </a>
            ))}
            <button type="button" onClick={more} className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[13.5px] font-bold ring-1 ring-white/15 transition hover:bg-white hover:text-[#0a0a0a]"><Icon name="more" size={16} />More</button>
          </div>
        </div>
      </div>

      {/* milestone road */}
      <div className="relative border-t border-white/10 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[16px] font-bold">{friends.length} {friends.length === 1 ? "friend" : "friends"} joined{nextTier ? ` · ${nextTier.friends - friends.length} more to ${nextTier.title.toLowerCase()}` : " · every milestone reached"}</h3>
          <span className="text-[13px] text-white/60">Friends count when they sign up with your code.</span>
        </div>
        <div className="relative mt-6">
          <div className="absolute left-[12.5%] right-[12.5%] top-[22px] h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#8f6bff] to-grape transition-[width] duration-700 ease-out" style={{ width: `${fill * 100}%` }} /></div>
          <ol className="relative grid grid-cols-4 gap-1">
            {TIERS.map((t, i) => {
              const reached = friends.length >= t.friends; const got = h.tiers.includes(i);
              return (
                <li key={t.friends} className="flex flex-col items-center text-center">
                  <span className={`grid h-11 w-11 place-items-center rounded-full ring-4 ring-[#0a0a0a] transition ${got ? "bg-white text-grape" : reached ? "hub-claim bg-grape text-white" : "bg-[#262626] text-white/45"}`}>{got ? <Icon name="check" size={18} stroke={3} /> : <Icon name="box" size={19} />}</span>
                  <span className="mt-2 text-[13px] font-bold leading-tight">{t.friends} {t.friends === 1 ? "friend" : "friends"}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-extrabold tabular-nums text-white/80"><Coin size={14} />{t.reward.toLocaleString("en-US")}</span>
                  {reached && !got ? <button type="button" onClick={(e) => claim(i, e.currentTarget)} disabled={!!busy} className="mt-2 h-8 disabled:opacity-60 rounded-full bg-white px-3.5 text-[12.5px] font-extrabold text-[#0a0a0a] transition hover:-translate-y-0.5">{busy === `tier:${i}` ? "Signing…" : "Claim"}</button>
                    : <span className="mt-2 flex h-8 max-w-[84px] items-center justify-center text-center text-[11.5px] font-semibold leading-tight text-white/45">{got ? "Collected" : t.title}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
