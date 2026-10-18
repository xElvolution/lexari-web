/**
 * Port of webapp/components/agent/SetupSequence.tsx: its own face thinking inside a progress ring, four steps ticking
 * off, then a happy face and a hand-off to the finish screen. About 2.5 s.
 */
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import AgentFace from "./AgentFace";
import BgArt from "./BgArt";
import Icon from "./Icon";
import type { Variant } from "./avatar";
import { F, GRAPE, useC } from "@/web/kit";

const STEPS = ["Setting up its computer", "Giving it memory", "Loading its skills", "Ready"];
const AT = [0.08, 0.36, 0.64, 0.97];
const R = 86, C = 2 * Math.PI * R;
const ACircle = Animated.createAnimatedComponent(Circle);

function LiveDot() {
  const o = useSharedValue(1);
  useEffect(() => { o.value = withRepeat(withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })), -1); }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: GRAPE }, st]} />;
}
function Tick() {
  const s = useSharedValue(0);
  useEffect(() => { s.value = withSpring(1, { damping: 8, stiffness: 300 }); }, [s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={st}><Icon name="check" size={13} color="#fff" stroke={3.2} /></Animated.View>;
}

export default function SetupSequence({ name, v, bg, onDone, ms = 2300 }: { name: string; v: Variant; bg?: string; onDone: () => void; ms?: number }) {
  const k = useC();
  const [p, setP] = useState(0);
  const [ready, setReady] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  const prog = useSharedValue(0);
  const pop = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    let raf = 0, hold: ReturnType<typeof setTimeout> | undefined, off = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (off) return;
      const total = reduce ? 900 : ms;
      const t0 = Date.now();
      const tick = () => {
        const kk = Math.min(1, (Date.now() - t0) / total);
        const val = 1 - Math.pow(1 - kk, 2.2) * (1 - kk * 0.15);
        setP(val); prog.value = val;
        if (kk < 1) raf = requestAnimationFrame(tick);
        else {
          setP(1); prog.value = 1; setReady(true);
          pop.value = withSpring(1.04, { damping: 7, stiffness: 200 });
          ring.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
          hold = setTimeout(() => done.current(), reduce ? 250 : 750);
        }
      };
      raf = requestAnimationFrame(tick);
    });
    return () => { off = true; cancelAnimationFrame(raf); if (hold) clearTimeout(hold); };
  }, [ms, prog, pop, ring]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - prog.value) }));
  const faceSt = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.value > 0 ? 1 - ring.value : 0, transform: [{ scale: 1 + ring.value * 0.5 }] }));

  return (
    <View accessibilityRole="progressbar" accessibilityLiveRegion="polite" accessibilityLabel={ready ? `${name} is ready` : `Setting up ${name}`} style={{ alignItems: "center", paddingVertical: 32 }}>
      <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
        <Svg width={200} height={200} style={{ position: "absolute", opacity: ready ? 1 : 0.6 }}>
          <Defs><RadialGradient id="ssg" cx="50%" cy="50%" r="50%"><Stop offset="0.3" stopColor={GRAPE} stopOpacity={k.dark ? 0.45 : 0.2} /><Stop offset="1" stopColor={GRAPE} stopOpacity="0" /></RadialGradient></Defs>
          <Circle cx={100} cy={100} r={100} fill="url(#ssg)" />
        </Svg>
        <Svg width={200} height={200} viewBox="0 0 200 200" style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={100} cy={100} r={R} fill="none" stroke={k.line} strokeWidth={6} />
          <ACircle cx={100} cy={100} r={R} fill="none" stroke={GRAPE} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${C} ${C}`} animatedProps={arc} />
        </Svg>
        <Animated.View style={[{ width: 148, height: 148, borderRadius: 74, overflow: "hidden", backgroundColor: "#0a0a0a", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }, faceSt]}>
          <BgArt id={bg ?? "black"} />
          <View><AgentFace variant={{ ...v, plain: false }} size={118} state={ready ? "happy" : "thinking"} animated /></View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 24, top: 24, right: 24, bottom: 24, borderRadius: 999, borderWidth: 2, borderColor: GRAPE }, ringSt]} />
      </View>
      <Text style={{ marginTop: 20, fontFamily: F.display, fontSize: 20, lineHeight: 20, letterSpacing: -0.9, color: k.ink, textAlign: "center" }}>{ready ? `${name} is ready.` : `Making ${name}…`}</Text>
      <View style={{ marginTop: 20, width: "100%", maxWidth: 290, gap: 8 }}>
        {STEPS.map((l, i) => {
          const on = p >= AT[i], cur = !on && (i === 0 || p >= AT[i - 1]);
          return (
            <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: on ? k.tint : "transparent" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? GRAPE : "transparent", borderWidth: on ? 0 : 2, borderColor: k.line }}>
                {on ? <Tick /> : cur ? <LiveDot /> : null}
              </View>
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: on ? k.ink : cur ? k.ink75 : k.dark ? "rgba(255,255,255,0.35)" : "rgba(10,10,10,0.35)" }}>{l}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 16, height: 4, width: "100%", maxWidth: 290, borderRadius: 2, overflow: "hidden", backgroundColor: k.tint }}><View style={{ height: 4, borderRadius: 2, backgroundColor: GRAPE, width: `${p * 100}%` }} /></View>
    </View>
  );
}
