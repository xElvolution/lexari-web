/** Wordmark: a punched ID badge glyph with two eyes, then "lexari". */
export default function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const ink = tone === "light" ? "#fff" : "#170a38";
  return (
    <span className="flex items-center gap-2">
      <svg width="30" height="34" viewBox="0 0 30 34" aria-hidden>
        <rect x="1" y="3" width="28" height="30" rx="8" fill="#ffa8ea" />
        <rect x="10" y="0" width="10" height="7" rx="3.5" fill={ink} />
        <circle cx="10.5" cy="18" r="2.6" fill="#170a38" />
        <circle cx="19.5" cy="18" r="2.6" fill="#170a38" />
        <path d="M10 25 Q15 28.5 20 25" stroke="#170a38" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="display text-[26px] leading-none" style={{ color: ink }}>lexari</span>
    </span>
  );
}
