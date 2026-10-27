/** Lexari brand background: deep violet glow fading to near-black (like the web balance card and the landing glow). */
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { View } from "react-native";
import Icon from "@/components/Icon";
import AgentFace from "@/components/AgentFace";

export const BRAND_BG = "#14072e";
export function BrandBg({ width, height, cy = "34%" }: { width: number; height: number; cy?: string }) {
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="bb-l" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#1d0b4a" /><Stop offset="0.6" stopColor="#0f0626" /><Stop offset="1" stopColor="#06030f" /></LinearGradient>
        <RadialGradient id="bb-r" cx="50%" cy={cy} r="62%"><Stop offset="0" stopColor="#6a3dff" stopOpacity={0.55} /><Stop offset="0.5" stopColor="#5b2bff" stopOpacity={0.16} /><Stop offset="1" stopColor="#5b2bff" stopOpacity={0} /></RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#bb-l)" />
      <Rect width={width} height={height} fill="url(#bb-r)" />
    </Svg>
  );
}

/** The Lexari mark: grape rounded tile with the smiling face (webapp/app/icon.svg). */
export function LexariMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={16} fill="#5b2bff" />
      {/* eyes + smile */}
      <EyeSmile />
    </Svg>
  );
}
function EyeSmile() {
  // same face as components/Logo LogoMark and the app icon
  return <><Ellipse cx={22.9} cy={26.9} rx={5.1} ry={7.75} fill="#fff" /><Ellipse cx={40.9} cy={26.9} rx={5.1} ry={7.75} fill="#fff" /><Circle cx={24.4} cy={24.9} r={2.06} fill="#3514b0" /><Circle cx={42.4} cy={24.9} r={2.06} fill="#3514b0" /><Path d="M21.6 41.4 Q32 49.9 42.4 41.4" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" /></>;
}

/** Minimal onboarding illustration: a soft glowing circle holding one icon (or the agent face). */
export function GlowIllustration({ icon, size = 200 }: { icon?: string; size?: number }) {
  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size * 1.5} height={size * 1.5} style={{ position: "absolute" }}>
        <Defs><RadialGradient id="gi" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#8f6bff" stopOpacity={0.55} /><Stop offset="0.55" stopColor="#5b2bff" stopOpacity={0.18} /><Stop offset="1" stopColor="#5b2bff" stopOpacity={0} /></RadialGradient></Defs>
        <Rect width={size * 1.5} height={size * 1.5} fill="url(#gi)" />
      </Svg>
      <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, borderWidth: 1, borderColor: "rgba(201,184,255,0.35)", backgroundColor: "rgba(91,43,255,0.22)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: size * 0.9, height: size * 0.9, borderRadius: size, borderWidth: 1, borderColor: "rgba(201,184,255,0.12)" }} />
        {icon ? <Icon name={icon} size={size * 0.24} color="#fff" stroke={1.6} /> : <AgentFace size={size * 0.46} animated />}
      </View>
    </View>
  );
}
