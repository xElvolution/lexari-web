import { copy } from "@/content/copy";

export default function Marquee() {
  const items = [...copy.marquee, ...copy.marquee];
  return (
    <div className="relative z-20 -my-7 -rotate-2 overflow-hidden bg-grape py-3.5 sm:-my-9 sm:py-4">
      <div className="marquee flex w-max items-center gap-8">
        {[0, 1].map((k) => (
          <div key={k} className="flex items-center gap-8" aria-hidden={k === 1}>
            {items.map((t, i) => (
              <span key={i} className="flex items-center gap-8">
                <span className="display whitespace-nowrap text-[26px] text-white sm:text-[34px]">{t}</span>
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><circle cx="11" cy="11" r="10" fill="#fff" /><circle cx="7.5" cy="10" r="1.8" fill="#0a0a0a" /><circle cx="14.5" cy="10" r="1.8" fill="#0a0a0a" /></svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
