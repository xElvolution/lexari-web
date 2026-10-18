/**
 * Port of shared/components/Badge.tsx (the landing hero badge, also printed in onboarding) at phone size.
 * The badge hangs from a lanyard. Drag it and it swings round the pivot, let go and a damped pendulum brings it back.
 * A tap or a fast sideways flick turns it over (spring) and kicks the lanyard. Physics runs every frame on the UI thread.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, Text, TextInput, View, useWindowDimensions, type LayoutRectangle } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from "react-native-svg";
import AgentFace from "./AgentFace";
import BgArt from "./BgArt";
import { lookVariant, type FaceLook } from "./avatar";
import { F, GRAPE } from "@/web/kit";

/** shared/content/badge.ts */
export const badgeCopy = {
  company: "LEXARI",
  role: "Home agent",
  seat: "Seat 01",
  since: "Started today",
  inputLabel: "Name your agent",
  defaultName: "Juniper",
  chips: ["Own computer", "Lasting memory", "Can hire help"],
  hint: "Tap to flip. Drag to swing. Type a name.",
  back: {
    kind: "Agent ID",
    holder: "Card holder",
    fields: [
      ["Role", "Home agent"],
      ["Access", "Owner · Seat 01"],
      ["Computer", "Its own, always on"],
      ["Memory", "Remembers you"],
      ["Team", "Can hire more"],
    ] as [string, string][],
    issuedLabel: "Issued",
    sign: "Agent signature",
    fine: "Property of Lexari. If found, please return to Lexari. Not valid for real doors.",
  },
};
const B = badgeCopy;

/** The .label type: mono, uppercase, 0.04em tracking. */
export function Lbl({ s, c, children, style }: { s: number; c: string; children: ReactNode; style?: object }) {
  return <Text style={[{ fontFamily: F.mono, fontSize: s, letterSpacing: s * 0.04, textTransform: "uppercase", color: c }, style]}>{children}</Text>;
}
/** The .display type: Bricolage 800, -0.045em, tight leading. */
export function Disp({ s, c = "#0a0a0a", children, style, lines }: { s: number; c?: string; children: ReactNode; style?: object; lines?: number }) {
  return <Text numberOfLines={lines} style={[{ fontFamily: F.display, fontSize: s, letterSpacing: -s * 0.045, lineHeight: Math.round(s * 1.02), color: c }, style]}>{children}</Text>;
}

/** Barcode generated from the agent's name, so every name prints a unique badge. */
export function Barcode({ text, h = 32 }: { text: string; h?: number }) {
  const bars: number[] = [];
  for (const ch of (text || "lexari").padEnd(10, "x")) { const c = ch.charCodeAt(0); bars.push(1 + (c % 3), 1 + ((c >> 2) % 2)); }
  const total = bars.reduce((a, b) => a + b + 1, 0);
  let x = 0;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${total} 20`} preserveAspectRatio="none">
      {bars.map((w, i) => { const r = <Rect key={i} x={x} y={0} width={i % 2 ? 0.6 : w} height={20} fill="#0a0a0a" />; x += w + 1; return r; })}
    </Svg>
  );
}

/** A 21x21 QR style code seeded by the name. Decorative, like the rest of the card. */
export function Code({ text }: { text: string }) {
  const n = 21;
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    let h = 2166136261;
    for (const ch of text || "lexari") h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const inF = (x: number, y: number, fx: number, fy: number) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (inF(x, y, 0, 0) || inF(x, y, n - 7, 0) || inF(x, y, 0, n - 7)) continue;
      h = Math.imul(h ^ (x * 31 + y * 17), 16777619);
      if ((h >>> 28) & 1) out.push([x, y]);
    }
    return out;
  }, [text]);
  const Fd = ({ x, y }: { x: number; y: number }) => <><Rect x={x} y={y} width={7} height={7} fill="#0a0a0a" /><Rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" /><Rect x={x + 2} y={y + 2} width={3} height={3} fill={GRAPE} /></>;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${n} ${n}`}>
      <Rect width={n} height={n} fill="#fff" />
      {cells.map(([x, y]) => <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0a0a0a" />)}
      <Fd x={0} y={0} /><Fd x={n - 7} y={0} /><Fd x={0} y={n - 7} />
    </Svg>
  );
}

let pid = 0;
/** .carpet / .carpet-w: office floor dots every 22px. */
export function Carpet({ color = "rgba(255,255,255,0.2)" }: { color?: string }) {
  const [id] = useState(() => `cp${++pid}`);
  return (
    <Svg pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
      <Defs><Pattern id={id} x={0} y={0} width={22} height={22} patternUnits="userSpaceOnUse"><Circle cx={1} cy={1} r={1} fill={color} /></Pattern></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** shared/components/Logo.tsx on the white card (ink #0a0a0a). */
export function CardLogo({ scale = 1 }: { scale?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * scale }}>
      <View style={{ width: 28 * scale, height: 28 * scale, borderRadius: 9 * scale, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" }}><View style={{ width: 10 * scale, height: 10 * scale, borderRadius: 5 * scale, backgroundColor: "#fff" }} /></View>
      <Disp s={26 * scale} style={{ lineHeight: 26 * scale }}>lexari</Disp>
    </View>
  );
}

/** The lanyard strap (.strap): a woven purple band with the wordmark. */
export function Strap({ h = 84 }: { h?: number }) {
  const [id] = useState(() => `st${++pid}`);
  return (
    <View style={{ width: 34, height: h }}>
      <View style={{ position: "absolute", left: 4, top: 0, width: 30, height: h, backgroundColor: "rgba(0,0,0,0.12)", borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
      <View style={{ width: 30, height: h, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <Svg style={{ position: "absolute", left: 0, top: 0 }} width={30} height={h}>
          <Defs>
            <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#4a1fe0" /><Stop offset="0.5" stopColor="#7a52ff" /><Stop offset="1" stopColor="#4a1fe0" /></LinearGradient>
            <Pattern id={`${id}p`} x={0} y={0} width={30} height={7} patternUnits="userSpaceOnUse"><Rect x={0} y={6} width={30} height={1} fill="rgba(0,0,0,0.12)" /></Pattern>
          </Defs>
          <Rect width={30} height={h} fill={`url(#${id}g)`} />
          <Rect width={30} height={h} fill={`url(#${id}p)`} />
        </Svg>
        <View style={{ transform: [{ rotate: "90deg" }], width: 60, alignItems: "center" }}>
          <Text style={{ fontFamily: F.monoB, fontSize: 8, letterSpacing: 0.32, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>lexari</Text>
        </View>
      </View>
    </View>
  );
}

/** The metal lanyard clip. */
export function Clip({ w = 48, h = 28, hole = [24, 10] as [number, number] }: { w?: number; h?: number; hole?: [number, number] }) {
  const [id] = useState(() => `cl${++pid}`);
  return (
    <View style={{ width: w, height: h, borderRadius: 6, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <Svg style={{ position: "absolute", left: 0, top: 0 }} width={w} height={h}>
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#f2f2f2" /><Stop offset="1" stopColor="#a3a3a3" /></LinearGradient></Defs>
        <Rect width={w} height={h} fill={`url(#${id})`} />
        <Rect y={h - 2} width={w} height={2} fill="rgba(0,0,0,0.2)" />
      </Svg>
      <View style={{ width: hole[0], height: hole[1], borderRadius: hole[1] / 2, backgroundColor: "rgba(0,0,0,0.4)" }} />
    </View>
  );
}

type Look = number | null | undefined | FaceLook;
const issuedToday = () => { try { return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return "Day one"; } };
const cardShadow = { shadowColor: "#140050", shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 22 }, elevation: 14 };

/**
 * The hanging badge. `setName` makes the "Name your agent" field typeable. `look` is a starter seed, a FaceLook from
 * the creator (with its card background) or null for the house face. `faceEl` replaces the face (specialists).
 */
export default function Badge({ name, setName, look, width = 250, windowH = 118, faceSize = 112, strap = 84, faceEl, type = "landing" }: {
  name: string; setName?: (v: string) => void; look?: Look; width?: number; windowH?: number; faceSize?: number; strap?: number; faceEl?: ReactNode;
  /** Which phone type scale the badge sits in: lexari.ai (shared/styles/mobile-type.css) or app.lexari.ai (also webapp/app/mobile-compact.css). */
  type?: "landing" | "app";
}) {
  const vw = useWindowDimensions().width;
  const app = type === "app";
  const sz = { hello: app ? 20 : 23.5, name: app ? 22 : vw <= 370 ? 29 : 32, holder: app ? 20 : 23.5, radius: app ? 20 : 26 };
  const [flipped, setFlipped] = useState(false);
  const [issued, setIssued] = useState("Day one");
  useEffect(() => { setIssued(issuedToday()); }, []);
  const input = useRef<TextInput>(null);
  const wrap = useRef<View>(null);
  const inputBox = useRef<LayoutRectangle | null>(null);
  const infoY = useRef(0);
  const inputY = useSharedValue(-1), inputH = useSharedValue(0);

  // physics state (UI thread)
  const a = useSharedValue(7), v = useSharedValue(0), f = useSharedValue(0), fv = useSharedValue(0), flipT = useSharedValue(0);
  const drag = useSharedValue(false), target = useSharedValue(0), tilt = useSharedValue(0);
  const px = useSharedValue(0), py = useSharedValue(0), sw = useSharedValue(390);
  const pressX = useSharedValue(0), pressT = useSharedValue(0), skip = useSharedValue(false);

  useFrameCallback((fr) => {
    "worklet";
    const dt = Math.min(0.033, (fr.timeSincePreviousFrame ?? 16) / 1000);
    if (drag.value) { v.value = (target.value - a.value) * 12; a.value += v.value * dt; }
    else { v.value += (-a.value * 38 - v.value * 2.6) * dt; a.value += v.value * dt; }
    fv.value += ((flipT.value - f.value) * 70 - fv.value * 11) * dt; f.value += fv.value * dt;
  });

  const flip = (dir: number) => {
    "worklet";
    flipT.value = flipT.value === 0 ? 180 : 0;
    v.value += 26 * dir; // the lanyard swings a little as the card turns
    runOnJS(setFlipped)(flipT.value === 180);
  };
  const focusInput = () => { if (setName) input.current?.focus(); };
  const measurePivot = () => {
    wrap.current?.measureInWindow((x, y, w) => { px.value = x + w / 2; py.value = y; });
  };
  const angleTo = (x: number, y: number) => {
    "worklet";
    const deg = (-Math.atan2(x - px.value, y - py.value) * 180) / Math.PI;
    return Math.max(-40, Math.min(40, deg));
  };
  const inInput = (y: number) => {
    "worklet";
    return !flipped && inputY.value >= 0 && y >= inputY.value && y <= inputY.value + inputH.value;
  };

  const tap = Gesture.Tap().maxDuration(800).maxDistance(12).onEnd((e, ok) => {
    "worklet";
    if (!ok) return;
    if (setName && flipT.value === 0 && inInput(e.y)) { runOnJS(focusInput)(); return; }
    flip(1);
  });
  const pan = Gesture.Pan().minDistance(12)
    .onBegin((e) => { "worklet"; pressX.value = e.absoluteX; pressT.value = Date.now(); skip.value = !!setName && flipT.value === 0 && inInput(e.y); tilt.value = (e.absoluteX / sw.value - 0.5) * 18; })
    .onStart(() => { "worklet"; if (!skip.value) drag.value = true; })
    .onUpdate((e) => { "worklet"; if (skip.value) return; target.value = angleTo(e.absoluteX, e.absoluteY); tilt.value = (e.absoluteX / sw.value - 0.5) * 18; })
    .onEnd((e) => {
      "worklet";
      const dt = Date.now() - pressT.value, dx = e.absoluteX - pressX.value, speed = e.velocityX / 1000; // px per ms
      if (!skip.value && Math.abs(speed) > 1.3 && dt < 380 && Math.abs(dx) > 40) flip(Math.sign(speed));
    })
    .onFinalize(() => { "worklet"; drag.value = false; });
  const g = Gesture.Exclusive(pan, tap);

  const rig = useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
  const front = useAnimatedStyle(() => {
    const deg = f.value + tilt.value + v.value * 0.04;
    return { transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }], opacity: Math.cos((deg * Math.PI) / 180) >= 0 ? 1 : 0 };
  });
  const back = useAnimatedStyle(() => {
    const deg = f.value + tilt.value + v.value * 0.04 + 180;
    return { transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }], opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 1 : 0 };
  });

  const shown = name || "Your agent";
  const obj = look && typeof look === "object" ? look : null;
  const face = faceEl ?? (obj ? <AgentFace variant={lookVariant(obj)} size={faceSize} animated /> : typeof look === "number" ? <AgentFace seed={look} size={faceSize} animated /> : <AgentFace size={faceSize} animated />);
  const card = { borderRadius: sz.radius, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", backfaceVisibility: "hidden" as const };

  return (
    <View ref={wrap} onLayout={(e) => { sw.value = Platform.OS === "web" && typeof window !== "undefined" ? window.innerWidth : 390; void e; measurePivot(); }} onTouchStart={measurePivot} style={{ alignItems: "center", alignSelf: "center" }}>
      <Animated.View style={[{ alignItems: "center", transformOrigin: "50% 0%" }, rig]}>
        <Strap h={strap} />
        <View style={{ zIndex: 10, marginTop: -4 }}><Clip /></View>
        <GestureDetector gesture={g}>
          <View accessible accessibilityRole="button" accessibilityState={{ selected: flipped }} accessibilityLabel={flipped ? "Badge back. Press to flip to the front." : "Agent badge. Press to flip and see the back."} onAccessibilityTap={() => { flipT.value = flipT.value === 0 ? 180 : 0; v.value += 26; setFlipped(flipT.value === 180); }} style={{ marginTop: -8, width }}>
            {/* FRONT */}
            <Animated.View style={[card, cardShadow, { padding: 12 }, front]} pointerEvents={flipped ? "none" : "auto"}>
              <View style={{ alignSelf: "center", marginBottom: 8, width: 64, height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.1)" }} />
              <View style={{ borderRadius: 18, backgroundColor: GRAPE, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" }}>
                <Disp s={sz.hello} c="#fff" style={{ lineHeight: sz.hello }}>HELLO</Disp>
                <Lbl s={9.5} c="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>my name is</Lbl>
              </View>
              <View style={{ marginTop: 12, height: windowH, borderRadius: 18, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <Carpet />
                {obj ? <BgArt id={obj.bg} /> : null}
                <View>{face}</View>
                <Lbl s={9} c="rgba(255,255,255,0.7)" style={{ position: "absolute", left: 12, top: 12 }}>{B.company}</Lbl>
                <View style={{ position: "absolute", right: 12, top: 12, borderRadius: 999, backgroundColor: GRAPE, paddingHorizontal: 8, paddingVertical: 4 }}><Lbl s={9} c="#fff">● online</Lbl></View>
              </View>
              <View onLayout={(e) => { infoY.current = e.nativeEvent.layout.y; if (inputBox.current) inputY.value = infoY.current + inputBox.current.y; }} style={{ paddingHorizontal: 6, paddingTop: 12 }}>
                <Disp s={sz.name} lines={1} style={{ lineHeight: Math.round(sz.name * 1.05), paddingBottom: 2 }}>{shown}</Disp>
                <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 4 }}>
                  {[B.role, "·", B.seat, "·", B.since].map((t, i) => <Lbl key={i} s={9.5} c="rgba(0,0,0,0.6)">{t}</Lbl>)}
                </View>
                <View onLayout={(e) => { const l = e.nativeEvent.layout; inputBox.current = l; inputY.value = infoY.current + l.y; inputH.value = l.height; }} style={{ marginTop: 12, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(91,43,255,0.4)", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Lbl s={8.5} c={GRAPE}>{B.inputLabel}</Lbl>
                  <TextInput ref={input} value={name} editable={!!setName} maxLength={12} onChangeText={(t) => setName?.(t.replace(/[^\p{L}\p{N} ._-]/gu, ""))}
                    accessibilityLabel={B.inputLabel} autoCorrect={false} autoCapitalize="words"
                    style={{ color: "#0a0a0a", fontSize: 16, fontFamily: F.bold, padding: 0, height: 22, ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : null) }} />
                </View>
                <View style={{ marginTop: 12 }}><Barcode text={name} /></View>
              </View>
            </Animated.View>

            {/* BACK */}
            <Animated.View style={[card, { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" }, back]} pointerEvents={flipped ? "auto" : "none"}>
              <View style={{ alignSelf: "center", marginTop: 12, width: 64, height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.1)" }} />
              <View style={{ marginTop: 12, height: 44, backgroundColor: "#0a0a0a" }} />
              <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <CardLogo scale={0.8} />
                  <View style={{ borderRadius: 999, backgroundColor: GRAPE, paddingHorizontal: 8, paddingVertical: 4 }}><Lbl s={8.5} c="#fff">{B.back.kind}</Lbl></View>
                </View>
                <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
                  <View style={{ width: "100%" }}><Lbl s={8.5} c="rgba(0,0,0,0.5)">{B.back.holder}</Lbl><Disp s={sz.holder} lines={1} style={{ lineHeight: Math.round(sz.holder * 1.08) }}>{shown}</Disp></View>
                  {[...B.back.fields, [B.back.issuedLabel, issued] as [string, string]].map(([k, val], i) => (
                    <View key={k} style={{ width: "50%", paddingRight: i % 2 ? 0 : 6, paddingLeft: i % 2 ? 6 : 0 }}>
                      <Lbl s={8.5} c="rgba(0,0,0,0.5)">{k}</Lbl>
                      <Text style={{ fontFamily: F.semi, fontSize: 12, lineHeight: 15, color: "#0a0a0a" }}>{val}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "flex-end", gap: 12, paddingTop: 12 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 6, padding: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" }}><Code text={shown} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ borderBottomWidth: 2, borderBottomColor: "rgba(0,0,0,0.7)", paddingBottom: 2 }}><Text numberOfLines={1} style={{ fontFamily: F.display, fontSize: 18, lineHeight: 20, fontStyle: "italic", color: GRAPE }}>{shown}</Text></View>
                    <Lbl s={8} c="rgba(0,0,0,0.5)" style={{ marginTop: 4 }}>{B.back.sign}</Lbl>
                  </View>
                </View>
                <Text style={{ marginTop: 12, fontFamily: F.sans, fontSize: 9.5, lineHeight: 13, color: "rgba(0,0,0,0.55)" }}>{B.back.fine}</Text>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}
