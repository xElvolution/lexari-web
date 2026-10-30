/** One gate for looping animations: run only while this screen is focused and the app is in the foreground. Tabs stay mounted, so without this every hidden tab keeps animating. */
import { useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
// expo-router vendors React Navigation; this is the same context its screens provide (undefined outside a screen)
import { NavigationContext } from "expo-router/build/react-navigation/core";

let appActive = AppState.currentState !== "background" && AppState.currentState !== "inactive";
const appSubs = new Set<(a: boolean) => void>();
AppState.addEventListener("change", (s) => { const a = s === "active"; if (a === appActive) return; appActive = a; appSubs.forEach((f) => f(a)); });

export function useAppActive() {
  const [a, setA] = useState(appActive);
  useEffect(() => { appSubs.add(setA); setA(appActive); return () => { appSubs.delete(setA); }; }, []);
  return a;
}

export function useMotion(on = true) {
  const nav = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => nav?.isFocused?.() ?? true);
  useEffect(() => {
    if (!nav) return;
    setFocused(nav.isFocused());
    const a = nav.addListener("focus", () => setFocused(true));
    const b = nav.addListener("blur", () => setFocused(false));
    return () => { a(); b(); };
  }, [nav]);
  const active = useAppActive();
  return on && focused && active;
}

/** A single shared ~24 fps clock for every animated face, instead of one requestAnimationFrame loop per face. */
type Sub = (t: number) => void;
const subs = new Set<Sub>();
let raf = 0, last = 0;
const t0 = Date.now();
function tick() {
  raf = requestAnimationFrame(tick);
  const now = Date.now();
  if (now - last < 42) return;
  last = now;
  const t = (now - t0) / 1000;
  subs.forEach((f) => f(t));
}
export function subscribeClock(f: Sub) {
  subs.add(f);
  if (!raf) raf = requestAnimationFrame(tick);
  return () => { subs.delete(f); if (!subs.size && raf) { cancelAnimationFrame(raf); raf = 0; } };
}
