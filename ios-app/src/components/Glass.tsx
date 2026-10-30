/**
 * Liquid Glass surfaces (iOS 26). Real refractive glass through expo-glass-effect where the OS has it, a UIBlurEffect
 * material through expo-blur on older iOS, and a solid tinted surface when Reduce Transparency is on.
 * Every surface gets a continuous (squircle) corner and a thin specular rim on the top edge.
 */
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useC } from "@/web/kit";

let liquid = false;
try { liquid = isLiquidGlassAvailable(); } catch { liquid = false; }
export const hasLiquidGlass = () => liquid;

let reduced = false;
const subs = new Set<(v: boolean) => void>();
AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => { reduced = v; subs.forEach((f) => f(v)); }).catch(() => {});
AccessibilityInfo.addEventListener?.("reduceTransparencyChanged", (v: boolean) => { reduced = v; subs.forEach((f) => f(v)); });

/** True while the user has Settings > Accessibility > Display > Reduce Transparency on. */
export function useReduceTransparency() {
  const [v, setV] = useState(reduced);
  useEffect(() => { subs.add(setV); return () => { subs.delete(setV); }; }, []);
  return v;
}

export type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** "regular" for chrome and cards, "clear" for surfaces over media. */
  variant?: "regular" | "clear";
  /** Tint the glass, e.g. the brand purple for primary buttons. */
  tint?: string;
  interactive?: boolean;
  /** Draw the specular top rim (on by default). */
  rim?: boolean;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
};

export function Glass({ children, style, radius = 22, variant = "regular", tint, interactive, rim = true, pointerEvents }: GlassProps) {
  const k = useC();
  const reduce = useReduceTransparency();
  const shape: ViewStyle = { borderRadius: radius, borderCurve: "continuous", overflow: "hidden" };
  const edge = k.dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.7)";
  const hairline: ViewStyle = { borderWidth: StyleSheet.hairlineWidth, borderColor: k.dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,30,0.08)" };
  const highlight = rim ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderCurve: "continuous", borderTopWidth: 1, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: edge, opacity: 0.9 }]} />
  ) : null;

  if (reduce) {
    return <View pointerEvents={pointerEvents} style={[shape, hairline, { backgroundColor: tint ?? k.card }, style]}>{children}</View>;
  }
  if (liquid) {
    return (
      <GlassView pointerEvents={pointerEvents} glassEffectStyle={variant} tintColor={tint} isInteractive={interactive} style={[shape, style]}>
        {children}
        {highlight}
      </GlassView>
    );
  }
  return (
    <View pointerEvents={pointerEvents} style={[shape, hairline, style]}>
      <BlurView intensity={variant === "clear" ? 30 : 60} tint={k.dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"} style={StyleSheet.absoluteFill} />
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.55 }]} /> : null}
      {children}
      {highlight}
    </View>
  );
}
