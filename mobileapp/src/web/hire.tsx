/** Hire the way the phone website does: free and already-paid agents join at once, a new hire confirms against the Lexari balance, then a small celebration. */
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/state/session";
import { ROSTER, specialist, type Specialist } from "@/content/roster";
import { AgentTile, GRAPE, T, useC } from "@/web/kit";
import { useData } from "@/web/data";
import { UpgradeSheet } from "@/web/Plans";
import { Burst, Pop, PopIn, toast } from "@/web/anim";
import PayWithSkr from "@/components/PayWithSkr";

const HIRE_USD = 1;
const usd = (micros: number) => `$${(Math.max(0, micros) / 1e6).toFixed(2)}`;

export function useHire() {
  const k = useC();
  const { token } = useSession();
  const { me, wallet, reload } = useData();
  const [pay, setPay] = useState<Specialist | null>(null);
  const [party, setParty] = useState<Specialist | null>(null);
  const [paidNow, setPaidNow] = useState(false);
  const [upgrade, setUpgrade] = useState<false | "seats" | "plans">(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const seatsFull = (a: Specialist) => {
    if (a.free) return false;
    const seats = me?.plan.seats ?? 1;
    const used = (me?.agents ?? []).filter((x) => x.kind === "hired" && !ROSTER.find((r) => r.slug === x.slug)?.free).length;
    return used >= seats && !me?.hires?.some((h) => h.slug === a.slug);
  };

  const finish = async (a: Specialist, charged: boolean) => {
    const back = !a.free && !!me?.hires?.some((h) => h.slug === a.slug);
    await reload();
    toast(back ? `${a.name} is back on your team` : `${a.name} joined your team · ${a.free ? "Free" : `$${HIRE_USD}`}`);
    setPaidNow(charged);
    setParty(a);
    setPay(null);
  };

  const start = (slug: string) => {
    const a = specialist(slug);
    if (!a || !token) return;
    if (me?.agents.some((x) => x.slug === a.slug)) { router.push(`/chat/${a.slug}`); return; }
    if (seatsFull(a)) { setUpgrade("seats"); return; }
    // Free specialists (the ORE Miner) come with any paid plan.
    if (a.free && me?.plan?.id === "free") { setUpgrade("plans"); return; }
    const again = !!me?.hires?.some((h) => h.slug === a.slug);
    if (a.free || again) {
      setBusy(true); setErr("");
      const run = a.free
        ? api("/api/hires", { method: "POST", body: JSON.stringify({ slug: a.slug, pay: "balance" }) }, token)
        : api("/api/hires", { method: "PUT", body: JSON.stringify({ slug: a.slug }) }, token);
      run.then(() => finish(a, false)).catch((e) => { if (e instanceof ApiError && e.status === 402) setUpgrade("plans"); else setErr(e instanceof Error ? e.message : "Could not hire them."); }).finally(() => setBusy(false));
      return;
    }
    setErr(""); setPay(a);
  };

  const confirm = async () => {
    if (!pay || !token) return;
    setBusy(true); setErr("");
    try {
      await api("/api/hires", { method: "POST", body: JSON.stringify({ slug: pay.slug, pay: "balance" }) }, token);
      await finish(pay, true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "That didn't go through. Nothing was charged.");
    } finally { setBusy(false); }
  };

  const balance = wallet?.balance ?? null;
  const short = balance !== null && balance < HIRE_USD * 1e6;
  const node = (
    <>
      <Modal visible={!!pay} transparent animationType="fade" onRequestClose={() => !busy && setPay(null)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 22 }}>
          <Pressable accessibilityLabel="Close" onPress={() => !busy && setPay(null)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />
          {pay ? (
            <View style={{ width: "100%", maxWidth: 420, borderRadius: 26, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="wallet" size={20} color="#fff" /></View>
                <View style={{ flex: 1 }}><T f="bold" s={18}>{`Hire ${pay.name}`}</T><T s={12.5} c={k.ink60}>{`${pay.job}. A one-time hire. Release and hire again for free.`}</T></View>
                <Pressable accessibilityLabel="Close" onPress={() => !busy && setPay(null)} hitSlop={8}><T s={22} c={k.ink60}>×</T></Pressable>
              </View>
              <View style={{ alignItems: "center", paddingVertical: 8 }}><AgentTile slug={pay.slug} size={72} radius={24} dot={false} /></View>
              <View style={{ borderRadius: 18, backgroundColor: k.tint, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T s={14} c={k.ink60}>Price</T><T f="bold" s={14}>{`$${HIRE_USD}.00`}</T></View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T s={14} c={k.ink60}>Your balance</T><T f="semi" s={14} c={short ? "#c2410c" : k.ink}>{balance === null ? "…" : usd(balance)}</T></View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: k.line, paddingTop: 8 }}><T s={14} c={k.ink60}>{short ? "You need" : "After this"}</T><T f="bold" s={14}>{balance === null ? "…" : short ? `${usd(HIRE_USD * 1e6 - balance)} more` : usd(balance - HIRE_USD * 1e6)}</T></View>
              </View>
              {err ? <T s={13} c="#e5484d">{err}</T> : null}
              <Pressable disabled={busy || balance === null} onPress={() => (short ? router.push({ pathname: "/(tabs)/wallets", params: { topup: "1" } }) : void confirm())} style={{ height: 48, borderRadius: 16, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center", opacity: busy || balance === null ? 0.6 : 1 }}>
                <T f="bold" s={15} c="#fff">{busy ? "Paying…" : short ? "Top up and continue" : `Hire for $${HIRE_USD}`}</T>
              </Pressable>
              <PayWithSkr usd={HIRE_USD} disabled={busy} />
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal visible={!!party} transparent animationType="fade" onRequestClose={() => setParty(null)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.62)" }}>
          {party ? (
            <PopIn style={{ width: "100%", maxWidth: 400 }}><View style={{ width: "100%", borderRadius: 28, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 24, alignItems: "center", overflow: "hidden" }}>
              <View pointerEvents="none" style={{ position: "absolute", top: -96, width: 192, height: 192, borderRadius: 96, backgroundColor: "rgba(91,43,255,0.3)" }} />
              <View style={{ width: 140, height: 120, alignItems: "center", justifyContent: "center" }}>
                <Burst n={16} base={70} />
                <Pop k={party.slug} from={0.3}><AgentTile slug={party.slug} size={96} radius={30} dot={false} mood="happy" /></Pop>
                <Pop k={`c${party.slug}`} from={0} style={{ position: "absolute", right: 10, bottom: 4 }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: GRAPE, borderWidth: 3, borderColor: k.card, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={14} stroke={3} color="#fff" /></View></Pop>
              </View>
              <T f="display" s={28} style={{ marginTop: 16, textAlign: "center", letterSpacing: -1 }}>{`${party.name} joined your team`}</T>
              <T s={14.5} c={k.ink60} style={{ marginTop: 8, textAlign: "center", lineHeight: 21 }}>{party.free ? `${party.job}. Free, and it doesn't take a seat.` : paidNow ? `${party.job}. Paid $${HIRE_USD} from your balance.` : `${party.job}. Back on your team, no charge.`}</T>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 18, alignSelf: "stretch" }}>
                <Pressable onPress={() => { const slug = party.slug; setParty(null); router.push(`/chat/${slug}`); }} style={{ flex: 1, height: 46, borderRadius: 16, borderWidth: 1, borderColor: k.line, alignItems: "center", justifyContent: "center" }}><T f="bold" s={15}>Say hi</T></Pressable>
                <Pressable onPress={() => setParty(null)} style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><T f="bold" s={15} c="#fff">Nice</T></Pressable>
              </View>
            </View></PopIn>
          ) : null}
        </View>
      </Modal>
      <UpgradeSheet open={!!upgrade} mode={upgrade || "seats"} onClose={() => setUpgrade(false)} onTopUp={() => { setUpgrade(false); router.push({ pathname: "/(tabs)/wallets", params: { topup: "1" } }); }} />
      <Modal visible={!!err && !pay} transparent animationType="fade" onRequestClose={() => setErr("")}>
        <Pressable onPress={() => setErr("")} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Pressable style={{ width: "100%", maxWidth: 360, borderRadius: 20, backgroundColor: k.card, padding: 18, gap: 10 }}>
            <T f="bold" s={16}>Couldn't hire them</T>
            <T s={14} c={k.ink60}>{err}</T>
            <Pressable onPress={() => setErr("")} style={{ height: 44, borderRadius: 14, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><T f="bold" s={15} c="#fff">OK</T></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
  return { start, busy, node };
}
