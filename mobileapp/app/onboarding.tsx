/**
 * Port of webapp/app/onboarding/page.tsx at phone size (webapp/app/mobile-compact.css): four steps (Name, Look,
 * About you, Meet) beside a badge printer that prints the live Badge, then SetupSequence and MintFinish.
 * Saves to the same endpoints as the web: POST /api/agents (home agent) and sealed POST /api/memories.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import Badge, { Carpet } from "@/components/Badge";
import AgentFace from "@/components/AgentFace";
import FaceCreator, { PopCheck } from "@/components/FaceCreator";
import SetupSequence from "@/components/SetupSequence";
import MintFinish from "@/components/MintFinish";
import OreGift from "@/web/OreGift";
import { agentIdNo, type IdInfo } from "@/components/AgentIdCard";
import Icon from "@/components/Icon";
import { tap } from "@/components/ui";
import { lookVariant, type FaceLook } from "@/components/avatar";
import { KNOW_SUGGESTIONS, LOOKS, NAMES, ROLES, TONES, cleanName, finishOnboarding, type ToneId } from "@/lib/onboard";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { Btn, Chip, F, GRAPE, Rise, WSheet, useC } from "@/web/kit";
import { COUNTRIES } from "@/content/countries";

type Look = number | null | FaceLook;

/** The web's `zoom` on .onb-badge: scales the rig and keeps the layout in step. */
function Zoom({ z, children }: { z: number; children: ReactNode }) {
  const [h, setH] = useState(0);
  const [w, setW] = useState(0);
  return (
    <View style={{ height: h ? h * z : undefined, width: w ? w * z : undefined, alignSelf: "center" }}>
      <View onLayout={(e) => { setH(e.nativeEvent.layout.height); setW(e.nativeEvent.layout.width); }} style={{ position: h ? "absolute" : "relative", left: 0, top: 0, transformOrigin: "0% 0%", transform: [{ scale: z }] }}>{children}</View>
    </View>
  );
}

/** gsap.fromTo(printer, { clipPath: inset(0 0 100% 0), y: -120 }, { clipPath: inset(0 0 -20% 0), y: 0, 1.3s power2.out }). */
function Printer({ run, children }: { run: number; children: ReactNode }) {
  const p = useSharedValue(0);
  const [h, setH] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!h) return;
    setDone(false);
    p.value = 0;
    p.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) });
    const t = setTimeout(() => setDone(true), 1350);
    return () => clearTimeout(t);
  }, [run, h, p]);
  const outer = useAnimatedStyle(() => ({ height: h ? Math.max(0.01, h * Math.min(1, p.value * 1.2)) : undefined }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * -120 }] }));
  return (
    <Animated.View style={[{ overflow: done ? "visible" : "hidden" }, done ? { height: h || undefined } : outer]}>
      <Animated.View onLayout={(e) => { if (!h) setH(e.nativeEvent.layout.height); }} style={done ? undefined : inner}>{children}</Animated.View>
    </Animated.View>
  );
}

function StepBits({ step, children }: { step: number; children: ReactNode[] }) {
  return <View key={step}>{children.filter(Boolean).map((c, i) => <Rise key={i} x={40} y={0} ms={600} back={1.4} delay={i * 50}>{c}</Rise>)}</View>;
}

function ThemeToggle() {
  const k = useC();
  const { isDark, setTheme } = usePrefs();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"} onPress={() => { tap(); setTheme(isDark ? "light" : "dark"); }}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: k.line, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Icon name={isDark ? "sun" : "moon"} size={18} color={k.ink} />
    </Pressable>
  );
}

function Backdrop({ width, height, center }: { width: number; height: number; center?: boolean }) {
  const k = useC();
  const glow = k.dark ? 0.5 : 0.2;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Carpet color={k.dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"} />
      <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <LinearGradient id="obfade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={k.bg} stopOpacity="0" /><Stop offset="0.8" stopColor={k.bg} stopOpacity="1" /></LinearGradient>
          <RadialGradient id="obglow" cx={center ? width / 2 : 80} cy={height / 3 + (center ? 0 : 240)} r={300} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={GRAPE} stopOpacity={glow} /><Stop offset="0.5" stopColor={GRAPE} stopOpacity={glow * 0.5} /><Stop offset="1" stopColor={GRAPE} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#obfade)" />
        <Rect width={width} height={height} fill="url(#obglow)" />
      </Svg>
    </View>
  );
}

const STEPS = ["Name", "Look", "About you", "Meet"];

/** Where you're based: a searchable country list (no city or country is assumed). */
function CountrySheet({ open, value, onClose, onPick }: { open: boolean; value: string; onClose: () => void; onPick: (c: string) => void }) {
  const k = useC();
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const list = t ? COUNTRIES.filter((c) => c.toLowerCase().includes(t)) : COUNTRIES;
  return (
    <WSheet open={open} title="Where you're based" sub="Your agent keeps your country in mind for times, money and spelling." onClose={() => { setQ(""); onClose(); }}>
      <View style={{ height: 44, borderRadius: 22, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 }}>
        <Icon name="search" size={16} color={k.ink45} />
        <TextInput value={q} onChangeText={setQ} autoFocus={false} placeholder="Search countries" placeholderTextColor={k.ink45} accessibilityLabel="Search countries" style={{ flex: 1, color: k.ink, fontFamily: F.sans, fontSize: 15, ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : null) }} />
      </View>
      <View style={{ marginTop: 8 }}>
        {list.map((c) => (
          <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: c === value }} onPress={() => { tap(); setQ(""); onPick(c); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? k.tint : "transparent" })}>
            <Text style={{ flex: 1, fontFamily: c === value ? F.bold : F.semi, fontSize: 15, color: k.ink }}>{c}</Text>
            {c === value ? <Icon name="check" size={16} stroke={3} color={k.brandInk} /> : null}
          </Pressable>
        ))}
        {!list.length ? <Text style={{ fontFamily: F.sans, fontSize: 14, color: k.ink60, textAlign: "center", paddingVertical: 20 }}>No country matches.</Text> : null}
      </View>
    </WSheet>
  );
}

export default function Onboarding() {
  const k = useC();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ name?: string }>();
  const { token, wallet } = useSession();
  const { securityAsked, startTour } = usePrefs();
  const { me, reload } = useData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => cleanName(params.name || ""));
  const [look, setLook] = useState<Look>(null);
  const [base, setBase] = useState<number | null | undefined>(undefined);
  const [you, setYou] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [picker, setPicker] = useState(false);
  const [tone, setTone] = useState<ToneId>("short");
  const [knows, setKnows] = useState<string[]>([KNOW_SUGGESTIONS[0]]);
  const [custom, setCustom] = useState("");
  const [finale, setFinale] = useState<"none" | "setup" | "gift" | "done">("none");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [born] = useState(() => Date.now());
  const scroll = useRef<ScrollView>(null);
  const prog = useSharedValue(0.25);

  useEffect(() => {
    if (me?.user?.method === "google" && me.profile?.name && !you) setYou(me.profile.name.split(" ")[0].slice(0, 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.profile?.name]);
  useEffect(() => { prog.value = withTiming((step + 1) / 4, { duration: 700, easing: Easing.bezier(0.4, 0, 0.2, 1) }); scroll.current?.scrollTo({ y: 0, animated: true }); }, [step, prog]);
  const bar = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }));

  const shown = name.trim() || "your agent";
  const agentName = name.trim() || "Juniper";
  const can = step === 0 ? !!name.trim() : true;
  const knownCount = knows.length + (you ? 1 : 0) + (country ? 1 : 0);
  const v = lookVariant(look);
  const bg = look && typeof look === "object" ? look.bg : undefined;
  const toggleKnow = (t: string) => setKnows((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t].slice(0, 8)));
  const addCustom = () => { const t = custom.trim(); if (t && !knows.includes(t)) setKnows((l) => [...l, t].slice(0, 8)); setCustom(""); };
  const after = () => { startTour(); router.replace(securityAsked ? "/(tabs)/agents" : "/security-setup"); };

  const meet = async () => {
    if (saving || !token) return;
    setSaving(true); setErr("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      const r = await finishOnboarding(token, wallet || me?.user.wallet, { name: agentName, look, you: you.trim(), role, tone, country }, knows);
      if (r.total && r.saved < r.total) setNote(r.saved ? `${r.saved} of ${r.total} first memories were filed. Add the rest from its brain.` : "Its first memories need your wallet's memory key. Open its brain to add them.");
      void reload();
      setTimeout(() => setFinale("setup"), 380);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Could not save your agent. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally { setSaving(false); }
  };

  const info: IdInfo = useMemo(() => ({
    id: "home", name: agentName, role: "Personal agent", idNo: agentIdNo("home"), desk: 1, born, maker: me?.profile?.name || you.trim() || "You", kind: "Personal",
    chips: ["Own computer", "Lasting memory", "Can hire help"], memory: true, look, bg,
  }), [agentName, born, me?.profile?.name, you, look, bg]);

  if (!token) return (
    <View style={{ flex: 1, backgroundColor: k.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
      <Carpet color={k.dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"} />
      <Text style={{ fontFamily: F.display, fontSize: 22, letterSpacing: -1, color: k.ink, textAlign: "center" }}>Sign in first.</Text>
      <Text style={{ marginTop: 12, fontFamily: F.sans, fontSize: 15, color: k.ink75, textAlign: "center" }}>Your agent needs to know who it works for.</Text>
      <Btn kind="brand" h={42} fs={14} drop={4} label="Sign in →" style={{ marginTop: 20, alignSelf: "center" }} onPress={() => router.replace("/(auth)/sign-in")} />
    </View>
  );

  if (finale !== "none") return (
    <View style={{ flex: 1, backgroundColor: k.bg }}>
      <Backdrop width={width} height={height} center />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }}>
        {finale === "setup"
          ? <SetupSequence name={agentName} v={v} bg={bg} onDone={() => setFinale(me?.agents.some((a) => a.slug === "ore") ? "done" : "gift")} />
          : finale === "gift"
          ? <OreGift agentName={agentName} onDone={() => setFinale("done")} />
          : <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}>
              <MintFinish info={info} title={`Meet ${agentName}.`}
                sub={`Its badge is printed, its computer is on and it already knows ${knownCount} ${knownCount === 1 ? "thing" : "things"} about you. Mint its ID card on chain, or do it later from its profile.`}
                later={after} laterLabel="Later, start chatting" />
              {note ? <Text style={{ marginTop: 4, fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: k.ink60, textAlign: "center" }}>{note}</Text> : null}
            </View>}
      </ScrollView>
    </View>
  );

  const zoom = height <= 800 ? 0.56 : 0.7;
  const label = (t: string) => <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.44, textTransform: "uppercase", color: k.brandInk }}>{t}</Text>;
  const h1 = (t: string, big = false) => <Text accessibilityRole="header" style={{ marginTop: 12, fontFamily: F.display, fontSize: big ? 24 : 21, lineHeight: (big ? 24 : 21) * 0.95, letterSpacing: -(big ? 24 : 21) * 0.045, color: k.ink }}>{t}</Text>;
  const lead = (t: string) => <Text style={{ marginTop: 16, maxWidth: 512, fontFamily: F.sans, fontSize: 15.5, lineHeight: 25, color: k.ink75 }}>{t}</Text>;
  const small = (t: string) => <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: k.dark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.7)" }}>{t}</Text>;
  const field = { borderRadius: 14, borderWidth: 2, borderColor: k.line, backgroundColor: k.card, color: k.ink, paddingVertical: 10.4, paddingHorizontal: 14.4, fontSize: 16, fontFamily: F.semi, ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : null) };
  const tile = Math.floor((Math.min(560, width - 32) - 8 * 3) / 4);
  const barH = 42 + 4 + 16 + Math.max(16, insets.bottom) + (step === 3 ? 22 : 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: k.bg }}>
      <Backdrop width={width} height={height} />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: barH + 28 }}>
        <View style={{ height: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View accessibilityRole="header" accessibilityLabel="Lexari" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: k.ink, alignItems: "center", justifyContent: "center" }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.bg }} /></View>
            <Text style={{ fontFamily: F.display, fontSize: 20, letterSpacing: -0.9, color: k.ink }}>lexari</Text>
          </View>
          <ThemeToggle />
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 4, ${STEPS[step]}`} style={{ marginHorizontal: 16, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: k.tint }}>
          <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: GRAPE }, bar]} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 36, gap: 20 }}>
          {/* the badge printer */}
          <Zoom z={zoom}>
            <View style={{ alignItems: "center", width: (Math.min(width, 560) - 32) / zoom }}>
              <View style={{ zIndex: 10, width: 270, height: 20, borderRadius: 10, backgroundColor: k.dark ? "#1c1730" : "#0d0a17", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
                <View style={{ width: "80%", height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.6)" }} />
                <Text style={{ position: "absolute", top: -20, fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.34, textTransform: "uppercase", color: k.ink45 }}>badge printer · desk 01</Text>
              </View>
              <View style={{ marginTop: -10 }}>
                <Printer run={step === 0 || step === 3 ? step : -1}>
                  <Badge name={name} setName={(t) => setName(cleanName(t))} look={look} type="app" />
                </Printer>
              </View>
              <Text style={{ marginTop: 20, fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: k.dark ? "rgba(255,255,255,0.65)" : "rgba(10,10,10,0.65)", textAlign: "center" }}>Type on the badge · tap it to flip · drag to swing</Text>
            </View>
          </Zoom>

          {/* the step panel */}
          {step === 0 ? (
            <StepBits step={0}>{[
              label("Step 1 of 4 · name"),
              h1("What should we call your agent?"),
              lead("Type a name on its badge, or here. It sits at desk one on your team and keeps this name."),
              <TextInput key="in" value={name} onChangeText={(t) => setName(cleanName(t))} placeholder="Name your agent" placeholderTextColor={k.ink45} accessibilityLabel="Agent name" autoCorrect={false} autoCapitalize="words" maxLength={12}
                style={[field, { marginTop: 16, height: 64, borderRadius: 16, fontSize: 22, fontFamily: name ? F.display : F.sans, letterSpacing: name ? -0.99 : 0, maxWidth: 448, paddingVertical: 0 }]} />,
              <View key="chips" style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{NAMES.map((n) => <Chip key={n} label={n} on={name === n} onPress={() => setName(n)} />)}</View>,
            ]}</StepBits>
          ) : step === 1 ? (
            <StepBits step={1}>{[
              label("Step 2 of 4 · look"),
              h1(`Pick a face for ${shown}.`),
              lead("Every face is generated. The badge updates as you pick."),
              <View key="grid" style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8, maxWidth: 560 }}>
                {LOOKS.map((l) => {
                  const on = base === l;
                  return (
                    <Pressable key={String(l)} onPress={() => { tap(); setBase(l); setLook(l); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={l === null ? "House face" : `Face ${l}`}
                      style={{ width: tile, height: tile + (on ? 6 : 0), transform: [{ scale: on ? 1.05 : 1 }] }}>
                      {on ? <View style={{ position: "absolute", left: 0, right: 0, top: 6, height: tile, borderRadius: 22, backgroundColor: "#3514b0" }} /> : null}
                      <View style={{ width: tile, height: tile, borderRadius: 22, backgroundColor: on ? GRAPE : k.tint, alignItems: "center", justifyContent: "center" }}>
                        <AgentFace variant={lookVariant(l)} size={Math.min(50, tile * 0.62)} />
                      </View>
                      {on ? <PopCheck size={24} bg={k.ink} fg={k.bg} /> : null}
                    </Pressable>
                  );
                })}
              </View>,
              <View key="fc" style={{ marginTop: 24, maxWidth: 560 }}>
                {small("Make it yours · states, brows, extras, memory dots and a card background")}
                <View style={{ marginTop: 12 }}><FaceCreator value={lookVariant(look)} onChange={(x) => setLook(x)} name={shown} /></View>
              </View>,
            ]}</StepBits>
          ) : step === 2 ? (
            <StepBits step={2}>{[
              label("Step 3 of 4 · about you"),
              h1(`What should ${shown} know?`),
              lead("These become its first memories. You can edit or forget any of them later in its brain."),
              <View key="form" style={{ marginTop: 20, gap: 16, maxWidth: 560 }}>
                <View>{small("Your first name")}<TextInput value={you} onChangeText={(t) => setYou(t.slice(0, 20))} placeholder="Ada" placeholderTextColor={k.ink45} accessibilityLabel="Your first name" style={[field, { marginTop: 8 }]} /></View>
                <View>{small("Where you're based")}
                  <Pressable accessibilityRole="button" accessibilityLabel={country ? `Country, ${country}. Change` : "Choose your country"} onPress={() => setPicker(true)} style={[field, { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                    <Text style={{ flex: 1, fontFamily: country ? F.semi : F.sans, fontSize: 16, color: country ? k.ink : k.ink45 }}>{country || "Choose your country"}</Text>
                    {country ? <Pressable accessibilityLabel="Clear country" hitSlop={8} onPress={() => setCountry("")}><Icon name="x" size={16} color={k.ink45} /></Pressable> : <Icon name="globe" size={16} color={k.ink45} />}
                  </Pressable>
                </View>
                <View>{small("What you do")}<View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{ROLES.map((r) => <Chip key={r} label={r} on={role === r} onPress={() => setRole(role === r ? "" : r)} />)}</View></View>
                <View>{small("How it should talk")}<View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{TONES.map((t) => <Chip key={t.id} label={t.label} on={tone === t.id} onPress={() => setTone(t.id)} />)}</View></View>
                <View>
                  {small(`Things to remember · ${knows.length}/8`)}
                  <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {[...KNOW_SUGGESTIONS, ...knows.filter((x) => !KNOW_SUGGESTIONS.includes(x))].map((t) => (
                      <Chip key={t} label={t} on={knows.includes(t)} onPress={() => toggleKnow(t)} icon={knows.includes(t) ? <Icon name="check" size={14} color="#fff" stroke={3} /> : undefined} />
                    ))}
                  </View>
                  <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                    <TextInput value={custom} onChangeText={(t) => setCustom(t.slice(0, 80))} placeholder="Add your own, like: I start at 9" placeholderTextColor={k.ink45} accessibilityLabel="Add a memory" onSubmitEditing={addCustom} returnKeyType="done" style={[field, { flex: 1 }]} />
                    <Btn kind="ghost" h={46} fs={13.5} label="Add" disabled={!custom.trim()} onPress={addCustom} />
                  </View>
                </View>
              </View>,
            ]}</StepBits>
          ) : (
            <StepBits step={3}>{[
              label("Step 4 of 4 · first day"),
              h1(`Meet ${shown}.`, true),
              lead(`Its badge is printed, its computer is on and it already knows ${knownCount} ${knownCount === 1 ? "thing" : "things"} about you. Say hi and start chatting.`),
              <View key="rows" style={{ marginTop: 20, gap: 10, maxWidth: 520 }}>
                {([["desk", "Its own computer", "A terminal, a browser and a folder of files"], ["memory", "A brain that keeps", `${knownCount} memories filed on day one`], ["team", "Seats for specialists", "Hire from the marketplace when the work grows"]] as const).map(([i, hh, t]) => (
                  <View key={hh} style={{ flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 20, backgroundColor: k.card, padding: 14, borderWidth: 1, borderColor: k.line }}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name={i} size={21} color="#fff" /></View>
                    <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bold, fontSize: 16, color: k.ink }}>{hh}</Text><Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 19, color: k.ink60 }}>{t}</Text></View>
                  </View>
                ))}
              </View>,
            ]}</StepBits>
          )}
        </View>
      </ScrollView>

      {/* sticky bottom bar, fading into the page like the web gradient */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Svg pointerEvents="none" width={width} height={barH + 16} style={{ position: "absolute", left: 0, bottom: 0 }}>
          <Defs><LinearGradient id="obbar" x1="0" y1="1" x2="0" y2="0"><Stop offset="0" stopColor={k.bg} stopOpacity="1" /><Stop offset="0.5" stopColor={k.bg} stopOpacity="1" /><Stop offset="1" stopColor={k.bg} stopOpacity="0" /></LinearGradient></Defs>
          <Rect width={width} height={barH + 16} fill="url(#obbar)" />
        </Svg>
        {err ? <Text accessibilityLiveRegion="polite" style={{ marginHorizontal: 16, marginBottom: 4, fontFamily: F.sans, fontSize: 13, color: "#e5484d", textAlign: "center" }}>{err}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: Math.max(16, insets.bottom) }}>
          {step > 0 ? <Btn kind="line" h={42} a11y="Back" icon="back" onPress={() => setStep((s) => s - 1)} style={{ alignSelf: "auto" }} /> : null}
          {step < 3
            ? <Btn kind="brand" h={42} fs={14} drop={4} disabled={!can} onPress={() => { if (can) setStep((s) => Math.min(3, s + 1)); }} style={{ flex: 1, opacity: can ? 1 : 0.4 }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.bold, fontSize: 14, color: "#fff" }}>{step === 0 ? `Continue with ${shown}` : "Continue"}</Text><Icon name="arrow" size={18} color="#fff" />
              </Btn>
            : <Btn kind="brand" h={64} fs={18} drop={4} disabled={saving} onPress={() => void meet()} style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? <Text style={{ fontFamily: F.bold, fontSize: 18, color: "#fff" }}>Saving…</Text> : <><Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.bold, fontSize: 18, color: "#fff" }}>{`Meet ${shown}`}</Text><Icon name="arrow" size={20} color="#fff" /></>}
              </Btn>}
        </View>
      </View>
      <CountrySheet open={picker} value={country} onClose={() => setPicker(false)} onPick={(c) => { setCountry(c); setPicker(false); }} />
    </KeyboardAvoidingView>
  );
}
