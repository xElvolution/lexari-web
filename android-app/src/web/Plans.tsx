/** Port of webapp/components/UpgradeSheet.tsx + Plans.tsx (PlansGrid, PeriodToggle) at phone width.
 * Plans are paid from the Lexari balance (POST /api/billing/plan); a short balance says so and offers Top up. */
import { useState } from "react";
import { Pressable, View } from "react-native";
import Icon from "@/components/Icon";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { GRAPE, Label, Pill, T, WSheet, useC } from "@/web/kit";
import PayWithSkr from "@/components/PayWithSkr";

type Period = "monthly" | "yearly";
export const PLANS = [
  { id: "free", name: "Free", seats: 1, usd: 0, later: false, for: "Your own agent on Lamina, with its computer and memory.", points: ["A daily Lamina allowance", "Your named agent", "Its own computer and memory"] },
  { id: "pro", name: "Pro", seats: 5, usd: 20, later: false, for: "Lamina all month, plus $20 of premium models.", points: ["Lamina usage included", "$20 of Claude Sonnet and more", "5 seats for your crew"] },
  { id: "plus", name: "Max", seats: 20, usd: 60, later: false, for: "Three times Pro, for heavy daily work.", points: ["3x the Lamina usage of Pro", "$60 of premium models", "20 seats and team chats"] },
  { id: "max", name: "Ultra", seats: 100, usd: 200, later: true, for: "A whole floor for big, parallel work.", points: ["10x the Lamina usage of Pro", "$200 of premium models", "100 seats"] },
] as const;
const price = (usd: number, p: Period) => (p === "yearly" ? usd * 10 : usd);

export function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const k = useC();
  return (
    <View style={{ height: 48, flexDirection: "row", borderRadius: 24, backgroundColor: k.tint, padding: 4, borderWidth: 1, borderColor: k.line }}>
      {(["monthly", "yearly"] as const).map((p) => (
        <Pressable key={p} onPress={() => onChange(p)} style={{ flex: 1, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: period === p ? GRAPE : "transparent" }}>
          <T f="bold" s={14} c={period === p ? "#fff" : k.ink60}>{p === "monthly" ? "Monthly" : "Yearly"}</T>
          {p === "yearly" ? <View style={{ borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: period === p ? "#fff" : "#1fbf6a" }}><Label s={8} c={period === p ? "#137a3d" : "#fff"}>2 months free</Label></View> : null}
        </Pressable>
      ))}
    </View>
  );
}

export function PlansGrid({ onPick, onTopUp }: { onPick?: () => void; onTopUp?: () => void }) {
  const k = useC();
  const { token } = useSession();
  const { me, reload } = useData();
  const cur = me?.plan.id || "free";
  const [period, setPeriod] = useState<Period>("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; short?: boolean; usd?: number } | null>(null);
  const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
  const pick = async (id: string) => {
    setBusy(id); setMsg(null);
    try { await api("/api/billing/plan", { method: "POST", body: JSON.stringify({ plan: id, period, key: `${Date.now()}-${Math.random().toString(36).slice(2)}` }) }, token); await reload(); onPick?.(); }
    catch (e) { const short = e instanceof ApiError && (e.status === 402 || e.status === 409); setMsg({ text: short ? "Your balance is short for this plan. Top up, then try again." : "That didn't go through. Try again.", short, usd: price(PLANS.find((x) => x.id === id)?.usd ?? 0, period) }); }
    finally { setBusy(null); }
  };
  return (
    <View style={{ gap: 12 }}>
      <PeriodToggle period={period} onChange={setPeriod} />
      <T f="semi" s={12.5} c={k.ink45} style={{ textAlign: "center" }}>{period === "yearly" ? "Pay for 10 months, get 12. Usage refills every month." : "30 days at a time. Renew whenever you like."}</T>
      {msg ? <View style={{ borderRadius: 16, backgroundColor: "rgba(229,72,77,0.12)", padding: 12 }}><T s={13} c="#ff9a9d">{msg.text}</T>{msg.short && onTopUp ? <Pill label="Top up" icon="plus" h={36} fs={13} style={{ marginTop: 8, alignSelf: "flex-start" }} onPress={onTopUp} /> : null}{msg.short && msg.usd ? <View style={{ marginTop: 8 }}><PayWithSkr usd={msg.usd} /></View> : null}</View> : null}
      {PLANS.filter((p) => !p.later).map((p) => {
        const on = p.id === cur, pop = p.id === "pro", lower = rank(p.id) < rank(cur), $ = price(p.usd, period);
        const ink = on ? "#fff" : k.ink, sub = on ? "rgba(255,255,255,0.8)" : k.ink75;
        return (
          <View key={p.id} style={{ borderRadius: 22, overflow: "hidden", backgroundColor: on ? GRAPE : k.card, borderWidth: pop && !on ? 2 : 1, borderColor: on || pop ? GRAPE : k.line }}>
            {pop && !on ? <View style={{ backgroundColor: GRAPE, paddingVertical: 6, alignItems: "center" }}><Label s={8.5} c="#fff">Most popular</Label></View> : null}
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T f="display" s={20} c={ink}>{p.name}</T>
                <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: on ? "rgba(255,255,255,0.2)" : k.tint }}><Label s={8.5} c={on ? "#fff" : k.brandInk}>{`${p.seats} seat${p.seats === 1 ? "" : "s"}`}</Label></View>
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", alignItems: "baseline", gap: 6 }}><T f="display" s={22} c={ink}>{`$${$}`}</T><T f="semi" s={13} c={on ? "rgba(255,255,255,0.75)" : k.ink45}>{p.usd ? (period === "yearly" ? "/ year" : "/ month") : "forever"}</T></View>
              {p.usd && period === "yearly" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 }}><T f="semi" s={13} c={sub}>{`$${(($ / 12)).toFixed(2)} a month, billed yearly`}</T><View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: on ? "#fff" : "#e7f8ee" }}><Label s={8.5} c="#137a3d">{`Save $${p.usd * 2}`}</Label></View></View> : null}
              <T s={13.5} c={sub} style={{ marginTop: 8, lineHeight: 18.5 }}>{p.for}</T>
              <View style={{ marginTop: 8, gap: 4 }}>{p.points.map((pt) => <View key={pt} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}><View style={{ marginTop: 3 }}><Icon name="check" size={13} color={on ? "#fff" : k.brandInk} /></View><T s={13} c={on ? "rgba(255,255,255,0.9)" : k.ink75}>{pt}</T></View>)}</View>
              <View style={{ paddingTop: 16 }}>
                {p.usd === 0 ? (on ? <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4 }}><Icon name="check" size={11} /><Label s={9} c="#fff">Current plan</Label></View> : <T s={12} c={k.ink45}>Where everyone starts</T>)
                  : on ? <Pressable onPress={() => void pick(p.id)} disabled={!!busy} style={{ height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}><Icon name="check" size={13} /><T f="bold" s={13.5} c="#fff">{`Current · Renew $${$}`}</T></Pressable>
                  : lower ? <><Pressable onPress={() => void pick(p.id)} disabled={!!busy} style={{ height: 44, borderRadius: 22, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="bold" s={13.5}>{`Book ${p.name} · $${$}`}</T></Pressable><T s={12} c={k.ink45} style={{ marginTop: 8 }}>Starts when your current plan ends</T></>
                  : <Pill label={busy === p.id ? "Working…" : `Get ${p.name} · $${$}${period === "yearly" ? " / year" : ""}`} h={44} fs={13.5} disabled={!!busy} onPress={() => void pick(p.id)} />}
              </View>
            </View>
          </View>
        );
      })}
      {PLANS.filter((p) => p.later).map((p) => (
        <View key={p.id} style={{ borderRadius: 22, backgroundColor: k.tint, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><T f="display" s={18}>{p.name}</T><View style={{ borderRadius: 999, backgroundColor: k.card, paddingHorizontal: 8, paddingVertical: 4 }}><Label s={8.5} c={k.brandInk}>Coming later</Label></View></View>
          <T s={13} c={k.ink60}>{`$${p.usd} a month. ${p.points.join(", ")}.`}</T>
        </View>
      ))}
    </View>
  );
}

/** "Free plan includes one agent." / "Your Pro plan is full." / "Upgrade your plan" — the web's blocking upgrade sheet. */
export function UpgradeSheet({ open, mode, onClose, onTopUp }: { open: boolean; mode: "seats" | "plans"; onClose: () => void; onTopUp?: () => void }) {
  const { me } = useData();
  const p = PLANS.find((x) => x.id === me?.plan.id) ?? PLANS[0];
  const free = p.id === "free";
  const title = mode === "plans" ? (free ? "Upgrade your plan" : "Plans") : free ? "Free plan includes one agent." : `Your ${p.name} plan is full.`;
  const body = mode === "plans" ? "More Lamina, premium models and seats. Your own agent always sits at desk one." : free ? "Upgrade to Pro to hire more." : `All ${p.seats} seats are taken. Move up a plan or release someone from the Team page.`;
  return <WSheet open={open} title={title} sub={body} icon="team" onClose={onClose}><PlansGrid onPick={onClose} onTopUp={onTopUp} /></WSheet>;
}
