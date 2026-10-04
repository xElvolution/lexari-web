"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Caps a list at its first n items: the list gets a fixed height that ends at the n-th item and the rest
 * scroll inside it. Re-measures when the items or the width change.
 */
export function useFirstN<T extends HTMLElement>(n: number, dep: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      el.style.maxHeight = "";
      const items = [...el.children] as HTMLElement[];
      if (items.length <= n) { el.style.overflowY = ""; return; }
      const top = el.getBoundingClientRect().top;
      const bottom = Math.max(...items.slice(0, n).map((x) => x.getBoundingClientRect().bottom));
      el.style.maxHeight = `${Math.ceil(bottom - top + 2)}px`;
      el.style.overflowY = "auto";
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [n, dep]);
  return ref;
}
