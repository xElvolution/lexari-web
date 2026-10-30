import { Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { grape } from "@/theme/colors";

/** Lexari mark: the grape tile with the eyes and smile, same art as the app icon and the web app. */
export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={0} y={0} width={64} height={64} rx={16} fill={grape} />
      <Ellipse cx={22.9} cy={26.9} rx={5.1} ry={7.75} fill="#fff" />
      <Ellipse cx={40.9} cy={26.9} rx={5.1} ry={7.75} fill="#fff" />
      <Circle cx={24.4} cy={24.9} r={2.06} fill="#3514b0" />
      <Circle cx={42.4} cy={24.9} r={2.06} fill="#3514b0" />
      <Path d="M21.6 41.4 Q32 49.9 42.4 41.4" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
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
