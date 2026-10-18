/** Port of webapp/components/wallet/CardVisual.tsx and the Wallets > Cards row: the premium card face (masked until you ask), the Tempo summary strip and the Card details sheet. */
import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Icon from "@/components/Icon";
import { PinPad } from "@/components/PinPad";
import { api } from "@/lib/api";
import { MASK, useHideBalance } from "@/lib/privacy";
import { useSession } from "@/state/session";
import { F, GRAPE, Label, Pill, T, WSheet, useC } from "@/web/kit";
import { toast } from "@/web/anim";

export type PayCard = { agent: string; last4: string; limit: number; spent: number; frozen: boolean; test?: boolean; number?: string; expMonth?: number; expYear?: number; cvv?: string };
export type Tempo = { address: string; network?: string; frozen: boolean; perTxUsd: number; dailyUsd: number; spentTodayUsd: number; balances: { symbol: string; amount: number }[] | null };

const dollars = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;
const expOf = (c: PayCard) => `${String(c.expMonth).padStart(2, "0")}/${String(c.expYear).slice(-2)}`;
const W = "rgba(255,255,255,";

/** The card itself, at the web's 1.586 ratio. Number, expiry and CVV stay masked unless `card` carries the revealed details. */
export function PayCardFace({ name, card, home, width }: { name: string; card: PayCard | null; home?: boolean; width?: number }) {
  const { width: sw } = useWindowDimensions();
  const w = Math.min(360, width ?? sw - 64);
  const h = w / 1.586;
  const u = w / 100; // 1cqw
  const full = !!card?.number;
  const num = full ? card!.number!.replace(/(.{4})/g, "$1 ").trim() : card ? `•••• •••• •••• ${card.last4}` : "•••• •••• •••• ••••";
  const exp = full ? expOf(card!) : "••/••";
  const pad = w * 0.06;
  const small = Math.max(6.5, Math.min(8, 2.2 * u));
  const val = Math.max(10, Math.min(13, 3.6 * u));
  return (
    <View accessible accessibilityLabel={card ? `Card for ${name} ending ${card.last4}${card.frozen ? ", frozen" : ""}` : `Card preview for ${name}. No card has been issued.`}
      style={{ width: w, height: h, borderRadius: 20, overflow: "hidden", padding: pad, borderWidth: 1, borderColor: `${W}0.1)`, boxShadow: "0 24px 50px -24px rgba(91,43,255,0.7)" }}>
      <Svg pointerEvents="none" width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <LinearGradient id="pcbg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={home ? "#6a3dff" : "#1a1726"} /><Stop offset="0.45" stopColor={home ? "#5b2bff" : "#12101b"} /><Stop offset="1" stopColor={home ? "#2a0f9a" : "#0a0a0a"} />
          </LinearGradient>
          <RadialGradient id="pcglow" cx="1" cy="0" rx="1.2" ry="1.4" fx="1" fy="0">
            <Stop offset="0" stopColor="#c9b8ff" stopOpacity={home ? 0 : 0.55} /><Stop offset="0.55" stopColor="#c9b8ff" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="pcsheen" x1="0" y1="0" x2="1" y2="1"><Stop offset="0.3" stopColor="#fff" stopOpacity={0} /><Stop offset="0.5" stopColor="#fff" stopOpacity={0.07} /><Stop offset="0.7" stopColor="#fff" stopOpacity={0} /></LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#pcbg)" />
        <Rect width={w} height={h} fill="url(#pcglow)" />
        <Rect width={w} height={h} fill="url(#pcsheen)" />
        {/* the web's three rings: -right-10 -top-16 h-44, -right-2 -top-24 h-56, -bottom-20 -left-16 h-48 */}
        <Circle cx={w + 40 - 88} cy={-64 + 88} r={88} stroke={`${W}0.1)`} fill="none" />
        <Circle cx={w + 8 - 112} cy={-96 + 112} r={112} stroke={`${W}0.1)`} fill="none" />
        <Circle cx={-64 + 96} cy={h + 80 - 96} r={96} stroke={`${W}0.07)`} fill="none" />
      </Svg>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 * u }}>
          <View style={{ width: Math.max(18, Math.min(24, 6.5 * u)), height: Math.max(18, Math.min(24, 6.5 * u)), borderRadius: 7, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}><View style={{ width: "30%", height: "30%", borderRadius: 99, backgroundColor: "#0a0a0a" }} /></View>
          <T f="display" s={Math.max(15, Math.min(20, 5.6 * u))} c="#fff" style={{ lineHeight: Math.max(16, Math.min(22, 6 * u)) }}>lexari</T>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 * u }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: card?.test ? "#ffd84d" : `${W}0.15)` }}><Label s={small} c={card?.test ? "#0a0a0a" : "#fff"}>{card ? (card.test ? "Virtual · test" : card.frozen ? "Frozen" : "Virtual") : "Preview"}</Label></View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.8} style={{ transform: [{ rotate: "90deg" }] }}><Path d="M8.5 16.5a6 6 0 0 1 0-9M12 19a9.5 9.5 0 0 0 0-14M15.5 21.5a13 13 0 0 0 0-19" /></Svg>
        </View>
      </View>
      <View style={{ marginTop: w * 0.05, width: w * 0.14, height: h * 0.16, borderRadius: 6, overflow: "hidden", opacity: 0.9 }}>
        <Svg width={w * 0.14} height={h * 0.16}>
          <Defs><LinearGradient id="pcchip" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#f3f0ff" /><Stop offset="1" stopColor="#b9a6ff" /></LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#pcchip)" />
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <Rect key={`${r}${c}`} x={3 + c * ((w * 0.14 - 6) / 3)} y={3 + r * ((h * 0.16 - 6) / 3)} width={(w * 0.14 - 6) / 3 - 1} height={(h * 0.16 - 6) / 3 - 1} rx={1} stroke="rgba(0,0,0,0.4)" strokeWidth={1} fill="none" opacity={0.4} />))}
        </Svg>
      </View>
      <T lines={1} s={Math.max(11, Math.min(18, 5 * u))} c={`${W}0.85)`} style={{ marginTop: w * 0.04, fontFamily: F.mono, letterSpacing: 0.6 }}>{num}</T>
      <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 3 * u }}>
        <View style={{ flexShrink: 1, minWidth: 0 }}><Label s={Math.max(6, Math.min(7.5, 2 * u))} c={`${W}0.6)`}>Card holder</Label><T lines={1} f="semi" s={val} c="#fff" style={{ fontFamily: F.mono, letterSpacing: 1 }}>{name.toUpperCase()}</T></View>
        <View><Label s={Math.max(6, Math.min(7.5, 2 * u))} c={`${W}0.6)`}>Valid thru</Label><T s={val} c={`${W}0.85)`} style={{ fontFamily: F.mono }}>{exp}</T></View>
        <View><Label s={Math.max(6, Math.min(7.5, 2 * u))} c={`${W}0.6)`}>CVV</Label><T s={val} c={`${W}0.85)`} style={{ fontFamily: F.mono }}>{full ? card!.cvv : "•••"}</T></View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row" }}><View style={{ width: Math.max(16, Math.min(24, 6.5 * u)), height: Math.max(16, Math.min(24, 6.5 * u)), borderRadius: 99, backgroundColor: `${W}0.9)` }} /><View style={{ marginLeft: -2.6 * u, width: Math.max(16, Math.min(24, 6.5 * u)), height: Math.max(16, Math.min(24, 6.5 * u)), borderRadius: 99, backgroundColor: "rgba(201,184,255,0.8)" }} /></View>
          <Label s={Math.max(5.5, Math.min(6.5, 1.8 * u))} c={`${W}0.6)`} style={{ marginTop: 2 }}>Network</Label>
        </View>
      </View>
      {card?.frozen ? (
        <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: `${W}0.2)`, alignItems: "center", justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "rgba(10,10,10,0.85)", paddingHorizontal: 14, paddingVertical: 8 }}><Icon name="pause" size={14} /><T f="bold" s={13} c="#fff">Frozen</T></View>
        </View>
      ) : null}
    </View>
  );
}

/** The Tempo balance and limits as a tidy strip under the card (web TempoCardRow summary). */
export function TempoSummary({ c }: { c: Tempo | null }) {
  const k = useC();
  const [hide] = useHideBalance();
  if (!c) return null;
  const tot = (c.balances || []).reduce((n, b) => n + b.amount, 0);
  const m = (s: string) => (hide ? MASK : s);
  const stats: [string, string][] = [["Balance", c.balances ? m(`$${tot.toFixed(2)}`) : "Unavailable"], ["Per payment", dollars(c.perTxUsd)], ["Per day", dollars(c.dailyUsd)], ["Spent today", m(dollars(c.spentTodayUsd))]];
  return (
    <View style={{ alignSelf: "stretch", borderRadius: 16, backgroundColor: k.tint, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Label s={9.5} c={k.ink60}>Tempo card</Label>
        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.frozen ? "rgba(127,127,127,0.18)" : "rgba(34,197,94,0.16)" }}><Label s={9} c={c.frozen ? k.ink60 : "#16a34a"}>{c.frozen ? "Frozen" : "Active"}</Label></View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
        {stats.map(([a, b]) => (
          <View key={a} style={{ width: "50%", paddingVertical: 4, paddingRight: 8 }}><T s={11.5} c={k.ink60}>{a}</T><T f="bold" s={15} lines={1}>{b}</T></View>
        ))}
      </View>
      <T f="mono" s={11.5} c={k.ink45} style={{ marginTop: 4 }}>{`${c.address.slice(0, 6)}…${c.address.slice(-4)}`}</T>
    </View>
  );
}

/** Card details: the face, then View card behind your PIN (number, expiry, CVV for 60s), plus balance, limits and spend. */
export function CardDetailsSheet({ open, onClose, agent, name, home, card, tempo }: { open: boolean; onClose: () => void; agent: string; name: string; home?: boolean; card: PayCard; tempo: Tempo | null }) {
  const k = useC();
  const { token } = useSession();
  const [full, setFull] = useState<PayCard | null>(null);
  const [pin, setPin] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  useEffect(() => { if (!open) { setFull(null); setPin(false); setErr(""); } }, [open]);
  useEffect(() => {
    if (!full) return;
    setLeft(60);
    const t = setInterval(() => setLeft((x) => { if (x <= 1) { setFull(null); return 0; } return x - 1; }), 1000);
    return () => clearInterval(t);
  }, [full]);
  const reveal = async (p: string) => {
    if (!token) return;
    setBusy(true); setErr("");
    try { const r = await api<{ card: PayCard }>("/api/cards/reveal", { method: "POST", body: JSON.stringify({ agent, pin: p }) }, token); setFull(r.card); setPin(false); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't open the card."); }
    finally { setBusy(false); }
  };
  const shown: PayCard = full ? { ...card, ...full, frozen: card.frozen, limit: card.limit, spent: card.spent } : card;
  const pct = Math.min(100, Math.round((card.spent / Math.max(1, card.limit)) * 100));
  const copy = async (v: string, what: string) => { await Clipboard.setStringAsync(v); toast({ text: `Copied the ${what}` }); };
  return (
    <WSheet open={open} onClose={onClose} title={`${name}'s card`} sub={card.frozen ? "Frozen. Unfreeze it on the web to pay again." : "Your agent pays inside the limits you set. Every payment waits for your Confirm."}>
      {pin ? (
        <View style={{ paddingVertical: 8 }}>
          <PinPad title="Enter your PIN" sub="To view the full card details." error={err} busy={busy} onDone={(p) => void reveal(p)} />
          <Pressable onPress={() => setPin(false)} style={{ alignSelf: "center", marginTop: 12, padding: 8 }}><T f="semi" s={13} c={k.ink60}>Cancel</T></Pressable>
        </View>
      ) : (
        <>
          <View style={{ alignItems: "center", marginTop: 4 }}><PayCardFace name={name} card={shown} home={home} width={320} /></View>
          {full ? (
            <View style={{ marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: k.line }}>
              {([["Card number", full.number!.replace(/(.{4})/g, "$1 ").trim(), full.number!], ["Expiry", expOf(full), expOf(full)], ["CVV", full.cvv!, full.cvv!]] as const).map(([l, v, raw], i) => (
                <Pressable key={l} accessibilityLabel={`Copy the ${l.toLowerCase()}`} onPress={() => void copy(raw, l.toLowerCase())} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
                  <View style={{ flex: 1 }}><T s={12} c={k.ink60}>{l}</T><T f="bold" s={15} style={{ fontFamily: F.mono }}>{v}</T></View>
                  <Icon name="copy" size={16} color={k.ink45} />
                </Pressable>
              ))}
              <T s={12} c={k.ink45} style={{ textAlign: "center", paddingBottom: 10 }}>{`Hides again in ${left}s`}</T>
            </View>
          ) : null}
          {err && !pin ? <T s={13} c="#e5484d" style={{ marginTop: 10, textAlign: "center" }}>{err}</T> : null}
          <View style={{ marginTop: 12 }}>
            {full ? <Pill label="Hide details" icon="eyeoff" kind="ghost" h={44} onPress={() => setFull(null)} /> : <Pill label="View card" icon="eye" h={44} onPress={() => { setErr(""); setPin(true); }} />}
          </View>
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T f="semi" s={14}>Monthly limit</T><T f="bold" s={14}>{`$${card.spent.toFixed(2)} of $${card.limit}`}</T></View>
            <View style={{ marginTop: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(127,127,127,0.18)", overflow: "hidden" }}><View style={{ width: `${pct}%`, height: 8, backgroundColor: GRAPE }} /></View>
          </View>
          {tempo ? <View style={{ marginTop: 14 }}><TempoSummary c={tempo} /></View> : null}
        </>
      )}
    </WSheet>
  );
}
