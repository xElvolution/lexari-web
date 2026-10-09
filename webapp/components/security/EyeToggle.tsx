"use client";

import { setHideBalance, useHideBalance } from "@/lib/privacy";
import Icon from "../Icon";

/** The eye: hide or show balances everywhere (saved to your account). `tone` matches the surface it sits on. */
export default function EyeToggle({ tone = "light", size = 28 }: { tone?: "light" | "dark"; size?: number }) {
  const hide = useHideBalance();
  const cls = tone === "dark" ? "bg-white/15 text-white hover:bg-white/25" : "bg-tint text-ink/70 hover:bg-alt hover:text-ink";
  return (
    <button type="button" data-hide-balance onClick={() => setHideBalance(!hide)} aria-label={hide ? "Show balances" : "Hide balances"} aria-pressed={hide} title={hide ? "Show balances" : "Hide balances"}
      className={`inline-grid shrink-0 place-items-center rounded-full transition ${cls}`} style={{ width: size, height: size }}>
      <Icon name={hide ? "eyeoff" : "eye"} size={Math.round(size * 0.5)} />
    </button>
  );
}
