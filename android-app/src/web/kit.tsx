/** Phone kit that mirrors app.lexari.ai at 390px: colours, type scale, top bar, agent tiles with rings, labels, pills. */
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { useMotion } from "@/lib/motion";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { useData } from "@/web/data";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { Modal, Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import Icon from "@/components/Icon";
import { Face, tap } from "@/components/ui";
import AgentFace from "@/components/AgentFace";
import { lookVariant } from "@/components/avatar";
import { usePrefs } from "@/state/prefs";
import { NotifyBell } from "@/components/Notifications";
import { Avatar } from "@/web/media";

export const GRAPE = "#5b2bff", GRAPE_SOFT = "#8f6bff", GOLD = "#f5c542", SILVER = "#c4c8d2", ONLINE = "#22c55e", IDLE = "#8a8797";
export const F = {
  sans: "Figtree_400Regular", reg: "Figtree_400Regular", med: "Figtree_500Medium", semi: "Figtree_600SemiBold", bold: "Figtree_700Bold", xbold: "Figtree_800ExtraBold",
  display: "BricolageGrotesque_800ExtraBold", mono: "MartianMono_400Regular", monoB: "MartianMono_500Medium",
};

/** Theme colours, same as shared/styles/theme.css. */
export function useC() {
  const { palette, isDark } = usePrefs();
  return {
    dark: isDark, bg: palette.bg, alt: palette.alt, card: palette.card, tint: palette.tint, ink: palette.ink, line: palette.line,
    brandInk: isDark ? "#a58bff" : "#5b2bff", faceTile: isDark ? "#0a0a0a" : "#ffffff",
    ink60: isDark ? "rgba(255,255,255,0.6)" : "rgba(10,10,10,0.6)", ink75: isDark ? "rgba(255,255,255,0.75)" : "rgba(10,10,10,0.75)",
    ink45: isDark ? "rgba(255,255,255,0.45)" : "rgba(10,10,10,0.45)",
  };
}
export type C = ReturnType<typeof useC>;

export function T({ f = "sans", s = 14, c, style, children, lines, ...rest }: { f?: keyof typeof F; s?: number; c?: string; style?: TextStyle | TextStyle[]; children: ReactNode; lines?: number; onPress?: () => void }) {
  const k = useC();
  return <Text numberOfLines={lines} {...rest} style={[{ fontFamily: F[f], fontSize: s, color: c ?? k.ink }, style as TextStyle]}>{children}</Text>;
}
/** The mono uppercase eyebrow (.label). */
export function Label({ children, c, s = 10, style, lines }: { children: ReactNode; c?: string; s?: number; style?: TextStyle; lines?: number }) {
  const k = useC();
  return <Text numberOfLines={lines} style={[{ fontFamily: F.mono, fontSize: s, letterSpacing: s * 0.06, textTransform: "uppercase", color: c ?? k.brandInk }, style]}>{children}</Text>;
}
export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void }) {
  const k = useC();
  const st = [{ backgroundColor: k.card, borderRadius: 18, borderWidth: 1, borderColor: k.line }, style as ViewStyle];
  return onPress ? <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [...st, pressed && { opacity: 0.85 }]}>{children}</Pressable> : <View style={st}>{children}</View>;
}
/** Rounded pill button: brand (purple), light (white), ghost (tint), outline. */
export function Pill({ label, onPress, kind = "brand", icon, h = 40, style, disabled, fs = 14 }: { label: string; onPress?: () => void; kind?: "brand" | "light" | "ghost" | "outline" | "soft" | "white"; icon?: string; h?: number; style?: ViewStyle; disabled?: boolean; fs?: number }) {
  const k = useC();
  const bg = kind === "white" ? "#fff" : kind === "brand" ? GRAPE : kind === "light" ? (k.dark ? "#fff" : "#0a0a0a") : kind === "ghost" ? k.tint : kind === "soft" ? "rgba(255,255,255,0.15)" : "transparent";
  const fg = kind === "white" ? "#0a0a0a" : kind === "brand" || kind === "soft" ? "#fff" : kind === "light" ? (k.dark ? "#0a0a0a" : "#fff") : k.ink;
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress?.(); }} style={({ pressed }) => [{ height: h, borderRadius: h / 2, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: bg, borderWidth: kind === "outline" ? 1.5 : 0, borderColor: k.ink, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {icon ? <Icon name={icon} size={fs + 2} color={fg} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: fs, color: fg }}>{label}</Text>
    </Pressable>
  );
}
export function Round({ icon, onPress, size = 44, badge, filled, label }: { icon?: string; onPress?: () => void; size?: number; badge?: string; filled?: ReactNode; label: string }) {
  const k = useC();
  return (
    <Pressable accessibilityLabel={label} onPress={() => { tap(); onPress?.(); }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: filled ? k.ink : "transparent", borderWidth: filled ? 0 : 1, borderColor: k.line }}>
      {filled ?? <Icon name={icon!} size={19} color={k.ink} />}
      {badge ? <View style={{ position: "absolute", top: -4, right: -6, minWidth: 22, height: 18, borderRadius: 9, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: k.bg }}><Text style={{ fontFamily: F.bold, fontSize: 10, color: "#fff" }}>{badge}</Text></View> : null}
    </Pressable>
  );
}
export function Logo() {
  const k = useC();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <LogoMark size={25} />
      {/* web header wordmark: text-[26px] display, which the phone type scale draws at 20px / 19px */}
      <Text style={{ fontFamily: F.display, fontSize: 20, lineHeight: 19, letterSpacing: -0.9, color: k.ink }}>lexari</Text>
    </View>
  );
}

export type Ring = "primary" | "made" | "hired" | null;
export function ringOf(slug: string, kind?: string, primary = "home"): Ring {
  if (slug === primary) return "primary";
  return slug === "home" || kind === "custom" || slug.startsWith("c-") ? "made" : "hired";
}
/** An agent face on its tile with the gold / purple / silver ring and a presence dot (faces.tsx AgentTile). */
export function AgentTile({ slug, look, size = 48, ring, dot = true, live = false, mood, radius, face: faceSize, animate }: { slug: string; look?: unknown; size?: number; ring?: Ring; dot?: boolean; live?: boolean; mood?: "idle" | "thinking" | "speaking" | "happy"; radius?: number; /** face size inside the tile (default 74% of it) */ face?: number; /** keep the face alive (blink, glance, orbit dots) even when idle */ animate?: boolean }) {
  const k = useC();
  const r = radius ?? Math.round(size * 0.32), d = Math.max(8, Math.round(size * 0.24));
  const rc = ring === "primary" ? GOLD : ring === "made" ? GRAPE_SOFT : ring === "hired" ? (k.dark ? SILVER : "#a9aebb") : null;
  const face = faceSize ?? Math.round(size * 0.74);
  const lk = look && typeof look === "object" && Object.keys(look as object).some((x) => x !== "v") ? lookVariant(look as never) : null;
  // Level perks (webapp faces.tsx AgentTile): a breathing purple glow from level 4 (Card glow), gold from level 10 (Legend)
  const { me, hub } = useData();
  const mine = size >= 26 && !!me?.agents.some((a) => a.slug === slug);
  const lv = mine ? hub?.levels?.find((l) => l.slug === slug)?.level ?? 1 : 1;
  const perk = lv >= 10 ? "legend" : lv >= 4 ? "glow" : null;
  return (
    <View style={{ width: size, height: size }}>
      {perk ? <PerkGlow kind={perk} radius={r} pad={2} /> : null}
      {rc ? <View style={{ position: "absolute", left: -4, top: -4, right: -4, bottom: -4, borderRadius: r + 4, borderWidth: 2, borderColor: rc, ...(ring === "primary" ? { shadowColor: GOLD, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null) }} /> : null}
      <View style={{ width: size, height: size, borderRadius: r, backgroundColor: k.faceTile, borderWidth: 1, borderColor: k.line, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {lk ? <AgentFace variant={lk} size={face} state={mood} animated={animate ?? (!!mood && mood !== "idle")} /> : <Face slug={slug === "home" ? undefined : slug} size={face} mood={mood} animated={animate} />}
      </View>
      {dot && ring ? <View style={{ position: "absolute", width: d, height: d, borderRadius: d / 2, right: -d * 0.15, bottom: -d * 0.15, backgroundColor: live ? ONLINE : IDLE, borderWidth: 2, borderColor: k.alt }} /> : null}
    </View>
  );
}

/** [data-tile-perk] / [data-card-perk]: a soft halo that breathes every 3.2s, purple (glow) or gold (legend). */
export function PerkGlow({ kind, radius, pad = 0, strong }: { kind: "glow" | "legend"; radius: number; pad?: number; strong?: boolean }) {
  const p = useSharedValue(0);
  const on = useMotion();
  useEffect(() => { if (!on) { cancelAnimation(p); return; } p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true); return () => cancelAnimation(p); }, [p, on]);
  const gold = kind === "legend";
  const lo = gold ? "rgba(233,183,58,0.55)" : "rgba(139,92,246,0.5)", hi = gold ? "rgba(247,215,116,0.85)" : "rgba(168,120,255,0.8)";
  const st = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * p.value, }));
  const blur = strong ? 30 : 10, spread = strong ? 5 : 2;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -pad, top: -pad, right: -pad, bottom: -pad, borderRadius: radius + pad, boxShadow: `0 0 ${blur}px ${spread}px ${lo}, 0 0 ${blur * 1.6}px ${spread * 2}px ${hi}` }, st]} />
  );
}

/** The phone top bar: logo, bell, theme toggle, profile initials. */
export function TopBar({ initials = "A", avatar }: { initials?: string; avatar?: unknown }) {
  const k = useC();
  const { setTheme, isDark } = usePrefs();
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: k.line, backgroundColor: k.bg }}>
      <Pressable onPress={() => router.navigate("/(tabs)/agents")}><Logo /></Pressable>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <NotifyBell />
        <Round label="Theme" icon={isDark ? "sun" : "moon"} onPress={() => setTheme(isDark ? "light" : "dark")} />
        <Round label="Profile" filled={<Avatar at={avatar} initials={initials} size={44} fs={13} />} onPress={() => router.navigate("/(tabs)/profile")} />
      </View>
    </View>
  );
}

/** Segmented tabs (Daily / Weekly / Hard, Account / Security, Wallet / Cards). */
export function Segs<K extends string>({ items, on, set, style }: { items: { k: K; label: string; icon?: string; badge?: number }[]; on: K; set: (k: K) => void; style?: ViewStyle }) {
  const k = useC();
  return (
    <View style={[{ flexDirection: "row", backgroundColor: k.tint, borderRadius: 999, padding: 4 }, style]}>
      {items.map((it) => {
        const a = it.k === on;
        return (
          <Pressable key={it.k} onPress={() => { tap(); set(it.k); }} style={{ flex: 1, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: a ? k.card : "transparent", borderWidth: a ? 1 : 0, borderColor: k.line }}>
            {it.icon ? <Icon name={it.icon} size={15} color={a ? k.ink : k.ink60} /> : null}
            <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: a ? k.ink : k.ink60 }}>{it.label}</Text>
            {it.badge ? <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.bold, fontSize: 10, color: "#fff" }}>{it.badge}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
export const short = (a?: string | null, n = 4) => (a ? `${a.slice(0, n)}…${a.slice(-n)}` : "");

/** Bottom sheet like the web phone sheets: rounded top, title + round close, scrolling body. */
/** Bottom sheet like the web's: blurred dim backdrop, drag handle, optional grape icon tile + subtitle (billing Sheet), close. */
export function WSheet({ open, title, sub, icon, iconNode, right, onClose, children, footer }: { open: boolean; title: string; sub?: ReactNode; icon?: string; iconNode?: ReactNode; right?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const k = useC();
  if (!open) return null;
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        <BlurView intensity={18} tint="dark" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />
      </Pressable>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%", backgroundColor: k.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: k.line }}>
        <View style={{ alignItems: "center", paddingTop: 10 }}><View style={{ width: 44, height: 6, borderRadius: 3, backgroundColor: k.dark ? "rgba(255,255,255,0.2)" : "rgba(10,10,10,0.2)" }} /></View>
        <View style={{ flexDirection: "row", alignItems: icon || iconNode ? "flex-start" : "center", gap: 12, paddingHorizontal: 16, paddingTop: icon || iconNode ? 12 : 8, paddingBottom: 10 }}>
          {iconNode ?? (icon ? <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={20} /></View> : null)}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: icon || iconNode ? F.display : F.bold, fontSize: icon ? 19 : 18, letterSpacing: icon ? -0.4 : 0, color: k.ink }}>{title}</Text>
            {typeof sub === "string" ? <Text style={{ fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: k.ink60, marginTop: 3 }}>{sub}</Text> : sub ? <View style={{ marginTop: 3 }}>{sub}</View> : null}
          </View>
          {right}
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: icon ? "transparent" : k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={18} color={k.ink75} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: footer ? 12 : 28, paddingTop: 4 }}>{children}</ScrollView>
        {footer ? <View style={{ borderTopWidth: 1, borderTopColor: k.line, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}
let coinN = 0;
/** A Lexari coin (port of hub/coin.tsx): purple, a white spark in the middle. */
export function Coin({ size = 14 }: { size?: number }) {
  const [u] = useState(() => `cn${++coinN}`);
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id={u + "a"} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#b9a3ff" /><Stop offset=".55" stopColor="#7c4dff" /><Stop offset="1" stopColor="#4a1fe0" /></LinearGradient>
        <LinearGradient id={u + "b"} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#6a3cff" /><Stop offset="1" stopColor="#3514b0" /></LinearGradient>
      </Defs>
      <Circle cx="20" cy="21.5" r="17" fill="#2a0e8f" />
      <Circle cx="20" cy="19.5" r="17" fill={`url(#${u}a)`} />
      <Circle cx="20" cy="19.5" r="12.6" fill={`url(#${u}b)`} stroke="#d9ccff" strokeOpacity={0.55} strokeWidth={1.2} />
      <Path d="M20 11.5 L22.1 17.4 L28 19.5 L22.1 21.6 L20 27.5 L17.9 21.6 L12 19.5 L17.9 17.4 Z" fill="#fff" />
    </Svg>
  );
}

/** Absolute-fill gradient background (CSS linear-gradient / radial-gradient stand-in). */
export function Grad({ stops, angle = 120, radial }: { stops: [string, number][]; angle?: number; radial?: { cx: string; cy: string; r: string; color: string; opacity?: number }[] }) {
  const [id] = useState(() => `g${++coinN}`);
  const rad = (angle - 90) * (Math.PI / 180);
  const x1 = 0.5 - Math.cos(rad) / 2, y1 = 0.5 - Math.sin(rad) / 2, x2 = 0.5 + Math.cos(rad) / 2, y2 = 0.5 + Math.sin(rad) / 2;
  return (
    <Svg style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>{stops.map(([c, o], i) => <Stop key={i} offset={o} stopColor={c} />)}</LinearGradient>
        {(radial ?? []).map((r, i) => <RadialGradient key={i} id={`${id}r${i}`} cx={r.cx} cy={r.cy} rx={r.r} ry={r.r} fx={r.cx} fy={r.cy}><Stop offset={0} stopColor={r.color} stopOpacity={r.opacity ?? 0.8} /><Stop offset={1} stopColor={r.color} stopOpacity={0} /></RadialGradient>)}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      {(radial ?? []).map((_, i) => <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#${id}r${i})`} />)}
    </Svg>
  );
}

/**
 * The web `.btn` family (shared/styles/theme.css): pill, bold, 56px (sm 40/44px), with the solid 6px drop for brand/white
 * and 5px grape drop for ink. Pressing scales to .97 like `.btn:active`.
 */
export function Btn({ label, onPress, kind = "brand", h = 56, fs, icon, iconRight, disabled, style, full, children, drop: dropIn, a11y }: {
  a11y?: string; drop?: number; label?: string; onPress?: () => void; kind?: "brand" | "white" | "line" | "ghost" | "ink"; h?: number; fs?: number; icon?: string; iconRight?: string;
  disabled?: boolean; style?: ViewStyle; full?: boolean; children?: ReactNode;
}) {
  const k = useC();
  const drop = dropIn ?? (kind === "brand" || kind === "white" ? 6 : kind === "ink" ? 5 : 0);
  const dropC = kind === "ink" ? GRAPE : "#3514b0";
  const bg = kind === "brand" ? GRAPE : kind === "white" ? "#fff" : kind === "ghost" ? k.tint : kind === "ink" ? k.ink : "transparent";
  const fg = kind === "brand" ? "#fff" : kind === "white" ? "#0a0a0a" : kind === "ink" ? k.bg : k.ink;
  const size = fs ?? (h >= 52 ? 16 : 14);
  return (
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [{ alignSelf: full ? "stretch" : "flex-start", height: h + drop, opacity: disabled ? 0.55 : 1, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] }, style]}>
      {drop ? <View style={{ position: "absolute", left: 0, right: 0, top: drop, height: h, borderRadius: 999, backgroundColor: dropC }} /> : null}
      <View style={{ height: h, borderRadius: 999, backgroundColor: bg, borderWidth: kind === "line" ? 2 : 0, borderColor: k.ink, paddingHorizontal: h >= 52 ? 25.6 : 18.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8.8 }}>
        {icon ? <Icon name={icon} size={size + 2} color={fg} /> : null}
        {children ?? (label ? <Text style={{ fontFamily: F.bold, fontSize: size, color: fg }}>{label}</Text> : null)}
        {iconRight ? <Icon name={iconRight} size={size + 2} color={fg} /> : null}
      </View>
    </Pressable>
  );
}

/** The web `.chip`: 38px tint pill, grape with a 4px deep drop when on. */
export function Chip({ label, on, onPress, icon, style }: { label: string; on?: boolean; onPress?: () => void; icon?: ReactNode; style?: ViewStyle }) {
  const k = useC();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={() => { tap(); onPress?.(); }} style={({ pressed }) => [{ height: 42.4, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
      {on ? <View style={{ position: "absolute", left: 0, right: 0, top: 4, height: 38.4, borderRadius: 999, backgroundColor: "#3514b0" }} /> : null}
      <View style={{ height: 38.4, borderRadius: 999, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 6.4, backgroundColor: on ? GRAPE : k.tint }}>
        {icon}
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: on ? "#fff" : k.ink }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** gsap `from({ y, opacity }, back.out)` entrances: rises into place after `delay` ms. */
export function Rise({ children, delay = 0, y = 30, x = 0, ms = 800, back = 1.5, style }: { children: ReactNode; delay?: number; y?: number; x?: number; ms?: number; back?: number; style?: ViewStyle | ViewStyle[] }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(delay, withTiming(1, { duration: ms, easing: Easing.out(Easing.back(back)) })); }, [p, delay, ms, back]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.6), transform: [{ translateY: (1 - p.value) * y }, { translateX: (1 - p.value) * x }] }));
  return <Animated.View style={[st, style as ViewStyle]}>{children}</Animated.View>;
}
/** gsap `from({ scale: 0, rotate: -20 }, back.out(2))`: pops in. */
export function PopIn({ children, delay = 0, ms = 800, rotate = -20, style }: { children: ReactNode; delay?: number; ms?: number; rotate?: number; style?: ViewStyle | ViewStyle[] }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(delay, withTiming(1, { duration: ms, easing: Easing.out(Easing.back(2)) })); }, [p, delay, ms]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 3), transform: [{ scale: Math.max(0, p.value) }, { rotate: `${(1 - p.value) * rotate}deg` }] }));
  return <Animated.View style={[st, style as ViewStyle]}>{children}</Animated.View>;
}

/** The web's settings switch (h-7 w-12 that lays out at 44x28): grape when on, ink/20 when off, a white 20px knob with a soft shadow. */
export function WToggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const k = useC();
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => { t.value = withTiming(on ? 1 : 0, { duration: 150, easing: Easing.out(Easing.quad) }); }, [on, t]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 20 }] }));
  const fill = useAnimatedStyle(() => ({ opacity: t.value }));
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} disabled={disabled} hitSlop={6}
      onPress={() => { tap(); onChange(!on); }}
      style={{ width: 44, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: k.dark ? "rgba(255,255,255,0.2)" : "rgba(10,10,10,0.2)", opacity: disabled ? 0.5 : 1 }}>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: GRAPE }, fill]} />
      <Animated.View style={[{ position: "absolute", left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }, knob]} />
    </Pressable>
  );
}
