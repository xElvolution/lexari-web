type Props = { label: string; title: string; body: string; why?: string; tone?: "base" | "grape"; className?: string };

/** Section opener: mono label, big display title, explanation, and a "why you should care" note. */
export default function SectionIntro({ label, title, body, why, tone = "base", className = "" }: Props) {
  const g = tone === "grape";
  return (
    <div className={`reveal max-w-[46rem] ${className}`}>
      <span className={`label inline-block rounded-full px-3 py-1.5 ${g ? "bg-white text-grape" : "bg-grape text-white"}`}>{label}</span>
      <h2 className={`display mt-6 text-[clamp(2.7rem,6.6vw,5.6rem)] ${g ? "text-white" : "text-ink"}`}>{title}</h2>
      <p className={`mt-6 text-[17px] leading-[1.65] sm:text-[19px] ${g ? "text-white/85" : "text-ink/75"}`}>{body}</p>
      {why && (
        <p className={`mt-6 flex gap-3 rounded-2xl p-4 text-[15px] font-semibold leading-snug sm:text-[16px] ${g ? "bg-white/12 text-white" : "bg-tint text-ink"}`}>
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] ${g ? "bg-white text-grape" : "bg-grape text-white"}`}>!</span>
          {why}
        </p>
      )}
    </div>
  );
}
