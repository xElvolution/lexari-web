type Props = { label: string; title: string; body: string; why?: string; tone?: "light" | "dark" | "grape"; className?: string };

/** Section opener: mono label, big display title, explanation, and a "why you should care" note. */
export default function SectionIntro({ label, title, body, why, tone = "light", className = "" }: Props) {
  const dark = tone !== "light";
  return (
    <div className={`reveal max-w-[46rem] ${className}`}>
      <span className={`label inline-block rounded-full px-3 py-1.5 ${tone === "light" ? "bg-grape text-white" : tone === "dark" ? "bg-candy text-plum" : "bg-plum text-candy"}`}>{label}</span>
      <h2 className={`display mt-6 text-[clamp(2.7rem,6.6vw,5.6rem)] ${dark ? "text-white" : "text-plum"}`}>{title}</h2>
      <p className={`mt-6 text-[17px] leading-[1.65] sm:text-[19px] ${dark ? "text-white/80" : "text-plum/75"}`}>{body}</p>
      {why && (
        <p className={`mt-6 flex gap-3 rounded-2xl p-4 text-[15px] font-semibold leading-snug sm:text-[16px] ${tone === "light" ? "bg-frost-2 text-plum" : "bg-white/10 text-white"}`}>
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] ${tone === "light" ? "bg-grape text-white" : "bg-candy text-plum"}`}>!</span>
          {why}
        </p>
      )}
    </div>
  );
}
