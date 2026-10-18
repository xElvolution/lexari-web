import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { grape } from "@/theme/colors";

/** Lexari mark: the web app's rounded square with a dot, in brand purple. */
export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <LinearGradient id="lx" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8f6bff" />
          <Stop offset="1" stopColor={grape} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={72} height={72} rx={22} fill="url(#lx)" />
      <Circle cx={36} cy={36} r={12} fill="#fff" />
    </Svg>
  );
}

export function Wordmark({ size = 30, color = "#fff" }: { size?: number; color?: string }) {
  return <Text style={{ color, fontSize: size, fontWeight: "700", letterSpacing: -size * 0.04 }}>lexari</Text>;
}

export function Logo({ size = 28, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.3 }}>
      <LogoMark size={size} />
      <Wordmark size={size * 0.95} color={color} />
    </View>
  );
}
