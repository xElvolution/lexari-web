"use client";

/**
 * Round coin / chain / provider marks from /public/logos. Used by Top up, Models and wallets. Falls back to a coloured
 * letter tile when a file is missing. CoinWithNetwork overlays the chain badge on the coin, like a wallet app.
 */
import { useState } from "react";
import { coinById, type ChainId, type CoinId } from "@/content/topup";
import { chainLogoSrc, coinLogoSrc, makerLogoSrc, MAKER_TILE, providerLogoSrc } from "@/lib/logos";

type Box = { size?: number; className?: string; title?: string };

function RoundImg({ src, size, className = "", title, fallback }: { src: string | null; size: number; className?: string; title?: string; fallback: React.ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      title={title}
      draggable={false}
      onError={() => setBroken(true)}
      className={`block shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function LetterTile({ text, bg, size, className = "", round = true }: { text: string; bg: string; size: number; className?: string; round?: boolean }) {
  const t = text.slice(0, text.length > 3 ? 3 : text.length);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-extrabold text-white ${round ? "rounded-full" : "rounded-[14px]"} ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: size * (t.length > 2 ? 0.28 : 0.38), letterSpacing: "-0.02em" }}
    >
      {t}
    </span>
  );
}

/** Lamina's mark: thin stacked layers (same glyph as billing/parts LaminaMark). */
function LaminaGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" fill="currentColor" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".75" />
      <path d="m3.5 16 8.5 4.5 8.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
    </svg>
  );
}

/** A coin's round mark. */
export function CoinLogo({ coin, size = 32, className = "" }: { coin: CoinId | string } & Box) {
  const c = coinById(coin);
  const src = coinLogoSrc(coin);
  const label = c?.symbol || String(coin);
  return (
    <RoundImg
      src={src}
      size={size}
      className={className}
      title={label}
      fallback={<LetterTile text={label.replace(/USD$/i, "$")} bg={c?.color || "#6b7280"} size={size} className={className} />}
    />
  );
}

/** A chain's round mark. */
export function ChainLogo({ chain, size = 28, className = "" }: { chain: ChainId | string } & Box) {
  const src = chainLogoSrc(chain);
  const label = String(chain).slice(0, 3).toUpperCase();
  return (
    <RoundImg
      src={src}
      size={size}
      className={`ring-1 ring-black/5 ${className}`}
      title={String(chain)}
      fallback={<LetterTile text={label} bg="#e5e7eb" size={size} className={`!text-ink/70 ${className}`} />}
    />
  );
}

/** Coin with a small chain badge on the lower-right corner (wallet-app style). */
export function CoinWithNetwork({ coin, chain, size = 34, className = "" }: { coin: CoinId | string; chain: ChainId | string } & Box) {
  const badge = Math.max(12, Math.round(size * 0.42));
  return (
    <span aria-hidden className={`relative inline-grid shrink-0 ${className}`} style={{ width: size, height: size }}>
      <CoinLogo coin={coin} size={size} />
      <span
        className="absolute grid place-items-center rounded-full bg-card ring-2 ring-[var(--card)]"
        style={{ width: badge, height: badge, right: -Math.round(badge * 0.15), bottom: -Math.round(badge * 0.1) }}
      >
        <ChainLogo chain={chain} size={badge} />
      </span>
    </span>
  );
}

/** A model provider / maker mark (rounded square). Lamina uses the Lexari layers mark. */
export function ProviderLogo({ provider, maker, size = 40, className = "" }: { provider?: string; maker?: string } & Box) {
  const [broken, setBroken] = useState(false);
  if (maker === "Lexari" || provider === "lamina") {
    return (
      <span className={`grid shrink-0 place-items-center rounded-[14px] bg-grape text-white ${className}`} style={{ width: size, height: size }}>
        <LaminaGlyph size={Math.round(size * 0.5)} />
      </span>
    );
  }
  const src = (provider && providerLogoSrc(provider)) || (maker && makerLogoSrc(maker)) || null;
  const tile = (maker && MAKER_TILE[maker]) || "#eef0f4";
  const letter = (maker || provider || "?").slice(0, 1).toUpperCase();
  if (!src || broken) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-[14px] font-bold text-white ${className}`} style={{ width: size, height: size, background: tile, fontSize: Math.round(size * 0.42) }}>
        {letter}
      </span>
    );
  }
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white ring-1 ring-black/5 ${className}`} style={{ width: size, height: size }}>
      <img src={src} alt="" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} draggable={false} onError={() => setBroken(true)} className="object-contain" style={{ width: Math.round(size * 0.62), height: Math.round(size * 0.62) }} />
    </span>
  );
}
