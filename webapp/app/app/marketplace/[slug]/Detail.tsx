"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { PALETTE } from "@shared/components/avatar";
import { SPECIALISTS, cannedReply, compact, specialistBySlug, storeMeta } from "@/content/appData";
import { release, sendTo, toast, useApp } from "@/lib/store";
import Face from "@shared/components/Face";
import Icon from "@/components/Icon";
import { AgentTile } from "@/components/faces";
import { Empty } from "@/components/ui";
import { hireWithFx } from "@/components/hireAction";
import { AppCard, HireBtn, ShelfRow, StarRow } from "@/components/market/parts";

const EXTRA_REVIEWS = [
  { who: "Kemi", seed: 311, stars: 5, text: "Set it up in a minute and it just got on with the work.", when: "2 weeks ago" },
  { who: "Jonas", seed: 312, stars: 4, text: "Really good. I wish it asked fewer questions up front, but the results are solid.", when: "1 month ago" },
];

export default function Detail({ slug }: { slug: string }) {
  const s = useApp()!;
  const router = useRouter();
  const a = specialistBySlug(slug);
  const face = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [helpful, setHelpful] = useState<string[]>([]);
  useEffect(() => {
    if (!bars.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.from(bars.current.querySelectorAll("[data-bar]"), { width: 0, duration: 1, stagger: 0.08, ease: "power3.out", delay: 0.2 });
    return () => { t.revert(); };
  }, [slug]);

  if (!a) return <Empty icon="search" title="That agent isn't on the marketplace." body="It may have been renamed. Head back to find someone else." cta={{ href: "/app/marketplace", label: "Back to marketplace" }} />;
  const m = storeMeta(a);
  const hired = s.hired.includes(a.slug);
  const col = PALETTE[a.color].fill;
  const similar = SPECIALISTS.filter((x) => x.slug !== a.slug && storeMeta(x).cat === m.cat).concat(SPECIALISTS.filter((x) => x.slug !== a.slug)).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 8);
  const tryJob = (ex: string) => {
    void (async () => {
      if (!hired) { const r = await hireWithFx(a.slug, face.current, () => router.push("/app/team")); if (r !== "ok") return; }
      sendTo(a.slug, ex); router.push(`/app?c=${a.slug}`);
    })();
  };
  const reviews = [...a.review.map((r, i) => ({ ...r, when: i ? "1 week ago" : "3 days ago" })), ...EXTRA_REVIEWS];
  const stats = [
    { top: <>{a.rating}<Icon name="star" size={14} className="text-brand-ink" /></>, sub: `${a.reviews} reviews` },
    { top: compact(m.hires), sub: "Hires" },
    { top: <span className="rounded-md border-2 border-ink/70 px-1.5 text-[14px] leading-tight">{m.age}</span>, sub: "Age rating" },
    { top: <Icon name="spark" size={18} />, sub: a.speed.replace("Usually done in ", "~") },
  ];
  const previews = a.examples.map((ex, i) => ({ caption: ["Ask in plain words", "Get it done while you work", "Straight back to your chat"][i] ?? "Try it", ex, reply: cannedReply({ id: a.slug, text: ex, n: i, agentName: a.name, you: "", tone: "short" }) }));

  return (
    <>
      <div data-rise className="flex items-center justify-between">
        <Link href="/app/marketplace" className="inline-flex items-center gap-2 rounded-full py-1 text-[14px] font-bold text-ink/75 hover:text-brand-ink"><Icon name="back" size={16} />Marketplace</Link>
      </div>

      {/* header */}
      <section data-rise className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div ref={face} className="shrink-0"><AgentTile id={a.slug} look={null} size={132} radius={36} face={110} className="shadow-[0_20px_40px_-20px_var(--glow)]" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="display text-[52px] leading-none text-ink sm:text-[68px]">{a.name}</h1>
          <p className="mt-2 text-[16px] font-semibold text-brand-ink">{m.maker}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-tint px-2.5 py-1 font-semibold text-ink">{m.cat}</span>
            <span className="rounded-full bg-tint px-2.5 py-1 font-semibold text-ink">{a.job}</span>
            {m.free && <span className="rounded-full bg-tint px-2.5 py-1 font-semibold text-brand-ink">Free to try</span>}
            {m.isNew && <span className="rounded-full bg-ink px-2.5 py-1 font-semibold text-[var(--bg)]">New</span>}
          </div>
          <dl className="mt-5 grid max-w-[560px] grid-cols-4 divide-x divide-[var(--line)]">
            {stats.map((x, i) => <div key={i} className="px-3 text-center first:pl-0"><dt className="sr-only">{x.sub}</dt><dd className="flex h-7 items-center justify-center gap-1 text-[18px] font-bold text-ink">{x.top}</dd><div className="mt-0.5 truncate text-[12px] text-ink/55">{x.sub}</div></div>)}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {hired ? (
              <>
                <Link href={`/app?c=${a.slug}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-grape px-7 text-[16px] font-bold text-white hover:bg-grape-deep">Chat with {a.name}<Icon name="arrow" size={17} /></Link>
                <button onClick={() => { release(a.slug); toast({ text: `${a.name} left the seat. It's open again.`, face: a.seed, color: a.color }); }} className="inline-flex h-12 items-center rounded-full px-5 text-[15px] font-bold text-ink ring-1 ring-line hover:ring-grape">Release seat</button>
              </>
            ) : <HireBtn a={a} size="lg" faceEl={() => face.current} />}
            <button onClick={() => { navigator.clipboard?.writeText(location.href).catch(() => {}); toast({ text: "Link copied" }); }} aria-label="Share" className="grid h-12 w-12 place-items-center rounded-full bg-tint text-ink hover:bg-grape hover:text-white"><Icon name="copy" size={18} /></button>
            <span className="text-[13px] text-ink/55">Takes one seat on your plan</span>
          </div>
        </div>
      </section>

      {/* previews */}
      <section data-rise className="mt-10">
        <h2 className="sr-only">Previews</h2>
        <div className="no-bar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8">
          {previews.map((p, i) => (
            <figure key={p.ex} className="flex w-[250px] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] p-4 text-white sm:w-[270px]" style={{ background: i % 2 ? `linear-gradient(160deg, #0a0a0a, #2a0f9a)` : `linear-gradient(160deg, #5b2bff, color-mix(in oklab, ${col} 45%, #1d0f5c))` }}>
              <figcaption className="display text-[24px] leading-[.95]">{p.caption}</figcaption>
              <div className="mt-4 flex flex-1 flex-col gap-2.5 rounded-[20px] bg-[#0d0a17] p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2"><AgentTile id={a.slug} look={null} size={24} radius={8} /><span className="text-[12px] font-bold">{a.name}</span><span className="ml-auto text-[10px] text-white/50">online</span></div>
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-grape px-3 py-2 text-[12px] leading-snug">{p.ex}</p>
                <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-[12px] leading-snug text-white/90">{p.reply}</p>
                <span className="typing mt-auto flex w-fit gap-1 rounded-full bg-white/10 px-3 py-2 text-lilac"><i /><i /><i /></span>
              </div>
            </figure>
          ))}
          <figure className="flex w-[250px] shrink-0 snap-start flex-col items-center justify-center overflow-hidden rounded-[28px] bg-tint p-4 text-center sm:w-[270px]">
            <div className="bob"><Face seed={a.seed} variant={{ color: a.color }} size={150} track /></div>
            <figcaption className="display mt-4 text-[24px] text-ink">&ldquo;{a.quip}&rdquo;</figcaption>
          </figure>
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <section data-rise>
            <h2 className="text-[22px] font-bold text-ink">About this agent</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink/80">{a.back} It works on its own computer, keeps notes in your team&apos;s brain and reports back in chat.</p>
            {more && <p className="mt-3 text-[16px] leading-relaxed text-ink/80">{a.name} is built by {m.maker}. Hire it into an open seat and it joins your team next to your personal agent. Mention it in a group chat or open a direct chat to give it work. You can release the seat at any time.</p>}
            <button onClick={() => setMore((x) => !x)} className="mt-2 text-[14px] font-bold text-brand-ink hover:underline">{more ? "Show less" : "Read more"}</button>
            <div className="mt-4 flex flex-wrap gap-1.5">{a.tools.map((t) => <span key={t} className="rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-semibold text-ink">{t}</span>)}</div>
          </section>

          <section data-rise className="mt-10">
            <h2 className="text-[22px] font-bold text-ink">What it can do</h2>
            <div ref={bars} className="mt-4 grid gap-3 sm:grid-cols-2">
              {a.skills.map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-card p-4 ring-1 ring-line">
                  <div className="flex justify-between text-[14px] font-semibold text-ink"><span>{k}</span><span className="tab-num text-brand-ink">{v}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint"><div data-bar className="h-full rounded-full bg-grape" style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
            <h3 className="label mt-6 text-[9.5px] text-ink/55">Try a first job</h3>
            <ul className="mt-2 grid gap-2">
              {a.examples.map((ex) => (
                <li key={ex}><button onClick={() => tryJob(ex)} className="group flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left ring-1 ring-line transition hover:ring-grape/60">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-brand-ink transition group-hover:bg-grape group-hover:text-white"><Icon name="chat" size={16} /></span>
                  <span className="flex-1 text-[15px] font-semibold leading-snug text-ink">{ex}</span>
                  <Icon name="arrow" size={16} className="text-ink/40 transition group-hover:translate-x-0.5 group-hover:text-brand-ink" />
                </button></li>
              ))}
            </ul>
          </section>

          <section data-rise className="mt-10">
            <h2 className="text-[22px] font-bold text-ink">Ratings & reviews</h2>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="shrink-0 text-center sm:w-36"><div className="display text-[64px] leading-none text-ink">{a.rating}</div><StarRow v={a.rating} size={15} /><div className="mt-1 text-[13px] text-ink/55">{a.reviews} reviews</div></div>
              <ul className="flex-1 space-y-1.5" aria-label="Rating breakdown">
                {m.dist.map((p, i) => <li key={i} className="flex items-center gap-3 text-[12.5px] text-ink/60"><span className="w-3 text-right">{5 - i}</span><span className="h-2.5 flex-1 overflow-hidden rounded-full bg-tint"><span className="block h-full rounded-full bg-grape" style={{ width: `${p}%` }} /></span><span className="tab-num w-9 text-right">{p}%</span></li>)}
              </ul>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.who} className="rounded-[22px] bg-card p-4 ring-1 ring-line">
                  <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-tint"><Face seed={r.seed} size={30} /></span><div><b className="block text-[14.5px] text-ink">{r.who}</b><span className="text-[12px] text-ink/50">{r.when}</span></div><span className="ml-auto"><StarRow v={r.stars} /></span></div>
                  <p className="mt-3 text-[14.5px] leading-snug text-ink/80">{r.text}</p>
                  <button onClick={() => setHelpful((h) => (h.includes(r.who) ? h.filter((x) => x !== r.who) : [...h, r.who]))} aria-pressed={helpful.includes(r.who)} className={`mt-3 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${helpful.includes(r.who) ? "bg-grape text-white" : "bg-tint text-ink/70 hover:text-ink"}`}>Helpful{helpful.includes(r.who) ? " ✓" : ""}</button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside data-rise className="h-fit rounded-[26px] bg-card p-5 ring-1 ring-line lg:sticky lg:top-6">
          <h2 className="text-[17px] font-bold text-ink">Listing info</h2>
          <dl className="mt-2 divide-y divide-[var(--line)] text-[14px]">
            {[["Maker", m.maker], ["Category", m.cat], ["Updated", m.updated], ["Version", m.version], ["Languages", m.languages], ["Age rating", m.age], ["Tools", a.tools.join(", ")], ["Seats", "1 seat"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-ink/55">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>)}
          </dl>
        </aside>
      </div>

      <ShelfRow title="Similar agents" sub={`More in ${m.cat} and beyond`}>{similar.map((x) => <AppCard key={x.slug} a={x} />)}</ShelfRow>
    </>
  );
}
