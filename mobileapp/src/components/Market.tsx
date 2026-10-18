/** Marketplace pieces shared by the store and a listing (webapp/components/market/parts.tsx): hire button, store tile, shelf. */
import { Children, createContext, useContext, useEffect, useRef, useState } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Face, tap } from "@/components/ui";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { PALETTE } from "@/components/avatar";
import { compact, storeMeta, type Specialist } from "@/content/roster";
import { AgentTile, Grad, Label, T, useC } from "@/web/kit";
import { useData } from "@/web/data";

export const open = (slug: string) => router.push(`/marketplace/${slug}`);
/** Provide useHire().start so every Hire button opens the same confirmation. */
export const HireCtx = createContext<(slug: string) => void>(() => {});

export function HireBtn({ a, lg }: { a: Specialist; lg?: boolean }) {
  const k = useC();
  const onHire = useContext(HireCtx);
  const { me } = useData();
  const hired = !!me?.agents.some((x) => x.slug === a.slug);
  const again = !hired && !!me?.hires?.some((h) => h.slug === a.slug);
  const h = lg ? 44 : 32; // the phone site: .h-12 is 2.75rem, .px-7 is 1.125rem and text-[16px] is 15px at ≤430
  // the moment a hire lands, the button pops and a check draws in before it settles on "Open"
  const was = useRef(hired);
  const pop = useSharedValue(1), chk = useSharedValue(hired ? 0 : 0);
  useEffect(() => {
    if (hired && !was.current) {
      pop.value = withSequence(withTiming(1.18, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 8, stiffness: 220 }));
      chk.value = withSequence(withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2.5)) }), withDelay(1400, withTiming(0, { duration: 260 })));
    }
    was.current = hired;
  }, [hired, pop, chk]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const cst = useAnimatedStyle(() => ({ width: chk.value * (lg ? 20 : 16), opacity: chk.value, transform: [{ scale: chk.value }] }));
  return (
    <Animated.View style={st}>
      <Pressable onPress={() => { tap(); if (hired) router.push(`/chat/${a.slug}`); else onHire(a.slug); }} style={({ pressed }) => ({ height: h, paddingHorizontal: lg ? 18 : 16, borderRadius: h / 2, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: hired ? k.tint : "#5b2bff", transform: [{ scale: pressed ? 0.96 : 1 }] })}>
        <Animated.View style={[{ overflow: "hidden", alignItems: "flex-start" }, cst]}><Icon name="check" size={lg ? 16 : 13} stroke={3} color={k.brandInk} /></Animated.View>
        <T f="bold" s={lg ? 15 : 13} c={hired ? k.brandInk : "#fff"}>{hired ? "Open" : a.free || again ? "Hire · Free" : "Hire · $1"}</T>
      </Pressable>
    </Animated.View>
  );
}


/** webapp StarRow: five stars, the rating's rounded count filled. */
export function StarRow({ v, size = 12 }: { v: number; size?: number }) {
  const k = useC();
  return <View accessibilityLabel={`${v} out of 5`} style={{ flexDirection: "row", gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <View key={i} style={{ opacity: i <= Math.round(v) ? 1 : 0.25 }}><Icon name="star" size={size} color={k.brandInk} /></View>)}</View>;
}

function FlipChip() {
  return <View pointerEvents="none" style={{ position: "absolute", right: 10, top: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}><Icon name="flip" size={13} color="rgba(255,255,255,0.9)" /></View>;
}

/** Store tile: tap the picture to flip it over in 3D (rating, hires, skills, price, speed, Open listing), like the web .flip card. */
export function AppCard({ a, wide, width }: { a: Specialist; wide?: boolean; width: number }) {
  const k = useC();
  const m = storeMeta(a);
  const [flipped, setFlipped] = useState(false);
  const f = useSharedValue(0);
  const press = useSharedValue(1);
  const flip = () => { tap(); const to = flipped ? 0 : 180; setFlipped(!flipped); f.value = withTiming(to, { duration: 650, easing: Easing.bezier(0.3, 1.35, 0.5, 1) }); };
  const front = useAnimatedStyle(() => ({ opacity: f.value < 90 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${f.value}deg` }, { scale: press.value }] }));
  const back = useAnimatedStyle(() => ({ opacity: f.value >= 90 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${f.value - 180}deg` }, { scale: press.value }] }));
  const h = wide ? 236 : Math.round(width * 1.325);
  const col = PALETTE[a.face];
  const skills = a.skills.slice(0, wide ? 2 : 3); const more = a.skills.length - skills.length;
  const face = { position: "absolute" as const, left: 0, top: 0, right: 0, bottom: 0, borderRadius: 22, overflow: "hidden" as const, backfaceVisibility: "hidden" as const };
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: flipped }} accessibilityLabel={flipped ? `${a.name} details. Tap to flip back.` : `${a.name}. Tap to flip for details.`}
        onPress={flip} onPressIn={() => { press.value = withTiming(0.97, { duration: 120 }); }} onPressOut={() => { press.value = withSpring(1, { damping: 12, stiffness: 260 }); }} style={{ height: h }}>
        <Animated.View pointerEvents={flipped ? "none" : "auto"} style={[face, front]}>
          {wide ? (
            <View style={{ flex: 1, padding: 16, justifyContent: "space-between", borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <Grad angle={125} stops={[["#0a0a0a", 0], ["#1d0f5c", 0.58], [col.shade, 1]]} radial={[{ cx: "88%", cy: "18%", r: "75%", color: col.fill, opacity: 0.7 }]} />
              <View style={{ position: "absolute", right: -40, top: -48, width: 160, height: 160, borderRadius: 80, borderWidth: 18, borderColor: col.fill, opacity: 0.25 }} />
              <View style={{ position: "absolute", right: 64, top: 24, width: 12, height: 12, borderRadius: 6, backgroundColor: col.fill, opacity: 0.7 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingRight: 36 }}>
                <View style={{ backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}><Label s={8.5} c="#0a0a0a">New</Label></View>
                <View style={{ flex: 1, alignItems: "flex-end" }}><Label s={8.5} c="rgba(255,255,255,0.7)" lines={1}>{a.job}</Label></View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
                <AgentTile slug={a.slug} size={84} radius={24} dot={false} animate />
                <T f="semi" s={14} c="rgba(255,255,255,0.9)" style={{ flex: 1, textAlign: "right", paddingBottom: 4, lineHeight: 19 }} lines={4}>{`“${a.quip}”`}</T>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, borderRadius: 22, backgroundColor: k.faceTile, borderWidth: 1, borderColor: k.line, alignItems: "center", justifyContent: "center" }}>
              {/* the web tile: the whole card is the agent's face tile, the face drawn at 136px */}
              <Face slug={a.slug} size={Math.min(136, Math.round(width * 0.72))} animated />
            </View>
          )}
          <FlipChip />
        </Animated.View>
        <Animated.View pointerEvents={flipped ? "auto" : "none"} style={[face, { backgroundColor: "#0a0a0a", padding: wide ? 16 : 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }, back]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><T f="bold" s={13} c="#fff">{String(a.rating)}</T><Icon name="star" size={12} color="#c9b8ff" /></View><T s={13} c="rgba(255,255,255,0.65)">{`${compact(m.hires)} hires`}</T></View>
          <Label s={8.5} c="#c9b8ff" style={{ marginTop: 10 }}>Skills</Label>
          {skills.map(([sk]) => <T key={sk} s={12} c="rgba(255,255,255,0.85)" lines={2} style={{ marginTop: 4, lineHeight: 15.6 }}>{`· ${sk}`}</T>)}
          {more > 0 ? <T s={12} c="rgba(255,255,255,0.45)" style={{ marginTop: 4 }}>{`+${more} more`}</T> : null}
          {!wide && width >= 190 ? <View style={{ marginTop: 10, borderLeftWidth: 2, borderLeftColor: "rgba(201,184,255,0.6)", paddingLeft: 8 }}><T s={12} c="rgba(255,255,255,0.7)" lines={3} style={{ fontStyle: "italic", lineHeight: 16 }}>{`“${a.quip}”`}</T></View> : null}
          <View style={{ marginTop: "auto", gap: 4, paddingTop: 8 }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}><T f="bold" s={11.5} c="#fff">{m.free ? "Free" : "Paid add-ons"}</T></View>
            <T s={11.5} c="rgba(255,255,255,0.6)" lines={1}>{a.speed}</T>
          </View>
          <Pressable onPress={() => open(a.slug)} style={{ marginTop: 10, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}><T f="bold" s={12.5} c="#0a0a0a">Open listing →</T></Pressable>
        </Animated.View>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 }}>
        <Pressable onPress={() => open(a.slug)} style={{ flex: 1, minWidth: 0 }}>
          <T f="bold" s={15} lines={1}>{a.name}</T>
          <T s={12.5} c={k.ink45} lines={2} style={{ lineHeight: 16 }}>{`${m.maker} · ${m.cat}`}</T>
        </Pressable>
        <View style={{ paddingTop: 2 }}><HireBtn a={a} /></View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
        <T f="semi" s={12.5} c={k.ink75}>{String(a.rating)}</T><Icon name="star" size={11} color={k.brandInk} /><T s={12.5} c={k.ink45}>{` · ${compact(m.hires)} hires`}</T>
        <Pressable onPress={() => open(a.slug)} hitSlop={8} style={{ marginLeft: "auto" }}><T f="bold" s={12.5} c={k.brandInk}>Open</T></Pressable>
      </View>
    </View>
  );
}

/**
 * A row that scrolls sideways (web ShelfRow: -mx-4 px-4 gap-4 snap-x scroll-px-4). Explicit leading and trailing spacers
 * instead of contentContainer padding + gap, which Android drops from the scroll width (that clipped the last card).
 * `snap` makes each card settle with the next one peeking in.
 */
export function HScroll({ children, gap = 16, pad = 16, snap, style }: { children: React.ReactNode; gap?: number; pad?: number; snap?: number; style?: object }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -pad, flexGrow: 0 }, style]} contentContainerStyle={{ alignItems: "flex-start", paddingVertical: 4 }}
      decelerationRate={snap ? "fast" : "normal"} snapToInterval={snap ? snap + gap : undefined} snapToAlignment="start" disableIntervalMomentum={!!snap}>
      <View style={{ width: pad }} />
      {items.map((c, i) => <View key={i} style={{ marginLeft: i ? gap : 0 }}>{c}</View>)}
      <View style={{ width: pad }} />
    </ScrollView>
  );
}

export function Shelf({ title, sub, children, snap }: { title: string; sub: string; children: React.ReactNode; snap?: number }) {
  const k = useC();
  return (
    <View style={{ marginTop: 36 }}>
      <T f="bold" s={18} style={{ letterSpacing: -0.45, lineHeight: 27 }}>{title}</T>
      <T s={13.5} c={k.ink45} style={{ marginTop: 2 }}>{sub}</T>
      <HScroll snap={snap} style={{ marginTop: 12 }}>{children}</HScroll>
    </View>
  );
}

