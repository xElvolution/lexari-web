/**
 * The interactive agent on the intro pages: your Lexari agent's face, big and alive.
 * Tap it: it squashes and stretches, grins and throws a burst of sparks. Drag it: it follows your finger on a spring
 * and its eyes track you, then springs home when you let go. Around it, per page:
 * "memory" orbiting memory chips you can flick, "think" thought sparkles while it looks around, "team" teammates popping in.
 * Every layer drifts with the page swipe (x) at its own speed, for depth.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, cancelAnimation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import AgentFace from "./AgentFace";
import { Face } from "./ui";
import type { FaceState } from "./avatar";
import { F } from "@/web/kit";

export type IntroMode = "memory" | "think" | "team";
/** width: the stage (page minus its 20px gutters); page: the full page width the scroll x moves in */
type P = { mode: IntroMode; x: SharedValue<number>; index: number; width: number; page: number; height: number; active: boolean };

// short on purpose: the orbit has to clear the face and the screen edge, so each chip is a word or two
const MEMS = ["One page", "Tables", "Maya", "Fridays", "Mornings"];
const TEAM = ["scout", "quill", "tally", "frame", "patch"] as const;

/** depth: how far this layer slides while you swipe between pages (0 = pinned to the page) */
function useParallax(x: SharedValue<number>, index: number, width: number, depth: number) {
  return useAnimatedStyle(() => {
    const d = (x.value - index * width) / width;
    return { transform: [{ translateX: d * width * depth }] };
  });
}

function Glow({ size, pulse }: { size: number; pulse: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45, transform: [{ scale: 0.9 + pulse.value * 0.2 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size }, st]}>
      <Svg width={size} height={size}><Defs><RadialGradient id="ig" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#7b55ff" stopOpacity="0.9" /><Stop offset="0.45" stopColor="#5b2bff" stopOpacity="0.35" /><Stop offset="1" stopColor="#5b2bff" stopOpacity="0" /></RadialGradient></Defs><Rect width="100%" height="100%" fill="url(#ig)" /></Svg>
    </Animated.View>
  );
}

/** Slow motes rising through the stage. */
function Mote({ i, w, h }: { i: number; w: number; h: number }) {
  const p = useSharedValue(0);
  const seed = useMemo(() => ({ x: ((i * 73) % 100) / 100, d: 5200 + ((i * 37) % 9) * 500, s: 2 + (i % 3), delay: (i * 410) % 4000 }), [i]);
  useEffect(() => { p.value = withDelay(seed.delay, withRepeat(withTiming(1, { duration: seed.d, easing: Easing.linear }), -1)); }, [p, seed]);
  const st = useAnimatedStyle(() => ({ opacity: Math.sin(p.value * Math.PI) * 0.7, transform: [{ translateY: h - p.value * h * 1.1 }, { translateX: Math.sin(p.value * 6 + i) * 10 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: seed.x * w, top: 0, width: seed.s, height: seed.s, borderRadius: 2, backgroundColor: i % 2 ? "#c9b8ff" : "#fff" }, st]} />;
}

/** One spark of the tap burst. */
function Spark({ i, n, burst, size }: { i: number; n: number; burst: SharedValue<number>; size: number }) {
  const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
  const st = useAnimatedStyle(() => {
    const t = burst.value; const r = size * 0.32 + t * (size * 0.45 + (i % 3) * 18);
    return { opacity: t > 0 && t < 1 ? Math.min(1, (1 - t) * 1.6) : 0, transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r }, { scale: 1.2 - t * 0.7 }, { rotate: `${t * 180}deg` }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: size / 2 - 8, top: size / 2 - 8, width: 16, height: 16, zIndex: 5 }, st]}><Svg width={16} height={16} viewBox="0 0 10 10"><Path d="M5 0 Q6 4 10 5 Q6 6 5 10 Q4 6 0 5 Q4 4 5 0Z" fill={i % 3 === 0 ? "#ffd84d" : i % 3 === 1 ? "#c9b8ff" : "#fff"} /></Svg></Animated.View>;
}

/**
 * A memory chip riding an elliptical orbit around the face; drag to flick it, it swings back into its lane.
 * It never covers or hides behind the face half-read: as it nears the face it fades out completely, and it is held
 * at least 16px inside the screen edge (lim = furthest a chip edge may sit from the stage centre).
 */
type FaceAt = { tx: SharedValue<number>; ty: SharedValue<number>; float: SharedValue<number>; sx: SharedValue<number>; sy: SharedValue<number>; x: SharedValue<number>; index: number; page: number };
function Chip({ i, n, label, spin, rx, ry, faceR, lim, face }: { i: number; n: number; label: string; spin: SharedValue<number>; rx: number; ry: number; faceR: number; lim: number; face: FaceAt }) {
  const dx = useSharedValue(0), dy = useSharedValue(0), extra = useSharedValue(0), hw = useSharedValue(60);
  const pan = Gesture.Pan()
    .onChange((e) => { dx.value += e.changeX; dy.value += e.changeY; })
    .onEnd((e) => {
      extra.value = withSpring(extra.value + (e.velocityX * 0.0009 - e.velocityY * 0.0004), { damping: 18, stiffness: 40 });
      dx.value = withSpring(0, { velocity: e.velocityX, damping: 9, stiffness: 90 }); dy.value = withSpring(0, { velocity: e.velocityY, damping: 9, stiffness: 90 });
    });
  const st = useAnimatedStyle(() => {
    const a = spin.value + extra.value + (i / n) * Math.PI * 2;
    const z = Math.sin(a); // front of the orbit is lower and a touch bigger
    const k = 0.9 + (z + 1) * 0.05;
    const w = hw.value * k, h = 14 * k;
    const edge = Math.max(0, lim - w);
    const cx = Math.max(-edge, Math.min(edge, Math.cos(a) * rx + dx.value)), cy = z * ry + dy.value;
    // gap between the chip's box and the face disc (plus a band for the bob): 0 or less = touching, fully gone
    // where the face is right now, seen from this layer (read straight from the gesture values, so it never lags a frame):
    // dragged by tx/ty, bobbing up to 10px, and this layer slides 15% with the swipe while the face doesn't
    const fx = face.tx.value - (face.x.value - face.index * face.page) * 0.15, fy = face.ty.value - face.float.value * 10;
    const gx = Math.max(0, Math.abs(cx - fx) - w), gy = Math.max(0, Math.abs(cy - fy) - h);
    const gap = Math.hypot(gx, gy) - faceR * Math.max(face.sx.value, face.sy.value); // a tap squashes it wider
    const clear = Math.max(0, Math.min(1, (gap - 20) / 20)); // fully gone well before it could touch the face
    return { opacity: clear * (0.75 + (z + 1) * 0.125), transform: [{ translateX: cx }, { translateY: cy }, { scale: k }] };
  });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID="intro-chip" style={[{ position: "absolute", width: 170, left: -85, top: -15, alignItems: "center" }, st]}>
       <View onLayout={(e) => { hw.value = e.nativeEvent.layout.width / 2; }} style={{ borderRadius: 999, backgroundColor: "rgba(20,14,40,0.82)", borderWidth: 1, borderColor: "rgba(201,184,255,0.35)", paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ["#d9ccff", "#a78bfa", "#93c5fd", "#e9d5ff", "#7dd3fc"][i % 5] }} />
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: "#fff" }} numberOfLines={1}>{label}</Text>
       </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Thought sparkles that pop above the head in turn. */
function Thought({ i, size }: { i: number; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(i * 500, withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.out(Easing.back(2)) }), withTiming(1, { duration: 500 }), withTiming(0, { duration: 400 })), -1)); }, [p, i]);
  const pos = [[-0.42, -0.62], [0.05, -0.8], [0.46, -0.6]][i];
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateX: pos[0] * size }, { translateY: pos[1] * size - p.value * 10 }, { scale: p.value }, { rotate: `${p.value * 90}deg` }] }));
  const s = 18 + (i % 2) * 8;
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: size / 2 - s / 2, top: size / 2 - s / 2, width: s, height: s }, st]}><Svg width={s} height={s} viewBox="0 0 10 10"><Path d="M5 0 Q6 4 10 5 Q6 6 5 10 Q4 6 0 5 Q4 4 5 0Z" fill={i === 1 ? "#ffd84d" : "#c9b8ff"} /></Svg></Animated.View>;
}

/** A teammate that springs in around the agent and keeps bobbing (the spring overshoots in scale, never toward the edge). */
function Mate({ i, slug, size, R, active, lim }: { i: number; slug: string; size: number; R: number; active: boolean; lim: number }) {
  const p = useSharedValue(0), bob = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    if (active) p.value = withDelay(250 + i * 140, withSpring(1, { damping: 8, stiffness: 140 }));
    bob.value = withRepeat(withSequence(withTiming(1, { duration: 1300 + i * 120, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1300 + i * 120, easing: Easing.inOut(Easing.sin) })), -1);
  }, [active, p, bob, i]);
  const ang = [-2.6, -2.0, -1.57, -1.14, -0.54][i];
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 2), transform: [{ translateX: Math.max(-(lim - (size + 12) / 2), Math.min(lim - (size + 12) / 2, Math.cos(ang) * R)) * Math.min(1, p.value) }, { translateY: Math.sin(ang) * R * 0.92 * p.value + bob.value * -6 + R * 0.12 }, { scale: p.value }, { rotate: `${(1 - p.value) * -40 + (i % 2 ? 6 : -6)}deg` }] }));
  return (
    <Animated.View testID="intro-mate" pointerEvents="none" style={[{ position: "absolute", left: -(size + 12) / 2, top: -(size + 12) / 2, width: size + 12, height: size + 12, borderRadius: (size + 12) * 0.32, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }, st]}>
      <Face slug={slug} size={size} />
    </Animated.View>
  );
}

export default function IntroAgent({ mode, x, index, width, page, height, active }: P) {
  const size = Math.min(width * 0.46, height * 0.42, 190);
  const pulse = useSharedValue(0), spin = useSharedValue(0), burst = useSharedValue(0);
  const speed = useSharedValue(0), hintOp = useSharedValue(1);
  const tx = useSharedValue(0), ty = useSharedValue(0), sx = useSharedValue(1), sy = useSharedValue(1), float = useSharedValue(0);
  const [face, setFace] = useState<FaceState>(mode === "think" ? "thinking" : "idle");
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const calm = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rest: FaceState = mode === "think" ? "thinking" : "idle";

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    float.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    spin.value = withRepeat(withTiming(Math.PI * 2, { duration: 16000, easing: Easing.linear }), -1);
    return () => { cancelAnimation(pulse); cancelAnimation(float); cancelAnimation(spin); if (calm.current) clearTimeout(calm.current); };
  }, [pulse, float, spin]);

  const react = () => {
    setTouched(true); setFace("happy"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (calm.current) clearTimeout(calm.current);
    calm.current = setTimeout(() => setFace(rest), 1300);
  };
  const look = (gx: number, gy: number) => setGaze({ x: gx, y: gy });
  const letGo = () => { setGaze(null); setFace(rest); };
  const lastLook = useSharedValue(0);

  const tap = Gesture.Tap().onEnd(() => {
    // squash, then a soft, bouncy spring back (low stiffness, low damping = organic overshoot)
    sx.value = withSequence(withTiming(1.18, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 5, stiffness: 120, mass: 0.9 }));
    sy.value = withSequence(withTiming(0.84, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 5, stiffness: 120, mass: 0.9 }));
    burst.value = 0; burst.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
    runOnJS(react)();
  });
  const drag = Gesture.Pan().minDistance(4)
    .onStart(() => { runOnJS(react)(); })
    .onChange((e) => {
      tx.value += e.changeX; ty.value += e.changeY; speed.value = Math.min(1, Math.abs(e.velocityX) / 2500);
      const k = Math.min(0.12, Math.hypot(e.velocityX, e.velocityY) / 12000); // stretch along the motion
      sx.value = 1 + k; sy.value = 1 - k * 0.8;
      const now = Date.now(); if (now - lastLook.value > 50) { lastLook.value = now; runOnJS(look)(e.translationX / 60, e.translationY / 60); }
    })
    .onEnd((e) => {
      tx.value = withSpring(0, { velocity: e.velocityX, damping: 10, stiffness: 120 });
      ty.value = withSpring(0, { velocity: e.velocityY, damping: 10, stiffness: 120 });
      sx.value = withSpring(1, { damping: 6 }); sy.value = withSpring(1, { damping: 6 }); speed.value = withTiming(0, { duration: 300 });
      runOnJS(letGo)();
    });
  const g = Gesture.Exclusive(drag, tap);

  const body = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value + float.value * -10 }, { rotate: `${tx.value * 0.08}deg` }, { scaleX: sx.value }, { scaleY: sy.value }] }));
  // the shadow stays on the floor: follows x, shrinks and fades as the agent lifts (bob or drag up), stretches with speed
  const shadow = useAnimatedStyle(() => {
    // idle bob lifts it ~10px (lift ≈ 0.1); a drag up of ~90px or more and the shadow is gone
    const lift = Math.max(0, Math.min(1, (float.value * 10 - ty.value) / 90));
    return { opacity: 0.55 * (1 - lift), transform: [{ translateX: tx.value }, { scaleX: (1 - lift * 0.6) * (1 + speed.value * 0.6) }, { scaleY: 1 - lift * 0.4 }] };
  });
  useEffect(() => { if (touched) hintOp.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) }); }, [touched, hintOp]);
  const hintSt = useAnimatedStyle(() => ({ opacity: hintOp.value * (0.45 + pulse.value * 0.55) }));
  const far = useParallax(x, index, page, 0.75), mid = useParallax(x, index, page, 0.4), near = useParallax(x, index, page, 0.15);
  const faceAt: FaceAt = { tx, ty, float, sx, sy, x, index, page };
  const enter = useAnimatedStyle(() => {
    const d = Math.abs((x.value - index * page) / page);
    return { opacity: interpolate(d, [0, 0.8], [1, 0], "clamp"), transform: [{ scale: interpolate(d, [0, 1], [1, 0.7], "clamp") }] };
  });
  const R = Math.min(width * 0.4, size * 1.05);
  const faceR = size * 0.4; // the face disc (r 38 of 100) plus its outline
  const lim = width / 2 + 20 - 17; // the stage is inset 20px; keep everything 16px (plus a pixel for rounding) clear of the screen edge

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -20, right: -20, top: 0, bottom: 0 }, far]}>
        {Array.from({ length: 16 }).map((_, i) => <Mote key={i} i={i} w={width} h={height * 0.6} />)}
      </Animated.View>
      <Animated.View style={[{ alignItems: "center", justifyContent: "center", width, height: size * 2.2 }, enter]}>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", alignItems: "center", justifyContent: "center" }, mid]}><Glow size={size * 2.1} pulse={pulse} /></Animated.View>
        <Animated.View testID="intro-shadow" pointerEvents="none" style={[{ position: "absolute", top: size * 1.1 + size * 0.47, width: size * 0.8, height: 18 }, shadow]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 18" preserveAspectRatio="none"><Defs><RadialGradient id="ish" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor="#000" stopOpacity="0.85" /><Stop offset="0.6" stopColor="#000" stopOpacity="0.35" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></RadialGradient></Defs><Ellipse cx="50" cy="9" rx="50" ry="9" fill="url(#ish)" /></Svg>
        </Animated.View>
        {mode === "team" ? <Animated.View pointerEvents="none" style={[{ position: "absolute", alignItems: "center", justifyContent: "center" }, mid]}>{TEAM.map((s, i) => <Mate key={s} i={i} slug={s} size={Math.round(size * 0.3)} R={R} active={active} lim={lim} />)}</Animated.View> : null}
        {mode === "memory" ? <Animated.View style={[{ position: "absolute", zIndex: 0, alignItems: "center", justifyContent: "center", top: size * 1.1 + size * 0.04 }, near]}>{MEMS.map((m, i) => <Chip key={m} i={i} n={MEMS.length} label={m} spin={spin} rx={Math.max(faceR + 20, lim - 46)} ry={faceR + 44} faceR={faceR} lim={lim} face={faceAt} />)}</Animated.View> : null}
        <GestureDetector gesture={g}>
          <Animated.View accessibilityRole="button" accessibilityLabel="Your agent. Tap or drag it." style={[{ width: size, height: size, alignItems: "center", justifyContent: "center", zIndex: 10 }, body]}>
            <View testID="intro-face" pointerEvents="none" style={{ position: "absolute", left: size * 0.1, top: size * 0.14, width: size * 0.8, height: size * 0.8, borderRadius: size }} />
            <AgentFace size={size} animated state={face} gaze={gaze} />
            {mode === "think" ? [0, 1, 2].map((i) => <Thought key={i} i={i} size={size} />) : null}
            {Array.from({ length: 12 }).map((_, i) => <Spark key={i} i={i} n={12} burst={burst} size={size} />)}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
      <Animated.Text pointerEvents="none" style={[{ marginTop: 6, fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }, hintSt]}>tap or drag me</Animated.Text>
    </View>
  );
}
