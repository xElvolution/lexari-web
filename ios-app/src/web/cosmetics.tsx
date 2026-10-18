/** Chat backgrounds and bubble styles from webapp/lib/cosmetics.ts, drawn with react-native-svg. */
import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

type RG = [number, number, number, string, number];
const RADIALS: Record<string, RG[]> = {
  "bg-aurora": [[15, 10, 60, "#5b2bff", 0.38], [90, 30, 55, "#2dd4bf", 0.22], [50, 100, 70, "#8f6bff", 0.28]],
  "bg-deepsea": [[80, 0, 60, "#36c5ff", 0.22]],
  "bg-velvet": [[0, 0, 50, "#ff6b9a", 0.26], [100, 50, 60, "#5b2bff", 0.36], [20, 100, 70, "#b026ff", 0.28]],
  "bg-stars": [[50, 0, 120, "#3514b0", 0.35]],
};
const LINEARS: Record<string, [string, number][]> = {
  "bg-sunset": [["#ff7a59", 0.22], ["#ff4d94", 0.18], ["#5b2bff", 0.22]],
  "bg-lavender": [["#c9b8ff", 0.26], ["#8f6bff", 0.12], ["#c9b8ff", 0.22]],
  "bg-deepsea": [["#146e8c", 0.22], ["#3514b0", 0.3]],
};

export function ChatBg({ id, w, h }: { id?: string | null; w: number; h: number }) {
  if (!id) return null;
  const rad = RADIALS[id] ?? [], lin = LINEARS[id];
  const el: ReactNode[] = [];
  if (id === "bg-grid") for (let x = 0; x < Math.max(w, h); x += 26) el.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#8f6bff" strokeOpacity={0.16} />, <Line key={`h${x}`} x1={0} y1={x} x2={w} y2={x} stroke="#8f6bff" strokeOpacity={0.16} />);
  if (id === "bg-dots") for (let x = 9; x < w; x += 18) for (let y = 9; y < h; y += 18) el.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#8f6bff" fillOpacity={0.32} />);
  if (id === "bg-pinstripe") for (let x = -h; x < w; x += 16) el.push(<Line key={x} x1={x} y1={h} x2={x + h} y2={0} stroke="#8f6bff" strokeOpacity={0.13} strokeWidth={2} />);
  if (id === "bg-ripple") for (let r = 2; r < Math.max(w, h) * 1.4; r += 28) el.push(<Circle key={r} cx={w / 2} cy={h * 1.1} r={r} stroke="#8f6bff" strokeOpacity={0.16} strokeWidth={2} fill="none" />);
  if (id === "bg-stars") [[12, 14], [40, 40], [62, 10], [24, 50], [70, 52], [120, 30], [160, 70], [140, 12]].forEach(([x, y], i) => el.push(<Circle key={i} cx={x} cy={y} r={1.2} fill={i % 3 ? "#fff" : "#c9b8ff"} fillOpacity={0.75} />));
  return (
    <Svg pointerEvents="none" width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <Defs>
        {lin ? <LinearGradient id={`l-${id}`} x1="0" y1="0" x2="0" y2="1">{lin.map(([c, o], i) => <Stop key={i} offset={i / (lin.length - 1)} stopColor={c} stopOpacity={o} />)}</LinearGradient> : null}
        {rad.map(([cx, cy, r, c, o], i) => <RadialGradient key={i} id={`r-${id}-${i}`} cx={`${cx}%`} cy={`${cy}%`} r={`${r}%`} fx={`${cx}%`} fy={`${cy}%`}><Stop offset="0" stopColor={c} stopOpacity={o} /><Stop offset="0.7" stopColor={c} stopOpacity={0} /></RadialGradient>)}
      </Defs>
      {lin ? <Rect width={w} height={h} fill={`url(#l-${id})`} /> : null}
      {rad.map((_, i) => <Rect key={i} width={w} height={h} fill={`url(#r-${id}-${i})`} />)}
      {el}
    </Svg>
  );
}

type B = { bg?: string; grad?: string[]; color: string; border?: [number, string]; glow?: string };
export const BUBBLE: Record<string, B> = {
  "bubble-glass": { bg: "rgba(255,255,255,0.12)", grad: ["rgba(255,255,255,0.18)", "rgba(143,107,255,0.18)"], color: "#fff", border: [1, "rgba(255,255,255,0.3)"] },
  "bubble-neon": { bg: "#0a0a0a", color: "#d9ccff", border: [2, "#8f6bff"], glow: "#8f6bff" },
  "bubble-candy": { grad: ["#ff6fb5", "#8f6bff"], color: "#fff" },
  "bubble-outline": { bg: "transparent", color: "#a58bff", border: [2, "#5b2bff"] },
  "bubble-midnight": { bg: "#1b1340", color: "#fff", border: [1, "rgba(143,107,255,0.5)"] },
  "bubble-lilac": { bg: "#e9e1ff", color: "#2a0f8f", border: [1, "#c9b8ff"] },
  "bubble-mint": { grad: ["#2dd4bf", "#5b2bff"], color: "#fff" },
  "bubble-sunset": { grad: ["#ff9a5a", "#ff4d94", "#8f6bff"], color: "#fff" },
  "bubble-gold": { grad: ["#f7d774", "#e3a52a"], color: "#3b2600", border: [1, "#e9b73a"] },
};
export function MyBubble({ id, children, style }: { id?: string | null; children: ReactNode; style?: ViewStyle }) {
  const b = id ? BUBBLE[id] : undefined;
  const base: ViewStyle = { overflow: "hidden", backgroundColor: b ? b.bg ?? "transparent" : "#5b2bff", ...(b?.border ? { borderWidth: b.border[0], borderColor: b.border[1] } : null), ...(b?.glow ? { shadowColor: b.glow, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } } : null) };
  return (
    <View style={[base, style]}>
      {b?.grad ? <Svg pointerEvents="none" width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0 }}><Defs><LinearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">{b.grad.map((c, i, a) => <Stop key={i} offset={i / (a.length - 1)} stopColor={c} />)}</LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#g-${id})`} /></Svg> : null}
      {children}
    </View>
  );
}
export const bubbleInk = (id?: string | null) => (id && BUBBLE[id] ? BUBBLE[id].color : "#fff");
