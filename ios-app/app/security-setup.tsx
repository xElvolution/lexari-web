import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Check, Fingerprint, KeyRound, ScanFace } from "lucide-react-native";
import { Button, T, tap } from "@/components/ui";
import { PinPad } from "@/components/PinPad";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { bioInfo, bioUnlock, type Bio } from "@/lib/bio";
import { markUnlocked, savePin } from "@/lib/lock";

type Step = "intro" | "pin" | "confirm" | "done";

function Halo({ children }: { children: React.ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 0 })), -1); }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.5 }] }));
  return (
    <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: "#8f6bff" }, ring]} />
      <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(91,43,255,0.22)", alignItems: "center", justifyContent: "center" }}>{children}</View>
    </View>
  );
}

/** Same backdrop as the lock screen (AppLock): #07050e with a soft grape glow at a third of the height. */
function LockBg() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      <Defs>
        <RadialGradient id="setupglow" cx={width / 2} cy={height / 3} r={430} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#5b2bff" stopOpacity="0.3" />
          <Stop offset="0.3" stopColor="#5b2bff" stopOpacity="0.28" />
          <Stop offset="0.5" stopColor="#5b2bff" stopOpacity="0.17" />
          <Stop offset="0.7" stopColor="#5b2bff" stopOpacity="0.06" />
          <Stop offset="1" stopColor="#5b2bff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="#07050e" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#setupglow)" />
    </Svg>
  );
}

const easy = (v: string) => /^(\d)\1+$/.test(v) || "0123456789".includes(v) || "9876543210".includes(v);

export default function SecuritySetup() {
  const { mode, next } = useLocalSearchParams<{ mode?: string; next?: string }>();
  const changing = mode === "pin";
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me, reload } = useData();
  const { setBio, setLock, setSecurityAsked } = usePrefs();
  const hasServerPin = !!me?.lockOn;
  const [bio, setBioInfo] = useState<Bio | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [step, setStep] = useState<Step>(changing ? "pin" : "intro");
  const [first, setFirst] = useState("");
  const [err, setErrText] = useState("");
  const [errKey, setErrKey] = useState(0);
  const setErr = (m: string) => { setErrText(m); if (m) setErrKey((n) => n + 1); };
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const pop = useSharedValue(0);

  useEffect(() => { bioInfo().then(setBioInfo).catch(() => {}); }, []);
  useEffect(() => { if (step === "done") pop.value = withSpring(1, { damping: 9 }); }, [step, pop]);
  const popSt = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: pop.value }));

  const finish = () => {
    setSecurityAsked();
    if (changing) router.back(); else router.replace((next as never) || "/(tabs)/agents");
  };

  const enableBio = async () => {
    if (!bio?.ok) return;
    if (await bioUnlock(`Turn on ${bio.label}`)) {
      setBio(true); setBioOn(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (hasServerPin) { setStep("done"); return; }
      setNote(`${bio.label} is on. Add a backup PIN in case it can't read you.`);
      setStep("pin");
    }
  };

  const onPin = async (v: string) => {
    setErr("");
    if (step === "pin") {
      if (easy(v)) { setErr("That PIN is too easy to guess. Try another."); return; }
      setFirst(v); setNote(""); setStep("confirm");
      return;
    }
    if (v !== first) { setErr("Those didn't match. Start again."); setFirst(""); setStep("pin"); return; }
    if (!token) return;
    setBusy(true);
    try {
      await savePin(v, token);
      setLock(true); markUnlocked(); void reload();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep("done");
    } catch (e) { setErr((e as Error).message || "That didn't save. Try again."); setFirst(""); setStep("pin"); }
    finally { setBusy(false); }
  };

  const wrap = { flex: 1, backgroundColor: "#07050e", paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 };

  if (step === "intro") {
    const BioIcon = bio?.face ? ScanFace : Fingerprint;
    return (
      <View style={wrap}>
        <LockBg />
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Pressable hitSlop={12} onPress={() => { tap(); finish(); }}><Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: "600" }}>Skip</Text></Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Halo><BioIcon color="#c9b8ff" size={58} strokeWidth={1.6} /></Halo>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", letterSpacing: -0.9, marginTop: 28, textAlign: "center" }}>Lock Lexari to you</Text>
          <Text style={[T.body, { color: "rgba(255,255,255,0.6)", marginTop: 10, textAlign: "center", maxWidth: 310, fontSize: 14.5, lineHeight: 21 }]}>
            {bio?.ok ? `Use ${bio.label} to open the app and approve payments. You can add a 4-digit PIN as a backup.` : "Set a 4-digit PIN to open the app and approve payments. You can turn this off any time in Settings."}
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {bio?.ok ? <Button label={`Use ${bio.label}`} icon={<BioIcon color="#fff" size={18} />} onPress={enableBio} /> : null}
          {!hasServerPin ? <Button kind={bio?.ok ? "ghost" : "primary"} label="Set a 4-digit PIN" icon={<KeyRound color="#fff" size={18} />} onPress={() => { setNote(""); setErr(""); setStep("pin"); }} /> : null}
          <Pressable onPress={() => { tap(); finish(); }} style={{ height: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Not now</Text></Pressable>
        </View>
      </View>
    );
  }

  if (step === "done") {
    return (
      <View style={wrap}>
        <LockBg />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#34d399", alignItems: "center", justifyContent: "center" }, popSt]}><Check color="#04120c" size={48} strokeWidth={3} /></Animated.View>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700", letterSpacing: -0.8, marginTop: 24 }}>{changing ? "PIN updated" : "You're protected"}</Text>
          <Text style={[T.body, { color: "rgba(255,255,255,0.6)", marginTop: 8, textAlign: "center", maxWidth: 300 }]}>{bioOn ? "Lexari opens with your biometrics, with your PIN as a backup." : "Lexari will ask for your PIN when it opens."}</Text>
        </View>
        <Button label={changing ? "Done" : "Enter Lexari"} onPress={finish} />
      </View>
    );
  }

  return (
    <View style={wrap}>
      <LockBg />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", height: 20 }}>
        {!changing ? <Pressable hitSlop={12} onPress={() => { tap(); finish(); }}><Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: "600" }}>Skip</Text></Pressable> : null}
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ marginBottom: 32, width: 56, height: 56, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#0a0a0a" }} />
        </View>
        <PinPad dark key={step} title={step === "pin" ? "Choose a 4-digit PIN" : "Enter it again"}
          sub={note || (step === "pin" ? "You'll use it to open Lexari and to view card details." : undefined)}
          error={err} errorKey={errKey} busy={busy} onDone={(p) => void onPin(p)} />
      </View>
    </View>
  );
}
