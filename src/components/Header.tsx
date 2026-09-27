"use client";

import { useEffect, useState } from "react";
import { copy, APP } from "@/content/copy";
import Logo from "./Logo";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solid || open ? "bg-grape/92 backdrop-blur-md" : ""}`}>
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <a href="#top" aria-label="Lexari home"><Logo /></a>
        <nav className="hidden items-center gap-1 lg:flex">
          {copy.nav.links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-white/85 transition hover:bg-white/12 hover:text-white">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={APP} className="btn btn-candy !hidden !h-11 !px-5 !text-[14px] sm:!inline-flex">{copy.nav.cta}</a>
          <button onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open} className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/40 text-white lg:hidden">
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
              <path d={open ? "M2 2l14 10M16 2L2 12" : "M1 2h16M1 7h16M1 12h16"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-white/15 px-5 pb-6 pt-3 lg:hidden">
          {copy.nav.links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="display py-2 text-[34px] text-white">{l.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}
