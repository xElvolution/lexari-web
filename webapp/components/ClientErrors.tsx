"use client";

import { useEffect } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD || "";
/** Stale client after a deploy: old chunks or server references no longer exist. A hard reload fixes it. */
const STALE = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Server Reference|failed-to-find-server-action|client reference manifest/i;

export function reportError(kind: string, e: unknown, extra: Record<string, unknown> = {}) {
  try {
    const err = e as { message?: string; stack?: string } | string;
    const message = typeof err === "string" ? err : err?.message || String(e);
    const body = JSON.stringify({ kind, message, stack: typeof err === "string" ? "" : err?.stack || "", url: location.pathname + location.search, ua: navigator.userAgent, build: BUILD, ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/client-error", new Blob([body], { type: "application/json" }));
    else void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch { /* never throw from the reporter */ }
}

function hardReload(why: string) {
  try {
    const last = Number(sessionStorage.getItem("lexari-reloaded") || 0);
    if (Date.now() - last < 30_000) return; // at most once every 30s
    sessionStorage.setItem("lexari-reloaded", String(Date.now()));
  } catch {}
  reportError("reload", why);
  location.reload();
}
export const isStale = (m: string) => STALE.test(m);
export { hardReload };

/** Sends browser errors to the server log, and reloads once when the page is from an older deploy. */
export default function ClientErrors() {
  useEffect(() => {
    const onErr = (ev: ErrorEvent) => {
      const m = ev.message || ev.error?.message || "";
      if (STALE.test(m)) return hardReload(m);
      reportError("error", ev.error || m, { src: `${ev.filename || ""}:${ev.lineno || 0}:${ev.colno || 0}` });
    };
    const onRej = (ev: PromiseRejectionEvent) => {
      const m = (ev.reason as Error)?.message || String(ev.reason);
      if (STALE.test(m)) return hardReload(m);
      reportError("rejection", ev.reason || m);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    // After a deploy: compare build ids when the tab comes back.
    const check = () => {
      if (document.hidden || !BUILD) return;
      if (document.querySelector("[data-pay-sheet]")) return; // never in the middle of a payment
      void fetch("/api/version", { cache: "no-store" }).then((r) => r.json()).then((v: { build?: string }) => { if (v.build && v.build !== BUILD) hardReload(`build ${BUILD} -> ${v.build}`); }).catch(() => {});
    };
    document.addEventListener("visibilitychange", check);
    const t = setInterval(check, 5 * 60_000);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); document.removeEventListener("visibilitychange", check); clearInterval(t); };
  }, []);
  return null;
}
