/** Port of webapp/app/(app)/marketplace/page.tsx at phone width: search, category chips, Agent of the week hero, Trending now, Top charts, New & notable, Editors' picks, Browse categories. */
import { Stage } from "@/web/anim";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Icon from "@/components/Icon";
import { PALETTE } from "@/components/avatar";
import { ROSTER, STORE_CATS, compact, storeMeta, type StoreCat } from "@/content/roster";
import { AgentTile, F, Grad, Label, T, useC } from "@/web/kit";
import { useData } from "@/web/data";
import { useHire } from "@/web/hire";
import { AppCard, HScroll, HireBtn, HireCtx, Shelf, open } from "@/components/Market";

const FEATURED = ["scout", "frame", "atlas"];
const byHires = [...ROSTER].sort((a, b) => storeMeta(b).hires - storeMeta(a).hires);
/**
 * Agent of the week carousel, like the web's snap track. Slides are as wide as the card itself (measured with onLayout,
 * not the window), all slides share the tallest slide's height, and the arrows and dots sit inside the card.
 */
function Hero() {
  const list = FEATURED.map((f) => ROSTER.find((x) => x.slug === f)!).filter(Boolean);
  const [i, setI] = useState(0);
  const [cw, setCw] = useState(0);
  const [hs, setHs] = useState<number[]>([]);
  const ref = useRef<ScrollView>(null);
  const paused = useRef(false);
  const h = Math.max(300, ...hs.filter(Boolean));
  const go = (n: number) => { const k = (n + list.length) % list.length; setI(k); if (cw) ref.current?.scrollTo({ x: k * cw, animated: true }); };
  // web: moves on every 6.5s unless you are touching it
  useEffect(() => { const t = setInterval(() => { if (!paused.current) go(i + 1); }, 6500); return () => clearInterval(t); });
  const onLayout = (e: LayoutChangeEvent) => { const nw = Math.round(e.nativeEvent.layout.width); if (nw && nw !== cw) { setCw(nw); setHs([]); ref.current?.scrollTo({ x: i * nw, animated: false }); } };
  const settle = (x: number) => { if (!cw) return; const k = Math.max(0, Math.min(list.length - 1, Math.round(x / cw))); if (k !== i) setI(k); };
  return (
    <View onLayout={onLayout} style={{ marginTop: 20, borderRadius: 30, overflow: "hidden", backgroundColor: "#0a0a0a", minHeight: 300 }}>
      {cw ? (
        <ScrollView
          ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
          onScrollBeginDrag={() => { paused.current = true; }}
          onScrollEndDrag={() => { paused.current = false; }}
          onScroll={(e) => settle(e.nativeEvent.contentOffset.x)}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        >
          {list.map((a, n) => { const m = storeMeta(a); const col = PALETTE[a.face].fill; return (
            <View key={a.slug} accessibilityLabel={`${n + 1} of ${list.length}`} style={{ width: cw, height: h, overflow: "hidden" }}>
              <Grad angle={120} stops={[["#0a0a0a", 0], ["#1d0f5c", 0.55], ["#5b2bff", 1]]} radial={[{ cx: "85%", cy: "30%", r: "70%", color: col, opacity: 0.55 }]} />
              <View pointerEvents="none" style={{ position: "absolute", right: 16, top: 16, transform: [{ rotate: "-6deg" }] }}><AgentTile slug={a.slug} size={72} dot={false} /></View>
              <View
                onLayout={(e) => { const v = Math.ceil(e.nativeEvent.layout.height); setHs((o) => (o[n] === v ? o : Object.assign([...o], { [n]: v }))); }}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 22, paddingBottom: 60 }}
              >
                <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Label s={9} c="#fff">{n === 0 ? "Agent of the week" : n === 1 ? "Editors' choice" : "Staff favourite"}</Label></View>
                <T f="display" s={34} c="#fff" style={{ marginTop: 14, letterSpacing: -1.6 }}>{a.name}</T>
                <T f="semi" s={16} c="rgba(255,255,255,0.9)" style={{ marginTop: 6 }}>{a.quip}</T>
                <T s={13.5} c="rgba(255,255,255,0.7)" style={{ marginTop: 8, lineHeight: 19 }}>{a.back}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 18 }}>
                  <HireBtn a={a} lg />
                  <Pressable onPress={() => open(a.slug)} style={{ height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center" }}><T f="bold" s={15} c="#fff">View listing</T></Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><T f="bold" s={13} c="#fff">{String(a.rating)}</T><Icon name="star" size={13} color="#fff" /><T s={13} c="rgba(255,255,255,0.8)">{` · ${compact(m.hires)} hires · ${m.cat}`}</T></View>
                </View>
              </View>
            </View>
          ); })}
        </ScrollView>
      ) : null}
      <View style={{ position: "absolute", right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable accessibilityLabel="Previous" onPress={() => go(i - 1)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}><Icon name="left" size={17} color="#fff" /></Pressable>
        <View style={{ flexDirection: "row", gap: 6 }}>{list.map((_, n) => <Pressable key={n} accessibilityLabel={`Slide ${n + 1}`} hitSlop={8} onPress={() => go(n)} style={{ height: 8, width: n === i ? 24 : 8, borderRadius: 4, backgroundColor: n === i ? "#fff" : "rgba(255,255,255,0.45)" }} />)}</View>
        <Pressable accessibilityLabel="Next" onPress={() => go(i + 1)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}><Icon name="right" size={17} color="#fff" /></Pressable>
      </View>
    </View>
  );
}

const CHART_TABS = [{ id: "free", label: "Free" }, { id: "hired", label: "Top hired" }, { id: "rising", label: "Rising" }] as const;

export default function Marketplace() {
  const k = useC();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StoreCat | "All">("All");
  const [tab, setTab] = useState<(typeof CHART_TABS)[number]["id"]>("hired");
  const scroll = useRef<ScrollView>(null);
  const { me } = useData();
  const hire = useHire();
  const mine = new Set((me?.agents ?? []).map((a) => a.slug));
  // web: w-[44vw] min-w-[176px] tiles (two and a peek per screen), wide 300px banners that leave the next one peeking
  const card = Math.max(176, Math.round(width * 0.44));
  const wideW = Math.min(300, width - 32 - 40);
  const filtered = useMemo(() => { const t = q.trim().toLowerCase(); return ROSTER.filter((a) => (cat === "All" || storeMeta(a).cat === cat) && (!t || `${a.name} ${a.job} ${a.cat} ${a.back} ${storeMeta(a).maker}`.toLowerCase().includes(t))); }, [q, cat]);
  const browsing = !!q.trim() || cat !== "All";
  const trending = [...ROSTER].sort((a, b) => b.reviews / b.jobs - a.reviews / a.jobs);
  const fresh = ROSTER.filter((a) => storeMeta(a).isNew).concat(ROSTER.slice(4, 6));
  const chart = (tab === "free" ? ROSTER.filter((a) => storeMeta(a).free).sort((a, b) => b.rating - a.rating || storeMeta(b).hires - storeMeta(a).hires) : tab === "rising" ? [...ROSTER].sort((a, b) => storeMeta(b).rising - storeMeta(a).rising) : byHires).slice(0, 10);
  const picks = [
    { title: "A research desk in two hires", body: "Scout reads everything, Sonar watches the market. Together they turn a week of reading into a page.", who: ["scout", "sonar"], tag: "Editors' pick" },
    { title: "Ship your launch week", body: "Quill writes the post, Frame makes the cards, Pulse schedules it all. You just say go.", who: ["quill", "frame", "pulse"], tag: "Collection" },
  ];
  return (
    <HireCtx.Provider value={hire.start}>
    <View style={{ flex: 1 }}>
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 40 }}><Stage>
      <Label>Marketplace</Label>
      <T f="display" s={23} style={{ marginTop: 10, letterSpacing: -1.1 }}>Find your next hire.</T>
      <View style={{ marginTop: 14, height: 46, borderRadius: 23, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}>
        <Icon name="search" size={18} color={k.ink45} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search agents, makers, skills" placeholderTextColor={k.ink45} style={{ flex: 1, color: k.ink, fontFamily: F.sans, fontSize: 15 }} />
      </View>
      <HScroll gap={8} style={{ marginTop: 14 }}>
        {(["All", ...STORE_CATS.map((c) => c.id)] as const).map((c) => { const on = cat === c; return (
          <Pressable key={c} onPress={() => setCat(c)} style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: on ? k.ink : k.card, borderWidth: on ? 0 : 1, borderColor: k.line }}>
            {c !== "All" ? <Icon name={STORE_CATS.find((x) => x.id === c)!.icon} size={15} color={on ? k.bg : k.ink75} /> : null}
            <T f="bold" s={14} c={on ? k.bg : k.ink75}>{c}</T>
          </Pressable>
        ); })}
      </HScroll>

      {browsing ? (
        <View style={{ marginTop: 28 }}>
          <T f="bold" s={20}>{q ? `Results for “${q}”` : `${cat} agents`}<T f="semi" s={15} c={k.ink45}>{`  ${filtered.length}`}</T></T>
          {filtered.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 18 }}>{filtered.map((a) => <AppCard key={a.slug} a={a} width={(width - 48) / 2} />)}</View>
            : <View style={{ marginTop: 20, alignItems: "center", padding: 24 }}><T f="bold" s={16}>No agents match.</T><T s={13.5} c={k.ink60}>Try a different word or category.</T><Pressable onPress={() => { setQ(""); setCat("All"); }} style={{ marginTop: 12 }}><T f="bold" s={14} c={k.brandInk}>Clear</T></Pressable></View>}
        </View>
      ) : (
        <>
          <Hero />
          <Shelf title="Trending now" sub="What people are hiring this week" snap={card}>{trending.map((a) => <AppCard key={a.slug} a={a} width={card} />)}</Shelf>
          <View style={{ marginTop: 40 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <View><T f="bold" s={20}>Top charts</T><T s={13.5} c={k.ink45}>Updated daily</T></View>
              <View style={{ flexDirection: "row", backgroundColor: k.tint, borderRadius: 999, padding: 4 }}>
                {CHART_TABS.map((t) => <Pressable key={t.id} onPress={() => setTab(t.id)} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: tab === t.id ? k.card : "transparent" }}><T f="bold" s={13.5} c={tab === t.id ? k.ink : k.ink60}>{t.label}</T></Pressable>)}
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              {chart.map((a, n) => { const m = storeMeta(a); return (
                <Pressable key={a.slug} onPress={() => open(a.slug)} style={{ flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: k.line, paddingVertical: 12 }}>
                  <T f="display" s={22} c={k.ink45} style={{ width: 28, textAlign: "center" }}>{String(n + 1)}</T>
                  <AgentTile slug={a.slug} size={52} dot={false} ring={mine.has(a.slug) ? "hired" : null} />
                  <View style={{ flex: 1 }}>
                    <T f="bold" s={15} lines={1}>{a.name}</T>
                    <T s={12.5} c={k.ink45} lines={1}>{`${m.cat} · ${m.maker}`}</T>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><T f="semi" s={12} c={k.ink60}>{String(a.rating)}</T><Icon name="star" size={11} color={k.ink60} /><T s={12} c={k.ink45}>{` · ${compact(m.hires)}`}</T></View>
                  </View>
                  <HireBtn a={a} />
                </Pressable>
              ); })}
            </View>
          </View>
          <Shelf title="New & notable" sub="Fresh on the marketplace" snap={wideW}>{fresh.map((a, n) => <AppCard key={`${a.slug}-${n}`} a={a} wide width={wideW} />)}</Shelf>
          <T f="bold" s={20} style={{ marginTop: 40 }}>{"Editors' picks"}</T>
          <View style={{ gap: 14, marginTop: 14 }}>
            {picks.map((p) => (
              <View key={p.title} style={{ borderRadius: 26, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 18 }}>
                <Label s={9}>{p.tag}</Label>
                <T f="display" s={24} style={{ marginTop: 8, letterSpacing: -1 }}>{p.title}</T>
                <T s={14} c={k.ink60} style={{ marginTop: 8, lineHeight: 20 }}>{p.body}</T>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
                  <View style={{ flexDirection: "row" }}>{p.who.map((w, n) => <Pressable key={w} onPress={() => open(w)} style={{ marginLeft: n ? -10 : 0, borderRadius: 16, borderWidth: 3, borderColor: k.card }}><AgentTile slug={w} size={44} dot={false} /></Pressable>)}</View>
                  <T f="semi" s={13.5} c={k.ink60}>{p.who.map((w) => ROSTER.find((x) => x.slug === w)?.name ?? w).join(", ")}</T>
                </View>
              </View>
            ))}
          </View>
          <T f="bold" s={20} style={{ marginTop: 40 }}>Browse categories</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
            {STORE_CATS.map((c) => { const n = ROSTER.filter((a) => storeMeta(a).cat === c.id).length; return (
              <Pressable key={c.id} onPress={() => { setCat(c.id); scroll.current?.scrollTo({ y: 0, animated: true }); }} style={{ width: (width - 44) / 2, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={c.icon} size={20} color={k.brandInk} /></View>
                <View><T f="bold" s={15}>{c.id}</T><T s={12.5} c={k.ink45}>{`${n} agent${n === 1 ? "" : "s"}`}</T></View>
              </Pressable>
            ); })}
          </View>
        </>
      )}
    </Stage></ScrollView>
    {hire.node}
    </View>
    </HireCtx.Provider>
  );
}


export { default as ErrorBoundary } from "@/components/ScreenError";
