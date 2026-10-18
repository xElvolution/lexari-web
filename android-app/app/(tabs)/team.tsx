/** Port of webapp/app/(app)/team/page.tsx at phone width: floor plan with seats and ring legend, plan card, Plans summary. */
import { Stage } from "@/web/anim";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { ROSTER } from "@/content/roster";
import { AgentTile, GOLD, GRAPE, GRAPE_SOFT, Label, Pill, SILVER, T, useC, type Ring } from "@/web/kit";
import { primaryOf, useData } from "@/web/data";

export function RingLegend() {
  const k = useC();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
      {[[GOLD, "Primary"], [GRAPE_SOFT, "Made by you"], [SILVER, "Hired"]].map(([c, l]) => (
        <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: c }} /><T s={12.5} c={k.ink75}>{l}</T></View>
      ))}
    </View>
  );
}

export default function Team() {
  const k = useC();
  const { me } = useData();
  const [pick, setPick] = useState<string | null>(null);
  const primary = primaryOf(me);
  const home = me?.agents.find((a) => a.slug === "home");
  const plan = me?.plan ?? { id: "free", name: "Free", seats: 1 };
  const order = (kind: string) => (kind === "home" ? 0 : kind === "custom" ? 1 : 2);
  const team = (me?.agents ?? []).slice().sort((a, b) => order(a.kind) - order(b.kind) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const isFree = (slug: string) => !!ROSTER.find((r) => r.slug === slug)?.free;
  const used = team.filter((a) => !isFree(a.slug)).length;
  const lockedSet = new Set<string>(); let n = 0;
  for (const a of team) { if (isFree(a.slug)) continue; n++; if (n > plan.seats) lockedSet.add(a.slug); }
  const unlocked = Math.min(Math.max(plan.seats, used), 100);
  const seats = Math.max(5, Math.ceil(Math.min(unlocked + (plan.seats < 100 ? 1 : 0), 100) / 5) * 5);
  const kindOf = (slug: string, kind: string): Exclude<Ring, null> => (slug === primary ? "primary" : kind === "home" || kind === "custom" ? "made" : "hired");
  const picked = pick ? team.find((a) => a.slug === pick) : undefined;
  const youName = home?.name || "your agent";
  // grid-cols-5 gap-2 like the web: square seats that share the card width (58 is the first paint before layout)
  const [gridW, setGridW] = useState(0);
  const cell = gridW ? Math.floor((gridW - 4 * 8) / 5) : 58;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 32 }}><Stage>
      <Label>Team</Label>
      <T f="display" s={23} style={{ marginTop: 10, letterSpacing: -1.1 }}>Your team floor.</T>
      <T s={15} c={k.ink75} style={{ marginTop: 8, lineHeight: 22 }}>{`Everyone on your team has a seat: ${youName}, the agents you made and the specialists you hired.`}</T>

      <View style={{ marginTop: 18, borderRadius: 26, backgroundColor: k.card, borderWidth: 2, borderColor: k.tint, padding: 14, overflow: "hidden" }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.6 }}>
          {Array.from({ length: 16 }, (_, i) => <View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * 28, height: 1, backgroundColor: k.line }} />)}
          {Array.from({ length: 14 }, (_, i) => <View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: i * 28, width: 1, backgroundColor: k.line }} />)}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Label c={k.ink60}>Floor plan</Label>
          <Label>{`${used} of ${plan.seats} seat${plan.seats === 1 ? "" : "s"}`}</Label>
        </View>
        <RingLegend />
        <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {Array.from({ length: seats }, (_, i) => {
            const a = team[i];
            if (a) {
              const kd = kindOf(a.slug, a.kind); const locked = lockedSet.has(a.slug);
              return (
                <Pressable key={i} onLongPress={() => setPick(a.slug)} onPress={() => (locked ? router.push("/settings/billing") : setPick(pick === a.slug ? null : a.slug))} style={{ width: cell, height: cell, opacity: locked ? 0.8 : 1 }}>
                  <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: Math.round(cell * 0.22), backgroundColor: k.tint, borderWidth: 2, borderColor: kd === "primary" ? GOLD : kd === "made" ? GRAPE_SOFT : SILVER, alignItems: "center", justifyContent: "center", ...(kd === "primary" ? { shadowColor: GOLD, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null) }}>
                    <View style={{ opacity: locked ? 0.4 : 1 }}><AgentTile slug={a.slug} look={a.look} size={44} dot={false} /></View>
                    {locked ? <View style={{ position: "absolute", width: 26, height: 26, borderRadius: 13, backgroundColor: k.ink, alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={13} color={k.bg} /></View> : null}
                  </View>
                </Pressable>
              );
            }
            if (i >= unlocked) return <Pressable key={i} onPress={() => router.push("/settings/billing")} style={{ width: cell, height: cell, borderRadius: Math.round(cell * 0.22), backgroundColor: k.dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)", alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={16} color={k.ink45} /></Pressable>;
            return <Pressable key={i} onPress={() => router.navigate("/(tabs)/marketplace")} style={{ width: cell, height: cell, borderRadius: Math.round(cell * 0.22), borderWidth: 2, borderStyle: "dashed", borderColor: k.ink45, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={18} color={k.ink45} /></Pressable>;
          })}
        </View>
        {picked ? (() => { const kd = kindOf(picked.slug, picked.kind); return (
          <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, borderRadius: 22, backgroundColor: k.ink, padding: 12 }}>
            <AgentTile slug={picked.slug} look={picked.look} size={44} dot={false} />
            <View style={{ flex: 1, minWidth: 140 }}><T f="bold" s={18} c={k.bg} lines={1}>{picked.name}</T><T s={12.5} c={k.bg} style={{ opacity: 0.75 }}>{`${kd === "primary" ? "Primary" : kd === "made" ? "Made by you" : picked.role} · seat ${String(team.indexOf(picked) + 1).padStart(2, "0")}`}</T></View>
            <Pill h={32} fs={13.5} label="Chat" onPress={() => router.push(`/chat/${picked.slug}`)} />
            <Pressable onPress={() => router.push(`/agents/${picked.slug}`)} style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: k.bg, justifyContent: "center", opacity: 0.85 }}><T f="bold" s={13.5} c={k.bg}>ID card</T></Pressable>
          </View>
        ); })() : null}
        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 2, borderStyle: "dashed", borderColor: k.ink45 }} /><T s={12.5} c={k.ink75}>Open seat</T></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: k.dark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.1)", alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={9} color={k.ink45} /></View><T s={12.5} c={k.ink75}>Locked</T></View>
          <T s={12.5} c={k.ink45}>Long-press an agent for more</T>
          <View style={{ marginLeft: "auto" }}><Pill h={40} fs={13.5} icon="plus" label="Add an agent" onPress={() => router.navigate("/(tabs)/marketplace")} /></View>
        </View>
      </View>

      <View style={{ marginTop: 16, borderRadius: 26, backgroundColor: GRAPE, padding: 18 }}>
        <Label c="rgba(255,255,255,0.8)">{`${plan.name} plan`}</Label>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 }}><T f="display" s={40} c="#fff">{String(plan.seats)}</T><T s={15} c="rgba(255,255,255,0.8)">{plan.seats === 1 ? "agent: your own" : "seats"}</T></View>
        <T s={15} c="rgba(255,255,255,0.9)" style={{ marginTop: 14, lineHeight: 22 }}>{plan.id === "free" ? "Free plan includes one agent: your own. Upgrade to Pro to hire specialists from the marketplace." : `${used} of ${plan.seats} seats used. Each specialist is a one-time $1 hire.`}</T>
        {plan.id !== "plus" && plan.id !== "max" ? <Pill kind="light" h={44} label="Upgrade plan" style={{ marginTop: 16, backgroundColor: "#fff" }} onPress={() => router.push("/settings/billing")} /> : null}
        <Pressable onPress={() => router.navigate("/(tabs)/marketplace")} style={{ marginTop: 18, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}><T f="bold" s={14} c="#0a0a0a">Open the marketplace</T></Pressable>
      </View>

      <T f="bold" s={20} style={{ marginTop: 28 }}>Plans</T>
      <T s={14} c={k.ink45} style={{ marginTop: 2 }}>More seats for more agents. Pay by card or USDC.</T>
      <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="star" size={18} color="#fff" /></View>
        <View style={{ flex: 1 }}><T f="bold" s={16}>{`${plan.name} plan`}</T><T s={13} c={k.ink60}>{`${used} of ${plan.seats} seat${plan.seats === 1 ? "" : "s"} used`}</T></View>
        <Pill h={40} fs={14} label="Upgrade plan" onPress={() => router.push("/settings/billing")} />
      </View>
    </Stage></ScrollView>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
