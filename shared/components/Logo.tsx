/** The Lexari mark: the grape tile with the eyes and smile (same art as the app icon, favicon and mobile icon). */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="16" fill="#5b2bff" />
      <ellipse cx="22.9" cy="26.9" rx="5.1" ry="7.75" fill="#fff" />
      <ellipse cx="40.9" cy="26.9" rx="5.1" ry="7.75" fill="#fff" />
      <circle cx="24.4" cy="24.9" r="2.06" fill="#3514b0" />
      <circle cx="42.4" cy="24.9" r="2.06" fill="#3514b0" />
      <path d="M21.6 41.4 Q32 49.9 42.4 41.4" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Mark and wordmark. The wordmark inherits the theme ink color, so it works on light and dark. */
export default function Logo() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <LogoMark size={28} />
      <span className="display text-[26px] leading-none">lexari</span>
    </span>
  );
}
