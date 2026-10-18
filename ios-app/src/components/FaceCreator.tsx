/**
 * Port of webapp/components/agent/FaceCreator.tsx: the classic Lexari faces plus states, brows, extras, orbiting
 * memory dots and an NFT background. Live preview with Idle / Think / Talk / Happy, randomize and undo.
 */
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Rect } from "react-native-svg";
import AgentFace from "./AgentFace";
import BgArt, { BACKGROUNDS } from "./BgArt";
import Icon from "./Icon";
import { tap } from "./ui";
import { ALL_BROWS, ALL_EXTRAS, ALL_EYES, ALL_MOUTHS, ALL_ORBITS, ALL_SHAPES, COLORS, LABEL, type FaceLook, type FaceState, type Variant } from "./avatar";
import { F, GRAPE, useC } from "@/web/kit";

type Tab = "shape" | "color" | "eyes" | "mouth" | "brows" | "extra" | "orbit" | "bg";
const TABS: [Tab, string][] = [["shape", "Shape"], ["color", "Colour"], ["eyes", "Eyes"], ["mouth", "Mouth"], ["brows", "Brows"], ["extra", "Extras"], ["orbit", "Orbit"], ["bg", "Background"]];
const STATES: [FaceState, string][] = [["idle", "Idle"], ["thinking", "Think"], ["speaking", "Talk"], ["happy", "Happy"]];
const LISTS = { shape: ALL_SHAPES, eyes: ALL_EYES, mouth: ALL_MOUTHS, brows: ALL_BROWS, extra: ALL_EXTRAS, orbit: ALL_ORBITS } as const;
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function Dice({ size = 16, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2}>
      <Rect x={3.5} y={3.5} width={17} height={17} rx={5} />
      {[[9, 9], [15, 15], [15, 9], [9, 15]].map(([x, y]) => <Circle key={`${x}${y}`} cx={x} cy={y} r={1.3} fill={color} stroke="none" />)}
    </Svg>
  );
}

/** A random look from the classic parts (no hats unless you pick one). */
export function randomLook(keep?: Partial<FaceLook>): FaceLook {
  const shape = pick(ALL_SHAPES);
  return { shape, color: pick(COLORS), eyes: pick(ALL_EYES), mouth: pick(ALL_MOUTHS), extra: shape === "robot" ? "antenna" : pick(["none", "none", "antenna", "ears", "catEars", "tuft", "horns"] as const), brows: pick(ALL_BROWS), orbit: pick(["none", "dots", "dots", "ring", "comet", "sparkle"] as const), dots: 3, blush: Math.random() < 0.4, bg: keep?.bg ?? "black" };
}

/** The pop-in check badge (.pop). */
export function PopCheck({ size = 20, bg = GRAPE, fg = "#fff", style }: { size?: number; bg?: string; fg?: string; style?: object }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withSpring(1, { damping: 9, stiffness: 260 }); }, [p]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  return <Animated.View style={[{ position: "absolute", right: -6, top: -6, width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, st, style]}><Icon name="check" size={size * 0.55} color={fg} stroke={3} /></Animated.View>;
}

const Tile = memo(function Tile({ v, on, label, onPick, w, children }: { v: Variant; on: boolean; label: string; onPick: () => void; w: number; children?: ReactNode }) {
  const k = useC();
  const s = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: s.value * -2 }] }));
  return (
    <Pressable onPress={() => { tap(); onPick(); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
      onPressIn={() => { s.value = withTiming(1, { duration: 150 }); }} onPressOut={() => { s.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.back(3)) }); }}>
      <Animated.View style={[{ width: w, borderRadius: 18, padding: 6, paddingBottom: 4, alignItems: "center", gap: 4, borderWidth: on ? 2 : 1, borderColor: on ? GRAPE : k.line }, st]}>
        <View style={{ alignSelf: "stretch", aspectRatio: 1, borderRadius: 13, overflow: "hidden", backgroundColor: k.faceTile, alignItems: "center", justifyContent: "center" }}>
          {children}
          <View><AgentFace variant={v} size={Math.min(46, (w - 12) * 0.72)} /></View>
        </View>
        <Text numberOfLines={1} style={{ maxWidth: "100%", fontFamily: F.bold, fontSize: 11, color: on ? k.ink : k.ink60 }}>{label}</Text>
        {on ? <PopCheck /> : null}
      </Animated.View>
    </Pressable>
  );
});

function Dots({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const k = useC();
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 0.36, textTransform: "uppercase", color: k.ink45 }}>Memory dots</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: k.ink60 }}>{value}</Text>
      </View>
      <View accessibilityRole="adjustable" accessibilityLabel="Memory dots" accessibilityValue={{ min: 1, max: 6, now: value }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(e) => onChange(Math.max(1, Math.min(6, value + (e.nativeEvent.actionName === "increment" ? 1 : -1))))}
        style={{ marginTop: 6, flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Pressable key={n} onPress={() => { tap(); onChange(n); }} style={{ flex: 1, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: n <= value ? GRAPE : k.tint }}>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: n <= value ? "#fff" : k.ink60 }}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function FaceCreator({ value, onChange, name, preview = true, width }: { value: FaceLook; onChange: (v: FaceLook) => void; name?: string; preview?: boolean; width?: number }) {
  const k = useC();
  const vw = useWindowDimensions().width;
  const W = width ?? Math.min(560, vw - 32);
  const tw = Math.floor((W - 8 * 3) / 4);
  const [tab, setTab] = useState<Tab>("shape");
  const [state, setState] = useState<FaceState>("idle");
  const hist = useRef<FaceLook[]>([]);
  const [, bump] = useState(0);
  const v: FaceLook = { ...value, plain: false };
  const commit = (n: Partial<FaceLook>) => { hist.current = [...hist.current.slice(-39), value]; bump((x) => x + 1); onChange({ ...v, ...n }); };
  const undo = () => { const p = hist.current.pop(); bump((x) => x + 1); if (p) onChange(p); };
  const shuffle = () => { hist.current = [...hist.current.slice(-39), value]; onChange(randomLook(value)); setState("happy"); setTimeout(() => setState((s) => (s === "happy" ? "idle" : s)), 1600); };
  const grid = (children: ReactNode) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;

  return (
    <View style={{ gap: 16 }}>
      {preview ? (
        <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: "#0a0a0a", padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <BgArt id={v.bg ?? "black"} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <View style={{ marginTop: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 8, paddingVertical: 4, flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 0.36, textTransform: "uppercase", color: "rgba(255,255,255,0.8)" }}>{`Live preview${name ? ` · ${name}` : ""}`}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable onPress={() => { tap(); undo(); }} disabled={!hist.current.length} accessibilityLabel="Undo" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", opacity: hist.current.length ? 1 : 0.35 }}><Icon name="undo" size={16} color="#fff" /></Pressable>
              <Pressable onPress={() => { tap(); shuffle(); }} accessibilityLabel="Randomize" style={({ pressed }) => ({ height: 39, transform: [{ translateY: pressed ? 1 : 0 }] })}>
                <View style={{ position: "absolute", left: 0, right: 0, top: 3, height: 36, borderRadius: 12, backgroundColor: "#3514b0" }} />
                <View style={{ height: 36, borderRadius: 12, backgroundColor: GRAPE, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 }}><Dice /><Text style={{ fontFamily: F.bold, fontSize: 13, color: "#fff" }}>Randomize</Text></View>
              </Pressable>
            </View>
          </View>
          <View style={{ alignItems: "center", paddingVertical: 4, position: "relative" }}><AgentFace variant={v} size={150} state={state} animated /></View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Preview state" style={{ flexDirection: "row", gap: 4, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", padding: 4 }}>
            {STATES.map(([s, l]) => (
              <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: state === s }} onPress={() => { tap(); setState(s); }} style={{ flex: 1, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: state === s ? "#fff" : "transparent" }}>
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: state === s ? "#0a0a0a" : "rgba(255,255,255,0.7)" }}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel="Face parts" style={{ marginHorizontal: -4 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 4, paddingBottom: 3 }}>
        {TABS.map(([t, l]) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => { tap(); setTab(t); }} style={{ height: 39 }}>
            {tab === t ? <View style={{ position: "absolute", left: 0, right: 0, top: 3, height: 36, borderRadius: 999, backgroundColor: "#3514b0" }} /> : null}
            <View style={{ height: 36, borderRadius: 999, paddingHorizontal: 14, justifyContent: "center", backgroundColor: tab === t ? GRAPE : k.tint }}>
              <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: tab === t ? "#fff" : k.ink75 }}>{l}</Text>
            </View>
          </Pressable>
        ))}
        {!preview ? <Pressable onPress={() => { tap(); shuffle(); }} accessibilityLabel="Randomize" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Dice color={k.ink} /></Pressable> : null}
      </ScrollView>

      {tab === "color" ? (
        <View style={{ gap: 16 }}>
          {grid(COLORS.map((c) => <Tile key={c} w={tw} v={{ ...v, color: c }} on={v.color === c} label={c[0].toUpperCase() + c.slice(1)} onPick={() => commit({ color: c })} />))}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: k.ink }}>Blush cheeks</Text>
            <Switch value={!!v.blush} onValueChange={(b) => commit({ blush: b })} trackColor={{ true: GRAPE, false: k.line }} thumbColor="#fff" accessibilityLabel="Blush cheeks" />
          </View>
        </View>
      ) : tab === "bg" ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: k.ink45 }}>Shown behind the face on the ID card and its NFT. Small avatars stay plain.</Text>
          {grid(BACKGROUNDS.map((b) => <Tile key={b.id} w={tw} v={v} on={(v.bg ?? "black") === b.id} label={b.label} onPick={() => commit({ bg: b.id })}><BgArt id={b.id} /></Tile>))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {grid((LISTS[tab] as readonly string[]).map((id) => {
            const cur = (v as Record<string, unknown>)[tab] ?? "none";
            return <Tile key={id} w={tw} v={{ ...v, [tab]: id } as Variant} on={cur === id} label={LABEL[id] ?? id} onPick={() => commit({ [tab]: id } as Partial<FaceLook>)} />;
          }))}
          {tab === "orbit" && v.orbit && v.orbit !== "none" && v.orbit !== "comet" ? <Dots value={v.dots ?? 3} onChange={(n) => commit({ dots: n })} /> : null}
        </View>
      )}
    </View>
  );
}
