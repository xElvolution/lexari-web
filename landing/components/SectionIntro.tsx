type Props = { label: string; title: string; body: string; tone?: "base" | "grape"; className?: string };

/** Section opener: mono label, big display title and a short explanation. */
export default function SectionIntro({ label, title, body, tone = "base", className = "" }: Props) {
  const g = tone === "grape";
  return (
    <div className={`reveal max-w-[46rem] ${className}`}>
      <span className={`label inline-block rounded-full px-3 py-1.5 ${g ? "bg-white text-grape" : "bg-grape text-white"}`}>{label}</span>
      <h2 className={`display mt-6 text-[clamp(2.7rem,6.6vw,5.6rem)] ${g ? "text-white" : "text-ink"}`}>{title}</h2>
      <p className={`mt-6 text-[17px] leading-[1.65] sm:text-[19px] ${g ? "text-white/85" : "text-ink/75"}`}>{body}</p>
    </div>
  );
}
