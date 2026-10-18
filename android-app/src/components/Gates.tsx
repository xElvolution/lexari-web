export { NetworkBanner } from "./NetworkPill";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { bioInfo, bioUnlock, type Bio } from "@/lib/bio";
import { IDLE_MS, forgetUnlock, markUnlocked, verifyPin, wasUnlocked } from "@/lib/lock";
import Icon from "./Icon";
import { PinPad } from "./PinPad";
import { F } from "@/web/kit";

/**
 * Port of webapp/components/lock/AppLock.tsx. Full-screen lock when the account has an app PIN (lockOn from /api/me):
 * on open, and again after 5 minutes away. The PIN is checked by the server. Biometrics, when turned on here, are a
 * local gate in front of it.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { lockOn: cachedOn, bioOn, loaded, setLock } = usePrefs();
  const { token } = useSession();
  const { me } = useData();
  const on = !!token && (me ? !!me.lockOn : cachedOn);
  const [locked, setLocked] = useState(false);
  const away = useRef(0);

  // keep a local copy of the server flag so the lock shows before /api/me answers on the next launch
  useEffect(() => { if (me && !!me.lockOn !== cachedOn) setLock(!!me.lockOn); }, [me, cachedOn, setLock]);

  useEffect(() => {
    if (!loaded) return;
    if (!on) { setLocked(false); return; }
    if (!wasUnlocked()) setLocked(true);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background" || s === "inactive") { if (!away.current) away.current = Date.now(); }
      else if (s === "active") {
        if (away.current && Date.now() - away.current > IDLE_MS) setLocked(true);
        away.current = 0;
      }
    });
    return () => sub.remove();
  }, [on, loaded]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {on && locked ? <AppLock bioOn={bioOn} onOpen={() => { markUnlocked(); setLocked(false); }} /> : null}
    </View>
  );
}

function Glow() {
  const { width, height } = useWindowDimensions();
  // a 420px grape/30 disc blurred by 110px, centred at 50% / 33%
  const r = 210 + 220;
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      <Defs>
        <RadialGradient id="lockglow" cx={width / 2} cy={height / 3} r={r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#5b2bff" stopOpacity="0.3" />
          <Stop offset="0.3" stopColor="#5b2bff" stopOpacity="0.28" />
          <Stop offset="0.5" stopColor="#5b2bff" stopOpacity="0.17" />
          <Stop offset="0.7" stopColor="#5b2bff" stopOpacity="0.06" />
          <Stop offset="0.88" stopColor="#5b2bff" stopOpacity="0.01" />
          <Stop offset="1" stopColor="#5b2bff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#lockglow)" />
    </Svg>
  );
}

function AppLock({ bioOn, onOpen }: { bioOn: boolean; onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  const { token, signOut } = useSession();
  const [err, setErrText] = useState("");
  const [errKey, setErrKey] = useState(0);
  const setErr = (m: string) => { setErrText(m); if (m) setErrKey((n) => n + 1); };
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState<Bio | null>(null);

  const tryBio = useCallback(async (info: Bio | null) => {
    if (!bioOn || !info?.ok) return;
    if (await bioUnlock("Unlock Lexari")) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onOpen(); }
  }, [bioOn, onOpen]);

  useEffect(() => { bioInfo().then((b) => { setBio(b); void tryBio(b); }).catch(() => {}); }, [tryBio]);

  const done = async (pin: string) => {
    if (!token) return;
    setBusy(true); setErr("");
    try { await verifyPin(pin, token); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onOpen(); }
    catch (e) { setErr((e as Error).message || "That PIN isn't right."); }
    finally { setBusy(false); }
  };
  const out = async () => { forgetUnlock(); await signOut(); router.replace("/(auth)/sign-in"); };
  const showBio = bioOn && bio?.ok;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 120, backgroundColor: "#07050e", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Glow />
      <View style={{ marginBottom: 32, width: 56, height: 56, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#0a0a0a" }} />
      </View>
      <PinPad dark title="Enter your PIN" sub="Lexari is locked on this device." error={err} errorKey={errKey} busy={busy} onDone={(p) => void done(p)}
        side={showBio ? (
          <Pressable accessibilityLabel={`Use ${bio?.label || "biometrics"}`} onPress={() => void tryBio(bio)} style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
            <Icon name="finger" size={24} color="rgba(255,255,255,0.8)" />
          </Pressable>
        ) : undefined} />
      <Pressable onPress={() => void out()} style={{ marginTop: 32 }} hitSlop={8}>
        {({ pressed }) => <Text style={{ fontFamily: F.semi, fontSize: 13.5, color: pressed ? "#fff" : "rgba(255,255,255,0.6)" }}>Forgot it? Sign out</Text>}
      </Pressable>
    </Animated.View>
  );
}

/** Extra local confirmation before money moves. The server still requires its own step-up. */
export async function biometricGate(reason: string): Promise<boolean> {
  const b = await bioInfo();
  if (!b.ok) return true;
  return bioUnlock(reason);
}
