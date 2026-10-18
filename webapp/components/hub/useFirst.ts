"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Caps a list at its first n items: the list gets a fixed height that ends at the n-th item and the rest
 * scroll inside it. Re-measures when the items or the width change. Measured from layout boxes (offsetTop and
 * offsetHeight), so an item's entrance animation can't make the cap end partway through a card.
 * With `allFrom`, screens at least that wide show every item with no cap.
 */
export function useFirstN<T extends HTMLElement>(n: number, dep: unknown, opts: { allFrom?: number } = {}) {
  const ref = useRef<T>(null);
  const { allFrom } = opts;
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const wide = allFrom ? window.matchMedia(`(min-width: ${allFrom}px)`) : null;
    const fit = () => {
      el.style.maxHeight = "";
      el.style.overflowY = "";
      el.dataset.capped = "false";
      const items = [...el.children] as HTMLElement[];
      if (items.length <= n || wide?.matches) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      const bottom = Math.max(...items.slice(0, n).map((x) => x.offsetTop + x.offsetHeight));
      if (bottom >= el.scrollHeight - 1) return;
      el.style.maxHeight = `${Math.ceil(bottom + 2)}px`;
      el.style.overflowY = "auto";
      el.dataset.capped = "true";
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el.parentElement ?? el);
    wide?.addEventListener("change", fit);
    return () => { ro.disconnect(); wide?.removeEventListener("change", fit); };
  }, [n, dep, allFrom]);
  return ref;
}
