"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { CHAT_SUGGESTIONS, specialistBySlug } from "@/content/appData";
import { agentName, jobNo, sendChat, type State } from "@/lib/store";
import Icon from "../Icon";
import { WhoFace } from "../faces";

export default function Chat({ s }: { s: State }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const count = useRef(s.chat.length);
  const last = s.chat[s.chat.length - 1];
  const pending = last?.from === "you";

  useEffect(() => {
    const el = list.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: count.current === s.chat.length ? "auto" : "smooth" });
    if (s.chat.length > count.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const kids = el.querySelectorAll("[data-msg]"); const n = s.chat.length - count.current;
      gsap.from(Array.from(kids).slice(-n), { y: 18, opacity: 0, scale: 0.96, duration: 0.45, ease: "back.out(1.7)", stagger: 0.05, clearProps: "all" });
    }
    count.current = s.chat.length;
  }, [s.chat.length]);

  const send = (t = text) => { const v = t.trim(); if (!v) return; sendChat(v); setText(""); input.current?.focus(); };
  const mention = (slug: string) => { setText((v) => `@${slug} ${v.replace(/^@\w+\s*/, "")}`); input.current?.focus(); };

  return (
    <div className="panel flex h-[520px] flex-col overflow-hidden sm:h-[560px] lg:h-full lg:min-h-[560px]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div><h2 className="display text-[26px] leading-none text-ink">Give {agentName(s)} a job</h2><p className="mt-1 text-[13px] text-ink/65">Plain words. Mention a hired specialist with @.</p></div>
        <span className="label hidden items-center gap-1.5 rounded-full bg-tint px-2.5 py-1.5 text-[9px] text-ink sm:flex"><i className="live-dot h-1.5 w-1.5 rounded-full bg-grape" />online</span>
      </div>
      <div ref={list} className="no-bar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {s.chat.map((m) => {
          if (m.from === "you") return (
            <div key={m.id} data-msg className="flex justify-end"><p className="max-w-[82%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-grape px-4 py-2.5 text-[15px] font-semibold leading-snug text-white">{m.text}</p></div>
          );
          const sp = m.from !== "home" ? specialistBySlug(m.from) : undefined;
          return (
            <div key={m.id} data-msg className="flex items-end gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tint"><WhoFace who={m.from} look={s.agent?.look} size={30} /></span>
              <div className="max-w-[82%]">
                <span className="label mb-1 block text-[9px] text-ink/60">{sp ? `${sp.name} · ${sp.job}` : agentName(s)}</span>
                <p className="rounded-[20px] rounded-bl-md bg-alt px-4 py-2.5 text-[15px] leading-snug text-ink ring-1 ring-line">{m.text}</p>
                {m.jobId && <Link href={`/app/jobs?open=${m.jobId}`} className="label mt-1.5 inline-flex items-center gap-1 text-[9px] text-brand-ink hover:underline">job {jobNo(m.jobId)} <Icon name="arrow" size={11} /></Link>}
              </div>
            </div>
          );
        })}
        {pending && (
          <div className="flex items-end gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-tint"><WhoFace who="home" look={s.agent?.look} size={30} /></span><span className="typing flex gap-1 rounded-[20px] rounded-bl-md bg-alt px-4 py-3.5 text-brand-ink ring-1 ring-line"><i /><i /><i /></span></div>
        )}
      </div>
      <div className="border-t border-line p-3">
        <div className="no-bar mb-2.5 flex gap-2 overflow-x-auto">
          {s.hired.map((h) => { const sp = specialistBySlug(h)!; return <button key={h} onClick={() => mention(h)} className="chip !h-9 shrink-0 !pl-1.5 !text-[13px]"><span className="grid h-6 w-6 place-items-center rounded-full bg-card"><WhoFace who={h} look={null} size={20} /></span>@{sp.slug}</button>; })}
          {s.chat.length < 3 && CHAT_SUGGESTIONS.slice(0, 3).map((c) => <button key={c} onClick={() => send(c)} className="chip !h-9 shrink-0 !text-[13px]">{c}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 rounded-[22px] bg-alt p-1.5 ring-2 ring-line transition focus-within:ring-grape">
          <textarea ref={input} value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={`Ask ${agentName(s)} to do something…`} aria-label="Message your agent" className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink/50" />
          <button disabled={!text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grape text-white shadow-[0_4px_0_#3514b0] transition hover:-translate-y-0.5 disabled:opacity-35 disabled:shadow-none"><Icon name="send" size={19} stroke={2.4} /></button>
        </form>
      </div>
    </div>
  );
}
