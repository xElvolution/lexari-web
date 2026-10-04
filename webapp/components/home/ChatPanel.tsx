"use client";

import { speak } from "@/lib/voice";
import { voiceOf } from "@/lib/voices";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { CHAT_SUGGESTIONS, specialistBySlug } from "@/content/appData";
import { MORE_REACTIONS, QUICK_REACTIONS, ensureReplies, isLocked, planOf, toast, toggleReaction, useNow, useTyping, type Msg, type State } from "@/lib/store";
import SendCard from "./SendCard";
import Icon from "../Icon";
import { AgentTile, GroupTile } from "../faces";
import { convoOf, dayLabel, fmtSecs, nameOf, shortTime } from "../agents";
import Composer from "./Composer";
import { openAgent, openUpgrade } from "../overlays";

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

function Body({ m, mine, s }: { m: Msg; mine: boolean; s: State }) {
  return (
    <>
      {m.reply && (
        <button type="button" onClick={() => document.getElementById(`m-${m.reply!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className={`mb-1.5 block w-full rounded-xl border-l-[3px] px-2.5 py-1.5 text-left text-[13px] leading-snug ${mine ? "border-white/70 bg-white/15 text-white/90" : "border-grape bg-tint text-ink/75"}`}>
          <span className="block text-[11.5px] font-bold">{m.reply.from === "you" ? "You" : nameOf(s, m.reply.from)}</span>
          <span className="line-clamp-2">{m.reply.text || "Attachment"}</span>
        </button>
      )}
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

const whoName = (s: State, w: string) => (w === "you" ? "You" : nameOf(s, w));

/** Small reaction pills under a bubble. Tap one to add or remove yours. */
function Pills({ m, s, convo, mine }: { m: Msg; s: State; convo: string; mine: boolean }) {
  const list = Object.entries(m.re || {}).filter(([, w]) => w.length);
  if (!list.length) return null;
  return (
    <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? "justify-end pr-2" : "pl-2"}`}>
      {list.map(([e, w]) => {
        const me = w.includes("you");
        return (
          <button key={e} onClick={() => toggleReaction(convo, m.id, e)} title={`${w.map((x) => whoName(s, x)).join(", ")} reacted ${e}`} aria-label={`${e} ${w.length}. ${me ? "Remove your reaction" : "React"}`} aria-pressed={me}
            className={`pop relative z-[1] flex h-[26px] items-center gap-1 rounded-full px-2 text-[13px] leading-none shadow-sm ring-2 ring-[var(--bg)] transition hover:scale-105 ${me ? "bg-grape text-white" : "bg-card text-ink"}`}>
            <span className="text-[14px]">{e}</span>{w.length > 1 && <span className="tab-num text-[11.5px] font-bold">{w.length}</span>}
            {!me && w.length === 1 && w[0] !== "you" && <span className="text-[10.5px] font-semibold text-ink/50">{whoName(s, w[0])}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Reaction bar plus Reply and Copy. Opens on a hold, and stays until a click outside the message. */
function MsgMenu({ m, convo, mine, open, more, below, onMore, onReply, onClose }: {
  m: Msg; convo: string; mine: boolean; open: boolean; more: boolean; below: boolean; onMore: () => void; onReply: () => void; onClose: () => void;
}) {
  const react = (e: string) => { toggleReaction(convo, m.id, e); onClose(); };
  const copy = () => { navigator.clipboard?.writeText(m.text || m.file?.name || "").then(() => toast({ text: "Copied" }), () => toast({ text: "Couldn't copy" })); onClose(); };
  return (
    <>
      {open && (
        <div data-menu className={`pop absolute z-[4] w-max ${below ? "top-full mt-2" : "bottom-full mb-2"} max-w-[min(330px,86vw)] ${mine ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"}`} role="menu" aria-label="React to message">
          <div className="flex flex-wrap items-center gap-0.5 rounded-[22px] bg-card p-1 shadow-[0_18px_40px_-16px_rgba(0,0,0,.45)] ring-1 ring-line">
            {(more ? [...QUICK_REACTIONS, ...MORE_REACTIONS] : QUICK_REACTIONS).map((e) => {
              const me = (m.re?.[e] || []).includes("you");
              return <button key={e} role="menuitem" onClick={() => react(e)} aria-label={`React ${e}`} className={`grid h-10 w-10 place-items-center rounded-full text-[21px] transition hover:-translate-y-0.5 hover:scale-125 hover:bg-tint ${me ? "bg-tint ring-2 ring-grape" : ""}`}>{e}</button>;
            })}
            {!more && <button onClick={onMore} aria-label="More reactions" className="grid h-10 w-10 place-items-center rounded-full bg-tint text-ink/70 transition hover:bg-grape hover:text-white"><Icon name="plus" size={18} /></button>}
          </div>
          <div className={`mt-1.5 flex gap-1 ${mine ? "justify-end" : ""}`}>
            <button role="menuitem" onClick={onReply} className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13.5px] font-bold text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="reply" size={15} />Reply</button>
            {!mine && m.text && m.from !== "system" && <button role="menuitem" data-read-aloud onClick={() => { void speak(m.text, voiceOf(m.from)); onClose(); }} className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13.5px] font-bold text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="speaker" size={15} />Read aloud</button>}
            {(m.text || m.file) && <button role="menuitem" onClick={copy} className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13.5px] font-bold text-ink shadow ring-1 ring-line hover:text-brand-ink"><Icon name="copy" size={15} />Copy</button>}
          </div>
        </div>
      )}
    </>
  );
}

/** Double-tap likes, a hold opens the menu, a drag to the right replies. */
function useBubbleGesture(opts: { onLike: () => void; onReply: () => void; onHold: () => void; held: boolean }) {
  const start = useRef<{ x: number; y: number; t: number; pid: number } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const swiping = useRef(false);
  const shiftRef = useRef(0);
  const [shift, setShift] = useState(0);
  const [pop, setPop] = useState(false);
  const move = (n: number) => { shiftRef.current = n; setShift(n); };
  const clearHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  const onLike = opts.onLike;
  const onReply = opts.onReply;
  const onHold = opts.onHold;
  return {
    shift, pop,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest("button, a")) return;
        if (opts.held) return;
        start.current = { x: e.clientX, y: e.clientY, t: Date.now(), pid: e.pointerId };
        swiping.current = false;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        clearHold();
        hold.current = setTimeout(() => { hold.current = null; start.current = null; onHold(); navigator.vibrate?.(12); }, 420);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = start.current; if (!s || e.pointerId !== s.pid) return;
        const dx = e.clientX - s.x; const dy = e.clientY - s.y;
        if (!swiping.current && Math.hypot(dx, dy) > 10) {
          clearHold();
          if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.15) swiping.current = true;
          else { start.current = null; move(0); return; }
        }
        if (swiping.current) move(Math.max(0, Math.min(112, dx)));
      },
      onPointerUp: (e: React.PointerEvent) => {
        const s = start.current;
        clearHold();
        if (swiping.current) {
          if (shiftRef.current > 64) onReply();
          swiping.current = false;
          move(0);
          start.current = null;
          return;
        }
        start.current = null;
        if (!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || Date.now() - s.t > 400) return;
        const at = Date.now();
        if (at - lastTap.current < 320) {
          lastTap.current = 0;
          window.getSelection()?.removeAllRanges();
          onLike();
          setPop(true);
          window.setTimeout(() => setPop(false), 450);
        } else lastTap.current = at;
      },
      onPointerCancel: () => { clearHold(); swiping.current = false; move(0); start.current = null; },
      onDoubleClick: (e: React.MouseEvent) => { e.preventDefault(); requestAnimationFrame(() => window.getSelection()?.removeAllRanges()); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onHold(); },
    },
  };
}

function Bubble({ m, s, convo, mine, lastOfRun, now, menu, setMenu, onReply }: {
  m: Msg; s: State; convo: string; mine: boolean; lastOfRun: boolean; now: number;
  menu: { id: string; more: boolean } | null; setMenu: (v: { id: string; more: boolean } | null) => void; onReply: (m: Msg) => void;
}) {
  const open = menu?.id === m.id;
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const sc = box.current.closest(".overflow-y-auto"); const top = sc ? sc.getBoundingClientRect().top : 0;
    setBelow(box.current.getBoundingClientRect().top - top < 140);
  }, [open]);
  const gesture = useBubbleGesture({
    held: open,
    onHold: () => setMenu({ id: m.id, more: false }),
    onReply: () => { setMenu(null); onReply(m); },
    onLike: () => toggleReaction(convo, m.id, "❤️"),
  });
  const cls = mine ? `bg-grape text-white ${lastOfRun ? "rounded-br-md" : ""}` : `bg-card text-ink ring-1 ring-line ${lastOfRun ? "rounded-bl-md" : ""}`;
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-msg-hold={m.id}>
      {(m.text || m.file || m.voice) ? <div ref={box} className="group/msg relative max-w-full">
        <span aria-hidden className="pointer-events-none absolute left-0 top-1/2 grid h-9 w-9 -translate-x-[130%] -translate-y-1/2 place-items-center rounded-full bg-tint text-brand-ink" style={{ opacity: gesture.shift > 24 ? 1 : 0 }}><Icon name="reply" size={16} /></span>
        <div {...gesture.handlers} title={shortTime(m.at, now)} className={`relative select-text rounded-[20px] px-4 py-2.5 text-[15.5px] leading-snug max-[430px]:rounded-[18px] max-[430px]:px-3.5 max-[430px]:py-2 max-[430px]:leading-[1.4] ${cls} ${open ? "ring-2 ring-grape" : ""} [-webkit-touch-callout:none]`} style={{ transform: `translateX(${gesture.shift}px)`, transition: gesture.shift ? "none" : "transform .2s ease", touchAction: "pan-y" }}>
          <Body m={m} mine={mine} s={s} />
          {gesture.pop && <span className="pop pointer-events-none absolute -right-1 -top-3 text-[22px]" aria-hidden>❤️</span>}
        </div>
        <MsgMenu m={m} convo={convo} mine={mine} open={open} more={!!menu?.more} below={below} onMore={() => setMenu({ id: m.id, more: true })} onReply={() => { setMenu(null); onReply(m); }} onClose={() => setMenu(null)} />
      </div> : null}
      {m.send && <SendCard convo={convo} m={m as Msg & { send: NonNullable<Msg["send"]> }} />}
      <Pills m={m} s={s} convo={convo} mine={mine} />
    </div>
  );
}

/** One conversation: header, thread and composer. Works for a single agent or a group. */
export default function ChatPanel({ s, id, onBack, onCall, onDesktop, desktopOpen, onEditGroup }: {
  s: State; id: string; onBack?: () => void; onCall: () => void; onDesktop: () => void; desktopOpen: boolean; onEditGroup: () => void;
}) {
  const c = convoOf(s, id)!;
  const msgs = s.threads[id] || [];
  const typing = useTyping(id);
  const now = useNow(30000);
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef(msgs.length);
  const look = s.agent?.look;
  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [menu, setMenu] = useState<{ id: string; more: boolean } | null>(null);
  const [reply, setReply] = useState<Msg | null>(null);
  useEffect(() => {
    if (!menu) return;
    const opened = Date.now();
    const off = (e: PointerEvent) => {
      if (Date.now() - opened < 450) return;
      const node = e.target as HTMLElement;
      if (node.closest("[data-menu]") || node.closest(`[data-msg-hold="${menu.id}"]`)) return;
      setMenu(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("pointerdown", off);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", off); window.removeEventListener("keydown", esc); };
  }, [menu]);

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
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-line px-3 sm:px-5 max-[430px]:h-[54px] max-[430px]:gap-2 max-[430px]:px-2">
        {onBack && <button onClick={onBack} aria-label="Back to chats" data-tour="chat-back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition hover:bg-tint"><Icon name="back" size={20} /></button>}
        {c.group ? (
          <button onClick={onEditGroup} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left">
            <GroupTile members={c.members} look={look} size={40} />
            <span className="min-w-0 flex-1"><h2 className="truncate text-[16.5px] font-bold leading-tight text-ink">{c.name}</h2><p className={`truncate text-[12.5px] ${typing ? "font-semibold text-brand-ink" : "text-ink/60"}`}>{sub}</p></span>
          </button>
        ) : (
          <button onClick={() => openAgent(id)} data-tour="chat-head" title={`${c.name}'s profile and ID card`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pr-2 text-left">
            <AgentTile id={id} look={look} size={40} className="transition group-hover:scale-105" />
            <span className="min-w-0">
              <h2 className="flex items-center gap-1.5 truncate text-[16.5px] font-bold leading-tight text-ink group-hover:text-brand-ink">{c.name}<Icon name="idcard" size={15} className="shrink-0 text-ink/40 transition group-hover:text-brand-ink" /></h2>
              <p className={`truncate text-[12.5px] ${typing ? "font-semibold text-brand-ink" : "text-ink/60"}`}>{sub}</p>
            </span>
          </button>
        )}
        {c.group && <button onClick={onEditGroup} aria-label="Edit group" title="Edit group" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink"><Icon name="users" size={19} /></button>}
      </header>

      <div ref={scroller} className="no-bar min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex min-h-full max-w-[820px] flex-col px-4 py-6 sm:px-6 max-[430px]:px-3 max-[430px]:py-4">
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
              // The reply bubble is empty until the first words arrive; the typing dots stand in for it (one bubble, not two).
              if (m.from !== "system" && !m.text && !m.file && !m.voice && !m.send) return null;
              if (m.from === "system") return (
                <div key={m.id} data-msg>{day}
                  <div className="my-3 flex justify-center"><span className="flex items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-[12.5px] font-semibold text-ink/70">{m.call && <Icon name="call" size={13} className="text-brand-ink" />}{m.call ? `Voice call · ${fmtSecs(m.call)}` : m.text}</span></div>
                </div>
              );
              const mine = m.from === "you";
              const bub = <Bubble m={m} s={s} convo={id} mine={mine} lastOfRun={lastOfRun} now={now} menu={menu} setMenu={setMenu} onReply={setReply} />;
              return (
                <div key={m.id} id={`m-${m.id}`} data-msg className={menu?.id === m.id ? "relative z-[5]" : ""}>{day}
                  {mine ? (
                    <div className={`flex justify-end ${first ? "mt-4" : ""}`}><div className="min-w-0 max-w-[80%]">{bub}</div></div>
                  ) : (
                    <div className={`flex items-end gap-2.5 ${first ? "mt-4" : ""}`}>
                      {lastOfRun ? <button onClick={() => openAgent(m.from)} aria-label={`${nameOf(s, m.from)}'s profile`} className={`shrink-0 ${m.re && Object.keys(m.re).length ? "mb-[22px]" : ""}`}><AgentTile id={m.from} look={look} size={30} radius={10} /></button> : <span className="w-[30px] shrink-0" />}
                      <div className="min-w-0 max-w-[80%]">
                        {first && <span className="mb-1 block text-[12px] font-bold text-ink/60">{nameOf(s, m.from)}</span>}
                        {bub}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {typing && !(msgs.length && msgs[msgs.length - 1].from === typing && (msgs[msgs.length - 1].text || msgs[msgs.length - 1].send)) && (
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

      {isLocked(s, id) ? (
        <div data-chat-locked className="pb-safe border-t border-line bg-base px-4 py-3"><div className="mx-auto flex max-w-[820px] items-center gap-3 rounded-[22px] bg-card p-3 ring-1 ring-line">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink text-[var(--bg)]"><Icon name="lock" size={17} /></span>
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink/75"><b className="text-ink">{c.name} is locked on your {planOf(s).name} plan.</b> Your chats are kept. Upgrade to keep working together.</span>
          <button data-upgrade-plan onClick={() => openUpgrade("plans")} className="btn btn-brand btn-sm !h-10 shrink-0">Upgrade plan</button>
        </div></div>
      ) : <Composer id={id} name={c.name} suggestions={suggestions} onCall={onCall} onDesktop={onDesktop} desktopOpen={desktopOpen}
        reply={reply ? { id: reply.id, from: reply.from, text: reply.text || (reply.voice ? "Voice note" : reply.file?.name ?? "") } : null} replyName={reply ? whoName(s, reply.from) : ""} onClearReply={() => setReply(null)} />}
    </section>
  );
}
