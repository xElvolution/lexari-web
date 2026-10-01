import { copy, SIGNIN } from "@/content/copy";
import LiveGlyph from "./glyph/LiveGlyph";
import { CAST, HOUSE, castFace } from "@/lib/glyph/cast";
import Logo from "./Logo";

export default function Finale() {
  const F = copy.finale, Ft = copy.footer;
  return (
    <>
      <section className="sheet grain overflow-hidden bg-grape pt-24 text-white sm:pt-32">
        <div className="relative mx-auto flex max-w-[1320px] flex-col items-center px-5 text-center sm:px-8">
          <div className="reveal flex -space-x-2">
            {[0, 3, 5, 6, 10].map((c, i) => <div key={c} style={{ transform: `rotate(${(i - 2) * 7}deg)` }}><LiveGlyph dna={CAST[c]} size={84} beat={i} /></div>)}
          </div>
          <h2 className="reveal display mt-8 max-w-[14ch] text-[clamp(3rem,8.5vw,7.5rem)]">{F.title}</h2>
          <p className="reveal mt-6 text-[18px] text-white/80 sm:text-[20px]">{F.body}</p>
          <a href={SIGNIN} className="reveal btn btn-white mt-9 !h-16 !px-9 !text-[18px]">{F.cta} →</a>
        </div>
        <div aria-hidden className="display pointer-events-none -mb-[0.14em] mt-16 select-none text-center text-[31vw] leading-[0.72] text-white/[0.09]">{F.wordmark}</div>
      </section>
      <footer className="bg-alt text-ink">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm"><Logo /><p className="mt-4 text-[15px] leading-relaxed text-ink/65">{Ft.line}</p></div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-semibold">
            {Ft.links.map((l) => <a key={l.label} href={l.href} className="text-ink/80 hover:text-brand-ink">{l.label}</a>)}
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 border-t border-line px-5 py-6 text-[12.5px] text-ink/55 sm:flex-row sm:justify-between sm:px-8">
          <span>© 2026 Lexari</span><span>{Ft.fine}</span>
        </div>
      </footer>
    </>
  );
}
