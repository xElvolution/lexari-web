"use client";

import { useEffect, useState } from "react";
import { SPECIALISTS } from "@/content/appData";
import { CHECKIN_COINS, LEASE_COST, TASK_COINS, agentName, claimCheckIn, claimTask, leaseAgent, seatsLeft, todayKey, toast, useApp, useNow, type AgentLook, type State } from "@/lib/store";
import Icon from "@/components/Icon";
import { AgentFace, SpecFace } from "@/components/faces";
import { PageHead } from "@/components/ui";

const WEIGHT = { memory: 35, jobs: 30, messages: 15, days: 10, streak: 10 };
const CAP = { memory: 8, jobs: 3, messages: 6, days: 14, streak: 7 };

function fill(n: number, cap: number, weight: number) {
  return Math.min(1, Math.max(0, n) / cap) * weight;
}

function bondWord(score: number) {
  if (score >= 88) return "Inseparable";
  if (score >= 70) return "Trusted";
  if (score >= 45) return "Close";
  if (score >= 18) return "Familiar";
  return "Just met";
}

function shiftKey(now: number, delta: number) {
  const d = new Date(now);
  d.setDate(d.getDate() + delta);
  return todayKey(d.getTime());
}

function streakOf(days: string[], now: number) {
  const have = new Set(days);
  let start = 0;
  if (!have.has(todayKey(now))) {
    if (!have.has(shiftKey(now, -1))) return 0;
    start = -1;
  }
  let n = 0;
  for (let i = start; have.has(shiftKey(now, i)); i--) n += 1;
  return n;
}

function joinAnd(bits: string[]) {
  if (bits.length <= 1) return bits[0] || "";
  if (bits.length === 2) return `${bits[0]} and ${bits[1]}`;
  return `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
}

function story(name: string, word: string, mem: number, jobs: number, msgs: number, days: number) {
  const bits = [
    mem ? `${mem} ${mem === 1 ? "memory" : "memories"} kept` : "",
    jobs ? `${jobs} ${jobs === 1 ? "job" : "jobs"} finished` : "",
    msgs ? `${msgs} ${msgs === 1 ? "message" : "messages"}` : "",
  ].filter(Boolean);
  const head = bits.length ? `${name} is ${word} from ${joinAnd(bits)}.` : `${name} is ${word}. Nothing shared yet.`;
  const time = days <= 0 ? "You met today." : days === 1 ? "One day together." : `${days} days together.`;
  return `${head} ${time}`;
}

function inviteCode(s: State) {
  const raw = (s.profile?.username || s.agent?.you || "you").replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase();
  return `LEX-${raw || "YOU"}`;
}

function Ring({ score, name, look }: { score: number; name: string; look: AgentLook | undefined }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
    if (reduce) { setShown(score); return; }
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const r = 86;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[220px] w-[220px] shrink-0" role="img" aria-label={`${name}, ${bondWord(score)}, ${score} of 100`}>
      <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="12" />
        <circle cx="110" cy="110" r={r} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-[132px] w-[132px] place-items-center rounded-[32px] bg-[#0a0a0a]">
          <AgentFace look={look} size={108} track />
        </div>
      </div>
    </div>
  );
}

export default function Bond() {
  const s = useApp()!;
  const tick = useNow(60_000);
  const now = tick || Date.now();
  const name = agentName(s);
  const daysIn = s.bond?.days || [];
  const coins = s.bond?.coins || 0;
  const claimed = new Set(s.bond?.claimed || []);
  const memories = s.memory.length;
  const doneJobs = s.jobs.filter((j) => j.status === "done");
  const messages = (s.threads.home || s.chat || []).length;
  const born = s.born.home || s.profile?.since || now;
  const days = Math.max(0, Math.floor((now - born) / 864e5));
  const streak = streakOf(daysIn, now);
  const score = Math.round(
    fill(memories, CAP.memory, WEIGHT.memory) +
    fill(doneJobs.filter((j) => j.assignee === "home").length, CAP.jobs, WEIGHT.jobs) +
    fill(messages, CAP.messages, WEIGHT.messages) +
    fill(days, CAP.days, WEIGHT.days) +
    fill(streak, CAP.streak, WEIGHT.streak),
  );
  const word = bondWord(score);
  const showedUp = daysIn.includes(todayKey(now));
  const code = inviteCode(s);
  const seats = seatsLeft(s);
  const open = SPECIALISTS.filter((sp) => !s.hired.includes(sp.slug));

  const checkIn = () => {
    if (!claimCheckIn(now)) { toast({ text: "Already checked in today.", face: "home" }); return; }
    toast({ text: `+${CHECKIN_COINS} coins`, face: "home" });
  };
  const collect = (id: number) => {
    if (!claimTask(id)) return;
    toast({ text: `+${TASK_COINS} coins`, face: "home" });
  };
  const lease = (slug: string, who: string) => {
    const r = leaseAgent(slug);
    if (r === "ok") toast({ text: `${who} is leased to your team.`, face: "home" });
    else if (r === "short") toast({ text: `Leasing costs ${LEASE_COST} coins.`, face: "home" });
    else if (r === "full") toast({ text: "No open seat on this plan.", face: "home" });
    else toast({ text: `${who} is already on the team.`, face: "home" });
  };
  const copyCode = () => {
    const done = () => toast({ text: "Invite code copied", face: "home" });
    const fail = () => toast({ text: "Couldn't copy", face: "home" });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, fail);
    else fail();
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  return (
    <>
      <PageHead kicker="Bond" title={`You and ${name}.`} body="Check in and finished work pay coins. Spend them to lease an agent onto your team." />

      <section data-rise className="grain relative mt-7 overflow-hidden rounded-[30px] bg-grape p-6 text-white sm:p-8">
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
          <Ring score={score} name={name} look={s.agent?.look} />
          <div className="min-w-0 text-center sm:text-left">
            <p className="label text-white/80">{score} of 100</p>
            <h2 className="display mt-2 text-[72px] leading-none sm:text-[92px]">{word}</h2>
            <p className="mx-auto mt-4 max-w-[38rem] text-[16px] leading-relaxed text-white/90 sm:mx-0 sm:text-[17px]">{story(name, word, memories, doneJobs.filter((j) => j.assignee === "home").length, messages, days)}</p>
          </div>
        </div>
        <dl className="relative mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/25 pt-6 sm:grid-cols-4">
          <Fact value={String(coins)} label="coins" />
          <Fact value={String(doneJobs.length)} label="tasks done" />
          <Fact value={days <= 0 ? "Today" : String(days)} label={days <= 0 ? "you met" : days === 1 ? "day together" : "days together"} />
          <Fact value={String(streak)} label="day streak" />
        </dl>
      </section>

      <section data-rise className="mt-8 grid items-start gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-[30px] bg-card p-6 ring-1 ring-line sm:p-7">
          <h2 className="display text-[40px] leading-none text-ink">Check in</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/70">Once a day. It pays {CHECKIN_COINS} coins. Nothing to type.</p>
          {showedUp ? <p className="mt-5 flex items-center gap-2 text-[15px] font-bold text-brand-ink"><Icon name="check" size={16} />Checked in · +{CHECKIN_COINS}</p>
            : <button type="button" onClick={checkIn} className="btn btn-brand btn-sm mt-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape">Check in · +{CHECKIN_COINS}</button>}
          <h3 className="mt-7 text-[16px] font-bold text-ink">This week</h3>
          <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label="The last seven days">
            {week.map((d) => {
              const key = todayKey(d.getTime());
              const on = daysIn.includes(key);
              const isToday = key === todayKey(now);
              return (
                <li key={key} aria-current={isToday ? "date" : undefined} aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${on ? ", checked in" : ""}`} className={`grid justify-items-center gap-1 rounded-2xl py-2 ${on ? "bg-grape text-white" : "bg-tint text-ink"} ${isToday && !on ? "ring-2 ring-grape" : ""}`}>
                  <span className={`text-[10px] font-bold ${on ? "text-white/80" : "text-ink/50"}`}>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                  <span className="text-[15px] font-bold leading-none">{d.getDate()}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[13px] text-ink/55">Coins stay on this device.</p>
        </div>

        <div className="rounded-[30px] bg-card p-6 ring-1 ring-line sm:p-7">
          <h2 className="display text-[40px] leading-none text-ink">Tasks</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/70">Each finished job pays {TASK_COINS} coins. Collect it once.</p>
          {doneJobs.length ? (
            <ul className="mt-4">
              {doneJobs.map((j) => {
                const got = claimed.has(`job-${j.id}`);
                return (
                  <li key={j.id} className="flex items-center gap-3 border-b border-line py-3">
                    <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{j.title}</span>
                    {got ? <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-brand-ink"><Icon name="check" size={14} />{TASK_COINS}</span>
                      : <button type="button" onClick={() => collect(j.id)} className="shrink-0 rounded-full bg-grape px-3.5 py-2 text-[13px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape">+{TASK_COINS}</button>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-4 text-[15px] text-ink/70">No finished job yet. When one ends, it shows up here to collect.</p>}
        </div>
      </section>

      <section data-rise className="mt-8 rounded-[30px] bg-card p-6 ring-1 ring-line sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-[40px] leading-none text-ink">Lease</h2>
          <p className="text-[14px] font-semibold text-ink/65">{LEASE_COST} coins · {seats} {seats === 1 ? "seat" : "seats"} open</p>
        </div>
        <ul className="mt-4">
          {open.slice(0, 6).map((sp) => {
            const short = coins < LEASE_COST;
            const blocked = seats <= 0;
            return (
              <li key={sp.slug} className="flex items-center gap-3 border-b border-line py-3">
                <SpecFace slug={sp.slug} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold text-ink">{sp.name}</span>
                  <span className="block truncate text-[13px] text-ink/60">{sp.job}</span>
                </span>
                <button type="button" onClick={() => lease(sp.slug, sp.name)} disabled={short || blocked} className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-[13px] font-bold text-[var(--bg)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape">
                  {blocked ? "No seat" : short ? `${LEASE_COST} coins` : "Lease"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section data-rise className="mt-10 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display text-[32px] text-ink">{code}</h2>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink/65">Invites are not counted yet. The code is yours to copy. Nothing is tracked.</p>
        </div>
        <button type="button" onClick={copyCode} className="btn btn-line h-11 shrink-0 px-5 text-[15px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape"><Icon name="copy" size={16} />Copy code</button>
      </section>
    </>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="display text-[36px] leading-none sm:text-[42px]">{value}</dd>
      <dt className="mt-1.5 text-[13px] text-white/80">{label}</dt>
    </div>
  );
}
