import { copy } from "@/content/copy";

const F = copy.faq;

export default function Faq() {
  return (
    <section id="questions" className="sheet scroll-mt-16 bg-base pb-28 pt-24 sm:pb-36 sm:pt-32">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
        <div className="reveal lg:sticky lg:top-28 lg:self-start">
          <span className="label inline-block rounded-full bg-grape px-3 py-1.5 text-white">{F.label}</span>
          <h2 className="display mt-6 text-[clamp(3rem,8vw,6.5rem)] text-ink">{F.title}</h2>
          <p className="mt-5 text-[18px] text-ink/70">{F.body}</p>
        </div>
        <div className="grid gap-3">
          {F.items.map(([q, a], i) => (
            <details key={q} className="reveal group rounded-[24px] bg-card p-5 ring-2 ring-tint open:ring-grape sm:p-6" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
                <span className="display text-[26px] text-brand-ink">Q.</span>
                <span className="display flex-1 pt-1 text-[22px] leading-[1.05] text-ink sm:text-[28px]">{q}</span>
                <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-[20px] font-bold text-ink transition-transform duration-300 group-open:rotate-45 group-open:bg-grape group-open:text-white">+</span>
              </summary>
              <div className="mt-4 flex gap-4">
                <span className="display text-[26px] text-ink/25">A.</span>
                <p className="pt-1 text-[16px] leading-relaxed text-ink/75 sm:text-[17px]">{a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
