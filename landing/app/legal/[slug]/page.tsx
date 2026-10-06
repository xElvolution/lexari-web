import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@shared/components/Logo";
import ThemeToggle from "@shared/components/ThemeToggle";
import { DOCS, LEGAL_CONTACT, LEGAL_UPDATED, type Block, type Doc } from "@/content/legal";

type Slug = keyof typeof DOCS;
const isSlug = (s: string): s is Slug => s in DOCS;

export function generateStaticParams() { return Object.keys(DOCS).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return { title: "Lexari · Legal" };
  const d = DOCS[slug];
  return { title: `Lexari · ${d.title}`, description: d.intro, alternates: { canonical: `/legal/${slug}` } };
}

function Body({ b }: { b: Block }) {
  if ("p" in b) return <p className="mt-4 text-[15px] leading-[1.7] text-ink/80 sm:text-[16.5px]">{b.p}</p>;
  if ("list" in b) {
    return (
      <ul className="mt-4 space-y-2.5">
        {b.list.map((item) => {
          const dot = item.indexOf(". ");
          const lead = dot > 0 && dot < 40 && /^[A-Z]/.test(item) && !item.slice(0, dot).includes(",") ? item.slice(0, dot) : "";
          return (
            <li key={item} className="relative pl-5 text-[15px] leading-[1.65] text-ink/80 sm:text-[16.5px]">
              <span aria-hidden className="absolute left-0 top-[0.62em] h-2 w-2 rounded-full bg-grape" />
              {lead ? <><strong className="font-semibold text-ink">{lead}.</strong>{item.slice(dot + 1)}</> : item}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-line">
      {/* phones: one card per processor; wider screens: a three column table */}
      <div className="hidden grid-cols-[1fr_1.5fr_1.6fr] gap-4 bg-tint px-4 py-2.5 sm:grid">
        <span className="label text-ink/60">Service</span><span className="label text-ink/60">What it does</span><span className="label text-ink/60">Data involved</span>
      </div>
      <dl className="divide-y divide-[var(--line)]">
        {b.rows.map((r) => (
          <div key={r.name} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[1fr_1.5fr_1.6fr] sm:gap-4">
            <dt className="text-[15px] font-bold text-ink">{r.name}</dt>
            <dd className="text-[14px] leading-snug text-ink/80">{r.role}</dd>
            <dd className="text-[13.5px] leading-snug text-ink/60"><span className="label mr-1.5 text-[9.5px] text-brand-ink sm:hidden">Data</span>{r.data}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Contents({ d }: { d: Doc }) {
  return (
    <ol className="space-y-1">
      {d.sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="group flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-[14px] text-ink/70 transition hover:bg-tint hover:text-ink">
            <span className="label w-5 shrink-0 text-[10px] text-ink/40 group-hover:text-brand-ink">{String(i + 1).padStart(2, "0")}</span>{s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const d = DOCS[slug];
  const other = slug === "privacy" ? DOCS.terms : DOCS.privacy;
  return (
    <main className="min-h-[100svh] bg-base text-ink">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-base/85 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between px-5 sm:h-[72px]">
          <Link href="/" aria-label="Lexari home"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link href={`/legal/${other.slug}`} className="hidden h-10 items-center rounded-full px-4 text-[14px] font-semibold text-ink/75 transition hover:bg-tint hover:text-ink sm:inline-flex">{other.title}</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-5 pb-24">
        <section className="relative pt-10 sm:pt-16">
          <span className="label text-brand-ink">{d.eyebrow}</span>
          <h1 className="display mt-3 text-[44px] sm:text-[84px]">{d.title}</h1>
          <p className="label mt-4 text-[10px] text-ink/50">Last updated {LEGAL_UPDATED}</p>
          <p className="mt-5 max-w-[44rem] text-[16px] leading-relaxed text-ink/80 sm:text-[19px]">{d.intro}</p>
        </section>

        <section aria-labelledby="short" className="grain relative mt-8 overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#6a3dff,#5b2bff_45%,#2a0f9a)] p-5 text-white shadow-[0_24px_50px_-28px_rgba(91,43,255,.9)] sm:mt-10 sm:p-8">
          <h2 id="short" className="label text-white/75">The short version</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-x-8">
            {d.summary.map((s) => (
              <li key={s} className="flex gap-3 text-[14.5px] leading-snug sm:text-[15.5px]">
                <span aria-hidden className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white/20">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>{s}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[240px_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <details className="group rounded-2xl bg-alt p-2 ring-1 ring-line lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-[14px] font-semibold text-ink">
                On this page
                <svg className="transition group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="mt-1"><Contents d={d} /></div>
            </details>
            <div className="hidden lg:block">
              <p className="label mb-2 px-2 text-[10px] text-ink/45">On this page</p>
              <Contents d={d} />
            </div>
          </aside>

          <article className="min-w-0 max-w-[46rem]">
            {d.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-[var(--line)] py-8 first:border-t-0 first:pt-0 sm:py-10">
                <h2 className="flex items-baseline gap-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[28px]" style={{ fontFamily: "var(--font-display)" }}>
                  <span className="label text-[11px] font-normal tracking-normal text-brand-ink">{String(i + 1).padStart(2, "0")}</span>{s.title}
                </h2>
                {s.body.map((b, j) => <Body key={j} b={b} />)}
              </section>
            ))}

            <div className="mt-4 flex flex-col gap-4 rounded-[22px] bg-alt p-5 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-[16px] font-bold text-ink">Questions about this page?</p>
                <p className="mt-1 text-[14px] text-ink/65">Write to <a href={`mailto:${LEGAL_CONTACT}`} className="font-semibold text-brand-ink underline-offset-2 hover:underline">{LEGAL_CONTACT}</a></p>
              </div>
              <div className="flex gap-2">
                <Link href={`/legal/${other.slug}`} className="btn btn-line btn-sm">{other.title}</Link>
                <Link href="/" className="btn btn-brand btn-sm">Back to Lexari</Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
