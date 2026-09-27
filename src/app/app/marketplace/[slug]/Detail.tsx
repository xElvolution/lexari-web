"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SPECIALISTS, specialistBySlug } from "@/content/appData";
import { release, sendChat, toast, useApp } from "@/lib/store";
import Face from "@/components/Face";
import Icon from "@/components/app/Icon";
import { SpecFace } from "@/components/app/faces";
import { DemoTag, Empty, Stars } from "@/components/app/ui";
import { hireWithFx } from "@/components/app/hireAction";

export default function Detail({ slug }: { slug: string }) {
  const s = useApp()!;
  const router = useRouter();
  const a = specialistBySlug(slug);
  const face = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!bars.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.from(bars.current.querySelectorAll("[data-bar]"), { width: 0, duration: 1.1, stagger: 0.1, ease: "power3.out", delay: 0.3 });
    const n = gsap.from(bars.current.querySelectorAll("[data-num]"), { textContent: 0, duration: 1.1, stagger: 0.1, delay: 0.3, snap: { textContent: 1 }, ease: "power3.out" });
    return () => { t.revert(); n.revert(); };
  }, [slug]);

  if (!a) return <Empty icon="search" title="That agent isn't on the roster." body="It may have been renamed. Head back to the marketplace to find someone else." cta={{ href: "/app/marketplace", label: "Back to marketplace" }} />;
  const seat = s.hired.indexOf(a.slug);
  const hired = seat >= 0;
  const similar = SPECIALISTS.filter((x) => x.slug !== a.slug && (x.cat === a.cat || x.words.some((w) => a.words.includes(w)))).concat(SPECIALISTS.filter((x) => x.slug !== a.slug)).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 3);
  const tryJob = (ex: string) => {
    if (!hired) { const r = hireWithFx(a.slug, face.current, () => router.push("/app/team")); if (r !== "ok") return; }
    sendChat(`@${a.slug} ${ex}`); router.push("/app");
  };

  return (
    <>
      <div data-rise className="flex items-center justify-between">
        <Link href="/app/marketplace" className="inline-flex items-center gap-2 rounded-full px-1 py-1 text-[14px] font-bold text-ink/75 hover:text-brand-ink"><Icon name="back" size={16} />Marketplace</Link>
        <DemoTag />
      </div>

      <section data-rise className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="carpet relative grid min-h-[320px] place-items-center overflow-hidden rounded-[32px] bg-tint ring-1 ring-line sm:min-h-[400px]">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--glow)] blur-[80px]" />
          <div ref={face} className="bob relative"><Face seed={a.seed} variant={{ color: a.color }} size={230} track /></div>
          <span className="display absolute left-6 top-4 text-[40px] text-ink/25">#{String(SPECIALISTS.indexOf(a) + 1).padStart(2, "0")}</span>
          <span className="label absolute right-5 top-5 rounded-full bg-ink px-2.5 py-1.5 text-[10px] text-[var(--bg)]">{a.cat}</span>
          {hired && <span className="label pop absolute bottom-5 left-5 rounded-full bg-grape px-3 py-1.5 text-[10px] text-white">In seat {String(seat + 2).padStart(2, "0")}</span>}
        </div>
        <div className="panel flex flex-col p-6 sm:p-8">
          <span className="label text-brand-ink">{a.job}</span>
          <h1 className="display mt-2 text-[64px] text-ink sm:text-[92px]">{a.name}</h1>
          <p className="mt-2 w-fit max-w-full rounded-2xl rounded-tl-sm border border-line bg-alt px-4 py-3 text-[17px] font-semibold text-ink">&ldquo;{a.quip}&rdquo;</p>
          <p className="mt-4 text-[17px] leading-relaxed text-ink/80">{a.back}</p>
          <dl className="mt-6 grid grid-cols-3 border-y-2 border-line py-4">
            <div><dt className="label text-[9.5px] text-ink/60">Rating</dt><dd className="display mt-1 text-[34px] text-ink">{a.rating}</dd><Stars value={a.rating} /></div>
            <div className="border-l-2 border-line pl-4"><dt className="label text-[9.5px] text-ink/60">Jobs done</dt><dd className="display mt-1 text-[34px] text-ink">{a.jobs.toLocaleString("en-US")}</dd><span className="text-[12px] text-ink/65">{a.reviews} reviews</span></div>
            <div className="border-l-2 border-line pl-4"><dt className="label text-[9.5px] text-ink/60">Speed</dt><dd className="mt-2 text-[15px] font-bold leading-tight text-ink">{a.speed}</dd></div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-auto lg:pt-6">
            {hired ? (
              <>
                <button onClick={() => tryJob(a.examples[0])} className="btn btn-brand flex-1">Give {a.name} a job <Icon name="arrow" size={18} /></button>
                <button onClick={() => { release(a.slug); toast({ text: `${a.name} left the seat. It's open again.`, face: a.seed, color: a.color }); }} className="btn btn-line text-ink">Release seat</button>
              </>
            ) : (
              <button onClick={() => hireWithFx(a.slug, face.current, () => router.push("/app/team"))} className="btn btn-brand flex-1 !h-16 !text-[18px]">Hire into a seat <Icon name="plus" size={20} /></button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        <div data-rise className="panel p-6">
          <h2 className="display text-[30px] text-ink">Skills</h2>
          <ul ref={bars} className="mt-4 grid gap-4">
            {a.skills.map(([k, v]) => (
              <li key={k}><div className="flex justify-between text-[14px] font-semibold text-ink"><span>{k}</span><span className="tab-num text-brand-ink" data-num>{v}</span></div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-tint"><div data-bar className="h-full rounded-full bg-grape" style={{ width: `${v}%` }} /></div></li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-1.5">{a.tools.map((t) => <span key={t} className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-[var(--bg)]">{t}</span>)}</div>
        </div>
        <div data-rise className="panel p-6">
          <h2 className="display text-[30px] text-ink">Good first jobs</h2>
          <ul className="mt-4 grid gap-2.5">
            {a.examples.map((ex) => (
              <li key={ex}><button onClick={() => tryJob(ex)} className="group flex w-full items-center gap-3 rounded-2xl bg-alt p-3.5 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-grape/60">
                <span className="flex-1 text-[15px] font-semibold leading-snug text-ink">{ex}</span>
                <span className="label shrink-0 rounded-full bg-tint px-2 py-1 text-[9px] text-ink transition group-hover:bg-grape group-hover:text-white">try it</span>
              </button></li>
            ))}
          </ul>
        </div>
        <div data-rise className="panel p-6">
          <div className="flex items-baseline justify-between"><h2 className="display text-[30px] text-ink">Reviews</h2><span className="text-[13px] text-ink/65">{a.reviews} total</span></div>
          <ul className="mt-4 grid gap-3">
            {a.review.map((r) => (
              <li key={r.who} className="rounded-2xl bg-alt p-4 ring-1 ring-line">
                <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-tint"><Face seed={r.seed} size={30} /></span><b className="text-ink">{r.who}</b><Stars value={r.stars} className="ml-auto" /></div>
                <p className="mt-2.5 text-[15px] leading-snug text-ink/85">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section data-rise className="mt-10">
        <h2 className="display text-[34px] text-ink">Works well with</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {similar.map((x) => (
            <Link key={x.slug} href={`/app/marketplace/${x.slug}`} className="group flex items-center gap-4 rounded-[22px] bg-card p-3 ring-1 ring-line transition hover:-translate-y-1 hover:ring-grape/50">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-tint transition group-hover:rotate-[-4deg]"><SpecFace slug={x.slug} size={54} /></span>
              <span className="min-w-0 flex-1"><span className="display block text-[26px] leading-none text-ink">{x.name}</span><span className="text-[13px] text-ink/70">{x.job}</span></span>
              <Icon name="arrow" size={18} className="mr-2 text-ink/50 transition group-hover:translate-x-1 group-hover:text-brand-ink" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
