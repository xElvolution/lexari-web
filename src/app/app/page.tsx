"use client";

import Link from "next/link";
import { SPECIALISTS } from "@/content/appData";
import { planOf, seatsLeft, useApp, useTyping, type State } from "@/lib/store";
import Icon from "@/components/app/Icon";
import { SpecFace, WhoFace } from "@/components/app/faces";
import { myAgents, type MyAgent } from "@/components/app/agents";

function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

function AgentCard({ a, s }: { a: MyAgent; s: State }) {
  const home = a.id === "home";
  const typing = useTyping(a.id);
  const preview = typing ? "typing…" : a.last ? `${a.last.from === "you" ? "You: " : ""}${a.last.text}` : `Say hi to ${a.name}`;
  return (
    <Link href={`/app/chat/${a.id}`} data-rise className={`group relative flex flex-col overflow-hidden rounded-[30px] ring-1 transition duration-300 [transition-timing-function:cubic-bezier(.3,1.5,.5,1)] hover:-translate-y-1.5 ${home ? "bg-card shadow-[0_8px_0_#3514b0] ring-grape/40 hover:shadow-[0_12px_0_#3514b0]" : "bg-card shadow-[0_8px_0_var(--tint)] ring-line hover:shadow-[0_12px_0_var(--color-grape)] hover:ring-grape/40"}`}>
      <div className={`relative grid h-[200px] place-items-center overflow-hidden ${home ? "grain carpet-w bg-grape" : "carpet bg-tint"}`}>
        <span className="relative transition duration-500 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] group-hover:-rotate-3 group-hover:scale-110"><WhoFace who={a.id} look={s.agent?.look} size={140} /></span>
        <span className={`label absolute left-4 top-4 rounded-full px-2.5 py-1 text-[9px] ${home ? "bg-white text-[#0a0a0a]" : "bg-ink text-[var(--bg)]"}`}>Seat {String(a.seat).padStart(2, "0")}{home ? " · yours" : ""}</span>
        <span className={`label absolute right-4 top-4 flex items-center gap-1.5 text-[9px] ${home ? "text-white/85" : "text-ink/65"}`}><i className={`h-1.5 w-1.5 rounded-full ${home ? "bg-white" : "bg-grape"} ${typing ? "live-dot" : ""}`} />online</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="display truncate text-[40px] text-ink">{a.name}</h2>
        <p className="mt-1 text-[15px] font-semibold text-brand-ink">{a.role}</p>
        <p className={`mt-3 line-clamp-2 min-h-[2.6em] text-[14.5px] leading-snug ${typing ? "font-semibold text-brand-ink" : "text-ink/70"}`}>{preview}</p>
        <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-line pt-4">
          <span className="text-[13px] font-semibold text-ink/65">{(() => { const n = (s.threads[a.id] || []).length; return n ? `${n} message${n === 1 ? "" : "s"}` : "No messages yet"; })()}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-grape px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_3px_0_#3514b0] transition group-hover:gap-2.5">Chat <Icon name="arrow" size={15} /></span>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const s = useApp()!;
  const agents = myAgents(s);
  const left = seatsLeft(s);
  const bench = SPECIALISTS.filter((x) => !s.hired.includes(x.slug)).slice(0, 4);

  return (
    <>
      <div data-rise className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="label text-brand-ink" suppressHydrationWarning>{greeting()}{s.agent?.you ? `, ${s.agent.you}` : ""}</span>
          <h1 className="display mt-3 text-[48px] text-ink sm:text-[72px]">Your agents.</h1>
          <p className="mt-3 max-w-[36rem] text-[16px] leading-relaxed text-ink/75 sm:text-[17px]">Tap an agent to chat. Your own agent sits in seat 01. Hire specialists into the other seats when the work grows.</p>
        </div>
        <Link href="/app/marketplace" className="btn btn-brand shrink-0 self-start sm:self-end"><Icon name="plus" size={18} />Hire more</Link>
      </div>

      <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => <AgentCard key={a.id} a={a} s={s} />)}
        <Link href={left > 0 ? "/app/marketplace" : "/app/team"} data-rise className="group flex min-h-[380px] flex-col items-center justify-center rounded-[30px] border-2 border-dashed border-ink/25 p-6 text-center transition hover:border-grape hover:bg-tint/60">
          <div className="flex -space-x-4">
            {bench.map((b, i) => <span key={b.slug} className="grid h-16 w-16 place-items-center rounded-2xl bg-tint ring-4 ring-base transition duration-500 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] group-hover:-translate-y-2" style={{ transitionDelay: `${i * 50}ms`, rotate: `${(i - 1.5) * 6}deg` }}><SpecFace slug={b.slug} size={50} /></span>)}
          </div>
          <h2 className="display mt-6 text-[40px] text-ink">Hire more</h2>
          <p className="mt-2 max-w-[16rem] text-[15px] text-ink/70">{left > 0 ? `${left} open seat${left > 1 ? "s" : ""} on ${planOf(s).name}. Pick a specialist from the marketplace.` : "Every seat is taken. Move up a plan for more seats."}</p>
          <span className="btn btn-ghost btn-sm mt-6 group-hover:bg-grape group-hover:text-white">{left > 0 ? "Open the marketplace" : "See plans"} <Icon name="arrow" size={16} /></span>
        </Link>
      </div>
    </>
  );
}
