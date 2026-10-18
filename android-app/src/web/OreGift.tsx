/**
 * Port of webapp/components/miner/OreGift.tsx: right after your first agent, a wrapped gift opens to reveal the ORE bot
 * (the free ORE Miner specialist). One tap claims it with the same free hire as the marketplace. Same words and facts.
 */
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { AgentTile, Btn, F, GRAPE, T, useC } from "@/web/kit";

type Phase = "closed" | "opening" | "open" | "claiming" | "claimed";

/** Same lines as the web. The ORE bot never earns anything on devnet and never mines on Lexari's machines. */
export const ORE_GIFT_FACTS: { icon: string; title: string; body: string }[] = [
  { icon: "spark", title: "Practice mode", body: "Real hashing with real hashrate, but no ORE rewards yet." },
  { icon: "server", title: "Runs on a computer you connect", body: "A one-line install on a machine you own. Nothing mines on Lexari's servers." },
  { icon: "undo", title: "Free, and yours to remove", body: "It takes no seat. Release it or uninstall the miner anytime." },
];

export default function OreGift({ agentName, onDone }: { agentName: string; onDone: (claimed: boolean) => void }) {
  const k = useC();
  const { token } = useSession();
  const { me, reload } = useData();
  const [phase, setPhase] = useState<Phase>("closed");
  const [err, setErr] = useState("");
  const opened = phase === "open" || phase === "claiming" || phase === "claimed";

  const bob = useSharedValue(0), shake = useSharedValue(0), lid = useSharedValue(0), card = useSharedValue(0), rays = useSharedValue(0), facts = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withSequence(withTiming(-12, { duration: 650, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 650, easing: Easing.inOut(Easing.quad) })), -1);
    const t = setTimeout(() => setPhase((p) => (p === "closed" ? "opening" : p)), 1400);
    return () => clearTimeout(t);
  }, [bob]);
  useEffect(() => {
    if (phase !== "opening") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    cancelAnimation(bob); bob.value = withTiming(0, { duration: 120 });
    shake.value = withRepeat(withSequence(withTiming(-10, { duration: 70 }), withTiming(10, { duration: 70 })), 4, true);
    lid.value = withDelay(300, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(() => setPhase("open"), 800);
    return () => clearTimeout(t);
  }, [phase, bob, shake, lid]);
  useEffect(() => {
    if (!opened) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    card.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.back(1.4)) });
    rays.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1);
    facts.value = withDelay(300, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const boxSt = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }, { rotate: `${shake.value}deg` }], opacity: 1 - lid.value * 0.9 }));
  const lidSt = useAnimatedStyle(() => ({ transform: [{ translateX: lid.value * 46 }, { translateY: lid.value * -150 }, { rotate: `${lid.value * 38}deg` }], opacity: 1 - Math.max(0, lid.value - 0.6) * 2.5 }));
  const cardSt = useAnimatedStyle(() => ({ opacity: Math.min(1, card.value * 1.6), transform: [{ perspective: 900 }, { translateY: (1 - card.value) * 40 }, { rotateY: `${(1 - card.value) * -100}deg` }, { scale: 0.7 + card.value * 0.3 }] }));
  const raySt = useAnimatedStyle(() => ({ opacity: Math.min(1, card.value * 1.5), transform: [{ rotate: `${rays.value}deg` }, { scale: 0.4 + Math.min(1, card.value) * 0.6 }] }));
  const factsSt = useAnimatedStyle(() => ({ opacity: facts.value, transform: [{ translateY: (1 - facts.value) * 12 }] }));

  const claim = async () => {
    if (!token || phase === "claiming") return;
    setErr(""); setPhase("claiming");
    try {
      if (!me?.agents.some((a) => a.slug === "ore")) {
        const again = !!me?.hires?.some((h) => h.slug === "ore");
        if (again) await api("/api/hires", { method: "PUT", body: JSON.stringify({ slug: "ore" }) }, token);
        else await api("/api/hires", { method: "POST", body: JSON.stringify({ slug: "ore", pay: "balance" }) }, token);
        void reload();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase("claimed");
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Couldn't add the ORE bot. Try again.");
      setPhase("open");
    }
  };

  return (
    <View testID="ore-gift" style={{ alignItems: "center", width: "100%", maxWidth: 460, alignSelf: "center" }}>
      <T f="mono" s={11} c={k.brandInk} style={{ letterSpacing: 0.44, textTransform: "uppercase" }}>{phase === "claimed" ? "Added to your team" : `A gift for ${agentName}`}</T>
      <T f="display" s={30} style={{ marginTop: 10, lineHeight: 31, letterSpacing: -1.3, textAlign: "center" }}>{phase === "claimed" ? "The ORE bot is in." : opened ? "Meet the ORE bot." : "One more thing…"}</T>

      <View style={{ height: 240, width: "100%", alignItems: "center", justifyContent: "center", marginTop: 14 }}>
        {opened ? (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 420, height: 420, alignItems: "center", justifyContent: "center" }, raySt]}>
            {Array.from({ length: 15 }, (_, i) => <View key={i} style={{ position: "absolute", width: 26, height: 420, borderRadius: 13, backgroundColor: "rgba(143,107,255,0.14)", transform: [{ rotate: `${i * 24}deg` }] }} />)}
          </Animated.View>
        ) : null}
        {!opened ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open the gift" onPress={() => setPhase("opening")}>
            <View style={{ width: 168, height: 168 }}>
              <Animated.View style={[{ position: "absolute", inset: 0 }, boxSt]}><GiftPart part="body" /></Animated.View>
              <Animated.View style={[{ position: "absolute", inset: 0 }, lidSt]}><GiftPart part="lid" /></Animated.View>
            </View>
          </Pressable>
        ) : (
          <Animated.View testID="ore-card" style={[{ width: 300, maxWidth: "100%", borderRadius: 26, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 18, shadowColor: GRAPE, shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 8 }, cardSt]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <AgentTile slug="ore" look={null} size={72} radius={24} dot={false} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T f="bold" s={20}>ORE bot</T>
                <T s={13.5} c={k.ink60} style={{ marginTop: 2 }}>A bot that does the mining</T>
                <View style={{ marginTop: 8, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "#fff4d6", paddingHorizontal: 8, paddingVertical: 3 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#f5a524" }} /><T f="bold" s={10.5} c="#8a5a00">Practice mode</T>
                </View>
              </View>
            </View>
            {phase === "claimed" ? <View style={{ position: "absolute", right: 12, top: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={15} stroke={3} color="#fff" /></View> : null}
          </Animated.View>
        )}
      </View>

      <Animated.View pointerEvents={opened ? "auto" : "none"} style={[{ width: "100%", gap: 8, marginTop: 6 }, factsSt]}>
        {ORE_GIFT_FACTS.map((f) => (
          <View key={f.title} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={f.icon} size={15} color={k.brandInk} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14}>{f.title}</T><T s={12.5} c={k.ink60} style={{ marginTop: 1, lineHeight: 17 }}>{f.body}</T></View>
          </View>
        ))}
        {err ? <T f="semi" s={13} c="#e5484d" style={{ textAlign: "center", marginTop: 4 }}>{err}</T> : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {phase === "claimed" ? <Btn kind="brand" h={48} label="Continue →" full style={{ flex: 1 }} onPress={() => onDone(true)} /> : (
            <>
              <Btn kind="line" h={48} label="Maybe later" disabled={phase === "claiming"} style={{ flex: 1 }} full onPress={() => onDone(false)} />
              <Btn kind="brand" h={48} label={phase === "claiming" ? "Adding…" : "Claim ORE bot"} disabled={phase === "claiming"} style={{ flex: 1.4 }} full onPress={() => void claim()} />
            </>
          )}
        </View>
        <T s={12} c={k.ink45} style={{ textAlign: "center", marginTop: 8, fontFamily: F.sans }}>{phase === "claimed" ? "Open its chat to connect a computer when you're ready." : "Free. You can also add it later from the marketplace."}</T>
      </Animated.View>
    </View>
  );
}

function GiftPart({ part }: { part: "body" | "lid" }) {
  return (
    <Svg width={168} height={168} viewBox="0 0 168 168">
      <Defs>
        <LinearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#7a52ff" /><Stop offset="1" stopColor="#4a1fe0" /></LinearGradient>
        <LinearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#9b7bff" /><Stop offset="1" stopColor="#6a3cff" /></LinearGradient>
      </Defs>
      {part === "body" ? (
        <G><Rect x={30} y={72} width={108} height={80} rx={14} fill="url(#gb)" /><Rect x={76} y={72} width={16} height={80} fill="#ffd84d" /><Rect x={30} y={72} width={108} height={10} fill="#000" opacity={0.12} /></G>
      ) : (
        <G>
          <Path d="M84 50c-8-16-30-20-32-6-2 12 20 12 32 6z" fill="#ffd84d" />
          <Path d="M84 50c8-16 30-20 32-6 2 12-20 12-32 6z" fill="#ffc21a" />
          <Rect x={22} y={50} width={124} height={26} rx={10} fill="url(#gl)" />
          <Rect x={76} y={50} width={16} height={26} fill="#ffd84d" />
        </G>
      )}
    </Svg>
  );
}
