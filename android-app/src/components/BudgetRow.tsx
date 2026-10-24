/** Port of webapp/components/agentpay/BudgetRow.tsx: what this agent may spend on its own, and the budget sheet (GET/POST /api/agents/budget). */
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import Icon from "./Icon";
import { api } from "@/lib/api";
import { useHideBalance } from "@/lib/privacy";
import { toast } from "@/web/anim";
import { GRAPE, Label, Pill, T, WSheet, useC } from "@/web/kit";

type Budget = { perTaskUsd: number; dailyUsd: number; spentTodayUsd: number; limits: { perTaskMaxUsd: number; dailyMaxUsd: number }; recent: { id: string; title: string; usd: number; status: string; explorer?: string; at: number }[] };
const usd = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 2 : n % 1 ? 2 : 0)}`;
const TASK = [0.1, 0.5, 1, 5];
const DAY = [1, 2, 5, 20];

export default function BudgetRow({ agent, name, token }: { agent: string; name: string; token: string | null }) {
  const k = useC();
  const [hide] = useHideBalance();
  const mask = (s: string) => (hide ? "••••" : s);
  const [b, setB] = useState<Budget | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => { if (token) api<Budget>(`/api/agents/budget?agent=${encodeURIComponent(agent)}`, {}, token).then(setB, () => setB(null)); }, [agent, token]);
  useEffect(load, [load]);
  if (!b) return null;
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.card, padding: 14, borderWidth: 1, borderColor: k.line }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#0f9f6e", alignItems: "center", justifyContent: "center" }}><Icon name="gauge" size={17} color="#fff" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T f="bold" s={14} lines={1}>Budget<T f="semi" s={14} c={k.ink60}>{` · ${usd(b.perTaskUsd)}/task · ${usd(b.dailyUsd)}/day`}</T></T>
          <T s={12.5} c={k.ink60}>{`${mask(usd(b.spentTodayUsd))} spent today on services and other agents.`}</T>
        </View>
        <Icon name="right" size={16} color={k.ink45} />
      </Pressable>
      {open ? <BudgetSheet agent={agent} name={name} b={b} token={token} mask={mask} onSaved={setB} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function BudgetSheet({ agent, name, b, token, mask, onSaved, onClose }: { agent: string; name: string; b: Budget; token: string | null; mask: (s: string) => string; onSaved: (b: Budget) => void; onClose: () => void }) {
  const k = useC();
  const [task, setTask] = useState(b.perTaskUsd);
  const [day, setDay] = useState(b.dailyUsd);
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, b.dailyUsd ? (b.spentTodayUsd / b.dailyUsd) * 100 : 0);
  const dirty = task !== b.perTaskUsd || day !== b.dailyUsd;
  const save = async () => {
    setBusy(true);
    try { const r = await api<Budget>("/api/agents/budget", { method: "POST", body: JSON.stringify({ agent, perTaskUsd: task, dailyUsd: Math.max(day, task) }) }, token); onSaved(r); toast(`${name}'s budget saved`); onClose(); }
    catch (e) { toast(e instanceof Error && e.message ? e.message : "Couldn't save the budget."); }
    finally { setBusy(false); }
  };
  return (
    <WSheet open title="Budget" icon="gauge" sub={`${name} pays x402 services and other agents from its own wallet. You confirm every payment; the budget caps what it may ask for.`} onClose={onClose}
      footer={<Pill h={44} label={busy ? "Saving…" : "Save"} disabled={!dirty || busy} onPress={() => void save()} />}>
      <View style={{ borderRadius: 16, backgroundColor: k.tint, padding: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T f="bold" s={13}>Today</T><T f="bold" s={13}>{mask(usd(b.spentTodayUsd))}<T f="semi" s={13} c={k.ink45}>{` of ${usd(b.dailyUsd)}`}</T></T></View>
        <View style={{ marginTop: 8, height: 8, borderRadius: 4, backgroundColor: k.line, overflow: "hidden" }}><View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: "#0f9f6e" }} /></View>
      </View>
      <Picker label="Per task" value={task} opts={TASK} max={b.limits.perTaskMaxUsd} onChange={(v) => { setTask(v); if (day < v) setDay(v); }} />
      <Picker label="Per day" value={day} opts={DAY} max={b.limits.dailyMaxUsd} min={task} onChange={setDay} />
      {b.recent.length ? (
        <View style={{ marginTop: 16 }}>
          <Label s={10} c={k.ink45} style={{ marginBottom: 6 }}>Recent payments</Label>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: k.line }}>
            {b.recent.map((r, i) => (
              <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.status === "confirmed" ? "#22c55e" : r.status === "prepared" ? "#e0a100" : r.status === "failed" || r.status === "rejected" ? "#e5484d" : k.ink45 }} />
                <T f="semi" s={13} lines={1} style={{ flex: 1 }}>{r.title}</T>
                <T f="bold" s={13}>{usd(r.usd)}</T>
                {r.explorer ? <Pressable accessibilityLabel="View transaction" onPress={() => void Linking.openURL(r.explorer!)} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" }}><Icon name="link" size={14} color={k.ink60} /></Pressable> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </WSheet>
  );
}

function Picker({ label, value, opts, onChange, max, min = 0 }: { label: string; value: number; opts: number[]; onChange: (v: number) => void; max: number; min?: number }) {
  const k = useC();
  const step = (d: number) => onChange(Math.max(min, Math.min(max, Math.round((value + d) * 100) / 100)));
  const inc = value < 1 ? 0.1 : 1;
  return (
    <View style={{ marginTop: 12, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: k.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T f="bold" s={14} style={{ flex: 1 }}>{label}</T>
        <Pressable accessibilityLabel={`Less ${label}`} onPress={() => step(-inc)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="bold" s={18}>−</T></Pressable>
        <T f="bold" s={17} style={{ width: 64, textAlign: "center" }}>{usd(value)}</T>
        <Pressable accessibilityLabel={`More ${label}`} onPress={() => step(inc)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={15} color={k.ink} /></Pressable>
      </View>
      <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
        {opts.filter((o) => o >= min && o <= max).map((o) => <Pressable key={o} onPress={() => onChange(o)} style={{ flex: 1, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: o === value ? GRAPE : k.tint }}><T f="bold" s={12} c={o === value ? "#fff" : k.ink75}>{usd(o)}</T></Pressable>)}
      </View>
    </View>
  );
}
