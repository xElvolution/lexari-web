import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { usePrefs } from "@/state/prefs";
import { grape } from "@/theme/colors";

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { palette } = usePrefs();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top + 8, paddingHorizontal: 14 }, style]}>
      {children}
    </View>
  );
}

export function Title({ children }: { children: string }) {
  const { palette } = usePrefs();
  return <Text style={{ color: palette.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 }}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const { palette } = usePrefs();
  return <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 16 }}>{children}</Text>;
}

export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { palette } = usePrefs();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.tint }}>
      {children}
    </Pressable>
  );
}

export function Money({ amount, unit }: { amount: string; unit?: string }) {
  const { hideBalances, palette } = usePrefs();
  return <Text style={{ color: palette.ink, fontSize: 14, fontWeight: "600" }}>{hideBalances ? "••••" : amount}{unit ? ` ${unit}` : ""}</Text>;
}

export function Face({ color = grape, mood = "idle" }: { color?: string; mood?: "idle" | "thinking" | "speaking" | "happy" }) {
  const eyes = mood === "happy" ? "M22 34 Q28 30 34 34 M50 34 Q56 30 62 34" : "M24 32 h8 M52 32 h8";
  const mouth = mood === "speaking" ? "M36 52 h12 v6 h-12 z" : mood === "thinking" ? "M38 54 h10" : "M32 52 Q42 62 52 52";
  return (
    <Svg width={44} height={44} viewBox="0 0 84 84">
      <Circle cx={42} cy={42} r={36} fill={color} />
      <Path d={eyes} stroke="#0a0a0a" strokeWidth={3} fill="none" strokeLinecap="round" />
      {mood === "speaking" ? <Rect x={36} y={50} width={12} height={8} rx={2} fill="#0a0a0a" /> : <Path d={mouth} stroke="#0a0a0a" strokeWidth={3} fill="none" strokeLinecap="round" />}
      <Ellipse cx={28} cy={48} rx={4} ry={2} fill="#ff8aa8" opacity={0.7} />
      <Ellipse cx={56} cy={48} rx={4} ry={2} fill="#ff8aa8" opacity={0.7} />
    </Svg>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { palette } = usePrefs();
  if (!open) return null;
  return (
    <BottomSheet snapPoints={["62%"]} enablePanDownToClose onClose={onClose} backgroundStyle={{ backgroundColor: palette.card }} handleIndicatorStyle={{ backgroundColor: palette.muted }}>
      <BottomSheetView style={{ padding: 16, gap: 10 }}>{children}</BottomSheetView>
    </BottomSheet>
  );
}

export function Row({ title, detail, onPress }: { title: string; detail?: string; onPress?: () => void }) {
  const { palette } = usePrefs();
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }}>
      <Text style={{ color: palette.ink, fontSize: 14 }}>{title}</Text>
      {detail ? <Text style={{ color: palette.muted, fontSize: 11, marginTop: 2 }}>{detail}</Text> : null}
    </Pressable>
  );
}

export function Loading() {
  return <ActivityIndicator color={grape} style={{ marginTop: 24 }} />;
}

export function ErrorText({ text }: { text: string }) {
  return <Text style={{ color: "#c42a2a", fontSize: 12, marginTop: 8 }}>{text}</Text>;
}

export function useRefresh(load: () => Promise<void>, deps: unknown[]) {
  useEffect(() => { load().catch(() => {}); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
