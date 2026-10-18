/** Port of webapp/components/security/SecurityCenter.tsx: balances privacy, anti-phishing phrase, money limits, saved addresses, devices and activity. */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Capped from "./Capped";
import { Pressable, Text, TextInput, View } from "react-native";
import Icon from "./Icon";
import { PhraseBadge } from "./StepUpSheet";
import { api } from "@/lib/api";
import { MASK, useHideBalance } from "@/lib/privacy";
import { useSession } from "@/state/session";
import { F, GRAPE, Label, WToggle, useC } from "@/web/kit";

type Sess = { id: string; device: string; network: string; createdAt: number; lastSeenAt: number; current: boolean };
type Addr = { id: string; chain: string; address: string; label: string; at: number };
type Ev = { id: string; kind: string; detail: string; device: string; at: number };
type Data = {
  settings: { phrase: string; dailySendCapUsd: number; allowlistOnly: boolean };
  sessions: Sess[]; addresses: Addr[]; events: Ev[]; movedTodayMicros: number; pin: boolean;
  stepup: { until: number; sendUsd: number }; limits: { defaultCapUsd: number; maxCapUsd: number };
};
type SetD = (f: (x: Data | null) => Data | null) => void;
type Say = (text: string) => void;

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 2 ? "Active now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-5)}`;
const CAPS = [0, 25, 100, 250, 1000];
const EV_ICON: Record<string, string> = { signin: "key", signout: "out", stepup: "lock", settings: "settings", address: "pin", send: "send", card: "file", email: "mail", budget: "wallet", integration: "plug" };
const RED = "#e5484d";

/** The security center's groups are px-4 on phones (max-[430px]:px-4); the rest of settings is px-5. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const k = useC();
  const kids = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={{ marginTop: 18 }}>
      <Label s={11} c={k.dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.5)"} style={{ lineHeight: 16.5, letterSpacing: 0.44, marginBottom: 4 }}>{title}</Label>
      <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 15 }}>
        {kids.map((c, i) => <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: k.line } : undefined}>{c}</View>)}
      </View>
    </View>
  );
}
function Row({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  const k = useC();
  return (
    <View style={{ paddingVertical: 16, gap: 10 }}>
      <View><Text style={{ fontFamily: F.semi, fontSize: 14.5, lineHeight: 21.75, color: k.ink }}>{title}</Text>{desc ? <Text style={{ marginTop: 2, fontFamily: F.reg, fontSize: 13.5, lineHeight: 18.56, color: k.ink60 }}>{desc}</Text> : null}</View>
      {children ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>{children}</View> : null}
    </View>
  );
}
function SmallBtn({ label, icon, onPress, disabled, brand }: { label: string; icon?: string; onPress: () => void; disabled?: boolean; brand?: boolean }) {
  const k = useC();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({ height: 40, borderRadius: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: brand || pressed ? GRAPE : k.tint, opacity: disabled ? 0.5 : 1 })}>
      {({ pressed }) => <>{icon ? <Icon name={icon} size={15} color={brand || pressed ? "#fff" : k.ink} /> : null}<Text style={{ fontFamily: F.semi, fontSize: 14, color: brand || pressed ? "#fff" : k.ink }}>{label}</Text></>}
    </Pressable>
  );
}
function Field(p: { value: string; onChangeText: (v: string) => void; placeholder: string; label: string; mono?: boolean }) {
  const k = useC();
  const [focus, setFocus] = useState(false);
  return <TextInput value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} accessibilityLabel={p.label} autoComplete="off" autoCorrect={false} autoCapitalize="none" spellCheck={false}
    placeholderTextColor={k.dark ? "rgba(255,255,255,0.4)" : "rgba(10,10,10,0.4)"} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
    style={{ height: 44, borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 16, fontFamily: p.mono ? F.mono : F.sans, fontSize: p.mono ? 13 : 14.5, color: k.ink, borderWidth: 2, borderColor: focus ? GRAPE : "transparent" }} />;
}

export default function SecurityCenter() {
  const k = useC();
  const { token } = useSession();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [hide, setHide] = useHideBalance();
  const say: Say = (t) => setNote(t);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 2600); return () => clearTimeout(t); }, [note]);
  const load = useCallback(() => { if (token) api<Data>("/api/security", {}, token).then((x) => { setD(x); setErr(""); }, (e) => setErr((e as Error).message || "Couldn't load your security settings.")); }, [token]);
  useEffect(() => { load(); }, [load]);
  const mask = (s: string) => (hide ? MASK : s);
  const save = async (patch: Partial<Data["settings"]>, done: string) => {
    try { const r = await api<{ settings: Data["settings"] }>("/api/security", { method: "PATCH", body: JSON.stringify(patch) }, token); setD((x) => (x ? { ...x, settings: r.settings } : x)); say(done); load(); }
    catch (e) { say((e as Error).message || "That didn't save."); }
  };
  return (
    <View testID="security-center">
      <Group title="Privacy">
        <Row title="Hide balances" desc="Shows •••• instead of your Lexari balance, agent wallets, history and card spend, on every device. Tap the eye next to any balance to switch.">
          <WToggle on={hide} onChange={setHide} label="Hide balances" />
        </Row>
      </Group>
      {note ? <Text accessibilityLiveRegion="polite" style={{ marginTop: 10, fontFamily: F.semi, fontSize: 12.5, color: k.brandInk }}>{note}</Text> : null}
      {err ? <Text accessibilityRole="alert" style={{ marginTop: 16, borderRadius: 16, backgroundColor: "#fde8e8", padding: 12, fontFamily: F.semi, fontSize: 13.5, color: "#b42318", overflow: "hidden" }}>{err}</Text> : null}
      {d ? <>
        <Phrase d={d} save={save} />
        <Group title="Money protection">
          <Row title="Daily money limit" desc={<>The most your agents can send, pay or trade, plus wallet sends they prepare, in 24 hours. <Text style={{ fontFamily: F.semi, color: k.ink75 }}>{mask(`$${(d.movedTodayMicros / 1e6).toFixed(2)}`)} used</Text>.</>}>
            <View accessibilityRole="radiogroup" accessibilityLabel="Daily money limit" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {CAPS.map((c) => { const on = d.settings.dailySendCapUsd === c; return (
                <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { if (!on) void save({ dailySendCapUsd: c }, c === 0 ? "Agents can't move money now" : `Daily limit is $${c}`); }}
                  style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: "center", backgroundColor: on ? GRAPE : k.tint }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: on ? "#fff" : k.ink75 }}>${c.toLocaleString("en-US")}</Text>
                </Pressable>
              ); })}
            </View>
          </Row>
          <Row title="Saved addresses only" desc="Agents can only send to addresses in your list below. Anything else is blocked.">
            <WToggle on={d.settings.allowlistOnly} onChange={(v) => void save({ allowlistOnly: v }, v ? "Only saved addresses now" : "Any address, with a warning for new ones")} label="Saved addresses only" />
          </Row>
          <Row title="Confirm it's you" desc={`Sends of $${d.stepup.sendUsd} or more, first-time addresses, new API keys, raising budgets or limits and changing where mail goes ask for ${d.pin ? "your PIN" : "a wallet signature"} first. ${d.pin ? "" : "Set an app PIN below to use a PIN instead."}`} />
        </Group>
        <Addresses d={d} setD={setD} say={say} />
        <Sessions d={d} setD={setD} say={say} />
        <Group title="Recent security activity">
          <Capped n={Math.min(d.events.length, 40)}>{d.events.length ? d.events.slice(0, 40).map((e) => (
            <View key={e.id} testID={`sec-event-${e.kind}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={EV_ICON[e.kind] || "info"} size={15} color={k.ink75} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 14, lineHeight: 19.25, color: k.ink }}>{e.detail}</Text>
                <Text style={{ fontFamily: F.reg, fontSize: 12, lineHeight: 16, color: k.dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.5)" }}>{[e.device, ago(e.at)].filter(Boolean).join(" · ")}</Text>
              </View>
            </View>
          )) : <Row title="Nothing yet" desc="Sign-ins and security changes show here." />}</Capped>
        </Group>
      </> : null}
      {!d && !err ? <View style={{ marginTop: 24, height: 160, borderRadius: 22, backgroundColor: k.tint }} /> : null}
    </View>
  );
}

function Phrase({ d, save }: { d: Data; save: (p: Partial<Data["settings"]>, done: string) => Promise<void> }) {
  const k = useC();
  const [edit, setEdit] = useState(!d.settings.phrase);
  const [v, setV] = useState("");
  const ok = v.trim().length >= 3;
  const submit = () => { if (ok) void save({ phrase: v.trim() }, "Security phrase saved").then(() => setEdit(false)); };
  return (
    <Group title="Anti-phishing phrase">
      <View style={{ paddingVertical: 16 }}>
        <Text style={{ fontFamily: F.reg, fontSize: 13.5, lineHeight: 18.56, color: k.dark ? "rgba(255,255,255,0.65)" : "rgba(10,10,10,0.65)" }}>A few words only you know. Lexari shows them on every confirm and payment screen. If a screen asks you to confirm and your phrase isn't on it, it's not Lexari: close it.</Text>
        {d.settings.phrase && !edit ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <PhraseBadge phrase={d.settings.phrase} />
            <View style={{ flexDirection: "row" }}><SmallBtn icon="edit" label="Change" onPress={() => { setEdit(true); setV(""); }} /></View>
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Field value={v} onChangeText={(t) => setV(t.replace(/[<>]/g, "").slice(0, 40))} placeholder="e.g. purple mango at noon" label="Security phrase" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {d.settings.phrase ? <SmallBtn label="Cancel" onPress={() => setEdit(false)} /> : null}
              <SmallBtn brand label="Save" disabled={!ok} onPress={submit} />
            </View>
          </View>
        )}
      </View>
    </Group>
  );
}

function Addresses({ d, setD, say }: { d: Data; setD: SetD; say: Say }) {
  const k = useC();
  const { token } = useSession();
  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { const r = await api<{ addresses: Addr[] }>("/api/security/addresses", { method: "POST", body: JSON.stringify({ address: addr.trim(), label: label.trim() }) }, token); setD((x) => (x ? { ...x, addresses: r.addresses } : x)); setAddr(""); setLabel(""); setOpen(false); say("Address saved"); }
    catch (e) { say((e as Error).message || "Couldn't save that address."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { const r = await api<{ addresses: Addr[] }>("/api/security/addresses", { method: "POST", body: JSON.stringify({ remove: id }) }, token); setD((x) => (x ? { ...x, addresses: r.addresses } : x)); say("Address removed"); }
    catch (e) { say((e as Error).message || "Couldn't remove it."); }
  };
  return (
    <Group title="Saved addresses">
      <Capped n={d.addresses.length}>{d.addresses.map((a) => (
        <View key={a.id} testID="saved-address" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(91,43,255,0.12)", alignItems: "center", justifyContent: "center" }}><Icon name="verified" size={15} color={k.brandInk} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.semi, fontSize: 14, color: k.ink }}>{a.label || "Saved address"}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: k.dark ? "rgba(255,255,255,0.55)" : "rgba(10,10,10,0.55)" }}>{short(a.address)} · {a.chain === "evm" ? "EVM" : "Solana"}</Text>
          </View>
          <Pressable accessibilityLabel={`Remove ${a.label || short(a.address)}`} onPress={() => void remove(a.id)} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? k.tint : "transparent" })}>
            {({ pressed }) => <Icon name="trash" size={15} color={pressed ? RED : (k.dark ? "rgba(255,255,255,0.55)" : "rgba(10,10,10,0.55)")} />}
          </Pressable>
        </View>
      ))}</Capped>
      {open ? (
        <View style={{ gap: 8, paddingVertical: 16 }}>
          <Field mono value={addr} onChangeText={(t) => setAddr(t.trim())} placeholder="Solana or 0x… address" label="Address" />
          <Field value={label} onChangeText={(t) => setLabel(t.replace(/[<>]/g, "").slice(0, 40))} placeholder="Name (e.g. My Phantom)" label="Name" />
          <Text style={{ fontFamily: F.reg, fontSize: 12.5, color: k.dark ? "rgba(255,255,255,0.55)" : "rgba(10,10,10,0.55)" }}>Check every character. You'll confirm it's you before it's saved.</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SmallBtn label="Cancel" onPress={() => setOpen(false)} />
            <SmallBtn brand label={busy ? "Saving…" : "Save address"} disabled={busy || addr.length < 32} onPress={() => void add()} />
          </View>
        </View>
      ) : (
        <Row title={d.addresses.length ? `${d.addresses.length} saved` : "No saved addresses"} desc="Sends to an address that isn't here and that you've never used show a warning first.">
          <SmallBtn icon="plus" label="Add" onPress={() => setOpen(true)} />
        </Row>
      )}
    </Group>
  );
}

function Sessions({ d, setD, say }: { d: Data; setD: SetD; say: Say }) {
  const k = useC();
  const { token } = useSession();
  const [busy, setBusy] = useState(false);
  const end = async (body: { id: string } | { others: true }) => {
    setBusy(true);
    try { const r = await api<{ ended: number; sessions: Sess[] }>("/api/security/sessions", { method: "POST", body: JSON.stringify(body) }, token); setD((x) => (x ? { ...x, sessions: r.sessions } : x)); say(r.ended ? `Signed out ${r.ended} ${r.ended === 1 ? "device" : "devices"}` : "No other devices"); }
    catch (e) { say((e as Error).message || "Couldn't sign that out."); }
    finally { setBusy(false); }
  };
  const others = d.sessions.filter((x) => !x.current).length;
  const dim = k.dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.5)";
  return (
    <Group title="Where you're signed in">
      <Capped n={d.sessions.length}>{d.sessions.map((x) => (
        <View key={x.id} testID={`session-${x.current ? "current" : "other"}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: x.current ? GRAPE : k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={/iPhone|Android|iPad/.test(x.device) ? "phone" : "laptop"} size={15} color={x.current ? "#fff" : k.ink75} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.semi, fontSize: 14, color: k.ink }}>{x.device}</Text>
              {x.current ? <View style={{ borderRadius: 999, backgroundColor: "rgba(91,43,255,0.12)", paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontFamily: F.bold, fontSize: 11, color: k.brandInk }}>This device</Text></View> : null}
            </View>
            <Text numberOfLines={1} style={{ fontFamily: F.reg, fontSize: 12, color: dim }}>{[x.network && `Network ${x.network}`, x.current ? "Active now" : ago(x.lastSeenAt)].filter(Boolean).join(" · ")}</Text>
          </View>
          {!x.current ? <Pressable onPress={() => void end({ id: x.id })} disabled={busy} style={({ pressed }) => ({ height: 36, borderRadius: 18, paddingHorizontal: 12, justifyContent: "center", backgroundColor: pressed ? "#fde8e8" : "transparent", opacity: busy ? 0.5 : 1 })}><Text style={{ fontFamily: F.bold, fontSize: 13, color: RED }}>Sign out</Text></Pressable> : null}
        </View>
      ))}</Capped>
      <Row title="Sign out everywhere else" desc={others ? `Ends ${others} other ${others === 1 ? "session" : "sessions"}. This device stays signed in.` : "You're only signed in here."}>
        <SmallBtn icon="out" label="Sign out others" disabled={busy || !others} onPress={() => void end({ others: true })} />
      </Row>
    </Group>
  );
}
