"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../Icon";

/** Your anti-phishing phrase on sensitive sheets. If it's missing or wrong, it isn't the real Lexari. */
export function PhraseBadge({ phrase, loading = false, compact = false }: { phrase?: string; loading?: boolean; compact?: boolean }) {
  if (loading) return <div className="h-[52px] animate-pulse rounded-2xl bg-tint" />;
  if (!phrase) {
    if (compact) return null;
    return (
      <div data-phrase-badge="none" className="flex items-start gap-2.5 rounded-2xl bg-tint p-3 text-[12.5px] leading-snug text-ink/65">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        <span>Add a security phrase in <Link href="/settings#security" className="font-semibold text-ink underline underline-offset-2">Settings &gt; Security</Link>. It shows here so you can tell a real Lexari screen from a fake one.</span>
      </div>
    );
  }
  return (
    <div data-phrase-badge className={`flex items-center gap-2.5 rounded-2xl bg-grape/10 ring-1 ring-grape/30 ${compact ? "px-3 py-2" : "p-3"}`}>
      <Icon name="verified" size={16} className="shrink-0 text-grape" />
      <span className="min-w-0 text-[12.5px] leading-snug text-ink/70">Your security phrase: <b data-phrase className="break-words font-bold text-ink">{phrase}</b></span>
    </div>
  );
}

/* Your phrase, loaded once per page view and shared by every card that shows it. */
let phraseCache: Promise<string> | null = null;
export function usePhrase() {
  const [p, setP] = useState<string | undefined>(undefined);
  useEffect(() => {
    phraseCache ??= fetch("/api/security/stepup", { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).then((j: { phrase?: string }) => j.phrase || "").catch(() => "");
    let on = true; void phraseCache.then((v) => { if (on) setP(v); }); return () => { on = false; };
  }, []);
  return p;
}
/** Forget the cached phrase (after you change it). */
export function phraseChanged() { phraseCache = null; }
