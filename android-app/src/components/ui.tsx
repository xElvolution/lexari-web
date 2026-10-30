import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AgentFace from "./AgentFace";
import type { ColorKey, FaceState } from "./avatar";
import { specialist } from "@/content/roster";
import { usePrefs } from "@/state/prefs";
import { grape } from "@/theme/colors";
import { NetworkBanner } from "./NetworkPill";

export const tap = () => { Haptics.selectionAsync().catch(() => {}); };
export const T = {
  h1: { fontSize: 24, fontWeight: "700", letterSpacing: -0.6 } as TextStyle,
  h2: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 } as TextStyle,
  body: { fontSize: 13.5, lineHeight: 19 } as TextStyle,
  small: { fontSize: 11.5, lineHeight: 15 } as TextStyle,
  label: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" } as TextStyle,
};

export function Screen({ children, style, pad = true }: { children: ReactNode; style?: ViewStyle; pad?: boolean }) {
  const { palette } = usePrefs();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top + 6, paddingHorizontal: pad ? 16 : 0 }, style]}>
      {children}
    </View>
  );
}

/** Screen header: big title on the left, icon buttons on the right. */
export function Header({ title, sub, right, pill = false }: { title: string; sub?: string; right?: ReactNode; pill?: boolean }) {
  const { palette } = usePrefs();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[T.h1, { color: palette.ink }]} numberOfLines={1}>{title}</Text>
          {pill ? <NetworkBanner /> : null}
        </View>
        {sub ? <Text style={[T.small, { color: palette.muted, marginTop: 1 }]} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right ? <View style={{ flexDirection: "row", gap: 8 }}>{right}</View> : null}
    </View>
  );
}

export function Title({ children }: { children: string }) {
  const { palette } = usePrefs();
  return <Text style={[T.h1, { color: palette.ink }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const { palette } = usePrefs();
  return <Text style={[T.small, { color: palette.muted }, style]}>{children}</Text>;
}

export function SectionLabel({ children }: { children: string }) {
  const { palette } = usePrefs();
  return <Text style={[T.label, { color: palette.muted, marginTop: 20, marginBottom: 8 }]}>{children}</Text>;
}

export function IconButton({ label, onPress, children, size = 38 }: { label: string; onPress: () => void; children: ReactNode; size?: number }) {
  const { palette } = usePrefs();
  return (
    <Pressable accessibilityLabel={label} onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: palette.tint, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      {children}
    </Pressable>
  );
}

export function Button({ label, onPress, kind = "primary", icon, disabled, style }: { label: string; onPress: () => void; kind?: "primary" | "ghost" | "light"; icon?: ReactNode; disabled?: boolean; style?: ViewStyle }) {
  const { palette } = usePrefs();
  const bg = kind === "primary" ? grape : kind === "light" ? "#ffffff" : palette.tint;
  const fg = kind === "primary" ? "#fff" : kind === "light" ? "#0a0a0a" : palette.ink;
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [{ height: 50, borderRadius: 16, backgroundColor: bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], borderWidth: kind === "ghost" ? StyleSheet.hairlineWidth : 0, borderColor: palette.line }, style]}>
      {icon}
      <Text style={{ color: fg, fontSize: 15, fontWeight: "600", letterSpacing: -0.2 }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { palette } = usePrefs();
  const base: ViewStyle = { backgroundColor: palette.card, borderRadius: 20, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [base, style, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>{children}</Pressable>;
}

export function Money({ amount, unit, size = 14 }: { amount: string; unit?: string; size?: number }) {
  const { hideBalances, palette } = usePrefs();
  return <Text style={{ color: palette.ink, fontSize: size, fontWeight: "700", letterSpacing: size > 20 ? -1 : 0 }}>{hideBalances ? "••••" : amount}{unit ? <Text style={{ fontSize: Math.max(11, size * 0.45), color: palette.muted, fontWeight: "500" }}>{` ${unit}`}</Text> : null}</Text>;
}

const HOME_COLOR: ColorKey = "lilac";
/** An agent face. Same seeds and colors as the web app. Pass a roster slug, or nothing for your own agent. */
export function Face({ slug, seed, color, mood = "idle", size = 44, animated = false }: { slug?: string; seed?: number; color?: ColorKey | string; mood?: FaceState; size?: number; animated?: boolean }) {
  const s = specialist(slug);
  const key = (s?.face || (color && !color.startsWith("#") ? color : undefined)) as ColorKey | undefined;
  return <AgentFace seed={s?.seed ?? seed} variant={key ? { color: key } : seed === undefined && !s ? { color: HOME_COLOR } : undefined} size={size} state={mood} animated={animated || mood !== "idle"} />;
}

/** Bottom sheet. Plain Modal so it works the same on Android and the web preview. */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const { palette } = usePrefs();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: palette.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 18, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line }}>
        <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: palette.line, marginBottom: 12 }} />
        {title ? <Text style={[T.h2, { color: palette.ink, marginBottom: 10 }]}>{title}</Text> : null}
        <View style={{ gap: 10 }}>{children}</View>
      </View>
    </Modal>
  );
}

export function Row({ title, detail, onPress, icon, right, danger }: { title: string; detail?: string; onPress?: () => void; icon?: ReactNode; right?: ReactNode; danger?: boolean }) {
  const { palette } = usePrefs();
  return (
    <Pressable onPress={onPress ? () => { tap(); onPress(); } : undefined} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, opacity: pressed && onPress ? 0.7 : 1 })}>
      {icon ? <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: palette.tint, alignItems: "center", justifyContent: "center" }}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? "#ff6b81" : palette.ink, fontSize: 14, fontWeight: "500" }}>{title}</Text>
        {detail ? <Text style={[T.small, { color: palette.muted, marginTop: 1 }]}>{detail}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ w = "100%", h = 14, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: ViewStyle }) {
  const { palette } = usePrefs();
  const o = useSharedValue(0.45);
  useEffect(() => { o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.45, { duration: 700 })), -1); }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: palette.tint }, st, style]} />;
}

export function Loading() {
  return <View style={{ gap: 10, marginTop: 16 }}><Skeleton h={64} r={18} /><Skeleton h={64} r={18} /><Skeleton w="60%" /></View>;
}

/** Calm inline notice. Friendly copy only; dev detail goes to the console. */
export function Notice({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const { palette } = usePrefs();
  return (
    <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: palette.tint }}>
      <Text style={[T.small, { color: palette.ink, flex: 1 }]}>{text}</Text>
      {onRetry ? <Pressable onPress={() => { tap(); onRetry(); }}><Text style={{ color: palette.brand, fontSize: 12.5, fontWeight: "600" }}>Retry</Text></Pressable> : null}
    </View>
  );
}

export function ErrorText({ text }: { text: string }) {
  return <Text style={{ color: "#ff6b81", fontSize: 12, marginTop: 8 }}>{text}</Text>;
}

/** Fade + rise on mount. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }); }, [v]);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 10 }] }));
  void delay;
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

export function useRefresh(load: () => Promise<void>, deps: unknown[]) {
  useEffect(() => { load().catch(() => {}); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Turn any thrown error into a short, friendly line. The raw error goes to the console. */
export function friendly(e: unknown, fallback: string): string {
  console.warn("[lexari]", e);
  const m = e instanceof Error ? e.message : "";
  if (/network|fetch|Failed to fetch|TypeError/i.test(m) || !m) return "Can't reach Lexari right now. Check your connection and try again.";
  if (/401|unauthor|session/i.test(m)) return "Your session ended. Sign in again.";
  return fallback;
}
