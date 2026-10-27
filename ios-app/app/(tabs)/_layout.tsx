import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Icon from "@/components/Icon";
import { TourTarget } from "@/components/Tour";
import { tap } from "@/components/ui";
import { F, GRAPE, TopBar, useC } from "@/web/kit";
import { initialsOf, useData } from "@/web/data";
import { NameGate } from "@/components/NameFields";

/** Same as the web phone nav (AppShell PhoneNav): Agents, Brain, Market, Team, More; More swaps the row for Wallets, Settings, Profile, Hub, Close. */
const PRIMARY = [
  { name: "agents", label: "Agents", icon: "home" },
  { name: "brain", label: "Brain", icon: "memory" },
  { name: "marketplace", label: "Market", icon: "market" },
  { name: "team", label: "Team", icon: "team" },
];
const SECONDARY = [
  { name: "wallets", label: "Wallets", icon: "wallet" },
  { name: "settings", label: "Settings", icon: "settings" },
  { name: "profile", label: "Profile", icon: "user" },
  { name: "hub", label: "Hub", icon: "hub" },
];
const SEC = new Set(SECONDARY.map((s) => s.name));

type NavIt = { name: string; label: string; icon: string };
const NAV_H = 66;

/**
 * One nav cell. Same motion as the web MobileBars gsap timeline: the hiding row's items rise (or fall) out one by one
 * (0.26s, 35ms stagger, power2.in), then the other row's items come in one by one (0.42s, 45ms stagger, back.out(1.6)).
 */
function NavCell({ it, i, n, shown, dir, first, on, onPress }: { it: NavIt; i: number; n: number; shown: boolean; dir: number; first: boolean; on: boolean; onPress: () => void }) {
  const k = useC();
  const y = useSharedValue(shown ? 0 : 46);
  const o = useSharedValue(shown ? 1 : 0);
  const pill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    if (first) { y.value = shown ? 0 : 46; o.value = shown ? 1 : 0; return; }
    if (shown) {
      const d = 260 + (n - 1) * 35 - 120 + i * 45;
      y.value = 46 * dir; o.value = 0;
      y.value = withDelay(d, withTiming(0, { duration: 420, easing: Easing.out(Easing.back(1.6)) }));
      o.value = withDelay(d, withTiming(1, { duration: 300 }));
    } else {
      y.value = withDelay(i * 35, withTiming(-46 * dir, { duration: 260, easing: Easing.in(Easing.quad) }));
      o.value = withDelay(i * 35, withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }));
    }
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { pill.value = withTiming(on ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) }); }, [on, pill]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  const pst = useAnimatedStyle(() => ({ opacity: pill.value, transform: [{ scaleX: 0.6 + pill.value * 0.4 }, { scaleY: 0.8 + pill.value * 0.2 }] }));
  return (
    <Animated.View pointerEvents={shown ? "auto" : "none"} style={[{ flex: 1 }, st]}>
      <TourTarget id={`nav-${it.name}`} style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={it.label} accessibilityState={{ selected: on }} onPress={onPress} style={{ flex: 1, alignItems: "center", paddingTop: 8, gap: 4 }}>
          <View style={{ width: 48, height: 32, alignItems: "center", justifyContent: "center" }}>
            {/* the web's h-8 w-12 rounded-full bg-grape: an oval pill behind the icon */}
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: 48, height: 32, borderRadius: 999, backgroundColor: GRAPE }, pst]} />
            <View style={{ zIndex: 1 }}><Icon name={it.icon} size={21} color={on ? "#fff" : k.ink75} /></View>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 11, color: on ? k.ink : k.ink60 }}>{it.label}</Text>
        </Pressable>
      </TourTarget>
    </Animated.View>
  );
}

function PhoneNav({ state, navigation }: BottomTabBarProps) {
  const k = useC();
  const insets = useSafeAreaInsets();
  const raw = state.routes[state.index]?.name;
  const current = raw === "marketplace/[slug]" ? "marketplace" : raw; // a listing keeps Market lit, like the web
  const [more, setMore] = useState(SEC.has(current));
  const first = useRef(true);
  useEffect(() => { if (SEC.has(current)) setMore(true); }, [current]);
  useEffect(() => { const t = setTimeout(() => { first.current = false; }, 50); return () => clearTimeout(t); }, []);
  const rowA: NavIt[] = [...PRIMARY, { name: "more", label: "More", icon: "more" }];
  const rowB: NavIt[] = [...SECONDARY, { name: "close", label: "Close", icon: "x" }];
  const press = (it: NavIt) => {
    tap();
    if (it.name === "more") setMore(true);
    else if (it.name === "close") setMore(false);
    else navigation.navigate(it.name);
  };
  const dir = more ? 1 : -1; // opening: items rise out and in from below; closing: they fall away and drop back in
  const row = (items: NavIt[], shown: boolean) => (
    <View pointerEvents={shown ? "box-none" : "none"} style={{ position: "absolute", left: 0, right: 0, top: 0, height: NAV_H, flexDirection: "row" }}>
      {items.map((it, i) => <NavCell key={it.name} it={it} i={i} n={items.length} shown={shown} dir={dir} first={first.current} on={it.name === current} onPress={() => press(it)} />)}
    </View>
  );
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: k.line, backgroundColor: k.bg, paddingBottom: insets.bottom }}>
      <View style={{ height: NAV_H, overflow: "hidden" }}>
        {row(rowA, !more)}
        {row(rowB, more)}
      </View>
    </View>
  );
}

function Bar() {
  const { me } = useData();
  return <TopBar initials={initialsOf(me)} avatar={me?.profile?.avatar} />;
}

export default function TabsLayout() {
  const k = useC();
  const insets = useSafeAreaInsets();
  return (
    <>
      <View style={{ flex: 1, backgroundColor: k.bg, paddingTop: insets.top }}>
        <Bar />
        <Tabs tabBar={(p) => <PhoneNav {...p} />} screenListeners={{ tabPress: () => tap() }} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: k.bg }, animation: "fade" }}>
          {[...PRIMARY, ...SECONDARY].map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />)}
          <Tabs.Screen name="marketplace/[slug]" options={{ href: null, title: "Listing" }} />
        </Tabs>
      </View>
      <NameGate />
    </>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
