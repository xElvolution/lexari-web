/** Theme choice: "light", "dark" or "system". Stored in localStorage (read before first paint) and mirrored to the account. */
export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "lexari-theme";
export const DEFAULT_THEME: ThemeChoice = "dark";

export function savedTheme(): ThemeChoice {
  try { const t = localStorage.getItem(THEME_KEY); if (t === "light" || t === "dark" || t === "system") return t; } catch {}
  return DEFAULT_THEME;
}
export const resolveTheme = (t: ThemeChoice) => (t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t);

const subs = new Set<(t: ThemeChoice) => void>();
export function onTheme(f: (t: ThemeChoice) => void) { subs.add(f); return () => { subs.delete(f); }; }

export function applyTheme(t: ThemeChoice, save = true) {
  document.documentElement.setAttribute("data-theme", resolveTheme(t));
  if (save) { try { localStorage.setItem(THEME_KEY, t); } catch {} }
  subs.forEach((f) => f(t));
}

let watching = false;
/** Keeps "system" in step with the device while the page is open. */
export function watchSystemTheme() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (savedTheme() === "system") applyTheme("system", false); });
}
