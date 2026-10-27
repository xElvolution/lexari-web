/**
 * Port of webapp/components/Tour.tsx: coach marks narrated by your own agent. Dims the app, spotlights one real control
 * (registered with <TourTarget id>) and waits for you to tap it. Six short stops, phone steps only.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, usePathname } from "expo-router";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Icon from "./Icon";
import { api } from "@/lib/api";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { nameOf, primaryOf, useData } from "@/web/data";
import { AgentTile, F, GRAPE, useC } from "@/web/kit";

type Ctx = { me: string; you: string; spec: string; specName: string; primary: string; primaryName: string };
type Step = { id: string; action: "next" | "click"; target?: (c: Ctx) => string; leaveChat?: boolean; home?: boolean; title?: (c: Ctx) => string; text: (c: Ctx) => string; cta?: string };

const STEPS: Step[] = [
  { id: "hi", action: "next", home: true, title: (c) => `Hi${c.you ? ` ${c.you}` : ""}, I'm ${c.me}.`, text: () => "Six short stops. You'll tap the real buttons.", cta: "Let's go" },
  { id: "primary", action: "next", home: true, target: (c) => `tile-${c.primary}`, text: (c) => `The gold ring marks ${c.primaryName}, your main personal agent.` },
  { id: "tile", action: "click", home: true, target: (c) => `tile-${c.spec}`, text: (c) => `This row is your team. Tap ${c.specName} to open their chat.` },
  { id: "composer", action: "next", target: () => "composer", text: () => "This is where you talk. Type a message, or use the mic, the clip, or the phone." },
  { id: "brain", action: "click", leaveChat: true, target: () => "nav-brain", text: (c) => `Tap Brain. That's what I remember about you, and you can edit or delete any of it.` },
  { id: "done", action: "next", title: (c) => `That's the tour${c.you ? `, ${c.you}` : ""}.`, text: () => "Bond, Market, Team and Wallets are in the menu. Have fun.", cta: "Finish" },
];
const PRAISE = ["Nice, you're getting the hang of it!", "Perfect.", "That's it.", "Great, keep going.", "Exactly like that."];

/* ---------- targets ---------- */
const targets = new Map<string, View>();
const tapListeners = new Set<(id: string) => void>();
let lastTap = 0;

/** Marks a real control the tour can spotlight. Taps on it are reported to the tour (they still reach the control). */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: object }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) targets.set(id, node);
    return () => { if (targets.get(id) === node) targets.delete(id); };
  }, [id]);
  const hit = () => { const now = Date.now(); if (now - lastTap < 300) return; lastTap = now; tapListeners.forEach((f) => f(id)); };
  const web = Platform.OS === "web" ? ({ onClickCapture: hit } as object) : null;
  return <View ref={ref} collapsable={false} onTouchEnd={hit} {...web} style={style}>{children}</View>;
}

type R = { x: number; y: number; w: number; h: number };

function Pulse({ hole }: { hole: R }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1); }, [p]);
  const st = useAnimatedStyle(() => ({ opacity: 0.55 + p.value * 0.45, transform: [{ scale: 1 + p.value * 0.03 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 18, borderWidth: 3, borderColor: GRAPE }, st]} />;
}
function TapHand({ color }: { color: string }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withSequence(withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 450 })), -1); }, [p]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * 2 }, { scale: 1 - p.value * 0.1 }] }));
  return <Animated.View style={st}><Icon name="hand" size={15} color={color} /></Animated.View>;
}

export default function Tour() {
  const { tourOn, tourDone, startTour } = usePrefs();
  const { token } = useSession();
  const { me } = useData();
  // same rule as the web store: the tour is on for anyone with a home agent who has not finished it (prefs.tourDone, any device)
  const serverDone = me ? !!me.prefs?.tourDone : true;
  const hasHome = !!me?.agents.some((a) => a.slug === "home");
  useEffect(() => { if (token && hasHome && !serverDone && !tourDone && !tourOn) startTour(); }, [token, hasHome, serverDone, tourDone, tourOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const path = usePathname();
  // only inside the app itself, never over sign-in, onboarding, security setup or the lock
  const inApp = /^\/(agents|brain|marketplace|team|wallets|settings|profile|hub|chat)(\/|$)/.test(path);
  if (!tourOn || !token || !inApp || !me?.agents.some((a) => a.slug === "home")) return null;
  return <TourInner />;
}

function TourInner() {
  const k = useC();
  const { tourStep, setTourStep, endTour: endLocal } = usePrefs();
  const { token } = useSession();
  const endTour = () => { endLocal(); if (token) void api("/api/me", { method: "PATCH", body: JSON.stringify({ prefs: { tourDone: true } }) }, token).catch(() => {}); };
  const { me } = useData();
  const path = usePathname();
  const vp = useWindowDimensions();
  const [i, setI] = useState(() => Math.min(tourStep, STEPS.length - 1));
  const step = STEPS[i];
  const [prevClick, setPrevClick] = useState(false);
  const spec = useMemo(() => me?.agents.find((a) => a.slug !== "home")?.slug ?? "home", []); // eslint-disable-line react-hooks/exhaustive-deps
  const home = me?.agents.find((a) => a.slug === "home");
  const you = String((home?.meta as { you?: string } | undefined)?.you || (me?.profile?.name && me.profile.name !== "You" ? me.profile.name.split(" ")[0] : ""));
  const primary = primaryOf(me);
  const ctx: Ctx = { me: nameOf(me, "home"), you, spec, specName: nameOf(me, spec), primary, primaryName: nameOf(me, primary) };
  const tKey = step.target?.(ctx);
  const cKey = step.action === "click" ? tKey : undefined;
  const [rect, setRect] = useState<R | null>(null);
  const [missing, setMissing] = useState(false);
  const [ch, setCh] = useState(200);
  const moved = useRef(false);

  const go = (n: number, clicked = false) => {
    moved.current = true;
    if (n >= STEPS.length) { endTour(); return; }
    setPrevClick(clicked); setI(Math.max(0, n)); setTourStep(Math.max(0, n)); setRect(null); setMissing(false);
  };

  // steps that live on the Agents page bring you back there; Brain needs the bottom bar, so leave the chat first
  useEffect(() => {
    if (step.home && !/\/agents$/.test(path) && path !== "/") router.navigate("/(tabs)/agents");
    else if (step.leaveChat && path.startsWith("/chat/")) router.navigate("/(tabs)/agents");
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // follow the target; give up after a moment and show a centred card instead
  useEffect(() => {
    moved.current = false;
    if (!tKey) return;
    let seen = false, off = false; const t0 = Date.now();
    const tick = () => {
      const node = targets.get(tKey);
      if (node) node.measureInWindow((x, y, w, h) => {
        if (off) return;
        if (w < 2 || h < 2) return;
        seen = true; setMissing(false);
        setRect((p) => (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 && Math.abs(p.w - w) < 0.5 && Math.abs(p.h - h) < 0.5 ? p : { x, y, w, h }));
      });
      else { setRect(null); if (!seen && Date.now() - t0 > 2600) setMissing(true); }
    };
    tick();
    const t = setInterval(tick, 200);
    return () => { off = true; clearInterval(t); };
  }, [i, tKey]);

  // a real tap on the spotlit control moves the tour on
  useEffect(() => {
    if (!cKey) return;
    const f = (id: string) => { if (id === cKey && !moved.current) { moved.current = true; setTimeout(() => go(i + 1, true), 380); } };
    tapListeners.add(f);
    return () => { tapListeners.delete(f); };
  }, [i, cKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const centred = !tKey || missing || !rect;
  const pad = 8;
  const hole = rect && !centred ? { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 } : null;
  const W = Math.min(372, vp.width - 24);
  let pos: { left: number; top: number; arrow?: { x: number; side: "top" | "bottom" } };
  if (!hole) pos = { left: (vp.width - W) / 2, top: Math.max(12, (vp.height - ch) / 2) };
  else {
    const cx = hole.x + hole.w / 2; const left = Math.max(12, Math.min(vp.width - W - 12, cx - W / 2));
    const ax = Math.max(22, Math.min(W - 22, cx - left));
    if (hole.y + hole.h + 14 + ch < vp.height - 8) pos = { left, top: hole.y + hole.h + 14, arrow: { x: ax, side: "top" } };
    else if (hole.y - 14 - ch > 8) pos = { left, top: hole.y - 14 - ch, arrow: { x: ax, side: "bottom" } };
    else pos = { left: (vp.width - W) / 2, top: hole.y + hole.h / 2 > vp.height / 2 ? 12 : vp.height - ch - 12 };
  }
  const praise = prevClick && i > 0 ? PRAISE[i % PRAISE.length] : null;
  const needsTap = step.action === "click" && !centred;
  const dim = "rgba(8,4,24,0.64)";
  const block = (st: object) => <Pressable accessible={false} style={[{ position: "absolute", backgroundColor: dim }, st]} />;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 95, elevation: 95 }}>
      {hole ? (
        <>
          {block({ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) })}
          {block({ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 })}
          {block({ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h })}
          {block({ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h })}
          {!needsTap ? <Pressable accessible={false} style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h }} /> : null}
          {needsTap ? <Pulse hole={hole} /> : <View pointerEvents="none" style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 18, borderWidth: 3, borderColor: GRAPE }} />}
        </>
      ) : block({ left: 0, top: 0, right: 0, bottom: 0 })}

      <View accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityLabel={`Tour, step ${i + 1} of ${STEPS.length}`} onLayout={(e) => setCh(e.nativeEvent.layout.height)} style={{ position: "absolute", left: pos.left, top: pos.top, width: W }}>
        {pos.arrow ? <View style={{ position: "absolute", left: pos.arrow.x - 8, [pos.arrow.side === "top" ? "top" : "bottom"]: -7, width: 16, height: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, transform: [{ rotate: "45deg" }] }} /> : null}
        <Animated.View key={step.id} entering={FadeIn.duration(260)} style={{ borderRadius: 18, backgroundColor: k.card, padding: 12.8, borderWidth: 1, borderColor: k.line, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 24 }, elevation: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View>
              <AgentTile slug="home" look={home?.look} size={46} radius={15} dot={false} />
              <View style={{ position: "absolute", right: -4, bottom: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: "#34d399", borderWidth: 2, borderColor: k.card }} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: k.brandInk }}>{ctx.me}</Text>
                <Pressable onPress={endTour} hitSlop={8}><Text style={{ fontFamily: F.semi, fontSize: 12.5, color: k.ink45 }}>Skip tour</Text></Pressable>
              </View>
              <View style={{ marginTop: 4, borderRadius: 16, borderTopLeftRadius: 6, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 10 }}>
                {praise ? <Text style={{ marginBottom: 4, fontFamily: F.bold, fontSize: 13.5, color: k.brandInk }}>{praise}</Text> : null}
                {step.title ? <Text style={{ fontFamily: F.bold, fontSize: 15.5, lineHeight: 19, color: k.ink }}>{step.title(ctx)}</Text> : null}
                <Text style={{ marginTop: step.title ? 4 : 0, fontFamily: F.sans, fontSize: 14, lineHeight: 19, color: k.dark ? "rgba(255,255,255,0.85)" : "rgba(10,10,10,0.85)" }}>{step.text(ctx)}</Text>
              </View>
            </View>
          </View>
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View accessibilityRole="image" accessibilityLabel={`Step ${i + 1} of ${STEPS.length}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
              {STEPS.map((x, n) => <View key={x.id} style={{ height: 5, width: n === i ? 14 : 5, borderRadius: 3, backgroundColor: n === i ? GRAPE : n < i ? "rgba(91,43,255,0.55)" : k.dark ? "rgba(255,255,255,0.15)" : "rgba(10,10,10,0.15)" }} />)}
            </View>
            {i > 0 ? <Pressable onPress={() => go(i - 1)} style={{ height: 36, borderRadius: 18, paddingHorizontal: 12, justifyContent: "center" }}><Text style={{ fontFamily: F.bold, fontSize: 13.5, color: k.ink60 }}>Back</Text></Pressable> : null}
            {needsTap
              ? <View style={{ height: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: k.tint }}><TapHand color={k.brandInk} /><Text style={{ fontFamily: F.bold, fontSize: 13, color: k.brandInk }}>Tap it</Text></View>
              : <Pressable onPress={() => (i === STEPS.length - 1 ? endTour() : go(i + 1))} style={({ pressed }) => ({ height: 36, borderRadius: 18, paddingHorizontal: 16, justifyContent: "center", backgroundColor: pressed ? "#3514b0" : GRAPE })}>
                  <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: "#fff" }}>{step.cta ?? (missing ? "Skip step" : "Next")}</Text>
                </Pressable>}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
