import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import Capped from "./Capped";
import { api } from "@/lib/api";
import { GRAPE, Label, T, useC } from "@/web/kit";

type Card = {
  address: string; network: string; explorer: string; frozen: boolean; perTxUsd: number; dailyUsd: number; spentTodayUsd: number;
  limits: { perTxMaxUsd: number; dailyMaxUsd: number }; balances: { symbol: string; amount: number }[] | null;
  history: { id: string; title: string; usd: number; status: string; explorer?: string; at: number }[];
};
const usd = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;
const PER = [1, 5, 10, 25];
const DAY = [10, 20, 50, 100];

/** The agent's Tempo card on the phone: balance, limits, history and freeze. Same API as the web (/api/agents/card). */
export default function TempoCard({ slug, name, token }: { slug: string; name: string; token: string | null }) {
  const k = useC();
  const [c, setC] = useState<Card | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [per, setPer] = useState(5);
  const [day, setDay] = useState(20);
  const load = useCallback(() => api<Card>(`/api/agents/card?agent=${encodeURIComponent(slug)}`, {}, token).then((r) => { setC(r); setPer(r.perTxUsd); setDay(r.dailyUsd); }).catch(() => setErr("Couldn't load the Tempo card.")), [slug, token]);
  useEffect(() => { void load(); }, [load]);
  const save = async (frozen: boolean) => {
    if (!c) return;
    setBusy(true); setErr("");
    try { const r = await api<Card>("/api/agents/card", { method: "POST", body: JSON.stringify({ agent: slug, perTxUsd: per, dailyUsd: Math.max(day, per), frozen }) }, token); setC(r); }
    catch (e) { setErr((e as Error).message || "Couldn't save the card."); }
    finally { setBusy(false); }
  };
  if (!c) return err ? <T s={13} c={k.ink60}>{err}</T> : null;
  const total = (c.balances || []).reduce((s, b) => s + b.amount, 0);
  const dirty = per !== c.perTxUsd || day !== c.dailyUsd;
  const chip = (v: number, on: boolean, set: (n: number) => void) => (
    <Pressable key={v} onPress={() => set(v)} style={{ flex: 1, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: on ? GRAPE : k.tint }}>
      <T f="bold" s={12} c={on ? "#fff" : k.ink75}>{usd(v)}</T>
    </Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ borderRadius: 22, padding: 18, backgroundColor: c.frozen ? "#5b5b66" : "#3b2a8f" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Label s={9} c="rgba(255,255,255,0.7)">Tempo card</Label><Label s={9} c="rgba(255,255,255,0.7)">{c.frozen ? "Frozen" : "Testnet"}</Label></View>
        <T f="bold" s={26} c="#fff" style={{ marginTop: 10 }}>{c.balances ? `$${total.toFixed(2)}` : "Balance unavailable"}</T>
        <T s={12.5} c="rgba(255,255,255,0.75)" style={{ marginTop: 4 }}>{name} · {usd(c.perTxUsd)} a payment · {usd(c.dailyUsd)} a day · {usd(c.spentTodayUsd)} spent today</T>
        <T s={11.5} c="rgba(255,255,255,0.6)" style={{ marginTop: 6 }} onPress={() => Linking.openURL(c.explorer)}>{c.address.slice(0, 6)}…{c.address.slice(-4)}</T>
      </View>
      <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16, gap: 8 }}>
        <T s={13} c={k.ink60}>Every card payment waits for your Confirm, inside these limits. Test stablecoins on {c.network}.</T>
        <T f="bold" s={14}>Per payment</T>
        <View style={{ flexDirection: "row", gap: 6 }}>{PER.filter((v) => v <= c.limits.perTxMaxUsd).map((v) => chip(v, v === per, (n) => { setPer(n); if (day < n) setDay(n); }))}</View>
        <T f="bold" s={14}>Per day</T>
        <View style={{ flexDirection: "row", gap: 6 }}>{DAY.filter((v) => v >= per && v <= c.limits.dailyMaxUsd).map((v) => chip(v, v === day, setDay))}</View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Pressable disabled={busy} onPress={() => save(!c.frozen)} style={{ flex: 1, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: k.tint }}><T f="bold" s={14}>{c.frozen ? "Unfreeze" : "Freeze"}</T></Pressable>
          <Pressable disabled={!dirty || busy} onPress={() => save(c.frozen)} style={{ flex: 1, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: GRAPE, opacity: !dirty || busy ? 0.4 : 1 }}>{busy ? <ActivityIndicator color="#fff" /> : <T f="bold" s={14} c="#fff">Save limits</T>}</Pressable>
        </View>
        {err ? <T s={12.5} c="#e5484d">{err}</T> : null}
        <Label s={9} c={k.ink45} style={{ marginTop: 8 }}>History</Label>
        <Capped n={c.history.length}>{c.history.length ? c.history.map((r) => (
          <Pressable key={r.id} onPress={() => r.explorer && Linking.openURL(r.explorer)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.status === "confirmed" ? "#22c55e" : r.status === "prepared" ? "#e0a100" : r.status === "failed" || r.status === "rejected" ? "#e5484d" : k.ink45 }} />
            <T f="semi" s={13} lines={1} style={{ flex: 1 }}>{r.title}</T>
            <T f="bold" s={13}>{usd(r.usd)}</T>
          </Pressable>
        )) : <T s={13} c={k.ink60}>No card payments yet. Ask {name} to pay with its Tempo card in chat.</T>}</Capped>
      </View>
    </View>
  );
}
