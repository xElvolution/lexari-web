"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { CHAT_SUGGESTIONS, specialistBySlug } from "@/content/appData";
import { ensureReplies, useNow, useTyping, type Msg, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile, GroupTile } from "../faces";
import { DemoTag } from "../ui";
import { convoOf, dayLabel, fmtSecs, nameOf, shortTime } from "../agents";
import Composer from "./Composer";

function VoiceNote({ secs, mine }: { secs: number; mine: boolean }) {
  const [p, setP] = useState(-1);
  useEffect(() => {
    if (p < 0) return;
    if (p >= 1) { const t = setTimeout(() => setP(-1), 300); return () => clearTimeout(t); }
    const t = setTimeout(() => setP((x) => Math.min(1, x + 0.1 / secs)), 100);
    return () => clearTimeout(t);
  }, [p, secs]);
  const bars = 26;
  return (
    <span className="flex items-center gap-2.5 py-0.5">
      <button onClick={() => setP(p < 0 ? 0 : -1)} aria-label={p < 0 ? "Play voice note" : "Stop"} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${mine ? "bg-white text-grape" : "bg-grape text-white"}`}><Icon name={p < 0 ? "play" : "pause"} size={15} /></button>
      <span className="flex h-7 items-center gap-[3px]" aria-hidden>
        {Array.from({ length: bars }).map((_, i) => <i key={i} className={`w-[3px] rounded-full transition-colors ${p >= 0 && i / bars <= p ? (mine ? "bg-white" : "bg-brand-ink") : mine ? "bg-white/45" : "bg-ink/25"}`} style={{ height: `${25 + ((i * 53) % 75)}%` }} />)}
      </span>
      <span className={`tab-num font-mono text-[12px] ${mine ? "text-white/85" : "text-ink/60"}`}>{fmtSecs(p >= 0 ? secs * p : secs)}</span>
    </span>
  );
}

function Body({ m, mine }: { m: Msg; mine: boolean }) {
  return (
    <>
      {m.file && (
        <span className={`mb-1 flex items-center gap-2.5 rounded-2xl p-1.5 pr-3 ${mine ? "bg-white/15" : "bg-tint"}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${mine ? "bg-white text-grape" : "bg-grape text-white"}`}><Icon name="file" size={17} /></span>
          <span className="min-w-0"><span className="block truncate text-[14px] font-semibold">{m.file.name}</span><span className={`block text-[11.5px] ${mine ? "text-white/75" : "text-ink/55"}`}>{m.file.size}</span></span>
        </span>
      )}
      {m.voice ? <VoiceNote secs={m.voice} mine={mine} /> : m.text && <span className="block whitespace-pre-wrap break-words">{m.text}</span>}
    </>
  );
}

/** One conversation: header, thread and composer. Works for a single agent or a group. */
export default function ChatPanel({ s, id, onBack, onCall, onDesktop, desktopOpen, onEditGroup }: {
  s: State; id: string; onBack?: () => void; onCall: () => void; onDesktop?: () => void; desktopOpen?: boolean; onEditGroup: () => void;
}) {
  const c = convoOf(s, id)!;
  const msgs = s.threads[id] || [];
  const typing = useTyping(id);
  const now = useNow(30000);
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef(msgs.length);
  const look = s.agent?.look;
  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => { ensureReplies(); }, []);
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollTop = el.scrollHeight; seen.current = (s.threads[id] || []).length;
    if (!calm()) gsap.fromTo(el.firstElementChild, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "all" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    if (msgs.length > seen.current && !calm()) {
      const kids = Array.from(el.querySelectorAll("[data-msg]")).slice(-(msgs.length - seen.current));
      gsap.from(kids, { y: 10, opacity: 0, duration: 0.32, ease: "power2.out", stagger: 0.04, clearProps: "all" });
    }
    seen.current = msgs.length;
  }, [msgs.length, typing]);

  const sp = !c.group && id !== "home" ? specialistBySlug(id) : undefined;
  const suggestions = msgs.filter((m) => m.from === "you").length > 1 ? [] : c.group ? ["What's still open for Friday?", "Everyone, one line on progress"] : id === "home" ? [...CHAT_SUGGESTIONS.slice(0, 2), "Remember that I work from Lagos"] : sp?.examples.slice(0, 2) ?? [];
  const sub = typing ? `${c.group ? `${nameOf(s, typing)} is ` : ""}typing…` : c.group ? c.sub : `${c.sub} · online`;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-base">
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-line px-3 sm:px-5">
        {onBack && <button onClick={onBack} aria-label="Back to chats" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition hover:bg-tint"><Icon name="back" size={20} /></button>}
        {c.group ? <GroupTile members={c.members} look={look} size={40} /> : <AgentTile id={id} look={look} size={40} />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16.5px] font-bold leading-tight text-ink">{c.name}</h2>
          <p className={`truncate text-[12.5px] ${typing ? "font-semibold text-brand-ink" : "text-ink/60"}`}>{sub}</p>
        </div>
        <DemoTag className="hidden md:inline-flex" />
        {c.group && <button onClick={onEditGroup} aria-label="Edit group" title="Edit group" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink"><Icon name="users" size={19} /></button>}
        {onDesktop && <button onClick={onDesktop} aria-pressed={!!desktopOpen} aria-label="Open desktop" title="Desktop" className={`grid h-10 w-10 place-items-center rounded-full transition ${desktopOpen ? "bg-grape text-white" : "text-ink/75 hover:bg-tint hover:text-brand-ink"}`}><Icon name="monitor" size={19} /></button>}
      </header>

      <div ref={scroller} className="no-bar min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex min-h-full max-w-[820px] flex-col px-4 py-6 sm:px-6">
          {msgs.length === 0 && (
            <div className="m-auto max-w-sm text-center">
              {c.group ? <GroupTile members={c.members} look={look} size={96} className="mx-auto" /> : <AgentTile id={id} look={look} size={96} className="mx-auto" />}
              <h3 className="display mt-5 text-[34px] text-ink">Say hi to {c.name}.</h3>
              <p className="mt-2 text-[15px] text-ink/65">{c.group ? "Everyone in the group sees your messages. Name someone to ask them directly." : id === "home" ? "Ask for anything. Start with “remember…” and it files a memory in its brain." : sp?.back}</p>
            </div>
          )}
          <div className="mt-auto space-y-2">
            {msgs.map((m, i) => {
              const prev = msgs[i - 1], next = msgs[i + 1];
              const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
              const first = !prev || prev.from !== m.from || newDay;
              const lastOfRun = !next || next.from !== m.from;
              const day = newDay && now > 0 ? <div className="label my-5 text-center text-[9px] text-ink/45">{dayLabel(m.at, now)}</div> : null;
              if (m.from === "system") return (
                <div key={m.id} data-msg>{day}
                  <div className="my-3 flex justify-center"><span className="flex items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-[12.5px] font-semibold text-ink/70">{m.call && <Icon name="call" size={13} className="text-brand-ink" />}{m.call ? `Voice call · ${fmtSecs(m.call)}` : m.text}</span></div>
                </div>
              );
              const mine = m.from === "you";
              return (
                <div key={m.id} data-msg>{day}
                  {mine ? (
                    <div className={`flex justify-end ${first ? "mt-4" : ""}`}>
                      <div title={shortTime(m.at, now)} className={`max-w-[80%] rounded-[20px] bg-grape px-4 py-2.5 text-[15.5px] leading-snug text-white ${lastOfRun ? "rounded-br-md" : ""}`}><Body m={m} mine /></div>
                    </div>
                  ) : (
                    <div className={`flex items-end gap-2.5 ${first ? "mt-4" : ""}`}>
                      {lastOfRun ? <AgentTile id={m.from} look={look} size={30} radius={10} /> : <span className="w-[30px] shrink-0" />}
                      <div className="min-w-0 max-w-[80%]">
                        {first && <span className="mb-1 block text-[12px] font-bold text-ink/60">{nameOf(s, m.from)}</span>}
                        <div title={shortTime(m.at, now)} className={`rounded-[20px] bg-card px-4 py-2.5 text-[15.5px] leading-snug text-ink ring-1 ring-line ${lastOfRun ? "rounded-bl-md" : ""}`}><Body m={m} mine={false} /></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {typing && (
              <div data-msg className="mt-3 flex items-end gap-2.5">
                <AgentTile id={typing} look={look} size={30} radius={10} />
                <div>
                  {c.group && <span className="mb-1 block text-[12px] font-bold text-ink/60">{nameOf(s, typing)}</span>}
                  <span className="typing flex gap-1 rounded-[20px] rounded-bl-md bg-card px-4 py-3.5 text-brand-ink ring-1 ring-line"><i /><i /><i /></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Composer id={id} name={c.name} suggestions={suggestions} onCall={onCall} />
    </section>
  );
}
