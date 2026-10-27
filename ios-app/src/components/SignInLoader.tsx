/** Port of webapp/components/SignInLoader.tsx: full-screen branded loading while the session is set up. */
import { useEffect } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import AgentFace from "./AgentFace";
import { F } from "@/web/kit";
import { LogoMark } from "./Logo";

function Dot({ i }: { i: number }) {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withDelay(i * 150, withRepeat(withSequence(withTiming(-6, { duration: 500, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })), -1)); }, [y, i]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#c9b8ff" }, st]} />;
}

export default function SignInLoader({ text = "Signing you in…", sub }: { text?: string; sub?: string }) {
  const { width, height } = useWindowDimensions();
  const ping = useSharedValue(0);
  useEffect(() => { ping.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }), -1); }, [ping]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - ping.value, transform: [{ scale: 1 + ping.value * 0.6 }] }));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={text} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: "#07050e", alignItems: "center", justifyContent: "center" }}>
      <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id="sil" cx={width / 2} cy={height * 0.42} r={460} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#5b2bff" stopOpacity="0.4" /><Stop offset="0.35" stopColor="#5b2bff" stopOpacity="0.34" />
            <Stop offset="0.6" stopColor="#5b2bff" stopOpacity="0.14" /><Stop offset="1" stopColor="#5b2bff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#sil)" />
      </Svg>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{ position: "absolute", width: 150, height: 150, borderRadius: 44, borderWidth: 2, borderColor: "rgba(201,184,255,0.4)" }, ring]} />
        <View style={{ width: 132, height: 132, borderRadius: 40, backgroundColor: "#1d0f5c", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><AgentFace size={104} animated /></View>
      </View>
      <View style={{ marginTop: 36, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LogoMark size={28} />
        <Text style={{ fontFamily: F.display, fontSize: 19, letterSpacing: -0.85, color: "#fff" }}>lexari</Text>
      </View>
      <Text style={{ marginTop: 16, fontFamily: F.semi, fontSize: 15.5, color: "#fff" }}>{text}</Text>
      {sub ? <Text style={{ marginTop: 6, maxWidth: 280, textAlign: "center", fontFamily: F.sans, fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>{sub}</Text> : null}
      <View style={{ marginTop: 24, flexDirection: "row", gap: 6 }}>{[0, 1, 2].map((i) => <Dot key={i} i={i} />)}</View>
    </View>
  );
}
