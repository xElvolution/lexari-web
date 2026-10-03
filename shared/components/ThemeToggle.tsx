"use client";

import { useEffect } from "react";

const KEY = "lexari-theme";

/** Flips data-theme on <html> and remembers the choice. Icons are swapped by CSS. */
export default function ThemeToggle() {
  useEffect(() => {
    // follow the system while the visitor has not picked a theme
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => { if (!localStorage.getItem(KEY)) document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light"); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const toggle = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch {}
  };
  return (
    <button onClick={toggle} aria-label="Switch light or dark theme" title="Switch theme" className="grid h-11 w-11 place-items-center rounded-full border-2 border-line text-ink transition hover:border-grape hover:text-brand-ink">
      <svg className="i-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
      <svg className="i-moon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
      </svg>
    </button>
  );
}
