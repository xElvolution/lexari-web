import { IS_TESTNET } from "@/lib/network";

/**
 * The persistent Testnet banner: on every page of a testnet build, so nobody mistakes test funds for real ones.
 * A mainnet build renders nothing. Server component, no client JS.
 */
export default function NetworkBanner() {
  if (!IS_TESTNET) return null;
  return (
    <div role="status" aria-label="Testnet" className="relative z-[60] flex h-7 w-full shrink-0 items-center justify-center gap-2 bg-[#f5a524] px-3 text-[12px] font-bold text-[#2b1a00]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <i className="h-1.5 w-1.5 rounded-full bg-[#2b1a00]" aria-hidden />
      <span className="truncate">Testnet. Coins here are test coins with no real value.</span>
    </div>
  );
}
