/**
 * A specialist's listing: port of webapp/app/(app)/marketplace/[slug]/Detail.tsx at phone width.
 * Banner with the face on its edge, name, maker, chips, the four-stat row, hire / share, the chat-preview carousel,
 * About, What it can do (animated bars) with first jobs, Ratings & reviews, Listing info, Similar agents.
 * Hire uses the same balance confirmation as the phone website.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import Icon from "@/components/Icon";
import { PALETTE } from "@/components/avatar";
import { AppCard, HireBtn, HireCtx, Shelf, StarRow } from "@/components/Market";
import { Face } from "@/components/ui";
import { ROSTER, compact, specialist, specialistReply, storeMeta } from "@/content/roster";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { AgentTile, GRAPE, Grad, Label, T, useC } from "@/web/kit";
import { useData } from "@/web/data";
import { useHire } from "@/web/hire";

const EXTRA_REVIEWS = [
  { who: "Kemi", seed: 311, stars: 5, text: "Set it up in a minute and it just got on with the work.", when: "2 weeks ago" },
  { who: "Jonas", seed: 312, stars: 4, text: "Really good. I wish it asked fewer questions up front, but the results are solid.", when: "1 month ago" },
];
const CAPTIONS = ["Ask in plain words", "Get it done while you work", "Straight back to your chat"];
const SITE = "https://app.lexari.ai";

/** A skill bar that grows in (web: gsap from width 0, 1s power3.out, 0.08s stagger, 0.2s delay). */
function Bar({ v, i }: { v: number; i: number }) {
  const k = useC();
  const w = useSharedValue(0);
  useEffect(() => { w.value = withDelay(200 + i * 80, withTiming(v, { duration: 1000, easing: Easing.out(Easing.cubic) })); }, [v, i, w]);
  const st = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <View style={{ marginTop: 8, height: 8, borderRadius: 4, backgroundColor: k.tint, overflow: "hidden" }}><Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: GRAPE }, st]} /></View>;
}

/** The three typing dots at the foot of a chat preview. */
function Typing() {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1); }, [p]);
  return (
    <View style={{ marginTop: "auto", alignSelf: "flex-start", flexDirection: "row", gap: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 10 }}>
      {[0, 1, 2].map((i) => <Dot key={i} i={i} p={p} />)}
    </View>
  );
}
function Dot({ i, p }: { i: number; p: { value: number } }) {
  const st = useAnimatedStyle(() => { const t = (p.value * 3 - i * 0.5 + 3) % 3; const up = t < 1 ? Math.sin(t * Math.PI) : 0; return { opacity: 0.4 + up * 0.6, transform: [{ translateY: -up * 3 }] }; });
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#c9b8ff" }, st]} />;
}
function Bob({ children }: { children: React.ReactNode }) {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withRepeat(withSequence(withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })), -1); }, [y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

export default function HireDetail() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>();
  const k = useC();
  const { width } = useWindowDimensions();
  const av = width <= 370 ? 0.8 : 0.78;
  const { me, reload } = useData();
  const { token } = useSession();
  const hire = useHire();
  const [more, setMore] = useState(false);
  const [helpful, setHelpful] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const a = specialist(slug);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 2200); return () => clearTimeout(t); }, [note]);

  if (!a) {
    return (
      <View style={{ flex: 1, backgroundColor: k.bg, paddingTop: 40, padding: 24, alignItems: "center" }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="search" size={22} color={k.brandInk} /></View>
        <T f="bold" s={20} style={{ marginTop: 14, textAlign: "center" }}>That agent isn't on the marketplace.</T>
        <T s={15} c={k.ink75} style={{ marginTop: 6, textAlign: "center" }}>It may have been renamed. Head back to find someone else.</T>
        <Pressable onPress={() => router.replace("/marketplace")} style={{ marginTop: 18, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: GRAPE, justifyContent: "center" }}><T f="bold" s={15} c="#fff">Back to marketplace</T></Pressable>
      </View>
    );
  }
  const m = storeMeta(a);
  const hired = !!me?.agents.some((x) => x.slug === a.slug);
  const col = PALETTE[a.face].fill;
  const home = me?.agents.find((x) => x.slug === "home")?.name;
  const similar = ROSTER.filter((x) => x.slug !== a.slug && storeMeta(x).cat === m.cat).concat(ROSTER.filter((x) => x.slug !== a.slug)).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 8);
  const reviews = [...(a.review ?? []).map((r, i) => ({ ...r, when: i ? "1 week ago" : "3 days ago" })), ...EXTRA_REVIEWS];
  const previews = a.examples.map((ex, i) => ({ caption: CAPTIONS[i] ?? "Try it", ex, reply: specialistReply(a, ex, i) }));
  const cardW = 250;
  const tryJob = (ex: string) => { if (!hired) { hire.start(a.slug); return; } router.push({ pathname: "/chat/[slug]", params: { slug: a.slug, prompt: ex } }); };
  const share = async () => {
    const url = `${SITE}/marketplace/${a.slug}`;
    try { await Clipboard.setStringAsync(url); setNote("Link copied"); } catch { await Share.share({ message: url }).catch(() => {}); }
  };
  const release = async () => {
    if (!token || busy) return;
    setBusy(true);
    try { await api(`/api/agents/${encodeURIComponent(a.slug)}`, { method: "DELETE" }, token); await reload(); setNote(`${a.name} left your team.`); }
    catch (e) { setNote((e as Error).message || "Could not release them."); }
    setBusy(false);
  };
  const stats: { top: React.ReactNode; sub: string }[] = [
    { top: <><T f="bold" s={16}>{String(a.rating)}</T><Icon name="star" size={14} color={k.brandInk} /></>, sub: `${a.reviews} reviews` },
    a.free ? { top: <T f="bold" s={16}>Free</T>, sub: "No seat" } : { top: <T f="bold" s={16}>{compact(m.hires)}</T>, sub: "Hires" },
    { top: <View style={{ borderRadius: 6, borderWidth: 2, borderColor: k.dark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.7)", paddingHorizontal: 6 }}><T f="bold" s={14} style={{ lineHeight: 17.5 }}>{m.age}</T></View>, sub: "Age rating" },
    { top: <Icon name="spark" size={18} color={k.ink} />, sub: a.speed.replace("Usually done in ", "~") },
  ];
  const chip = (label: string, brand = false) => <View key={label} style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 10, paddingVertical: 4 }}><T f="semi" s={13} c={brand ? k.brandInk : k.ink} style={{ lineHeight: 19.5 }}>{label}</T></View>;

  return (
    <HireCtx.Provider value={hire.start}>
      <View key={slug} style={{ flex: 1, backgroundColor: k.bg }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}>
          <Pressable onPress={() => router.navigate("/marketplace")} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 4 }}>
            <Icon name="back" size={16} color={k.ink75} /><T f="bold" s={14} c={k.ink75}>Marketplace</T>
          </Pressable>

          {/* banner, like a collection page: the face sits on its bottom edge */}
          <View style={{ marginTop: 20, height: 128, borderRadius: 18, overflow: "hidden" }}>
            <Grad angle={135} stops={[[`${PALETTE[a.face].shade}`, 0], ["#120d26", 1]]} radial={[{ cx: "88%", cy: "0%", r: "110%", color: col, opacity: 1 }]} />
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.4, flexDirection: "row", flexWrap: "wrap" }}>
              {Array.from({ length: Math.ceil(width / 16) * 9 }).map((_, i) => <View key={i} style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}><View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.28)" }} /></View>)}
            </View>
            <View style={{ position: "absolute", right: 12, bottom: -48, opacity: 0.3, transform: [{ rotate: "-8deg" }] }}><Face slug={a.slug} size={190} /></View>
            <View style={{ position: "absolute", left: -40, top: -64, width: 192, height: 192, borderRadius: 96, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }} />
            <View style={{ position: "absolute", right: 12, top: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 10, paddingVertical: 4 }}><Label s={11} c="rgba(255,255,255,0.85)" style={{ lineHeight: 16.5, letterSpacing: 0.44 }}>{m.cat}</Label></View>
          </View>
          {/* the phone site scales agent tiles by --av-scale (.78 up to 370px wide .8): 104 -> 81, face 86 -> 67 */}
          <View style={{ marginTop: -44, marginLeft: 12, alignSelf: "flex-start", borderRadius: 22, backgroundColor: k.bg, padding: 4, zIndex: 2 }}><AgentTile slug={a.slug} size={Math.round(104 * av)} radius={Math.round(28 * av)} face={Math.round(86 * av)} dot={false} /></View>

          <View style={{ marginTop: 12 }}>
            <T f="display" s={26} style={{ lineHeight: 24.7, letterSpacing: -1.17 }}>{a.name}</T>
            <T f="semi" s={15} c={k.brandInk} style={{ marginTop: 8, lineHeight: 22.5 }}>{m.maker}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {chip(m.cat)}{chip(a.job)}
              {a.free || m.free ? chip(a.free ? "Free · no seat" : "Free to try", true) : null}
              {m.isNew ? <View style={{ borderRadius: 999, backgroundColor: k.ink, paddingHorizontal: 10, paddingVertical: 4 }}><T f="semi" s={13} c={k.bg} style={{ lineHeight: 19.5 }}>New</T></View> : null}
            </View>
            <View style={{ flexDirection: "row", marginTop: 16 }}>
              {stats.map((x, i) => (
                <View key={i} style={{ flex: 1, paddingHorizontal: 12, paddingLeft: i ? 12 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: k.line, alignItems: "center" }}>
                  <View style={{ height: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>{x.top}</View>
                  <T s={12} c={k.ink45} lines={1} style={{ marginTop: 2, lineHeight: 18 }}>{x.sub}</T>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 18 }}>
              {hired ? (
                <>
                  <Pressable onPress={() => router.push(`/chat/${a.slug}`)} style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: GRAPE, flexDirection: "row", alignItems: "center", gap: 8 }}><T f="bold" s={15} c="#fff">{`Chat with ${a.name}`}</T><Icon name="arrow" size={17} color="#fff" /></Pressable>
                  <Pressable onPress={() => void release()} disabled={busy} style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1, borderColor: k.line, justifyContent: "center", opacity: busy ? 0.5 : 1 }}><T f="bold" s={14.5}>{a.free ? "Release" : "Release seat"}</T></Pressable>
                </>
              ) : <HireBtn a={a} lg />}
              <Pressable accessibilityLabel="Share" onPress={() => void share()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="copy" size={18} color={k.ink} /></Pressable>
              <T s={13} c={k.ink45}>{`Joins your team next to ${home || "your agent"}`}</T>
            </View>
            {note ? <T f="semi" s={13} c={k.brandInk} style={{ marginTop: 10 }}>{note}</T> : null}
          </View>

          {/* previews */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + 16} decelerationRate="fast" style={{ marginHorizontal: -16, marginTop: 25 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 8 }}>
            {previews.map((p, i) => (
              <View key={p.ex} style={{ width: cardW, borderRadius: 28, overflow: "hidden", padding: 16 }}>
                {i % 2 ? <Grad angle={160} stops={[["#0a0a0a", 0], ["#2a0f9a", 1]]} /> : <Grad angle={160} stops={[["#5b2bff", 0], [PALETTE[a.face].shade, 1]]} radial={[{ cx: "100%", cy: "100%", r: "90%", color: "#1d0f5c", opacity: 0.55 }]} />}
                <T f="display" s={19} c="#fff" style={{ lineHeight: 18.05, letterSpacing: -0.855 }}>{p.caption}</T>
                <View style={{ marginTop: 16, flex: 1, minHeight: 250, gap: 10, borderRadius: 20, backgroundColor: "#0d0a17", padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", paddingBottom: 8 }}>
                    <AgentTile slug={a.slug} size={24} radius={8} dot={false} /><T f="bold" s={12} c="#fff">{a.name}</T><T s={10} c="rgba(255,255,255,0.5)" style={{ marginLeft: "auto" }}>online</T>
                  </View>
                  <View style={{ alignSelf: "flex-end", maxWidth: "85%", borderRadius: 16, borderBottomRightRadius: 6, backgroundColor: GRAPE, paddingHorizontal: 12, paddingVertical: 8 }}><T s={12} c="#fff" style={{ lineHeight: 16.5 }}>{p.ex}</T></View>
                  <View style={{ alignSelf: "flex-start", maxWidth: "88%", borderRadius: 16, borderBottomLeftRadius: 6, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 8 }}><T s={12} c="rgba(255,255,255,0.9)" style={{ lineHeight: 16.5 }}>{p.reply}</T></View>
                  <Typing />
                </View>
              </View>
            ))}
            <View style={{ width: cardW, borderRadius: 28, backgroundColor: k.tint, padding: 16, alignItems: "center", justifyContent: "center" }}>
              <Bob><Face slug={a.slug} size={120} animated /></Bob>
              <T f="display" s={19} style={{ marginTop: 16, textAlign: "center", letterSpacing: -0.855, lineHeight: 18.05 }}>{`“${a.quip}”`}</T>
            </View>
          </ScrollView>

          <View style={{ marginTop: 40 }}>
            <T f="bold" s={18} style={{ lineHeight: 27 }}>About this agent</T>
            <T s={15} c={k.ink75} style={{ marginTop: 12, lineHeight: 24.4 }}>{`${a.back} It works on its own computer, keeps notes in your team's brain and reports back in chat.`}</T>
            {more ? <T s={15} c={k.ink75} style={{ marginTop: 12, lineHeight: 24.4 }}>{`${a.name} is built by ${m.maker}. Hire it and it joins your team next to your personal agent. Mention it in a group chat or open a direct chat to give it work. You can release the seat at any time.`}</T> : null}
            <Pressable onPress={() => setMore((x) => !x)} style={{ marginTop: 8, alignSelf: "flex-start" }}><T f="bold" s={14} c={k.brandInk}>{more ? "Show less" : "Read more"}</T></Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 }}>{a.tools.map((t) => <View key={t} style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 12, paddingVertical: 6 }}><T f="semi" s={12.5}>{t}</T></View>)}</View>
          </View>

          <View style={{ marginTop: 40 }}>
            <T f="bold" s={18} style={{ lineHeight: 27 }}>What it can do</T>
            <View style={{ marginTop: 16, gap: 12 }}>
              {a.skills.map(([name, v], i) => (
                <View key={name} style={{ borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T f="semi" s={14}>{name}</T><T f="semi" s={14} c={k.brandInk} style={{ fontVariant: ["tabular-nums"] }}>{String(v)}</T></View>
                  <Bar v={v} i={i} />
                </View>
              ))}
            </View>
            <Label s={11} c={k.ink45} style={{ marginTop: 24, lineHeight: 16.5, letterSpacing: 0.44 }}>Try a first job</Label>
            <View style={{ marginTop: 8, gap: 8 }}>
              {a.examples.map((ex) => (
                <Pressable key={ex} onPress={() => tryJob(ex)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: pressed ? GRAPE : k.line, padding: 14 })}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="chat" size={16} color={k.brandInk} /></View>
                  <T f="semi" s={14.5} style={{ flex: 1, lineHeight: 19.9 }}>{ex}</T>
                  <Icon name="arrow" size={16} color={k.ink45} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 40 }}>
            <T f="bold" s={18} style={{ lineHeight: 27 }}>Ratings & reviews</T>
            <View style={{ marginTop: 16, gap: 24 }}>
              <View style={{ alignItems: "center" }}>
                <T f="display" s={28} style={{ lineHeight: 26.6, letterSpacing: -1.26 }}>{String(a.rating)}</T>
                <StarRow v={a.rating} size={15} />
                <T s={13} c={k.ink45} style={{ marginTop: 4 }}>{`${a.reviews} reviews`}</T>
              </View>
              <View accessibilityLabel="Rating breakdown" style={{ gap: 6 }}>
                {m.dist.map((p, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <T s={12.5} c={k.ink60} style={{ width: 12, textAlign: "right" }}>{String(5 - i)}</T>
                    <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: k.tint, overflow: "hidden" }}><View style={{ width: `${p}%`, height: 10, borderRadius: 5, backgroundColor: GRAPE }} /></View>
                    <T s={12.5} c={k.ink60} style={{ width: 36, textAlign: "right", fontVariant: ["tabular-nums"] }}>{`${p}%`}</T>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ marginTop: 24, gap: 12 }}>
              {reviews.map((r) => { const on = helpful.includes(r.who); return (
                <View key={r.who} style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Face seed={r.seed} size={30} /></View>
                    <View><T f="bold" s={14} style={{ lineHeight: 21 }}>{r.who}</T><T s={12} c={k.ink45}>{r.when}</T></View>
                    <View style={{ marginLeft: "auto" }}><StarRow v={r.stars} /></View>
                  </View>
                  <T s={14} c={k.ink75} style={{ marginTop: 12, lineHeight: 19.25 }}>{r.text}</T>
                  <Pressable accessibilityState={{ selected: on }} onPress={() => setHelpful((h) => (on ? h.filter((x) => x !== r.who) : [...h, r.who]))} style={{ marginTop: 12, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: on ? GRAPE : k.tint }}>
                    <T f="semi" s={12.5} c={on ? "#fff" : k.ink75}>{`Helpful${on ? " ✓" : ""}`}</T>
                  </Pressable>
                </View>
              ); })}
            </View>
          </View>

          <View style={{ marginTop: 40, borderRadius: 26, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 20 }}>
            <T f="bold" s={15.5} style={{ lineHeight: 23.25 }}>Listing info</T>
            <View style={{ marginTop: 8 }}>
              {[["Maker", m.maker], ["Category", m.cat], ["Updated", m.updated], ["Version", m.version], ["Languages", m.languages], ["Age rating", m.age], ["Tools", a.tools.join(", ")], ["Seats", "1 seat"]].map(([key, v], i) => (
                <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
                  <T s={14} c={k.ink45}>{key}</T><T f="semi" s={14} style={{ flexShrink: 1, textAlign: "right" }}>{v}</T>
                </View>
              ))}
            </View>
          </View>

          <Shelf title="Similar agents" sub={`More in ${m.cat} and beyond`}>{similar.map((x) => <AppCard key={x.slug} a={x} width={Math.max(176, Math.round(width * 0.44))} />)}</Shelf>
        </ScrollView>
        {hire.node}
      </View>
    </HireCtx.Provider>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
