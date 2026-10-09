import type { IntegrationId, IntegrationStatus } from "@/content/integrations";
import { STATUS_LABEL } from "@/content/integrations";

/** Each integration's mark on its brand colour, drawn inline (no external images). */
export function IntegrationLogo({ id, size = 44, className = "" }: { id: IntegrationId; size?: number; className?: string }) {
  const r = Math.round(size * 0.3);
  const box = { width: size, height: size, borderRadius: r };
  const g = Math.round(size * 0.56);
  const tile = (bg: string, svg: React.ReactNode) => <span aria-hidden data-int-logo={id} className={`grid shrink-0 place-items-center overflow-hidden ${className}`} style={{ ...box, background: bg, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>{svg}</span>;
  switch (id) {
    case "solana":
      return tile("#0b0b12", (
        <svg width={g} height={g} viewBox="0 0 24 24"><defs><linearGradient id="int-sol" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#9945ff" /><stop offset="1" stopColor="#14f195" /></linearGradient></defs>
          <path fill="url(#int-sol)" d="M6.2 15.6h14.6l-3 3H3.2zM6.2 5.4h14.6l-3 3H3.2zM17.8 10.5H3.2l3 3h14.6z" /></svg>
      ));
    case "orca":
      return tile("#ffd15c", (
        <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#14121f" d="M3 13.2c0-4.2 3.9-7.4 8.9-7.4 2.6 0 4.7.8 6.2 2.2l1.3-2.3.9 4.6c.5.9.7 1.9.7 2.9 0 4-3.6 6.9-8.3 6.9H8.2L5.6 22l.6-3.5C4.2 17.3 3 15.4 3 13.2z" /><ellipse cx="9.2" cy="12.6" rx="2.6" ry="1.5" fill="#fff" transform="rotate(-18 9.2 12.6)" /><path fill="#fff" d="M13 16.8c2.4 0 4.6-.9 5.9-2.5-.4 2.4-2.9 4.1-6 4.1h-1.6z" /></svg>
      ));
    case "jupiter":
      return tile("linear-gradient(140deg,#c7f284,#00bef0)", (
        <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="#0e1a2b" strokeWidth="2.1" strokeLinecap="round"><path d="M4.5 9.5c4-2.6 10.2-2.9 15-.6" /><path d="M3.6 13.4c5.2-3 11.6-3.1 16.8-.2" /><path d="M5.4 17.2c4.3-2.1 9.5-2.1 13.4 0" /></svg>
      ));
    case "polymarket":
      return tile("#2d63ff", (
        <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#fff" d="M5 4.5 19 8v8L5 19.5zm2.2 2.9v9.2l9.6-2.4V9.8z" /></svg>
      ));
    case "base":
      return tile("#0052ff", (
        <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#fff" d="M12 20.5a8.5 8.5 0 1 0-8.46-9.36h11.2v1.72H3.54A8.5 8.5 0 0 0 12 20.5z" /></svg>
      ));
    case "ethereum":
      return tile("#627eea", (
        <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#fff" fillOpacity=".95" d="M12 2.5 6.2 12.2 12 15.6l5.8-3.4z" /><path fill="#fff" fillOpacity=".7" d="M12 16.7 6.2 13.3 12 21.5l5.8-8.2z" /></svg>
      ));
    case "tempo":
      return tile("#16161d", (
        <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#fff" d="M5 5.5h14v3.2h-5.3V19h-3.4V8.7H5z" /></svg>
      ));
    case "panta":
      return tile("linear-gradient(140deg,#0f172a,#1e3a8a)", (
        <svg width={g} height={g} viewBox="0 0 24 24" fill="none"><path d="M6 19V5h6.5a4.5 4.5 0 0 1 0 9H6" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="17.5" cy="17.5" r="2" fill="#38bdf8" /></svg>
      ));
    case "payments":
      return tile("linear-gradient(140deg,#0f9f6e,#22c55e)", (
        <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18M7 15h3" /></svg>
      ));
    case "ore":
      return tile("#1a1206", (
        <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#f5a524" d="m12 3 7.5 4.5v9L12 21l-7.5-4.5v-9z" /><path fill="#1a1206" d="m12 7.2 3.8 2.3v4.9L12 16.8l-3.8-2.4V9.5z" /></svg>
      ));
    case "solami":
      return tile("#111", (
        <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8h14M5 12h10M5 16h6" /></svg>
      ));
    case "prices":
      return tile("linear-gradient(140deg,#5b2bff,#8f6bff)", (
        <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 17.5 9 12l3.5 3.5L20.5 7" /><path d="M15.5 7h5v5" /></svg>
      ));
  }
}

const PILL: Record<IntegrationStatus, string> = {
  devnet: "bg-[#e7f8ee] text-[#137a3d]",
  live: "bg-[#e7f8ee] text-[#137a3d]",
  needskey: "bg-[#fff4d6] text-[#8a5a00]",
  testnet: "bg-[#e8efff] text-[#2453c9]",
  market: "bg-grape/12 text-brand-ink",
  soon: "bg-tint text-ink/55",
};
const DOT: Record<IntegrationStatus, string> = { devnet: "bg-[#22c55e]", live: "bg-[#22c55e]", needskey: "bg-[#e0a100]", testnet: "bg-[#3b6cf0]", market: "bg-grape", soon: "bg-ink/30" };

/** The honest status pill: Live on devnet, Testnet wallet, Market data or Coming soon. */
export function StatusPill({ status, className = "" }: { status: IntegrationStatus; className?: string }) {
  return (
    <span data-int-status={status} className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${PILL[status]} ${className}`}>
      <i className={`h-1.5 w-1.5 rounded-full ${DOT[status]} ${status === "devnet" || status === "live" ? "animate-pulse" : ""}`} />{STATUS_LABEL[status]}
    </span>
  );
}
