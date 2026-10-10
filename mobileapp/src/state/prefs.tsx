import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { dark, light, type Palette } from "@/theme/colors";

type ThemeName = "light" | "dark" | "system";
type Prefs = {
  theme: ThemeName;
  palette: Palette;
  hideBalances: boolean;
  lockOn: boolean;
  setTheme: (t: ThemeName) => void;
  toggleBalances: () => void;
  setLock: (on: boolean) => void;
};

const Ctx = createContext<Prefs | null>(null);
const KEY = "lexari.prefs.v1";

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("dark");
  const [hideBalances, setHide] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [system, setSystem] = useState(Appearance.getColorScheme() === "light" ? "light" : "dark");

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((raw) => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw) as { theme?: ThemeName; hideBalances?: boolean; lockOn?: boolean };
        if (p.theme) setThemeState(p.theme);
        if (typeof p.hideBalances === "boolean") setHide(p.hideBalances);
        if (typeof p.lockOn === "boolean") setLockOn(p.lockOn);
      } catch { /* ignore a bad local blob */ }
    }).catch(() => {});
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme === "light" ? "light" : "dark"));
    return () => sub.remove();
  }, []);

  const persist = (next: { theme: ThemeName; hideBalances: boolean; lockOn: boolean }) => {
    SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  };

  const value = useMemo<Prefs>(() => {
    const resolved = theme === "system" ? system : theme;
    return {
      theme,
      palette: resolved === "light" ? light : dark,
      hideBalances,
      lockOn,
      setTheme: (t) => { setThemeState(t); persist({ theme: t, hideBalances, lockOn }); },
      toggleBalances: () => { setHide((v) => { persist({ theme, hideBalances: !v, lockOn }); return !v; }); },
      setLock: (on) => { setLockOn(on); persist({ theme, hideBalances, lockOn: on }); },
    };
  }, [theme, system, hideBalances, lockOn]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("Prefs missing");
  return v;
}
