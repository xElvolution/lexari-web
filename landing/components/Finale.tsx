import Link from "next/link";
import { copy, SIGNIN } from "@/content/copy";
import Face from "@shared/components/Face";
import Logo from "@shared/components/Logo";

export default function Finale() {
  const F = copy.finale, Ft = copy.footer;
  return (
    <>
      <section className="sheet grain overflow-hidden bg-grape pt-24 text-white sm:pt-32">
        <div className="relative mx-auto flex max-w-[1320px] flex-col items-center px-5 text-center sm:px-8">
          <div className="reveal flex -space-x-2">
            {([["orange", 101], ["yellow", 7], ["teal", 45], ["pink", 23], ["sky", 88]] as const).map(([color, seed], i) => <div key={seed} style={{ transform: `rotate(${(i - 2) * 7}deg)` }}><Face seed={seed} variant={{ color }} size={84} /></div>)}
          </div>
          <h2 className="reveal display mt-8 max-w-[14ch] text-[clamp(3rem,8.5vw,7.5rem)]">{F.title}</h2>
          <p className="reveal mt-6 text-[18px] text-white/80 sm:text-[20px]">{F.body}</p>
          <a href={SIGNIN} className="reveal btn btn-white mt-9 !h-16 !px-9 !text-[18px]">{F.cta} →</a>
        </div>
        <div aria-hidden className="display pointer-events-none -mb-[0.14em] mt-16 select-none text-center text-[31vw] leading-[0.72] text-white/[0.09]">{F.wordmark}</div>
      </section>
      <footer className="border-t border-line bg-alt text-ink">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(16rem,22rem)_1fr] lg:gap-20 lg:py-16">
          <div>
            <a href="#top" aria-label="Lexari home" className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape"><Logo /></a>
            <p className="mt-5 max-w-[28ch] text-[16px] leading-relaxed text-ink/70">{Ft.line}</p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {Ft.groups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="display text-[22px]">{group.title}</h2>
                <ul className="mt-4 grid gap-2.5">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("/") ? (
                        <Link href={l.href} className="text-[15px] text-ink/70 transition hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape">{l.label}</Link>
                      ) : (
                        <a href={l.href} className="text-[15px] text-ink/70 transition hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape">{l.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-5 py-6 text-[13px] leading-relaxed text-ink/60 sm:flex-row sm:items-baseline sm:justify-between sm:px-8">
            <span>© 2026 Lexari</span>
            <span className="grid gap-1 sm:text-right">
              <span>{Ft.fine}</span>
              <span>{Ft.wallets}</span>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
