import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import * as Store from "@/lib/storage";
import { dark, light, type Palette } from "@/theme/colors";

type ThemeName = "light" | "dark" | "system";
type Saved = { theme: ThemeName; hideBalances: boolean; lockOn: boolean; bioOn: boolean; onboarded: boolean; securityAsked: boolean; tourOn: boolean; tourStep: number; tourDone: boolean; passkeyAsk?: boolean };
type Prefs = Saved & {
  loaded: boolean;
  palette: Palette;
  isDark: boolean;
  setTheme: (t: ThemeName) => void;
  dismissPasskey: () => void;
  toggleBalances: () => void;
  setBalances: (hide: boolean) => void;
  setLock: (on: boolean) => void;
  setBio: (on: boolean) => void;
  setOnboarded: () => void;
  setSecurityAsked: () => void;
  /** the coach-mark tour (webapp store tour: { on, step, done }) */
  startTour: () => void;
  setTourStep: (n: number) => void;
  endTour: () => void;
};

const Ctx = createContext<Prefs | null>(null);
const KEY = "lexari.prefs.v1";
const DEFAULTS: Saved = { theme: "dark", hideBalances: false, lockOn: false, bioOn: false, onboarded: false, securityAsked: false, tourOn: false, tourStep: 0, tourDone: false };

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [system, setSystem] = useState(Appearance.getColorScheme() === "light" ? "light" : "dark");

  useEffect(() => {
    Store.getItem(KEY).then((raw) => {
      if (raw) { try { setSaved({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) }); } catch { /* ignore a bad local blob */ } }
    }).catch(() => {}).finally(() => setLoaded(true));
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme === "light" ? "light" : "dark"));
    return () => sub.remove();
  }, []);

  const value = useMemo<Prefs>(() => {
    const patch = (p: Partial<Saved>) => setSaved((cur) => {
      const next = { ...cur, ...p };
      Store.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    const resolved = saved.theme === "system" ? system : saved.theme;
    return {
      ...saved,
      loaded,
      isDark: resolved !== "light",
      palette: resolved === "light" ? light : dark,
      setTheme: (theme) => patch({ theme }),
      toggleBalances: () => patch({ hideBalances: !saved.hideBalances }),
      setBalances: (hideBalances) => patch({ hideBalances }),
      setLock: (lockOn) => patch({ lockOn }),
      setBio: (bioOn) => patch({ bioOn }),
      setOnboarded: () => patch({ onboarded: true }),
      setSecurityAsked: () => patch({ securityAsked: true, passkeyAsk: true }),
      dismissPasskey: () => patch({ passkeyAsk: false }),
      startTour: () => { if (!saved.tourDone) patch({ tourOn: true, tourStep: 0 }); },
      setTourStep: (tourStep) => patch({ tourStep }),
      endTour: () => patch({ tourOn: false, tourDone: true }),
    };
  }, [saved, system, loaded]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("Prefs missing");
  return v;
}
