/** Ports of webapp/components/email/MailSheet.tsx and webapp/components/tasks/TasksSheet.tsx (opened from the chat header). */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { AgentTile, F, GRAPE, Label, T, WSheet, useC } from "@/web/kit";
import { TaskRow, type TaskView } from "@/web/chat/cards";

type MailItem = { id: string; dir: "in" | "out"; status: string; kind: "mail" | "forward_verify"; from: string; fromName: string; to: string[]; subject: string; snippet: string; at: number; read: boolean; verify?: { service: string; code?: string; link?: string; for?: string } | null };
type Box = { agent: string; address: string; mode: string; senderMode: "agent" | "user"; replyTo: string | null; unread: number };
type MailState = { box: Box; inbox: MailItem[]; sent: MailItem[] };
const when = (t: number) => { const d = new Date(t); return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }); };
const initial = (m: MailItem) => ((m.dir === "out" ? m.to[0] : m.fromName || m.from) || "?").trim()[0]?.toUpperCase() || "?";

function Seg<K extends string>({ items, on, set, brand }: { items: readonly (readonly [K, string])[]; on: K; set: (k: K) => void; brand?: boolean }) {
  const k = useC();
  return (
    <View style={{ flex: 1, flexDirection: "row", borderRadius: 999, backgroundColor: k.tint, padding: 4 }}>
      {items.map(([id, l]) => <Pressable key={id} onPress={() => set(id)} style={{ flex: 1, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: on === id ? (brand ? GRAPE : k.card) : "transparent" }}><T f="bold" s={12.5} c={on === id ? (brand ? "#fff" : k.ink) : k.ink60} lines={1}>{l}</T></Pressable>)}
    </View>
  );
}
function IBtn({ icon, label, onPress, busy }: { icon: string; label: string; onPress: () => void; busy?: boolean }) {
  const k = useC();
  return <Pressable accessibilityLabel={label} onPress={onPress} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}>{busy ? <ActivityIndicator color={GRAPE} size="small" /> : <Icon name={icon} size={16} color={k.ink} />}</Pressable>;
}
function Back({ label, onPress }: { label: string; onPress: () => void }) {
  const k = useC();
  return <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 32, marginBottom: 8 }}><Icon name="back" size={15} color={k.ink75} /><T f="bold" s={12.5} c={k.ink75}>{label}</T></Pressable>;
}

export function MailSheet({ open, onClose, agent, name, onAsk, onUnread }: { open: boolean; onClose: () => void; agent: string; name: string; onAsk: (text: string) => void; onUnread?: (n: number) => void }) {
  const k = useC();
  const { token } = useSession();
  const [st, setSt] = useState<MailState | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"in" | "out">("in");
  const [view, setView] = useState<{ kind: "list" } | { kind: "read"; id: string } | { kind: "setup" }>({ kind: "list" });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const load = useCallback(async () => {
    try { const r = await api<MailState>(`/api/email/${encodeURIComponent(agent)}`, {}, token); setSt(r); onUnread?.(r.box.unread); setErr(""); }
    catch { setErr("Couldn't open the inbox."); }
  }, [agent, token]);
  useEffect(() => { if (!open) return; setView({ kind: "list" }); void load(); const t = setInterval(() => void load(), 20_000); return () => clearInterval(t); }, [open, load]);
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const copy = (text: string, what: string) => { void Clipboard.setStringAsync(text).then(() => say(`${what} copied`)); };
  const test = async (kind: "mail" | "gmail_verify") => {
    setBusy(kind);
    try { await api(`/api/email/${encodeURIComponent(agent)}/test`, { method: "POST", body: JSON.stringify({ kind }) }, token); await load(); setTab("in"); say(kind === "mail" ? "A test email arrived" : "A Gmail confirmation arrived"); }
    catch { say("Couldn't add a test email."); } finally { setBusy(null); }
  };
  const ask = (t: string) => { onClose(); onAsk(t); };
  const box = st?.box;
  const verify = st?.inbox.find((m) => m.kind === "forward_verify" && !m.read);
  const list = tab === "in" ? st?.inbox ?? [] : st?.sent ?? [];
  const sub: ReactNode = box ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <T s={11.5} c={k.ink75} style={{ fontFamily: F.mono, flexShrink: 1, lineHeight: 14 }}>{box.address}</T>
      <Pressable accessibilityLabel="Copy address" onPress={() => copy(box.address, "Address")} style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}><Icon name="copy" size={13} color={k.ink60} /></Pressable>
    </View>
  ) : "Loading…";
  return (
    <WSheet open={open} onClose={onClose} title={view.kind === "setup" ? "Forwarding" : `${name}'s email`} sub={sub} iconNode={<AgentTile slug={agent} size={40} dot={false} />}>
      {!st ? (err ? <View style={{ paddingVertical: 24, alignItems: "center" }}><T s={13.5} c={k.ink60}>{err}</T><Pressable onPress={() => void load()}><T f="bold" s={13.5} c={k.brandInk}>Try again</T></Pressable></View> : <View style={{ height: 160, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={GRAPE} /></View>)
        : view.kind === "read" ? <ReadView id={view.id} name={name} onBack={() => { setView({ kind: "list" }); void load(); }} onAsk={ask} />
        : view.kind === "setup" ? <Setup st={st} agent={agent} name={name} onBack={() => setView({ kind: "list" })} onSaved={(b) => setSt({ ...st, box: b })} copy={copy} onTest={() => void test("gmail_verify").then(() => setView({ kind: "list" }))} />
        : (
          <View>
            {st.box.mode === "mock" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, backgroundColor: "#fff8e6", paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#f5a524" }} /><T f="semi" s={11.5} c="#8a5a00" style={{ flex: 1 }}>Test mode: mail stays inside Lexari until email is switched on.</T></View> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Seg items={[["in", `Inbox${st.box.unread ? ` · ${st.box.unread}` : ""}`], ["out", "Sent"]] as const} on={tab} set={setTab} />
              <IBtn icon="forward" label="Forwarding and sending" onPress={() => setView({ kind: "setup" })} />
              {st.box.mode === "mock" ? <IBtn icon="inbox" label="Add a test email" busy={busy === "mail"} onPress={() => void test("mail")} /> : null}
            </View>
            {verify?.verify && tab === "in" ? (
              <View style={{ marginTop: 10, borderRadius: 18, backgroundColor: "rgba(26,115,232,0.10)", borderWidth: 1, borderColor: "rgba(26,115,232,0.35)", padding: 12 }}>
                <Pressable onPress={() => setView({ kind: "read", id: verify.id })}>
                  <T f="bold" s={13.5}>{`${verify.verify.service} wants to confirm forwarding`}</T>
                  <T s={12} c={k.ink60} style={{ marginTop: 2, lineHeight: 16 }}>{`${verify.verify.for ? `${verify.verify.for} asked to forward mail here. ` : ""}Confirm it in ${verify.verify.service} to start forwarding.`}</T>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  {verify.verify.code ? <Pressable onPress={() => copy(verify.verify!.code!, "Code")} style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="copy" size={13} color={k.ink} /><T f="bold" s={13} style={{ fontFamily: F.mono }}>{verify.verify.code}</T></Pressable> : null}
                  {verify.verify.link ? <Pressable onPress={() => Linking.openURL(verify.verify!.link!)} style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: "#1a73e8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><T f="bold" s={13} c="#fff">Confirm</T><Icon name="arrow" size={13} color="#fff" /></Pressable> : null}
                </View>
              </View>
            ) : null}
            {list.length === 0 ? (
              <View style={{ paddingVertical: 28, alignItems: "center" }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={tab === "in" ? "inbox" : "send"} size={22} color={k.ink45} /></View>
                <T s={13} c={k.ink60} style={{ marginTop: 8, textAlign: "center" }}>{tab === "in" ? `Nothing yet. Forward mail to ${name}, or anyone can write to the address above.` : `Ask ${name} to write an email. You approve every one before it goes.`}</T>
                {tab === "in" ? <Pressable onPress={() => setView({ kind: "setup" })} style={{ marginTop: 12, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: GRAPE, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="forward" size={14} color="#fff" /><T f="bold" s={12.5} c="#fff">Set up forwarding</T></Pressable> : null}
              </View>
            ) : (
              <View style={{ marginTop: 10, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, overflow: "hidden" }}>
                {list.map((m, i) => (
                  <Pressable key={m.id} onPress={() => setView({ kind: "read", id: m.id })} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: m.kind === "forward_verify" ? "#1a73e8" : m.read ? k.tint : GRAPE }}>{m.kind === "forward_verify" ? <Icon name="forward" size={14} color="#fff" /> : <T f="bold" s={13} c={m.read ? k.ink60 : "#fff"}>{initial(m)}</T>}</View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}><T f={m.read ? "semi" : "bold"} s={13.5} c={m.read ? k.ink75 : k.ink} lines={1} style={{ flex: 1 }}>{m.dir === "out" ? `To ${m.to.join(", ")}` : m.fromName || m.from}</T><T s={11} c={k.ink45}>{when(m.at)}</T></View>
                      <T f={m.read ? undefined : "semi"} s={12.5} c={m.read ? k.ink60 : k.ink} lines={1}>{m.subject || "(no subject)"}</T>
                      <T s={11.5} c={k.ink45} lines={1}>{m.status === "draft" ? "Draft · waiting for you in chat" : m.status === "failed" ? "Failed to send" : m.snippet}</T>
                    </View>
                    {!m.read ? <View style={{ marginTop: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: GRAPE }} /> : null}
                  </Pressable>
                ))}
              </View>
            )}
            {st.inbox.length > 0 && tab === "in" ? <Pressable onPress={() => ask("Summarize my inbox: what's new, what needs a reply, and anything urgent.")} style={{ marginTop: 12, height: 42, borderRadius: 16, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="spark" size={15} color={k.brandInk} /><T f="bold" s={13} c={k.brandInk}>{`Ask ${name} to summarize`}</T></Pressable> : null}
          </View>
        )}
      {toast ? <View style={{ marginTop: 10, alignSelf: "center", borderRadius: 14, backgroundColor: k.ink, paddingHorizontal: 12, paddingVertical: 6 }}><T f="semi" s={12.5} c={k.bg}>{toast}</T></View> : null}
    </WSheet>
  );
}

function ReadView({ id, name, onBack, onAsk }: { id: string; name: string; onBack: () => void; onAsk: (t: string) => void }) {
  const k = useC();
  const { token } = useSession();
  const [m, setM] = useState<(MailItem & { text: string }) | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ mail: MailItem & { text: string } }>(`/api/email/item/${id}`, {}, token).then((r) => setM(r.mail), () => setErr("Couldn't open that email.")); }, [id]);
  const Line = ({ a, b }: { a: string; b: string }) => <View style={{ flexDirection: "row", gap: 8 }}><T s={12} c={k.ink45} style={{ width: 40 }}>{a}</T><T s={12} c={k.ink75} style={{ flex: 1 }}>{b}</T></View>;
  return (
    <View>
      <Back label="Back" onPress={onBack} />
      {!m ? (err ? <T s={13} c={k.ink60}>{err}</T> : <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={GRAPE} /></View>) : (
        <>
          <T f="bold" s={16} style={{ lineHeight: 21 }}>{m.subject || "(no subject)"}</T>
          <View style={{ marginTop: 8, gap: 2 }}>
            <Line a="From" b={m.fromName ? `${m.fromName} <${m.from}>` : m.from} /><Line a="To" b={m.to.join(", ")} />
            <Line a="Date" b={new Date(m.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} />
          </View>
          <ScrollView style={{ marginTop: 12, maxHeight: 320, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}><T s={13} c={k.ink75} style={{ lineHeight: 19 }}>{m.text || "(no text)"}</T></ScrollView>
          {m.dir === "in" && m.kind === "mail" ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable onPress={() => onAsk(`Summarize the email "${m.subject}" from ${m.fromName || m.from} (id ${m.id.slice(0, 8)}) and tell me what I need to do.`)} style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="spark" size={15} color={k.ink} /><T f="bold" s={13}>Summarize</T></Pressable>
              <Pressable onPress={() => onAsk(`Draft a reply to the email "${m.subject}" from ${m.fromName || m.from} (id ${m.id.slice(0, 8)}).`)} style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: GRAPE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="reply" size={15} color="#fff" /><T f="bold" s={13} c="#fff" lines={1}>{`Reply with ${name}`}</T></Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function Setup({ st, agent, name, onBack, onSaved, copy, onTest }: { st: MailState; agent: string; name: string; onBack: () => void; onSaved: (b: Box) => void; copy: (t: string, w: string) => void; onTest: () => void }) {
  const k = useC();
  const { token } = useSession();
  const [you, setYou] = useState(st.box.replyTo || "");
  const [mode, setMode] = useState(st.box.senderMode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [how, setHow] = useState<"gmail" | "outlook">("gmail");
  const dirty = you.trim() !== (st.box.replyTo || "") || mode !== st.box.senderMode;
  const save = async () => {
    setBusy(true); setErr("");
    try { onSaved((await api<{ box: Box }>(`/api/email/${encodeURIComponent(agent)}`, { method: "PUT", body: JSON.stringify({ replyTo: you.trim() || null, senderMode: mode }) }, token)).box); }
    catch { setErr("Couldn't save. Try again."); } finally { setBusy(false); }
  };
  const steps = how === "gmail"
    ? ["Gmail on the web: Settings (gear) → See all settings → Forwarding and POP/IMAP.", "Add a forwarding address and paste the address above.", `Gmail sends a confirmation to ${name}. It shows up in this inbox with a code and a Confirm button.`, "Confirm, then pick Forward a copy of incoming mail to it (or a filter for just some mail)."]
    : ["Outlook on the web: Settings → Mail → Forwarding.", "Turn on Enable forwarding and paste the address above.", "Tick Keep a copy of forwarded messages, then Save. No code needed.", "Work accounts may need IT to allow forwarding outside the company."];
  return (
    <View>
      <Back label="Inbox" onPress={onBack} />
      <Pressable onPress={() => copy(st.box.address, "Address")} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, backgroundColor: "rgba(91,43,255,0.10)", borderWidth: 1, borderColor: "rgba(91,43,255,0.30)", paddingHorizontal: 12, paddingVertical: 10 }}><Icon name="mail" size={16} color={k.brandInk} /><T f="semi" s={12.5} lines={1} style={{ flex: 1, fontFamily: F.mono }}>{st.box.address}</T><Icon name="copy" size={14} color={k.ink60} /></Pressable>
      <View style={{ flexDirection: "row", marginTop: 12 }}><Seg items={[["gmail", "Gmail"], ["outlook", "Outlook"]] as const} on={how} set={setHow} /></View>
      <View style={{ marginTop: 10, gap: 6 }}>{steps.map((t, i) => <View key={i} style={{ flexDirection: "row", gap: 8 }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="bold" s={10.5}>{String(i + 1)}</T></View><T s={12.5} c={k.ink75} style={{ flex: 1, lineHeight: 17 }}>{t}</T></View>)}</View>
      <Label s={9} c={k.ink45} style={{ marginTop: 16 }}>Sending</Label>
      <T f="semi" s={12} c={k.ink75} style={{ marginTop: 6 }}>Your email</T>
      <TextInput value={you} onChangeText={(v) => setYou(v.slice(0, 254))} keyboardType="email-address" autoCapitalize="none" placeholder="you@gmail.com" placeholderTextColor={k.ink45} style={{ marginTop: 4, height: 42, borderRadius: 14, borderWidth: 1, borderColor: k.line, backgroundColor: k.tint, color: k.ink, paddingHorizontal: 12, fontSize: 14 }} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {([["agent", name, "From the agent"], ["user", "You via Lexari", "Replies come to you"]] as const).map(([id, t, d]) => (
          <Pressable key={id} onPress={() => setMode(id)} style={{ flex: 1, borderRadius: 16, padding: 10, backgroundColor: mode === id ? "rgba(91,43,255,0.12)" : k.card, borderWidth: mode === id ? 2 : 1, borderColor: mode === id ? GRAPE : k.line }}><T f="bold" s={13} lines={1}>{t}</T><T s={11.5} c={k.ink60}>{d}</T></Pressable>
        ))}
      </View>
      {err ? <T s={12.5} c="#e5484d" style={{ marginTop: 8 }}>{err}</T> : null}
      <Pressable disabled={!dirty || busy} onPress={() => void save()} style={{ marginTop: 12, height: 40, borderRadius: 20, backgroundColor: GRAPE, opacity: !dirty || busy ? 0.45 : 1, alignItems: "center", justifyContent: "center" }}>{busy ? <ActivityIndicator color="#fff" /> : <T f="bold" s={14} c="#fff">Save</T>}</Pressable>
      {st.box.mode === "mock" ? <Pressable onPress={onTest} style={{ marginTop: 10, alignItems: "center" }}><T f="bold" s={12} c={k.brandInk}>Try a Gmail confirmation (test)</T></Pressable> : null}
    </View>
  );
}

export function TasksSheet({ open, onClose, agent, name, tasks, now, onDesktop, onChange }: { open: boolean; onClose: () => void; agent: string; name: string; tasks: TaskView[]; now: number; onDesktop: () => void; onChange: (t: TaskView | null, id: string) => void }) {
  const k = useC();
  const running = tasks.filter((t) => t.status === "running" || t.status === "waiting");
  const scheduled = tasks.filter((t) => t.kind === "schedule");
  const done = tasks.filter((t) => t.kind !== "schedule" && !(t.status === "running" || t.status === "waiting"));
  const [tab, setTab] = useState<"now" | "sched" | "done">("now");
  useEffect(() => { if (open) setTab(running.length ? "now" : scheduled.length ? "sched" : "done"); }, [open]);
  const rows = tab === "now" ? running : tab === "sched" ? scheduled : done;
  return (
    <WSheet open={open} onClose={onClose} title="Tasks" sub={`What ${name} is doing on its computer`} iconNode={<AgentTile slug={agent} size={40} dot={false} />}>
      <View style={{ flexDirection: "row" }}><Seg items={[["now", `Running${running.length ? ` · ${running.length}` : ""}`], ["sched", `Scheduled${scheduled.length ? ` · ${scheduled.length}` : ""}`], ["done", "Done"]] as const} on={tab} set={setTab} /></View>
      {rows.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={tab === "sched" ? "clock" : "jobs"} size={22} color={k.ink45} /></View>
          <T s={13} c={k.ink60} style={{ marginTop: 10 }}>{tab === "now" ? "Nothing running right now." : tab === "sched" ? "No scheduled tasks." : "Nothing finished yet."}</T>
        </View>
      ) : (
        <View style={{ marginTop: 12, gap: 6 }}>
          {rows.map((t) => <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: k.bg, borderWidth: 1, borderColor: k.line, paddingHorizontal: 10, paddingVertical: 8, overflow: "hidden" }}><TaskRow t={t} r={t} now={now} onDesktop={onDesktop} onChange={onChange} /></View>)}
        </View>
      )}
    </WSheet>
  );
}
