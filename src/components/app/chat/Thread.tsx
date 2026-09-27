"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { CHAT_SUGGESTIONS, specialistBySlug } from "@/content/appData";
import { agentName, ensureReplies, sendTo, useNow, useTyping, type State } from "@/lib/store";
import Face from "../../Face";
import Icon from "../Icon";
import { WhoFace } from "../faces";
import { DemoTag } from "../ui";
import { dayLabel, shortTime } from "../agents";
import { hireWithFx } from "../hireAction";

export default function Thread({ s, id }: { s: State; id: string }) {
  const router = useRouter();
  const home = id === "home";
  const sp = home ? undefined : specialistBySlug(id);
  const hired = home || s.hired.includes(id);
  const msgs = s.threads[id] || [];
  const typing = useTyping(id);
  const now = useNow(30000);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const seen = useRef(msgs.length);
  const name = home ? agentName(s) : sp?.name ?? "Agent";

  useEffect(() => { ensureReplies(); }, []);
  // on switching agents: settle at the bottom and fade the thread in
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollTop = el.scrollHeight; seen.current = (s.threads[id] || []).length;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) gsap.fromTo(el.querySelectorAll("[data-msg]"), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.025, ease: "power2.out", clearProps: "all" });
    if (window.matchMedia("(min-width: 1024px)").matches) input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // new messages pop in
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    if (msgs.length > seen.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const kids = Array.from(el.querySelectorAll("[data-msg]")).slice(-(msgs.length - seen.current));
      gsap.from(kids, { y: 18, opacity: 0, scale: 0.94, duration: 0.5, ease: "back.out(1.8)", stagger: 0.05, clearProps: "all" });
    }
    seen.current = msgs.length;
  }, [msgs.length, typing]);

  const grow = () => { const t = input.current; if (!t) return; t.style.height = "auto"; t.style.height = `${Math.min(160, t.scrollHeight)}px`; };
  const send = (v = text) => { if (!v.trim()) return; sendTo(id, v); setText(""); requestAnimationFrame(grow); input.current?.focus(); };
  const suggestions = home ? [...CHAT_SUGGESTIONS.slice(0, 3), "Remember that I work from Lagos"] : sp?.examples ?? [];

  if (!home && !sp) return (
    <div className="grid h-full place-items-center p-8 text-center"><div><h2 className="display text-[36px] text-ink">No one by that name.</h2><Link href="/app" className="btn btn-brand btn-sm mt-6">Back home</Link></div></div>
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-line bg-base/85 px-3 py-3 backdrop-blur-md sm:px-5">
        <Link href="/app/chat" aria-label="Back to chats" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition hover:bg-tint lg:hidden"><Icon name="back" size={20} /></Link>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${home ? "bg-grape" : "bg-tint"}`}><WhoFace who={id} look={s.agent?.look} size={36} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-bold leading-tight text-ink">{name}</h2>
          <p className={`flex items-center gap-1.5 truncate text-[13px] ${typing ? "font-semibold text-brand-ink" : "text-ink/65"}`}>
            {!typing && <i className="h-1.5 w-1.5 rounded-full bg-grape" />}{typing ? "typing…" : `${home ? "Your personal agent" : sp!.job} · online`}
          </p>
        </div>
        <DemoTag className="hidden sm:inline-flex" />
        <Link href={home ? "/app/memory" : `/app/marketplace/${id}`} className="label hidden rounded-full bg-tint px-3 py-2 text-[9.5px] text-ink transition hover:bg-grape hover:text-white sm:inline-block">{home ? "Brain" : "Profile"}</Link>
      </header>

      {/* thread */}
      <div ref={scroller} className="no-bar min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex min-h-full max-w-[800px] flex-col px-4 py-6 sm:px-6">
          {!hired ? (
            <div className="m-auto max-w-sm text-center">
              <div ref={faceRef} className="bob mx-auto grid h-28 w-28 place-items-center rounded-[30px] bg-tint"><Face seed={sp!.seed} variant={{ color: sp!.color }} size={92} track /></div>
              <h3 className="display mt-6 text-[36px] text-ink">{sp!.name} isn&apos;t on your team yet.</h3>
              <p className="mt-2 text-[15px] text-ink/70">Hire {sp!.name} into an open seat to start chatting.</p>
              <button onClick={() => hireWithFx(id, faceRef.current, () => router.push("/app/team"))} className="btn btn-brand btn-sm mt-6">Hire into a seat</button>
            </div>
          ) : msgs.length === 0 ? (
            <div className="m-auto max-w-md text-center">
              <div className={`bob mx-auto grid h-28 w-28 place-items-center rounded-[30px] ${home ? "bg-grape" : "bg-tint"}`}><WhoFace who={id} look={s.agent?.look} size={92} /></div>
              <h3 className="display mt-6 text-[40px] text-ink">Say hi to {name}.</h3>
              <p className="mt-2 text-[15px] text-ink/70">{home ? "Ask for anything. Start with “remember…” and it files a memory in its brain." : sp!.back}</p>
            </div>
          ) : (
            <div className="mt-auto space-y-2.5">
              {msgs.map((m, i) => {
                const prev = msgs[i - 1];
                const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
                const first = !prev || prev.from !== m.from || newDay;
                const lastOfGroup = !msgs[i + 1] || msgs[i + 1].from !== m.from;
                return (
                  <div key={m.id} data-msg>
                    {newDay && now > 0 && <div className="label my-5 text-center text-[9px] text-ink/55">{dayLabel(m.at, now)}</div>}
                    {m.from === "you" ? (
                      <div className={`flex justify-end ${first ? "mt-4" : ""}`}>
                        <p title={shortTime(m.at, now)} className={`max-w-[80%] whitespace-pre-wrap break-words rounded-[22px] bg-grape px-4 py-2.5 text-[15.5px] font-medium leading-snug text-white shadow-[0_6px_16px_-10px_rgba(91,43,255,.8)] ${lastOfGroup ? "rounded-br-md" : ""}`}>{m.text}</p>
                      </div>
                    ) : (
                      <div className={`flex items-end gap-2.5 ${first ? "mt-4" : ""}`}>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${lastOfGroup ? (home ? "bg-grape" : "bg-tint") : "opacity-0"}`}>{lastOfGroup && <WhoFace who={m.from} look={s.agent?.look} size={26} />}</span>
                        <div className="max-w-[80%]">
                          {first && <span className="label mb-1 block text-[9px] text-ink/60">{name}</span>}
                          <p title={shortTime(m.at, now)} className={`whitespace-pre-wrap break-words rounded-[22px] bg-card px-4 py-2.5 text-[15.5px] leading-snug text-ink ring-1 ring-line ${lastOfGroup ? "rounded-bl-md" : ""}`}>{m.text}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {typing && (
            <div data-msg className="mt-3 flex items-end gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${home ? "bg-grape" : "bg-tint"}`}><WhoFace who={id} look={s.agent?.look} size={26} /></span>
              <span className="typing flex gap-1 rounded-[22px] rounded-bl-md bg-card px-4 py-3.5 text-brand-ink ring-1 ring-line"><i /><i /><i /></span>
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      {hired && (
        <div className="pb-safe border-t border-line bg-base/90 backdrop-blur-md">
          <div className="mx-auto max-w-[800px] px-3 pb-3 pt-3 sm:px-6">
            {msgs.length < 4 && suggestions.length > 0 && (
              <div className="no-bar -mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1">
                {suggestions.map((c) => <button key={c} onClick={() => send(c)} className="chip !h-9 shrink-0 !text-[13px]">{c}</button>)}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 rounded-[26px] bg-card p-1.5 pl-2 ring-2 ring-line transition focus-within:ring-grape focus-within:shadow-[0_0_0_5px_var(--glow)]">
              <textarea ref={input} value={text} rows={1} onChange={(e) => { setText(e.target.value.slice(0, 1000)); grow(); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={`Message ${name}…`} aria-label={`Message ${name}`} className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink/50" />
              <button disabled={!text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grape text-white shadow-[0_4px_0_#3514b0] transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-35 disabled:shadow-none"><Icon name="send" size={19} stroke={2.4} /></button>
            </form>
            <p className="label mt-2 text-center text-[8.5px] text-ink/50"><span className="hidden sm:inline">Enter to send · Shift+Enter for a new line · </span>Demo replies</p>
          </div>
        </div>
      )}
    </section>
  );
}
