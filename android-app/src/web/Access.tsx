/**
 * Port of webapp/components/integrations (consent popup, toggle, audit log, switch off all) and
 * webapp/components/wallets/WalletsSection.tsx for Settings on the phone.
 */
import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { useWalletLink } from "@/lib/walletLink";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { AgentTile, GRAPE, Label, PopIn, Rise, T, WSheet, WToggle, short, useC } from "@/web/kit";
import { useData } from "@/web/data";
import {
  AUDIT_LABEL, CHAIN_COLOR, CLIENT_COLOR, DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS, INTEGRATION_META, INTEGRATION_DOMAIN, LIMITS, SCOPE_INFO, STATUS_LABEL, WALLET_CHAINS,
  clientName, defaultScopes, scopesOf, type AddedIntegration, type AuditRow, type LinkedWallet, type Scope, type WalletsReply,
} from "@/content/access";

type Team = { slug: string; kind: string; name: string }[];
type IntReply = { added: AddedIntegration[]; agents: Team; catalog?: { id: string; name: string; status: string; blurb: string; addable: boolean }[] };
const DAY = 86_400_000;
const SCOPE_ICON: Record<Scope, string> = { read: "eye", trade: "flip", bet: "spark", withdraw: "wallet", transfer: "send" };
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;
const expiryLabel = (d: number) => (d === 1 ? "1 day" : `${d} days`);
const until = (d: number) => new Date(Date.now() + d * DAY).toLocaleDateString([], { month: "short", day: "numeric" });
const ago = (t: number) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" }); };
export function endsIn(at: number | null, now = Date.now()) { if (at === null) return null; if (at <= now) return "Expired"; const d = Math.ceil((at - now) / DAY); return d <= 1 ? "Ends today" : `Ends in ${d} days`; }
const tap = () => { void Haptics.selectionAsync().catch(() => {}); };

function Logo({ id, size = 46, off }: { id: string; size?: number; off?: boolean }) {
  const m = INTEGRATION_META[id];
  const [bad, setBad] = useState(false);
  const dom = INTEGRATION_DOMAIN[id];
  if (dom && !bad) return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center", opacity: off ? 0.45 : 1 }}><Image source={{ uri: `https://www.google.com/s2/favicons?domain=${dom}&sz=128` }} onError={() => setBad(true)} style={{ width: size * 0.62, height: size * 0.62, borderRadius: size * 0.14 }} /></View>;
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: m?.color ?? GRAPE, alignItems: "center", justifyContent: "center", opacity: off ? 0.45 : 1 }}><T f="display" s={size * 0.42} c={id === "orca" || id === "hyperliquid" ? "#0a0a0a" : "#fff"}>{(m?.name ?? id).slice(0, 1)}</T></View>;
}
function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: bg }}><T f="semi" s={12} c={color}>{label}</T></View>;
}
function Head({ children }: { children: string }) {
  const k = useC();
  return <Label s={10} c={k.ink45} style={{ marginTop: 18, marginBottom: 6 }}>{children}</Label>;
}
function Hero({ icon, kicker, title, sub, children }: { icon: string; kicker: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <View style={{ borderRadius: 22, padding: 20, backgroundColor: "#4a1fe0", overflow: "hidden", marginTop: 6 }}>
      <View style={{ position: "absolute", right: -40, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(143,107,255,0.45)" }} />
      <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={24} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label s={9.5} c="rgba(255,255,255,0.7)">{kicker}</Label>
          <T f="display" s={28} c="#fff" style={{ marginTop: 4 }} lines={1}>{title}</T>
          {sub ? <T s={13.5} c="rgba(255,255,255,0.8)" style={{ marginTop: 6, lineHeight: 19 }}>{sub}</T> : null}
        </View>
      </View>
      {children}
    </View>
  );
}
function HeroBtn({ label, icon, onPress, disabled, solid }: { label: string; icon: string; onPress: () => void; disabled?: boolean; solid?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, height: solid ? 48 : 40, borderRadius: 999, backgroundColor: solid ? "#fff" : "rgba(255,255,255,0.15)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.5 : 1 }}>
      <Icon name={icon} size={solid ? 16 : 15} color={solid ? "#3a17c9" : "#fff"} stroke={2.4} /><T f="bold" s={solid ? 15 : 13.5} c={solid ? "#3a17c9" : "#fff"}>{label}</T>
    </Pressable>
  );
}

/* ---------------- consent ---------------- */

type Draft = { connector: string; grantId?: string; agents: string[]; perTxUsd: number; dailyUsd: number; maxSlippageBps: number; scopes?: Scope[] };

/** The consent popup: what agents may do, limits, which agents and for how long. Same rules as the web. */
function ConsentSheet({ draft, team, onClose, onDone }: { draft: Draft; team: Team; onClose: () => void; onDone: (r: IntReply, days: number) => void }) {
  const k = useC();
  const { token } = useSession();
  const { me } = useData();
  const m = INTEGRATION_META[draft.connector];
  const [scopes, setScopes] = useState<Scope[]>(draft.scopes?.length ? draft.scopes : defaultScopes(draft.connector));
  const [agents, setAgents] = useState<string[]>(draft.agents.length ? draft.agents : team.length === 1 ? [team[0].slug] : []);
  const [days, setDays] = useState<number>(DEFAULT_EXPIRY_DAYS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const allow = async () => {
    setErr(""); setBusy(true);
    const body = { agents, scopes, expiresDays: days, ...(m?.moves ? { perTxUsd: draft.perTxUsd, dailyUsd: draft.dailyUsd, ...(m.trading ? { maxSlippageBps: draft.maxSlippageBps } : {}) } : {}) };
    try {
      const r = draft.grantId
        ? await api<IntReply>(`/api/integrations/${draft.grantId}`, { method: "PATCH", body: JSON.stringify(body) }, token)
        : await api<IntReply>("/api/integrations", { method: "POST", body: JSON.stringify({ connector: draft.connector, ...body }) }, token);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone(r, days);
    } catch (e) { setErr((e as Error).message || "That didn't save. Try again."); setBusy(false); }
  };
  const look = me?.agents.find((a) => a.slug === "home")?.look;
  return (
    <WSheet open title={`Allow ${m?.name ?? draft.connector}?`} sub={m?.chains} iconNode={<PopIn><Logo id={draft.connector} size={46} /></PopIn>} onClose={onClose} footer={
      <View>
        {err ? <T s={13} c="#e5484d" style={{ marginBottom: 10 }}>{err}</T> : null}
        <Pressable onPress={() => void allow()} disabled={busy || !agents.length} accessibilityRole="button"
          style={{ height: 52, borderRadius: 999, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: busy || !agents.length ? 0.5 : 1 }}>
          {!busy ? <Icon name="check" size={17} stroke={2.4} /> : null}<T f="bold" s={16} c="#fff">{busy ? "Allowing…" : !agents.length ? "Pick at least one agent" : `Allow for ${expiryLabel(days)}`}</T>
        </Pressable>
        <Pressable onPress={onClose} style={{ height: 40, alignItems: "center", justifyContent: "center", marginTop: 4 }}><T f="semi" s={14} c={k.ink60}>Not now</T></Pressable>
      </View>
    }>
      <Head>What agents can do</Head>
      {scopesOf(draft.connector).map((s, i) => {
        const on = scopes.includes(s), info = SCOPE_INFO[s];
        return (
          <Rise key={s} delay={i * 55} y={10}>
            <View style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: k.line, alignItems: "flex-start" }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? (info.risky ? "#fff1e6" : "rgba(91,43,255,0.12)") : k.tint }}><Icon name={SCOPE_ICON[s]} size={17} color={on ? (info.risky ? "#c2570c" : GRAPE) : k.ink45} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}><T f="semi" s={14.5}>{info.title}</T>{info.risky ? <Chip label="Higher risk" color="#c2570c" bg="#fff1e6" /> : null}</View>
                <T s={12.5} c={k.ink60} style={{ lineHeight: 17, marginTop: 2 }}>{info.body}</T>
              </View>
              {s === "read" ? <Chip label="Always" color={k.ink60} bg={k.tint} /> : <WToggle on={on} onChange={(v) => { tap(); setScopes((a) => (v ? [...new Set([...a, s])] : a.filter((x) => x !== s))); }} label={info.title} />}
            </View>
          </Rise>
        );
      })}
      {m?.moves ? (
        <>
          <Head>Limits</Head>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([["Per trade", `$${draft.perTxUsd}`], ["Daily", `$${draft.dailyUsd}`], ...(m.trading ? [["Slippage", pct(draft.maxSlippageBps)]] : [])] as [string, string][]).map(([a, b]) => (
              <View key={a} style={{ flex: 1, borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 10, paddingVertical: 8 }}><T f="semi" s={11} c={k.ink60}>{a}</T><T f="bold" s={16}>{b}</T></View>
            ))}
          </View>
        </>
      ) : null}
      <Head>Agents</Head>
      {team.map((a) => (
        <View key={a.slug} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
          <AgentTile slug={a.slug} look={a.slug === "home" ? look : undefined} size={36} dot={false} />
          <T f="semi" s={14.5} style={{ flex: 1 }} lines={1}>{a.name}</T>
          <WToggle on={agents.includes(a.slug)} onChange={(v) => { tap(); setAgents((x) => (v ? [...new Set([...x, a.slug])] : x.filter((y) => y !== a.slug))); }} label={`Let ${a.name} use it`} />
        </View>
      ))}
      <Head>Access lasts</Head>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {EXPIRY_DAYS.map((d) => (
          <Pressable key={d} onPress={() => { tap(); setDays(d); }} accessibilityRole="button" accessibilityState={{ selected: days === d }}
            style={{ flex: 1, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: days === d ? GRAPE : k.tint }}>
            <T f="bold" s={13} c={days === d ? "#fff" : k.ink75}>{expiryLabel(d)}</T>
          </Pressable>
        ))}
      </View>
      <T s={12.5} c={k.ink60} style={{ marginTop: 8 }}>Until {until(days)}. After that it switches off on its own.</T>
      <View style={{ marginTop: 14, flexDirection: "row", gap: 8, borderRadius: 16, backgroundColor: "rgba(91,43,255,0.08)", padding: 12 }}>
        <Icon name="lock" size={15} color={GRAPE} />
        <T s={12.5} c={k.ink75} style={{ flex: 1, lineHeight: 17 }}>{draft.connector === "hyperliquid" ? "Agents trade through a Hyperliquid API wallet that can place orders but can never withdraw. " : ""}{m?.moves ? "Every action still waits for your Confirm in chat. " : ""}Switch it off anytime: anything still waiting for your Confirm is cancelled, and it shows in the audit log.</T>
      </View>
    </WSheet>
  );
}

/* ---------------- audit ---------------- */

function AuditSheet({ connector, team, onClose }: { connector?: string; team: Team; onClose: () => void }) {
  const k = useC();
  const { token } = useSession();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ rows: AuditRow[] }>(`/api/integrations/audit?limit=60${connector ? `&connector=${connector}` : ""}`, {}, token).then((r) => setRows(r.rows), (e) => setErr((e as Error).message)); }, [connector, token]);
  const who = (s?: string) => (s ? team.find((a) => a.slug === s)?.name ?? "An agent" : "You");
  return (
    <WSheet open title="Audit log" sub={connector ? `Everything that happened with ${INTEGRATION_META[connector]?.name ?? connector}.` : "Every access you gave and every call your agents made."} icon="list" onClose={onClose}>
      {err ? <T s={14} c={k.ink60} style={{ paddingVertical: 24, textAlign: "center" }}>{err}</T>
        : !rows ? <T s={14} c={k.ink60} style={{ paddingVertical: 24, textAlign: "center" }}>Loading…</T>
          : !rows.length ? <T s={14} c={k.ink60} style={{ paddingVertical: 24, textAlign: "center" }}>Nothing yet. Access you give and every agent call show up here.</T>
            : rows.map((r, i) => {
              const [label, color, icon] = AUDIT_LABEL[r.kind] ?? AUDIT_LABEL.failed;
              return (
                <Rise key={r.id} delay={Math.min(i, 12) * 35} y={8}>
                  <Pressable disabled={!r.explorer} onPress={() => r.explorer && Linking.openURL(r.explorer)} style={{ flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: k.line }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 2, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={11} color={color} stroke={2.6} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T f="semi" s={14} lines={1}>{r.title}</T>
                      <T s={11.5} c={k.ink45} lines={1}>{!connector ? `${INTEGRATION_META[r.connector]?.name ?? r.connector} · ` : ""}{who(r.agent)} · {ago(r.at)}</T>
                      {r.detail ? <T s={12} c={k.ink60} lines={2} style={{ marginTop: 2 }}>{r.detail}</T> : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Chip label={label} color={color} bg={color + "1a"} />
                      {r.usd ? <T f="bold" s={13}>${r.usd.toFixed(2)}</T> : null}
                    </View>
                  </Pressable>
                </Rise>
              );
            })}
    </WSheet>
  );
}

/* ---------------- integrations ---------------- */

type Sheet = null | { kind: "consent"; draft: Draft } | { kind: "audit"; connector?: string } | { kind: "add" };

/** Same groups as the web page (webapp/components/integrations/IntegrationsSection.tsx). */
const GROUPS: [string, string[]][] = [
  ["Trading", ["orca", "jupiter", "kuru", "uniswap", "intents", "bridge", "hyperliquid", "polymarket", "panta"]],
  ["Wallets & Payments", ["skr", "solana", "base", "ethereum", "arbitrum", "robinhood", "monad", "zcash", "tempo", "agora", "mera", "payments"]],
  ["Data", ["prices", "nansen", "alchemy", "ore", "solami"]],
  ["AI", ["self"]],
];

export function IntegrationsSec() {
  const k = useC();
  const { token } = useSession();
  const { me } = useData();
  const [d, setD] = useState<IntReply | null>(null);
  const [err, setErr] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [kill, setKill] = useState(false);
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const load = useCallback(() => { if (token) api<IntReply>("/api/integrations", {}, token).then(setD, (e) => setErr((e as Error).message)); }, [token]);
  useEffect(load, [load]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 2600); return () => clearTimeout(t); }, [note]);
  const look = me?.agents.find((a) => a.slug === "home")?.look;
  const off = async (g: AddedIntegration) => {
    setBusy(g.id);
    try { setD(await api<IntReply>(`/api/integrations/${g.id}`, { method: "PATCH", body: JSON.stringify({ enabled: false }) }, token)); setNote(`${INTEGRATION_META[g.connector]?.name ?? g.connector} switched off`); }
    catch (e) { setNote((e as Error).message); } finally { setBusy(null); }
  };
  const killAll = async () => {
    setBusy("all");
    try { const r = await api<IntReply & { revoked: number }>("/api/integrations/revoke-all", { method: "POST", body: "{}" }, token); setD(r); setNote(r.revoked ? `Switched off ${r.revoked} integration${r.revoked === 1 ? "" : "s"}` : "Everything was already off"); setKill(false); }
    catch (e) { setNote((e as Error).message); } finally { setBusy(null); }
  };
  const consentFor = (g: AddedIntegration): Draft => ({ connector: g.connector, grantId: g.id, agents: g.agents, perTxUsd: g.perTxUsd, dailyUsd: g.dailyUsd, maxSlippageBps: g.maxSlippageBps, scopes: g.scopes });
  const added = d?.added ?? [];
  const live = added.filter((g) => g.enabled).length;
  const team = d?.agents ?? [];
  const addable = Object.keys(INTEGRATION_META).filter((id) => INTEGRATION_META[id].addable !== false && !added.some((g) => g.connector === id));
  const cat = new Map((d?.catalog ?? []).map((c) => [c.id, c]));
  const shown = detail ? added.find((g) => g.id === detail) ?? null : null;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={15}>{`${added.length} connected`}</T><T s={12.5} c={k.ink60} style={{ lineHeight: 17 }}>Agents only use what you connect, and ask before moving money.</T></View>
        <Pressable onPress={() => setSheet({ kind: "add" })} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: GRAPE, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="plus" size={13} stroke={2.6} color="#fff" /><T f="bold" s={13} c="#fff">Add</T></Pressable>
        <Pressable onPress={() => setSheet({ kind: "audit" })} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="list" size={13} color={k.ink} /><T f="semi" s={13}>Audit</T></Pressable>
        {live ? <Pressable onPress={() => setKill(true)} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="stop" size={13} color="#e5484d" /><T f="semi" s={13} c="#e5484d">Off</T></Pressable> : null}
      </View>
      {kill ? (
        <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: "rgba(229,72,77,0.4)", padding: 12 }}>
          <T s={13} c={k.ink75} style={{ lineHeight: 18 }}>Switch off all {live} integration{live === 1 ? "" : "s"}? Agents lose access right away and anything waiting for your Confirm is cancelled.</T>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable onPress={() => setKill(false)} style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="semi" s={13.5}>Keep</T></Pressable>
            <Pressable onPress={() => void killAll()} disabled={busy === "all"} style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: "#e5484d", alignItems: "center", justifyContent: "center" }}><T f="bold" s={13.5} c="#fff">{busy === "all" ? "Switching off…" : "Switch off all"}</T></Pressable>
          </View>
        </View>
      ) : null}
      {note ? <Rise y={8}><View style={{ marginTop: 12, alignSelf: "center", borderRadius: 999, backgroundColor: k.ink, paddingHorizontal: 14, paddingVertical: 8 }}><T f="semi" s={13} c={k.bg}>{note}</T></View></Rise> : null}
      {err && !d ? <T s={14} c={k.ink60} style={{ marginTop: 16 }}>Integrations didn't load. {err}</T> : null}
      {GROUPS.map(([label, ids]) => {
        const items = ids.filter((id) => INTEGRATION_META[id] && (!d?.catalog || cat.has(id) || added.some((g) => g.connector === id)));
        if (!items.length) return null;
        return (
          <View key={label} style={{ marginTop: 20 }}>
            <Label s={9.5} c={k.ink45} style={{ marginBottom: 8 }}>{label}</Label>
            <View style={{ gap: 8 }}>
              {items.map((id) => {
                const m = INTEGRATION_META[id], c = cat.get(id), g = added.find((x) => x.connector === id);
                const on = !!g?.enabled, setup = !g && c?.status === "needskey", canAdd = (c?.addable ?? m.addable !== false) && !setup;
                return (
                  <Pressable key={id} testID={`card-${id}`} onPress={() => { tap(); if (g) setDetail(g.id); else if (canAdd) setSheet({ kind: "consent", draft: { connector: id, agents: [], perTxUsd: LIMITS.perTx.def, dailyUsd: LIMITS.daily.def, maxSlippageBps: LIMITS.slippageBps.def } }); else setInfo(id); }}
                    style={{ height: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}>
                    <Logo id={id} size={32} off={!!g && !g.enabled} />
                    <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14} lines={1}>{c?.name ?? m.name}</T><T s={12} c={k.ink60} lines={1}>{c?.status && STATUS_LABEL[c.status] ? `${STATUS_LABEL[c.status]} · ` : ""}{c?.blurb ?? m.chains}</T></View>
                    <Chip label={on ? "Connected" : setup ? "Setup" : g ? "Off" : "Available"} color={on ? "#137a3d" : setup ? "#9a6700" : k.ink60} bg={on ? "#e7f8ee" : setup ? "rgba(245,165,36,0.16)" : k.tint} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      <T s={12} c={k.ink45} style={{ marginTop: 16, lineHeight: 17 }}>Every trade and transfer waits for your Confirm in chat. Market data is read only.</T>
      {shown ? (() => { const g = shown; const m = INTEGRATION_META[g.connector]; const ends = endsIn(g.expiresAt); const soon = g.expiresAt !== null && g.expiresAt - Date.now() < 3 * DAY; return (
        <WSheet open title={m?.name ?? g.connector} onClose={() => setDetail(null)}>
            <View style={{ borderRadius: 22, borderWidth: 1, borderColor: k.line, backgroundColor: k.card, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", gap: 12, padding: 16, paddingBottom: 12, alignItems: "flex-start" }}>
                <Logo id={g.connector} off={!g.enabled} />
                <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={16}>{m?.name ?? g.connector}</T><T s={11.5} c={k.ink45} style={{ marginTop: 3 }}>{m?.chains}</T></View>
                <View style={{ opacity: busy === g.id ? 0.6 : 1 }} pointerEvents={busy === g.id ? "none" : "auto"}>
                  <WToggle on={g.enabled} onChange={(v) => { tap(); if (v) setSheet({ kind: "consent", draft: consentFor(g) }); else void off(g); }} label={g.enabled ? `Switch off ${m?.name}` : `Turn on ${m?.name}`} />
                </View>
              </View>
              {!g.enabled ? <View style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: k.tint, paddingHorizontal: 12, paddingVertical: 8 }}><T f="semi" s={12.5} c={k.ink60}>{ends === "Expired" ? "Access expired." : "Switched off."} No agent can use {m?.name} until you allow it again.</T></View> : null}
              <View style={{ borderTopWidth: 1, borderTopColor: k.line, paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Label s={9} c={k.ink45}>Access</Label>
                  {g.enabled && ends ? <Chip label={ends} color={soon ? "#8a6100" : k.ink60} bg={soon ? "#fff6db" : k.tint} /> : null}
                  <Pressable onPress={() => setSheet({ kind: "consent", draft: consentFor(g) })} style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 8 }}><Icon name="lock" size={13} color={GRAPE} /><T f="semi" s={13} c={GRAPE}>{g.enabled ? "Review" : "Allow again"}</T></Pressable>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{g.scopes.map((s) => <Chip key={s} label={SCOPE_INFO[s].title} color={SCOPE_INFO[s].risky ? "#c2570c" : k.ink75} bg={SCOPE_INFO[s].risky ? "#fff1e6" : k.tint} />)}</View>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: k.line, paddingHorizontal: 16, paddingVertical: 12 }}>
                <Label s={9} c={k.ink45}>Agents</Label>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {g.agents.length ? g.agents.map((a) => (
                    <View key={a} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: k.tint, paddingVertical: 4, paddingLeft: 4, paddingRight: 10 }}>
                      <AgentTile slug={a} look={a === "home" ? look : undefined} size={22} dot={false} /><T f="semi" s={13}>{team.find((t) => t.slug === a)?.name ?? "An agent"}</T>
                    </View>
                  )) : <T s={13} c={k.ink60}>No agent can use it yet.</T>}
                </View>
              </View>
              {m?.moves ? (
                <View style={{ borderTopWidth: 1, borderTopColor: k.line, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Label s={9} c={k.ink45}>Limits</Label><T s={12} c={k.ink60}>${g.spentTodayUsd.toFixed(2)} of ${g.dailyUsd} today · ${g.perTxUsd} per trade</T></View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: k.tint, marginTop: 8, overflow: "hidden" }}><View style={{ height: 6, borderRadius: 3, backgroundColor: GRAPE, width: `${Math.min(100, (g.spentTodayUsd / Math.max(1, g.dailyUsd)) * 100)}%` }} /></View>
                </View>
              ) : null}
              <Pressable onPress={() => setSheet({ kind: "audit", connector: g.connector })} style={{ borderTopWidth: 1, borderTopColor: k.line, paddingHorizontal: 16, height: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="list" size={15} color={GRAPE} /><T f="semi" s={13.5} c={GRAPE}>Audit log</T><View style={{ marginLeft: "auto" }}><Icon name="right" size={15} color={k.ink45} /></View>
              </Pressable>
            </View>
        </WSheet>
      ); })() : null}
      {info ? (
        <WSheet open title={cat.get(info)?.name ?? INTEGRATION_META[info].name} sub={INTEGRATION_META[info].chains} onClose={() => setInfo(null)}>
          <T s={14} c={k.ink75} style={{ lineHeight: 20 }}>{cat.get(info)?.blurb ?? ""}</T>
          <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}><T s={12.5} c={k.ink60}>{info === "mera" ? "Link a passkey in Settings, Security." : cat.get(info)?.status === "needskey" ? "This one needs setting up on the server before agents can use it." : "Always on for your agents."}</T></View>
        </WSheet>
      ) : null}
      {sheet?.kind === "add" ? (
        <WSheet open title="Add an integration" sub="Pick a tool, then choose which agents can use it." icon="plug" onClose={() => setSheet(null)}>
          {addable.map((id, i) => (
            <Rise key={id} delay={Math.min(i, 10) * 35} y={8}>
              <Pressable onPress={() => setSheet({ kind: "consent", draft: { connector: id, agents: [], perTxUsd: LIMITS.perTx.def, dailyUsd: LIMITS.daily.def, maxSlippageBps: LIMITS.slippageBps.def } })} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: k.line }}>
                <Logo id={id} size={42} /><View style={{ flex: 1 }}><T f="bold" s={15}>{INTEGRATION_META[id].name}</T><T s={12.5} c={k.ink60}>{INTEGRATION_META[id].chains}</T></View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={16} stroke={2.4} /></View>
              </Pressable>
            </Rise>
          ))}
        </WSheet>
      ) : null}
      {sheet?.kind === "consent" ? <ConsentSheet draft={sheet.draft} team={team} onClose={() => setSheet(null)} onDone={(r, days) => { setD(r); setSheet(null); setNote(`${INTEGRATION_META[sheet.draft.connector]?.name ?? "It"} is on until ${until(days)}`); }} /> : null}
      {sheet?.kind === "audit" ? <AuditSheet connector={sheet.connector} team={team} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/* ---------------- wallets ---------------- */

/** Wallets you linked, the active wallet and chain, and the withdraw-only-here rule. Linking runs through Privy on lexari.ai (the same account). */
export function WalletsSec() {
  const k = useC();
  const { token } = useSession();
  const [w, setW] = useState<WalletsReply | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { if (token) api<WalletsReply>("/api/wallets", {}, token).then(setW, (e) => setErr((e as Error).message)); }, [token]);
  useEffect(load, [load]);
  const pick = async (address: string, chain: string, key: string) => {
    tap(); setBusy(key);
    try { setW(await api<WalletsReply>("/api/wallets", { method: "PATCH", body: JSON.stringify({ address, chain }) }, token)); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const active = w?.active ? w.wallets.find((x) => x.address === w.active!.address) : undefined;
  const chain = WALLET_CHAINS.find((c) => c.id === w?.active?.chain);
  const linkOnWeb = () => Linking.openURL("https://app.lexari.ai/settings#wallets");
  const wl = useWalletLink(token);
  const linkHere = async (f: "solana" | "evm") => {
    tap(); setBusy(`link-${f}`); setErr("");
    try { const m = await wl.link(f); setErr(m === "Wallet linked" ? "" : m); load(); } catch (e) { setErr((e as Error).message || "Linking did not finish."); } finally { setBusy(null); }
  };
  const tile = (x: LinkedWallet, size = 40) => <View style={{ width: size, height: size, borderRadius: 13, backgroundColor: CLIENT_COLOR[x.client] ?? k.tint, alignItems: "center", justifyContent: "center" }}>{x.client === "lexari" ? <Icon name="wallet" size={size * 0.48} /> : <T f="bold" s={size * 0.4} c="#fff">{clientName(x.client).slice(0, 1)}</T>}</View>;
  return (
    <>
      <Hero icon="wallet" kicker="Withdrawals go to" title={active ? (active.login ? "Sign-in wallet" : clientName(active.client)) : w ? "None yet" : "…"} sub={active ? `${short(active.address, 5)}${chain ? ` · ${chain.name}${chain.network ? ` ${chain.network}` : ""}` : ""}` : undefined}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {WALLET_CHAINS.map((c) => {
            const on = w?.active?.chain === c.id;
            const target = active?.family === c.family ? active : w?.wallets.find((x) => x.family === c.family);
            return (
              <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ checked: on }} disabled={!!busy} onPress={() => (target ? void pick(target.address, c.id, c.id) : linkOnWeb())}
                style={{ height: 38, borderRadius: 999, paddingLeft: 6, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: on ? "#fff" : "rgba(255,255,255,0.15)", opacity: target ? 1 : 0.7 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: CHAIN_COLOR[c.id], alignItems: "center", justifyContent: "center", opacity: busy === c.id ? 0.5 : 1 }}>{on ? <Icon name="check" size={12} stroke={3} /> : null}</View>
                <T f="semi" s={13.5} c={on ? "#3a17c9" : "#fff"}>{c.name}</T>{!target ? <Icon name="plus" size={12} stroke={2.6} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Hero>
      {err ? <T s={13} c="#e5484d" style={{ marginTop: 12 }}>{err}</T> : null}
      <Head>Your wallets</Head>
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: k.line, backgroundColor: k.card, paddingHorizontal: 16 }}>
        {!w ? <T s={14} c={k.ink60} style={{ paddingVertical: 16 }}>Checking…</T> : w.wallets.map((x, i) => {
          const on = w.active?.address === x.address;
          return (
            <Rise key={x.address} delay={i * 50} y={8}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i === w.wallets.length - 1 ? 0 : 1, borderBottomColor: k.line }}>
                <Pressable onPress={() => !on && void pick(x.address, chain?.family === x.family ? chain.id : x.family === "solana" ? "solana" : "base", x.address)} accessibilityLabel={on ? "Active wallet" : `Make ${clientName(x.client)} active`}>
                  {tile(x)}
                  {on ? <PopIn style={{ position: "absolute", right: -4, bottom: -4 }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: GRAPE, borderWidth: 3, borderColor: k.card, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={9} stroke={3} /></View></PopIn> : null}
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <T f="semi" s={15}>{x.login ? "Sign-in wallet" : clientName(x.client)}</T>
                    <Chip label={x.family === "evm" ? "EVM" : "Solana"} color={k.ink60} bg={k.tint} />
                    {on ? <Chip label="Active" color={GRAPE} bg="rgba(91,43,255,0.12)" /> : null}
                  </View>
                  <Pressable onPress={() => Clipboard.setStringAsync(x.address)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}><Icon name="copy" size={11} color={k.ink45} /><T s={12} c={k.ink45}>{short(x.address, 5)}</T></Pressable>
                </View>
                {x.login ? <T f="semi" s={12} c={k.ink45}>Can't unlink</T>
                  : !on ? <Pressable onPress={() => void pick(x.address, x.family === "solana" ? "solana" : chain?.family === "evm" ? chain.id : "base", x.address)} style={{ height: 34, borderRadius: 17, backgroundColor: k.tint, paddingHorizontal: 12, justifyContent: "center" }}><T f="semi" s={13}>Make active</T></Pressable> : null}
              </View>
            </Rise>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {(["solana", "evm"] as const).map((f) => (
          <Pressable key={f} disabled={!!busy} onPress={() => void linkHere(f)} style={{ flex: 1, height: 48, borderRadius: 999, borderWidth: 1, borderColor: k.line, backgroundColor: k.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: f === "solana" ? CHAIN_COLOR.solana : CHAIN_COLOR.ethereum, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={13} stroke={2.6} /></View>
            <T f="bold" s={14}>{f === "solana" ? "Link Solana wallet" : "Link EVM wallet"}</T>
          </Pressable>
        ))}
      </View>
      <T s={12.5} c={k.ink60} style={{ marginTop: 8, lineHeight: 17 }}>{wl.inApp.solana ? "Privy checks the wallet is yours right here: your Solana wallet app signs a message (no fee). EVM wallets link on lexari.ai." : "Linking opens lexari.ai, where Privy checks the wallet is yours. It shows here right after."}</T>
      <View style={{ marginTop: 18, flexDirection: "row", gap: 12, borderRadius: 22, borderWidth: 1, borderColor: k.line, backgroundColor: k.card, padding: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(91,43,255,0.12)", alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={19} color={GRAPE} /></View>
        <View style={{ flex: 1 }}>
          <T f="semi" s={15}>Withdrawals go only to these wallets</T>
          <T s={13} c={k.ink60} style={{ marginTop: 2, lineHeight: 18 }}>When an agent sends funds back to you, it can only use a wallet listed here, and each send still waits for your Confirm. Paying any other address needs "Send to any address", which you turn on per integration.</T>
        </View>
      </View>
      <T s={12.5} c={k.ink45} style={{ marginTop: 14, lineHeight: 18 }}>Privy checks each wallet is yours with a signature (no transaction, no fee). Lexari keeps only the address.</T>
    </>
  );
}
