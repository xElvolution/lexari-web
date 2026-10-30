/** Port of webapp/components/lock/PinPad.tsx: title, dots that fill and shake, round keys, chevron delete. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Icon from "@/components/Icon";
import { F, GRAPE, useC } from "@/web/kit";
import { PIN_LENGTH } from "@/lib/lock";

export const PIN_LEN = PIN_LENGTH;

function Dot({ on, dark, ink }: { on: boolean; dark: boolean; ink: string }) {
  const s = useSharedValue(on ? 1.1 : 1);
  useEffect(() => { s.value = withTiming(on ? 1.1 : 1, { duration: 150 }); }, [on, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[{ width: 14, height: 14, borderRadius: 7, backgroundColor: on ? GRAPE : dark ? "rgba(255,255,255,0.25)" : ink }, st]} />;
}

function Key({ onPress, label, children, dark, plain }: { onPress: () => void; label: string; children: ReactNode; dark: boolean; plain?: boolean }) {
  const k = useC();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({
        width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
        backgroundColor: plain ? "transparent" : dark ? (pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)") : pressed ? GRAPE : k.tint,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}>
      {({ pressed }) => typeof children === "string"
        ? <Text style={{ fontFamily: F.semi, fontSize: 26, color: dark ? "#fff" : pressed ? "#fff" : k.ink }}>{children}</Text>
        : children}
    </Pressable>
  );
}

/** A phone-style PIN pad. Calls onDone with the digits; the parent shows errors. `side` fills the empty bottom-left slot. */
export function PinPad({ title, sub, length = PIN_LEN, error, errorKey = 0, busy, onDone, dark = false, side }: {
  title: string; sub?: string; length?: number; error?: string; errorKey?: number; busy?: boolean; onDone: (pin: string) => void; dark?: boolean; side?: ReactNode;
}) {
  const k = useC();
  const [pin, setPin] = useState("");
  const x = useSharedValue(0);
  const pinRef = useRef(pin);
  pinRef.current = pin;
  useEffect(() => {
    if (!error) return;
    setPin("");
    x.value = withSequence(withTiming(-8, { duration: 80 }), withTiming(8, { duration: 80 }), withTiming(-5, { duration: 80 }), withTiming(5, { duration: 80 }), withTiming(0, { duration: 80 }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, [error, errorKey, x]);
  const add = (d: string) => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const n = (pinRef.current + d).slice(0, length);
    pinRef.current = n;
    setPin(n);
    if (n.length === length) onDone(n);
  };
  const del = () => { const n = pinRef.current.slice(0, -1); pinRef.current = n; setPin(n); };
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const on = (e: KeyboardEvent) => { if (/^[0-9]$/.test(e.key)) add(e.key); else if (e.key === "Backspace") del(); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const ink = dark ? "#fff" : k.ink;
  const soft = dark ? "rgba(255,255,255,0.7)" : k.ink60;
  const row = (ds: string[]) => (
    <View style={{ flexDirection: "row", gap: 16 }}>
      {ds.map((d) => <Key key={d} label={d} dark={dark} onPress={() => add(d)}>{d}</Key>)}
    </View>
  );
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontFamily: F.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.8, color: ink, textAlign: "center" }}>{title}</Text>
      {sub ? <Text style={{ marginTop: 8, textAlign: "center", fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: soft }}>{sub}</Text> : null}
      <Animated.View accessibilityLabel={`${pin.length} of ${length} digits`} style={[{ marginTop: 24, flexDirection: "row", gap: 12 }, shake]}>
        {Array.from({ length }).map((_, i) => <Dot key={i} on={i < pin.length} dark={dark} ink={dark ? "" : k.dark ? "rgba(255,255,255,0.15)" : "rgba(10,10,10,0.15)"} />)}
      </Animated.View>
      <View style={{ marginTop: 12, minHeight: 20, justifyContent: "center" }}>
        <Text accessibilityRole="alert" style={{ fontFamily: busy ? F.sans : F.semi, fontSize: 13, color: busy ? soft : "#ff5a5f", textAlign: "center" }}>{busy ? "Checking…" : error || ""}</Text>
      </View>
      <View style={{ marginTop: 8, gap: 16 }}>
        {row(["1", "2", "3"])}
        {row(["4", "5", "6"])}
        {row(["7", "8", "9"])}
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>{side}</View>
          <Key label="0" dark={dark} onPress={() => add("0")}>0</Key>
          <Key label="Delete" dark={dark} plain onPress={del}><Icon name="left" size={22} color={dark ? "rgba(255,255,255,0.8)" : k.ink75} /></Key>
        </View>
      </View>
    </View>
  );
}
