"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import SectionIntro from "./SectionIntro";
import Face from "./Face";

const D = copy.desk;

function Typed({ lines, active }: { lines: string[]; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    setN(0);
    const total = lines.join("").length;
    const id = setInterval(() => setN((v) => (v >= total ? v : v + 2)), 28);
    return () => clearInterval(id);
  }, [active, lines]);
  let left = n;
  return (
    <div className="font-mono text-[11px] leading-[1.9] sm:text-[13px]">
      {lines.map((l, i) => {
        const s = l.slice(0, Math.max(0, left)); left -= l.length;
        if (!s) return null;
        return <div key={i} className={l.startsWith("$") ? "text-white" : "text-lilac"}>{s}</div>;
      })}
      <span className="caret" />
    </div>
  );
}

function Screen({ kind, active }: { kind: string; active: boolean }) {
  const base = `absolute inset-0 p-4 transition-all duration-500 sm:p-6 ${active ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4"}`;
  if (kind === "brief") return (
    <div className={base}>
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-grape p-3 text-[13px] font-semibold text-white sm:text-[15px]">Compare three budgeting tools. Keep it to one page.</div>
      <div className="mt-3 flex items-end gap-2"><Face size={40} /><div className="max-w-[75%] rounded-2xl rounded-bl-md bg-white/10 p-3 text-[13px] text-white sm:text-[15px]">On it. Opening my browser now.</div></div>
      <div className="label mt-4 text-[9px] text-white/40">job received · 09:00</div>
    </div>
  );
  if (kind === "browser") return (
    <div className={base}>
      <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-mono text-[10px] text-white/70 sm:text-[12px]"><span className="h-2 w-2 rounded-full bg-lilac" />pricing.budgetapp.example</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["Basic", "Plus", "Team"].map((p, i) => (
          <div key={p} className={`rounded-xl p-2.5 sm:p-3 ${i === 1 ? "bg-grape" : "bg-white/8 ring-1 ring-white/10"}`}>
            <div className="text-[11px] font-bold text-white sm:text-[13px]">{p}</div>
            <div className="display mt-1 text-[18px] text-white sm:text-[24px]">${[0, 6, 12][i]}</div>
            {[0, 1, 2].map((k) => <div key={k} className="mt-1.5 h-1.5 rounded-full bg-white/20" style={{ width: `${90 - k * 18}%` }} />)}
          </div>
        ))}
      </div>
      <div className={`label mt-3 w-fit rounded-full bg-white px-2.5 py-1 text-[9px] text-[#0a0a0a] ${active ? "pop" : ""}`}>reading table 2 of 3</div>
    </div>
  );
  if (kind === "terminal") return <div className={base}><Typed lines={D.terminal} active={active} /></div>;
  return (
    <div className={base}>
      <div className="label text-[9px] text-white/50">~/output</div>
      <div className="mt-3 grid gap-2">
        {D.files.map((f, i) => (
          <div key={f.name} className={`flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10 ${active ? "pop" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
            <span className="grid h-8 w-7 place-items-center rounded-md bg-grape text-[9px] font-bold text-white">{f.name.split(".")[1]}</span>
            <span className="flex-1 font-mono text-[11px] text-white sm:text-[13px]">{f.name}</span>
            <span className="text-[11px] text-white/50">{f.size}</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white" aria-hidden>↓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Desk() {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.i)); }), { rootMargin: "-48% 0px -48% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <section id="desk" className="relative scroll-mt-16 bg-base pb-28 pt-28 sm:pb-36 sm:pt-40">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <SectionIntro label={D.label} title={D.title} body={D.body} why={D.why} />

        <div className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
          {/* the computer: sticky while the shift scrolls past */}
          <div className="sticky top-[76px] z-10 self-start lg:order-2 lg:top-28">
            <div className="rounded-[26px] bg-frame p-2.5 shadow-[0_24px_0_-10px_var(--tint),0_40px_80px_-30px_var(--glow)] ring-1 ring-line sm:rounded-[34px] sm:p-3.5">
              <div className="flex items-center justify-between px-2 pb-2 pt-1 sm:px-3 sm:pb-3">
                <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-grape" /><i className="h-2.5 w-2.5 rounded-full bg-lilac" /><i className="h-2.5 w-2.5 rounded-full bg-white/60" /></span>
                <span className="label text-[9px] text-white/55">agent computer · online</span>
                <span className="label text-[9px] text-lilac">{D.shift[step].time}</span>
              </div>
              <div className="relative h-[210px] overflow-hidden rounded-[18px] bg-[#07050e] sm:h-[330px] sm:rounded-[24px]">
                {D.shift.map((s, i) => <Screen key={s.screen} kind={s.screen} active={i === step} />)}
              </div>
            </div>
            <div className="mx-auto h-5 w-24 bg-frame sm:h-7" /><div className="mx-auto h-2.5 w-44 rounded-full bg-frame" />
          </div>

          <div className="lg:order-1">
            <p className="label text-brand-ink">{D.shiftTitle}</p>
            <ol className="mt-4">
              {D.shift.map((s, i) => (
                <li key={s.time} ref={(el) => { refs.current[i] = el; }} data-i={i} className="flex min-h-[34vh] gap-4 border-l-4 py-6 pl-5 transition-colors duration-500 sm:gap-6 lg:min-h-[40vh]" style={{ borderColor: i <= step ? "var(--brand-ink)" : "var(--tint)" }}>
                  <span className={`display text-[28px] transition-colors duration-500 sm:text-[40px] ${i === step ? "text-brand-ink" : "text-ink/25"}`}>{s.time}</span>
                  <div className={`transition-opacity duration-500 ${i === step ? "opacity-100" : "opacity-45"}`}>
                    <h3 className="display text-[30px] text-ink sm:text-[44px]">{s.head}</h3>
                    <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink/75 sm:text-[18px]">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
