/** Reanimated ports of the web's CSS keyframe loops (webapp/app/globals.css) and its Toaster. */
import { Children, isValidElement, useCallback, useEffect, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useMotion } from "@/lib/motion";
import { F, GRAPE, useC } from "@/web/kit";

/** A looping 0→1 clock: `linear` for spins, ease-in-out ping-pong otherwise. */
function useLoop(ms: number, want = true, linear = false) {
  const on = useMotion(want);
  const p = useSharedValue(0);
  useEffect(() => {
    if (!on) { cancelAnimation(p); p.value = withTiming(0, { duration: 200 }); return; }
    p.value = 0;
    p.value = linear ? withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false) : withRepeat(withTiming(1, { duration: ms / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(p);
  }, [ms, on, linear, p]);
  return p;
}

/** .hub-orbit / .hub-rays: rotate forever (reverse = counter-spin, for children that stay upright). */
export function Spin({ ms = 48000, reverse, children, style, on = true }: { ms?: number; reverse?: boolean; children?: ReactNode; style?: ViewStyle | ViewStyle[]; on?: boolean }) {
  const p = useLoop(ms, on, true);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${(reverse ? -360 : 360) * p.value}deg` }] }));
  return <Animated.View pointerEvents="box-none" style={[style as ViewStyle, st]}>{children}</Animated.View>;
}
/** .hub-float / .lv-float: bob up and down. */
export function Float({ ms = 3200, y = 7, children, style, on = true }: { ms?: number; y?: number; children: ReactNode; style?: ViewStyle | ViewStyle[]; on?: boolean }) {
  const p = useLoop(ms, on);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -y * p.value }] }));
  return <Animated.View style={[style as ViewStyle, st]}>{children}</Animated.View>;
}
/** .box-bounce (idle box) / .box-shake (opening) / .lv-bounce (levelling up). */
export function Bounce({ mode, children, style }: { mode: "box" | "shake" | "level" | "none"; children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const ms = mode === "shake" ? 450 : mode === "level" ? 700 : 1300;
  const p = useLoop(ms, mode !== "none", true);
  const st = useAnimatedStyle(() => {
    const t = p.value;
    if (mode === "shake") {
      const rot = interpolate(t, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], [0, -12, 10, -9, 8, -5, 0]);
      const sc = interpolate(t, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], [1.05, 1.08, 1.1, 1.12, 1.14, 1.16, 1.05]);
      return { transform: [{ rotate: `${rot}deg` }, { scale: sc }] };
    }
    if (mode === "level") {
      const ty = interpolate(t, [0, 0.3, 0.55, 0.75, 1], [0, -16, 0, -6, 0]);
      const sx = interpolate(t, [0, 0.3, 0.55, 0.75, 1], [1, 1.06, 0.96, 1.02, 1]);
      const sy = interpolate(t, [0, 0.3, 0.55, 0.75, 1], [1, 0.96, 1.05, 1.02, 1]);
      return { transform: [{ translateY: ty }, { scaleX: sx }, { scaleY: sy }] };
    }
    if (mode === "box") {
      const ty = interpolate(t, [0, 0.5, 1], [0, -14, 0]);
      const sx = interpolate(t, [0, 0.5, 1], [1, 1.04, 1]); const sy = interpolate(t, [0, 0.5, 1], [1, 0.97, 1]);
      return { transform: [{ translateY: ty }, { scaleX: sx }, { scaleY: sy }] };
    }
    return { transform: [] };
  }, [mode]);
  return <Animated.View style={[style as ViewStyle, st]}>{children}</Animated.View>;
}
/** .lv-pop / .pop: a one-shot scale punch whenever `k` changes. */
export function Pop({ k, children, style, from = 0.6 }: { k: string | number; children: ReactNode; style?: ViewStyle | ViewStyle[]; from?: number }) {
  const s = useSharedValue(1);
  const r = useSharedValue(0);
  useEffect(() => {
    s.value = from; r.value = -4;
    s.value = withSequence(withTiming(1.22, { duration: 245, easing: Easing.out(Easing.cubic) }), withTiming(0.95, { duration: 210 }), withTiming(1, { duration: 245, easing: Easing.out(Easing.back(2)) }));
    r.value = withSequence(withTiming(-4, { duration: 245 }), withTiming(2, { duration: 210 }), withTiming(0, { duration: 245 }));
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${r.value}deg` }] }));
  return <Animated.View style={[style as ViewStyle, st]}>{children}</Animated.View>;
}
/** A dialog's .pop entrance: grows in from .9 with a little overshoot. */
export function PopIn({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withSpring(1, { damping: 13, stiffness: 180, mass: 0.8 }); }, [p]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.5), transform: [{ scale: 0.86 + 0.14 * p.value }, { translateY: (1 - p.value) * 24 }] }));
  return <Animated.View style={[style as ViewStyle, st]}>{children}</Animated.View>;
}

const BURST = ["#ffd84d", "#c9b8ff", "#ffffff", "#8f6bff", "#ff9ec7", "#7ef0c4"];
function Bit({ i, n, d }: { i: number; n: number; d: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(1, { duration: 1100, easing: Easing.bezier(0.15, 0.7, 0.3, 1) }); }, [p]);
  const a = (i / n) * Math.PI * 2;
  const st = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ translateX: Math.sin(a) * d * p.value }, { translateY: -Math.cos(a) * d * p.value }, { rotate: `${(i / n) * 360}deg` }, { scale: 0.4 + 0.6 * p.value }] }));
  return <Animated.View style={[{ position: "absolute", left: "50%", top: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: 3, backgroundColor: BURST[i % BURST.length] }, st]} />;
}
/** .lv-burst: confetti squares fly out from the centre. Remount (change `key`) to fire again. */
export function Burst({ n = 18, base = 76 }: { n?: number; base?: number }) {
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>{Array.from({ length: n }, (_, i) => <Bit key={i} i={i} n={n} d={base + (i % 3) * 16} />)}</View>;
}
/** .hub-rise: "+25 XP" floats up and fades. */
export function RiseText({ text, color = "#ffd84d" }: { text: string; color?: string }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }); }, [p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85, transform: [{ translateY: p.value < 0.15 ? -10 * (p.value / 0.15) : -10 - 54 * ((p.value - 0.15) / 0.85) }, { scale: p.value < 0.15 ? 0.6 + 0.4 * (p.value / 0.15) : 1 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 8, left: 0, right: 0, alignItems: "center" }, st]}><Text style={{ fontFamily: F.xbold, fontSize: 18, color, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 6 }}>{text}</Text></Animated.View>;
}

// ---------- Toaster (webapp/components/Toaster.tsx) ----------
export type Toast = { id: number; text: string; action?: { label: string; run: () => void }; ms?: number };
let seq = 0;
let list: Toast[] = [];
const subs = new Set<(l: Toast[]) => void>();
const emit = () => subs.forEach((f) => f(list));
export function dismiss(id: number) { list = list.filter((t) => t.id !== id); emit(); }
/** Show a toast; it leaves on its own after `ms` (default 3.6s), on swipe, or on the close button. */
export function toast(t: Omit<Toast, "id"> | string) {
  const v: Toast = typeof t === "string" ? { id: ++seq, text: t } : { ...t, id: ++seq };
  list = [...list.slice(-2), v]; emit();
  return v.id;
}

function ToastItem({ t }: { t: Toast }) {
  const k = useC();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0), y = useSharedValue(30), o = useSharedValue(0), s = useSharedValue(0.9);
  const [gone, setGone] = useState(false);
  const leave = (dir = 0) => {
    if (gone) return; setGone(true);
    const done = () => dismiss(t.id);
    if (dir) { x.value = withTiming(dir * width, { duration: 220 }, () => runOnJS(done)()); o.value = withTiming(0, { duration: 220 }); }
    else { o.value = withTiming(0, { duration: 220 }); y.value = withTiming(20, { duration: 220 }, () => runOnJS(done)()); }
  };
  useEffect(() => {
    y.value = withTiming(0, { duration: 550, easing: Easing.out(Easing.back(1.8)) });
    s.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.8)) });
    o.value = withTiming(1, { duration: 300 });
    const h = setTimeout(() => leave(0), t.ms ?? 3600);
    return () => clearTimeout(h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pan = Gesture.Pan().activeOffsetX([-12, 12]).failOffsetY([-20, 20])
    .onUpdate((e) => { x.value = e.translationX; o.value = 1 - Math.min(0.7, Math.abs(e.translationX) / 300); })
    .onEnd((e) => { if (Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 600) runOnJS(leave)(e.translationX > 0 ? 1 : -1); else { x.value = withSpring(0); o.value = withTiming(1); } });
  const fling = Gesture.Pan().activeOffsetY([12, 999]).onEnd((e) => { if (e.translationY > 30) runOnJS(leave)(0); });
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }] }));
  return (
    <GestureDetector gesture={Gesture.Race(pan, fling)}>
      <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[{ width: "100%", maxWidth: 420, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: k.ink, paddingVertical: 10, paddingLeft: 14, paddingRight: 8, shadowColor: "#140050", shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 18 }, elevation: 12 }, st]}>
        <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 14, lineHeight: 19, color: k.bg }}>{t.text}</Text>
        {t.action ? <Pressable onPress={() => { t.action!.run(); leave(0); }} style={{ borderRadius: 999, backgroundColor: GRAPE, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ fontFamily: F.bold, fontSize: 13, color: "#fff" }}>{t.action.label}</Text></Pressable> : null}
        <Pressable accessibilityLabel="Dismiss" hitSlop={8} onPress={() => leave(0)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={15} color={k.dark ? "rgba(10,10,10,0.6)" : "rgba(255,255,255,0.6)"} /></Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

/** Mount once at the root: toasts sit above the bottom nav, newest last. */
export function Toaster() {
  const [l, setL] = useState<Toast[]>(list);
  const insets = useSafeAreaInsets();
  useEffect(() => { subs.add(setL); return () => { subs.delete(setL); }; }, []);
  if (!l.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 84, alignItems: "center", gap: 8 }}>
      {l.map((t) => <ToastItem key={t.id} t={t} />)}
    </View>
  );
}

// ---------- page entrance (AppShell: gsap.from("[data-rise]", { y: 14, opacity: 0, duration: .5, stagger: .05, ease: "power2.out" })) ----------
function RiseIn({ i, gen, children }: { i: number; gen: number; children: ReactNode }) {
  const p = useSharedValue(gen ? 0 : 1);
  useEffect(() => {
    if (!gen) return;
    p.value = 0;
    p.value = withDelay(Math.min(i, 12) * 50, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
  }, [gen, i, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 14 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}
/** Wrap a screen's sections: each one rises in, 50ms apart, every time the tab comes into view. */
export function Stage({ children }: { children: ReactNode }) {
  const [gen, setGen] = useState(0);
  useFocusEffect(useCallback(() => { setGen((g) => g + 1); }, []));
  let n = 0;
  return <>{Children.map(children, (c) => (isValidElement(c) ? <RiseIn i={n++} gen={gen}>{c}</RiseIn> : c))}</>;
}
