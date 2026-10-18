/** Chat cards ported from the web phone chat: TxReceipt, SendCard (fund + transfer), MeetCard, TaskCard, SecretCardView,
 * TakeoverCardView, ActionCardView, EmailCardView, FileCard and the screenshots strip. Same words, colours and states. */
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Modal, Pressable, Share, TextInput, View } from "react-native";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import Icon from "@/components/Icon";
import { biometricGate } from "@/components/Gates";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { signAndSend } from "@/lib/mwa";
import { useSession } from "@/state/session";
import { F, GRAPE, Label, T, short, useC } from "@/web/kit";
import { useData } from "@/web/data";
import AgentFace from "@/components/AgentFace";

export type Tx = { id?: string; kind: string; status: string; sol?: number; amount?: string; to?: string; from?: string; label?: string; sig?: string; url?: string; net?: string; balance?: number; error?: string };
export type SendAsk = { kind?: string; to: string; sol: number; usd?: number; agent?: string; reason?: string; status: string; sig?: string; firstTime?: boolean; valueUsd?: number; error?: string; returned?: { sig?: string; sol?: number; usd?: number } };
export type MeetAsk = { url: string; platform: string; as?: "me" | "agent"; taskId?: string; agentName?: string; userName?: string };
export type TaskRef = { id: string; kind: string; title: string };
export type TaskView = { id: string; kind: string; status: string; title: string; agent: string; phase?: string; detail?: string; createdAt: number; finishedAt?: number; joinedAt?: number; secs?: number; every?: string; nextRun?: number; link?: string };
export type SecretCard = { id: string; name: string; label: string; service?: string; why?: string; status: string; agent?: string };
export type ActionCard = { id: string; title?: string; status: string; usd: number; rows?: [string, string][]; network?: string; sig?: string; explorer?: string; error?: string; connector?: string; tool?: string };
export type EmailCard = { id: string; subject?: string; fromLabel?: string; to: string[]; from: string; replyTo?: string; text: string; status: string; mock?: boolean; sentAt?: number; error?: string };
export type CardFile = { id: string; name: string; size: number | string; mime?: string; kind?: string };

const OK_BG = "#e7f8ee", OK_FG = "#137a3d", BAD = "#e5484d";
const txUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}${env.cluster === "mainnet-beta" ? "" : "?cluster=devnet"}`;
const sol = (n: number) => `${+n.toFixed(6)} SOL`;
export const fileUri = (id: string) => `${env.apiUrl}/api/files/${encodeURIComponent(id)}`;
export const shotUri = (reply: string, n: number) => `${env.apiUrl}/api/computer/shot/${encodeURIComponent(reply)}/${n}`;
const sizeLabel = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);
const typeLabel = (f: CardFile) => /\.([A-Za-z0-9]{1,5})$/.exec(f.name)?.[1]?.toUpperCase() || (f.mime?.startsWith("image/") ? f.mime.slice(6).toUpperCase() : "FILE");

function useAuthed() { const { token } = useSession(); return token && token !== "preview" ? { Authorization: `Bearer ${token}` } : undefined; }
function Spin({ c = "#fff" }: { c?: string }) { return <ActivityIndicator size="small" color={c} />; }
function Box({ children, w = 340, style }: { children: React.ReactNode; w?: number; style?: object }) {
  const k = useC();
  return <View style={[{ marginTop: 6, width: "100%", maxWidth: w, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, overflow: "hidden" }, style]}>{children}</View>;
}
function Btn({ label, onPress, brand, disabled, flex, icon }: { label: string; onPress: () => void; brand?: boolean; disabled?: boolean; flex?: number; icon?: string }) {
  const k = useC();
  return (
    <Pressable disabled={disabled} onPress={onPress} style={{ flex, height: 36, borderRadius: 18, paddingHorizontal: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: brand ? GRAPE : "transparent", borderWidth: brand ? 0 : 1.5, borderColor: k.line, opacity: disabled ? 0.6 : 1 }}>
      {icon ? <Icon name={icon} size={15} color={brand ? "#fff" : k.ink} /> : null}
      <T f="bold" s={13.5} c={brand ? "#fff" : k.ink}>{label}</T>
    </Pressable>
  );
}
function Row({ k: key, v, mono }: { k: string; v: string; mono?: boolean }) {
  const k = useC();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 6 }}><T s={13.5} c={k.ink60}>{key}</T><T f={mono ? "monoB" : "sans"} s={13.5} style={{ flexShrink: 1, textAlign: "right" }}>{v}</T></View>;
}
function OkLine({ text, sig, url }: { text: string; sig?: string; url?: string }) {
  return (
    <Pressable onPress={() => (url ? Linking.openURL(url) : sig && Linking.openURL(txUrl(sig)))} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: OK_BG, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Icon name="check" size={14} color={OK_FG} /><T f="bold" s={13} c={OK_FG} style={{ flex: 1 }}>{text}</T><Icon name="arrow" size={13} color={OK_FG} />
    </Pressable>
  );
}

const TITLE: Record<string, string> = { send: "Sent", fund: "Funded task", return: "Leftover returned", hire: "Hire paid", plan: "Plan paid", card: "Card paid", mint: "ID card minted", incoming: "Received", pay: "Agent paid", topup: "Balance topped up" };
const NOT: Record<string, string> = { send: "Send", fund: "Funding", return: "Return", hire: "Hire payment", plan: "Plan payment", card: "Card payment", mint: "Mint", incoming: "Incoming", pay: "Agent payment", topup: "Top up" };
/** The compact receipt row in chat (TxReceipt.tsx). */
export function TxReceipt({ tx }: { tx: Tx }) {
  const k = useC();
  const st = tx.status;
  const [bg, fg] = st === "confirmed" ? [OK_BG, OK_FG] : st === "failed" ? ["rgba(229,72,77,0.1)", "#c7353a"] : st === "cancelled" ? [k.tint, k.ink60] : ["#fff6d6", "#8a6500"];
  const title = st === "cancelled" ? `${NOT[tx.kind]} cancelled` : st === "failed" ? `${NOT[tx.kind]} failed` : st === "pending" ? `${NOT[tx.kind]} pending` : TITLE[tx.kind] || "Sent";
  const who = tx.kind === "incoming" ? `from ${tx.label || short(tx.from)}` : tx.kind === "mint" ? "" : tx.to ? `to ${tx.label || short(tx.to)}` : "";
  const sub = (st === "pending" ? `Waiting for ${tx.net || "Solana"}…` : st === "confirmed" ? `Confirmed on ${tx.net || "Solana"}${tx.balance !== undefined && tx.balance >= 0 ? ` · balance ${sol(tx.balance)}` : ""}` : st === "failed" ? tx.error || "Didn't go through" : "Nothing was sent") + (tx.sig ? ` · ${short(tx.sig)}` : "");
  return (
    <View style={{ marginVertical: 8, alignItems: "center" }}>
      <Pressable disabled={!tx.sig} onPress={() => Linking.openURL(tx.url || txUrl(tx.sig!))} style={{ width: "100%", maxWidth: 340, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: bg }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: st === "confirmed" ? OK_FG : st === "failed" ? BAD : st === "cancelled" ? "rgba(128,128,128,0.3)" : "#ffd84d" }}>
          {st === "pending" ? <Spin c="#0a0a0a" /> : <Icon name={st === "confirmed" ? "check" : "x"} size={12} stroke={3} color={st === "cancelled" ? k.ink75 : st === "pending" ? "#0a0a0a" : "#fff"} />}
        </View>
        <View style={{ flex: 1 }}>
          <T f="bold" s={12.5} c={fg}>{`${title}${tx.amount ? ` · ${tx.amount}` : tx.sol ? ` · ${sol(tx.sol)}` : ""}${who ? ` ${who}` : ""}`}</T>
          <T f="semi" s={11} c={fg} style={{ opacity: 0.75 }}>{sub}</T>
        </View>
        {tx.sig ? <Icon name="arrow" size={13} color={fg} /> : null}
      </Pressable>
    </View>
  );
}

/** Confirm card: a hired agent asking to be funded, or a SOL transfer your agent prepared (SendCard.tsx). */
export function SendCard({ convo, mid, sd, who, onPatch }: { convo: string; mid: string; sd: SendAsk; who: string; onPatch: (p: Partial<SendAsk>) => void }) {
  const k = useC();
  const { token } = useSession();
  const [busy, setBusy] = useState<"" | "sign" | "confirm">("");
  const [err, setErr] = useState(sd.error || "");
  const fund = sd.kind === "fund";
  const legacy = fund && sd.usd === undefined;
  const usd = sd.usd ?? 0;
  const done = sd.status !== "pending";
  const save = (p: Partial<SendAsk>) => { onPatch(p); const n = { ...sd, ...p }; if (n.status !== "pending") void api("/api/messages", { method: "PATCH", body: JSON.stringify({ convo, clientId: mid, send: { status: n.status, ...(n.sig ? { sig: n.sig } : {}), ...(n.error ? { error: n.error.slice(0, 200) } : {}) } }) }, token).catch(() => {}); };
  const confirm = async () => {
    setErr("");
    if (!(await biometricGate(fund ? `Fund ${who}` : `Send ${sd.sol} SOL`))) { setErr("You didn't confirm. Nothing was sent."); return; }
    try {
      if (fund && !legacy) {
        setBusy("confirm");
        const key = `chat-${mid}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
        const r = await api<{ funding: { status: string; sig: string | null } }>("/api/wallet/fund", { method: "POST", body: JSON.stringify({ agent: sd.agent, usd, key }) }, token);
        if (r.funding.status !== "sent") throw new Error("That transfer didn't go through. Your balance was refunded.");
        save({ status: "sent", ...(r.funding.sig ? { sig: r.funding.sig } : {}) });
      } else {
        setBusy("sign");
        const c = new Connection(env.cluster === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com", "confirmed");
        const me = await api<{ user?: { wallet?: string } }>("/api/me", {}, token);
        const from = new PublicKey(me.user?.wallet || "");
        const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
        const tx = new Transaction({ feePayer: from, blockhash, lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(sd.to), lamports: Math.round(sd.sol * 1e9) }));
        const sig = await signAndSend(tx);
        setBusy("confirm");
        save({ status: "sent", sig });
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Nothing was sent."); } finally { setBusy(""); }
  };
  return (
    <View style={{ marginTop: 8, width: "100%", maxWidth: 300, borderRadius: 16, backgroundColor: k.tint, borderWidth: 1, borderColor: k.line, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="wallet" size={15} color="#fff" /></View>
        <T f="bold" s={14}>{fund ? (legacy ? `Fund ${who}'s task` : `Fund ${who}`) : "Send SOL"}</T>
        <View style={{ marginLeft: "auto", borderRadius: 999, backgroundColor: "#ffd84d", paddingHorizontal: 8, paddingVertical: 2 }}><Label s={8} c="#0a0a0a">{fund && !legacy ? "Fund" : "Send"}</Label></View>
      </View>
      <View style={{ marginTop: 6 }}>
        <Row k="Amount" v={fund && !legacy ? `$${usd.toFixed(2)}` : `${sd.sol} SOL`} mono={!fund || legacy} />
        {fund && sd.reason ? <Row k="For" v={sd.reason} /> : null}
        {fund && !legacy ? <><Row k="From" v="Your Lexari balance" /><Row k="To" v={`${who}'s wallet`} /></> : <><Row k="To" v={fund ? `${who}'s wallet · ${short(sd.to)}` : short(sd.to)} mono /><Row k="From" v="Your wallet" /></>}
        {!fund && sd.valueUsd ? <Row k="Value" v={`≈ $${sd.valueUsd.toFixed(2)}`} /> : null}
      </View>
      {fund && !legacy && !done ? <T s={12} c={k.ink60} style={{ marginTop: 8 }}>Arrives in its wallet as USDC. Anything unused can go back to your balance.</T> : null}
      {!fund && sd.firstTime && sd.status === "pending" ? <View style={{ marginTop: 12, flexDirection: "row", gap: 8, borderRadius: 12, backgroundColor: "#fff4d6", paddingHorizontal: 12, paddingVertical: 8 }}><Icon name="info" size={14} color="#7a4b00" /><T f="semi" s={12.5} c="#7a4b00" style={{ flex: 1 }}>You've never sent to this address. Check every character. Agents can be tricked by web pages and emails.</T></View> : null}
      {sd.status === "sent" && sd.sig ? <OkLine sig={sd.sig} text={fund && !legacy ? `Funded · receipt ${short(sd.sig)}` : `Sent · ${short(sd.sig)}`} /> : null}
      {fund && sd.status === "sent" && sd.returned ? <T f="semi" s={12.5} c={k.ink60} style={{ marginTop: 8 }}>{sd.returned.usd ? `$${sd.returned.usd.toFixed(2)} went back to your balance` : sd.returned.sol ? `Leftover ${sd.returned.sol} SOL sent back to you` : "Nothing was left to send back."}</T> : null}
      {sd.status === "cancelled" ? <T f="semi" s={13} c={k.ink60} style={{ marginTop: 12 }}>Cancelled. Nothing was sent.</T> : null}
      {err && !done ? <T s={12.5} c={BAD} style={{ marginTop: 8 }}>{err}</T> : null}
      {!done ? (
        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <Btn label="Cancel" disabled={!!busy} onPress={() => save({ status: "cancelled" })} />
          <Btn brand flex={1} disabled={!!busy} label={busy === "sign" ? "Approve in wallet…" : busy === "confirm" ? "Sending…" : fund && !legacy ? `Confirm $${usd.toFixed(2)}` : `Confirm ${sd.sol} SOL`} onPress={() => void confirm()} />
        </View>
      ) : null}
    </View>
  );
}

const clock = (secs: number) => { const s = Math.max(0, Math.floor(secs)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`; };
const shortUrl = (u: string) => u.replace(/^https:\/\/(www\.)?/, "").replace(/\?.*$/, "").slice(0, 48);
const PLATFORM: Record<string, string> = { jitsi: "Jitsi Meet", meet: "Google Meet", zoom: "Zoom", teams: "Microsoft Teams" };
function meetLine(t: TaskView, now: number) {
  if (t.status === "waiting" || t.phase === "waiting") return "Waiting to be let in";
  if (t.phase === "in_meeting" && t.joinedAt) return `In the meeting · ${clock((now - t.joinedAt) / 1000)}`;
  if (t.phase === "transcribing") return "Writing the notes…";
  if (t.status === "running") return "Joining…";
  if (t.status === "done") return `Notes ready${t.secs ? ` · ${Math.max(1, Math.round(t.secs / 60))} min` : ""}`;
  return t.detail || "Didn't get in";
}
export function taskLine(t: TaskView | undefined, now: number) {
  if (!t) return "";
  if (t.kind === "meeting") return meetLine(t, now);
  if (t.kind === "schedule") return t.status === "paused" ? `${t.every} · paused` : `${t.every}${t.nextRun ? ` · next ${new Date(t.nextRun).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}`;
  if (t.status === "running") return `${t.kind === "video" ? "Rendering" : t.kind === "deploy" ? "Deploying" : "Running"} · ${clock((now - t.createdAt) / 1000)}`;
  return t.status === "done" ? "Done" : t.status === "stopped" ? "Stopped" : "Didn't finish";
}
function PillBtn({ icon, label, onPress, busy }: { icon: string; label: string; onPress: () => void; busy?: boolean }) {
  const k = useC();
  return <Pressable accessibilityLabel={label} onPress={onPress} disabled={busy} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}>{busy ? <Spin c={k.ink} /> : <Icon name={icon} size={15} color={k.ink} />}</Pressable>;
}
export async function actTask(id: string, op: string, token: string | null) { return api<{ task: TaskView | null }>(`/api/tasks/${id}`, { method: "POST", body: JSON.stringify({ op }) }, token); }

/** The Join card for a meeting link (TaskCards.tsx MeetCard). */
export function MeetCard({ convo, mid, from, mt, task, now, onDesktop, onPatch, onTask }: { convo: string; mid: string; from: string; mt: MeetAsk; task?: TaskView; now: number; onDesktop: () => void; onPatch: (p: MeetAsk) => void; onTask: (t: TaskView) => void }) {
  const k = useC();
  const { token } = useSession();
  const [as, setAs] = useState<"me" | "agent">(mt.as || "agent");
  const [busy, setBusy] = useState(false);
  const agentName = mt.agentName || "Your agent";
  const first = (mt.userName || "you").split(" ")[0];
  const shown = as === "me" ? mt.userName || "Your name" : `${agentName} (for ${first})`;
  const live = !!mt.taskId;
  const active = task && (task.status === "running" || task.status === "waiting");
  const join = async () => {
    setBusy(true);
    try { const r = await api<{ task: TaskView }>("/api/tasks", { method: "POST", body: JSON.stringify({ op: "meeting", agent: from, convo, url: mt.url, as, messageId: mid }) }, token); onTask(r.task); onPatch({ ...mt, as, taskId: r.task.id }); }
    catch { /* the card stays */ } finally { setBusy(false); }
  };
  return (
    <Box w={360} style={{ padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: live && active ? GRAPE : k.tint }}><Icon name="users" size={17} color={live && active ? "#fff" : GRAPE} /></View>
        <View style={{ flex: 1 }}><T f="bold" s={14} lines={1}>{PLATFORM[mt.platform] || "Meeting"}</T><T f="mono" s={11} c={k.ink60} lines={1}>{shortUrl(mt.url)}</T></View>
        {live && active ? <><PillBtn icon="desk" label="Watch on the agent's computer" onPress={onDesktop} /><PillBtn icon="hangup" label="Leave the meeting" onPress={() => void actTask(mt.taskId!, "stop", token)} /></> : null}
      </View>
      {live ? (
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: k.tint, paddingHorizontal: 10, paddingVertical: 6 }}>
          {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GRAPE }} /> : <Icon name={task?.status === "done" ? "check" : "info"} size={13} color={task?.status === "done" ? GRAPE : k.ink45} />}
          <T f="semi" s={12.5} c={k.ink75} lines={1} style={{ flex: 1 }}>{task ? meetLine(task, now) : "Joining…"}</T>
          <T s={11} c={k.ink45}>{mt.as === "me" ? "as you" : "as agent"}</T>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 10, flexDirection: "row", borderRadius: 999, backgroundColor: k.tint, padding: 4 }}>
            {([["agent", "As my agent"], ["me", "As me"]] as const).map(([key, l]) => <Pressable key={key} onPress={() => setAs(key)} style={{ flex: 1, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: as === key ? GRAPE : "transparent" }}><T f="bold" s={12.5} c={as === key ? "#fff" : k.ink60}>{l}</T></Pressable>)}
          </View>
          <T s={11.5} c={k.ink60} style={{ marginTop: 8 }}>{"Joins as "}<T f="bold" s={11.5} c={k.ink75}>{shown}</T>{`, muted with camera off, and says it's taking notes.${as === "me" ? " Uses your account if you're signed in on its browser." : ""}`}</T>
          <Pressable disabled={busy} onPress={() => void join()} style={{ marginTop: 10, height: 36, borderRadius: 18, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}>{busy ? <Spin /> : <T f="bold" s={14} c="#fff">Join</T>}</Pressable>
        </>
      )}
    </Box>
  );
}

const KIND_ICON: Record<string, string> = { job: "terminal", schedule: "clock", video: "play", deploy: "globe", meeting: "users" };
export function TaskRow({ t, r, now, onDesktop, onChange }: { t?: TaskView; r: TaskRef | TaskView; now: number; onDesktop?: () => void; onChange?: (t: TaskView | null, id: string) => void }) {
  const k = useC();
  const { token } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (op: string) => { setBusy(op); try { const x = await actTask(r.id, op, token); onChange?.(x.task, r.id); } catch { /* keep */ } finally { setBusy(null); } };
  const running = t?.status === "running" || t?.status === "waiting";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: running || t?.status === "active" ? GRAPE : k.tint }}>{running && r.kind !== "schedule" ? <Spin /> : <Icon name={KIND_ICON[r.kind] || "jobs"} size={16} color={running || t?.status === "active" ? "#fff" : GRAPE} />}</View>
      <View style={{ flex: 1 }}><T f="bold" s={13.5} lines={1}>{t?.title || r.title}</T><T s={11.5} c={k.ink60} lines={1}>{t ? taskLine(t, now) : "…"}</T></View>
      {t?.link ? <PillBtn icon="link" label="Open the link" onPress={() => Linking.openURL(t.link!)} /> : null}
      {running && onDesktop && r.kind !== "schedule" ? <PillBtn icon="desk" label="Watch on the agent's computer" onPress={onDesktop} /> : null}
      {running ? <PillBtn icon="stop" label="Stop" busy={busy === "stop"} onPress={() => void act("stop")} /> : null}
      {t?.kind === "schedule" ? <PillBtn icon={t.status === "paused" ? "play" : "pause"} label={t.status === "paused" ? "Resume" : "Pause"} busy={busy === "pause" || busy === "resume"} onPress={() => void act(t.status === "paused" ? "resume" : "pause")} /> : null}
      {t && !running && (t.kind === "schedule" || !onDesktop) ? <PillBtn icon="trash" label="Delete" busy={busy === "delete"} onPress={() => void act("delete")} /> : null}
    </View>
  );
}
export function TaskCard({ r, t, now, onDesktop }: { r: TaskRef; t?: TaskView; now: number; onDesktop: () => void }) {
  if (r.kind === "meeting") return null;
  return <Box w={360} style={{ paddingHorizontal: 12, paddingVertical: 10 }}><TaskRow t={t} r={r} now={now} onDesktop={onDesktop} /></Box>;
}

/** The secure card: an agent asked for a credential; it goes straight to the vault (SecretCardView.tsx). */
export function SecretCardView({ c0, who, onSaved }: { c0: SecretCard; who: string; onSaved: (name: string) => void }) {
  const k = useC();
  const { token } = useSession();
  const [c, setC] = useState(c0);
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const save = async () => {
    const value = val; setVal(""); setBusy("save"); setErr("");
    try { const r = await api<{ secret: { name: string }; card?: SecretCard }>("/api/secrets", { method: "POST", body: JSON.stringify({ name: c.name, value, label: c.label, service: c.service, requestId: c.id }) }, token); setC(r.card || { ...c, status: "saved" }); onSaved(r.secret.name); }
    catch (e) { setErr(e instanceof Error ? e.message : "It couldn't be saved. Try again."); } finally { setBusy(null); }
  };
  const cancel = async () => { setVal(""); setBusy("cancel"); try { const r = await api<{ card: SecretCard }>(`/api/secrets/requests/${c.id}`, { method: "POST", body: JSON.stringify({ op: "cancel" }) }, token); setC(r.card); } catch (e) { setErr(e instanceof Error ? e.message : ""); } finally { setBusy(null); } };
  return (
    <Box w={320}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={15} color="#fff" /></View>
        <View style={{ flex: 1 }}><T f="bold" s={14} lines={1}>{c.label}</T><T s={11.5} c={k.ink60} lines={1}>{`${c.service ? `${c.service} · ` : ""}${who} asked`}</T></View>
        {c.status === "saved" ? <View style={{ borderRadius: 999, backgroundColor: OK_BG, paddingHorizontal: 8, paddingVertical: 2 }}><T f="bold" s={10.5} c={OK_FG}>Saved</T></View> : null}
        {c.status === "cancelled" ? <View style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 8, paddingVertical: 2 }}><T f="bold" s={10.5} c={k.ink60}>Cancelled</T></View> : null}
      </View>
      {c.why && c.status === "pending" ? <T s={12.5} c={k.ink60} style={{ paddingHorizontal: 12, paddingTop: 6 }}>{c.why}</T> : null}
      {c.status === "pending" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 12, paddingTop: 10 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 999, backgroundColor: k.tint, paddingLeft: 12 }}>
            <TextInput value={val} onChangeText={setVal} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="off" importantForAutofill="no" placeholder={`Paste ${c.name}`} placeholderTextColor={k.ink45} accessibilityLabel={`${c.label} (kept secret)`} style={{ flex: 1, height: 36, fontFamily: F.mono, fontSize: 13, color: k.ink }} />
            <Pressable accessibilityLabel={show ? "Hide" : "Show"} onPress={() => setShow(!show)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Icon name={show ? "eyeoff" : "eye"} size={15} color={k.ink60} /></Pressable>
          </View>
          <Pressable accessibilityLabel="Cancel" disabled={!!busy} onPress={() => void cancel()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={15} color={k.ink75} /></Pressable>
          <Pressable accessibilityLabel="Save securely" disabled={!!busy || !val} onPress={() => void save()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: GRAPE, opacity: !val ? 0.4 : 1, alignItems: "center", justifyContent: "center" }}>{busy === "save" ? <Spin /> : <Icon name="check" size={16} stroke={2.6} color="#fff" />}</Pressable>
        </View>
      ) : (
        <T f="semi" s={12} c={k.ink60} style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8 }}>{c.status === "saved" ? <>{"Saved as "}<T f="mono" s={12} c={k.ink75}>{c.name}</T>{`. ${who} can use it, never see it.`}</> : "Nothing was saved."}</T>
      )}
      {c.status === "pending" ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 12, marginTop: -4 }}><Icon name="eyeoff" size={12} color={k.ink45} /><T s={11} c={k.ink45}>{`Encrypted in your vault. Never shown to ${who} or in chat.`}</T></View> : null}
      {err ? <T s={12} c={BAD} style={{ paddingHorizontal: 12, paddingBottom: 12 }}>{err}</T> : null}
    </Box>
  );
}

const takeoverTitle = (r: string) => {
  const site = /\b(?:sign|log)\s*(?:in|into|on)\s*(?:to\s+)?(?:your\s+|my\s+)?([A-Z0-9][\w.-]*(?:\s[A-Z][\w.-]*)?)/i.exec(r)?.[1];
  if (site && !/^(the|it|there|here|yourself)$/i.test(site)) return `Sign in to ${site.replace(/\s+account$/i, "")}`;
  return /captcha/i.test(r) ? "Solve the CAPTCHA" : /code|2fa|two-factor|verif/i.test(r) ? "Enter the code" : "Your turn on my computer";
};
export function TakeoverCardView({ reason, onDesktop }: { reason: string; onDesktop: () => void }) {
  const k = useC();
  return (
    <Box w={320} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="monitor" size={16} color={GRAPE} /></View>
      <View style={{ flex: 1 }}><T f="bold" s={13.5} lines={1}>{takeoverTitle(reason)}</T><T s={11.5} c={k.ink60}>You sign in on my screen. I never see your password.</T></View>
      <Pressable onPress={onDesktop} style={{ borderRadius: 999, backgroundColor: GRAPE, paddingHorizontal: 12, paddingVertical: 6 }}><T f="bold" s={12.5} c="#fff">Take over</T></Pressable>
    </Box>
  );
}

const STATUS_CHIP: Record<string, [string, string, string]> = {
  prepared: ["Needs you", "#fff6d6", "#8a6500"], pending: ["Sending", "#fff6d6", "#8a6500"], done: ["Done", OK_BG, OK_FG], confirmed: ["Done", OK_BG, OK_FG],
  failed: ["Failed", "#fdecec", "#c4292f"], rejected: ["Failed", "#fdecec", "#c4292f"], cancelled: ["Cancelled", "", ""], expired: ["Expired", "", ""],
};
/** A paid action an integration prepared (ChatCards.tsx ActionCardView). */
export function ActionCardView({ a0, who }: { a0: ActionCard; who: string }) {
  const k = useC();
  const { token } = useSession();
  const [a, setA] = useState(a0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const { reload } = useData();
  const self = a.connector === "self";
  const run = async (op: "confirm" | "cancel") => {
    if (op === "confirm" && !(await biometricGate(self ? "Confirm this change" : "Confirm this payment"))) return;
    setBusy(op); setErr("");
    try {
      const next = (await api<{ action: ActionCard }>(`/api/integrations/actions/${a.id}`, { method: "POST", body: JSON.stringify({ op }) }, token)).action;
      setA(next);
      // The agent changed its own name, face, persona or model: reload so the header, team and pickers show it.
      if (next.connector === "self" && next.status === "confirmed") await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : ""); } finally { setBusy(null); }
  };
  const seed = a.tool === "self.setavatar" ? Number((a.rows || []).find(([kk]) => kk === "Face")?.[1]?.replace(/\D/g, "")) : NaN;
  const [label, bg, fg] = STATUS_CHIP[a.status] || [a.status, k.tint, k.ink60];
  return (
    <Box w={320}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="bolt" size={15} color="#fff" /></View>
        <View style={{ flex: 1 }}><T f="bold" s={14} lines={2}>{a.title || "Paid action"}</T><T s={11.5} c={k.ink60} lines={1}>{`${a.connector || "x402"} · ${who}`}</T></View>
        <View style={{ borderRadius: 999, backgroundColor: bg || k.tint, paddingHorizontal: 8, paddingVertical: 2 }}><T f="bold" s={10.5} c={fg || k.ink60}>{label}</T></View>
      </View>
      {Number.isInteger(seed) && seed > 0 ? <View style={{ alignItems: "center", paddingTop: 12 }}><View style={{ borderRadius: 22, backgroundColor: k.tint, padding: 8, borderWidth: 1, borderColor: k.line }}><AgentFace seed={seed} size={72} animated /></View></View> : null}
      <View style={{ paddingHorizontal: 14, paddingTop: 6 }}>
        {(a.rows || []).map(([kk, v]) => <Row key={kk} k={kk} v={v} />)}
        {a.usd > 0 ? <Row k="Counts toward limits" v={`$${a.usd.toFixed(2)}`} /> : null}
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" }} /><T f="semi" s={11.5} c={k.ink45}>{self ? "Only this agent's own settings. Nothing else changes." : "Solana"}</T></View>
        {a.status === "prepared" ? <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}><Btn label={busy === "cancel" ? "Cancelling…" : "Cancel"} flex={1} disabled={!!busy} onPress={() => void run("cancel")} /><Btn brand label="Confirm" flex={1.4} disabled={!!busy} onPress={() => void run("confirm")} /></View> : null}
        {(a.status === "done" || a.status === "confirmed") && a.sig ? <OkLine sig={a.sig} url={a.explorer} text={`Done · ${a.sig.length > 14 ? short(a.sig) : a.sig}`} /> : null}
        {a.status === "confirmed" && !a.sig && self ? <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: OK_BG, paddingHorizontal: 12, paddingVertical: 8 }}><Icon name="check" size={14} color={OK_FG} /><T f="bold" s={13} c={OK_FG} style={{ flex: 1 }}>{(a.rows || []).find(([kk]) => kk === "Done")?.[1] || "Done"}</T></View> : null}
        {a.status === "failed" || a.status === "rejected" ? <T f="semi" s={12.5} c="#c4292f" style={{ marginTop: 12, borderRadius: 12, backgroundColor: "#fdecec", padding: 10 }}>{a.error || "That didn't go through. Nothing was sent."}</T> : null}
        {a.status === "cancelled" ? <T f="semi" s={12.5} c={k.ink60} style={{ marginTop: 12 }}>{self ? "Cancelled. Nothing changed." : "Cancelled. Nothing was sent."}</T> : null}
        {a.status === "expired" ? <T f="semi" s={12.5} c={k.ink60} style={{ marginTop: 12 }}>This expired before it was confirmed. Ask again for a fresh quote.</T> : null}
        {err ? <T s={12.5} c={BAD} style={{ marginTop: 8 }}>{err}</T> : null}
      </View>
    </Box>
  );
}

/** An email your agent drafted (EmailCardView.tsx). */
export function EmailCardView({ e0, who }: { e0: EmailCard; who: string }) {
  const k = useC();
  const { token } = useSession();
  const [e, setE] = useState(e0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const long = e.text.length > 280 || e.text.split("\n").length > 5;
  const run = async (op: "send" | "cancel") => { setBusy(op); try { setE((await api<{ email: EmailCard }>(`/api/email/item/${e.id}`, { method: "POST", body: JSON.stringify({ op }) }, token)).email); } catch { /* keep */ } finally { setBusy(null); } };
  const chip = e.status === "sent" ? ["Sent", OK_BG, OK_FG] : e.status === "draft" || e.status === "pending" ? ["Draft", "#fff6d6", "#8a6500"] : e.status === "failed" ? ["Failed", "#fdecec", "#c4292f"] : ["Cancelled", k.tint, k.ink60];
  return (
    <Box w={330}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="mail" size={16} color="#fff" /></View>
        <View style={{ flex: 1 }}><T f="bold" s={14} lines={1}>{e.subject || "(no subject)"}</T><T s={11.5} c={k.ink60} lines={1}>{`${e.fromLabel || "Email"} · ${who}`}</T></View>
        <View style={{ borderRadius: 999, backgroundColor: chip[1], paddingHorizontal: 8, paddingVertical: 2 }}><T f="bold" s={10.5} c={chip[2]}>{chip[0]}</T></View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 4 }}>
        {([["To", e.to.join(", ")], ["From", e.from], ...(e.replyTo ? [["Reply", e.replyTo]] : [])] as [string, string][]).map(([kk, v]) => <View key={kk} style={{ flexDirection: "row", gap: 8 }}><T s={12.5} c={k.ink45} style={{ width: 48 }}>{kk}</T><T f={kk === "To" ? "semi" : "sans"} s={12.5} c={kk === "To" ? k.ink : k.ink75} style={{ flex: 1 }}>{v}</T></View>)}
      </View>
      <Pressable onPress={() => setOpen(!open)} style={{ marginHorizontal: 14, marginTop: 10, borderRadius: 12, backgroundColor: k.tint, paddingHorizontal: 12, paddingVertical: 10 }}>
        <T s={13} c={k.ink75} lines={open || !long ? undefined : 5}>{e.text}</T>
        {long ? <T f="bold" s={11.5} c={GRAPE} style={{ marginTop: 4 }}>{open ? "Show less" : "Show all"}</T> : null}
      </Pressable>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10 }}>
        {e.mock ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#f5a524" }} /><T f="semi" s={11.5} c={k.ink45}>Test mode · not delivered outside Lexari</T></View> : null}
        {e.status === "draft" || e.status === "pending" ? <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}><PillBtn icon="x" label="Cancel draft" busy={busy === "cancel"} onPress={() => void run("cancel")} /><Btn brand flex={1} icon="send" label={busy === "send" ? "Sending…" : "Send"} disabled={!!busy} onPress={() => void run("send")} /></View> : null}
        {e.status === "sent" ? <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: OK_BG, paddingHorizontal: 12, paddingVertical: 10 }}><Icon name="check" size={15} stroke={2.6} color={OK_FG} /><T f="bold" s={13} c={OK_FG} style={{ flex: 1 }}>{e.mock ? "Sent · test mode" : "Sent"}</T>{e.sentAt ? <T f="semi" s={11.5} c={OK_FG}>{new Date(e.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</T> : null}</View> : null}
        {e.status === "failed" ? <T f="semi" s={12.5} c="#c4292f" style={{ marginTop: 10, borderRadius: 12, backgroundColor: "#fdecec", padding: 10 }}>{e.error || "It didn't send. Nothing went out."}</T> : null}
        {e.status === "cancelled" ? <T f="semi" s={12.5} c={k.ink60} style={{ marginTop: 10 }}>Cancelled. Nothing was sent.</T> : null}
      </View>
    </Box>
  );
}

function Peek({ id }: { id: string }) {
  const k = useC();
  const headers = useAuthed();
  const [txt, setTxt] = useState<string | null>(null);
  useEffect(() => { let on = true; fetch(`${fileUri(id)}?peek=1`, { headers }).then((r) => (r.ok ? r.text() : "")).then((t) => on && setTxt(t.slice(0, 4096)), () => on && setTxt("")); return () => { on = false; }; }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (txt === null) return <View style={{ height: 84, backgroundColor: k.tint }} />;
  if (!txt.trim()) return null;
  return <T f="mono" s={11.5} c={k.ink75} lines={10} style={{ paddingHorizontal: 12, paddingVertical: 10, lineHeight: 16.5, maxHeight: 164 }}>{txt.split("\n").slice(0, 10).join("\n")}</T>;
}
const ICON: Record<string, string> = { image: "camera", video: "play", text: "list", code: "terminal", pdf: "file", other: "box" };
/** A file in chat: preview, name, type · size and Download (FileCard.tsx). */
export function FileCard({ f, mine = false }: { f: CardFile; mine?: boolean }) {
  const k = useC();
  const headers = useAuthed();
  const [big, setBig] = useState(false);
  const kind = f.kind && f.kind !== "other" ? f.kind : f.mime?.startsWith("image/") ? "image" : f.mime?.startsWith("video/") ? "video" : f.kind || "other";
  const size = typeof f.size === "number" ? sizeLabel(f.size) : f.size;
  const dot = f.name.lastIndexOf(".");
  const [stem, ext] = dot > 0 && f.name.length - dot <= 6 ? [f.name.slice(0, dot), f.name.slice(dot)] : [f.name, ""];
  return (
    <View style={{ width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden", backgroundColor: mine ? "rgba(255,255,255,0.15)" : k.card, borderWidth: mine ? 0 : 1, borderColor: k.line }}>
      {kind === "image" ? <Pressable accessibilityLabel={`Open ${f.name}`} onPress={() => setBig(true)}><Image source={{ uri: fileUri(f.id), headers }} style={{ width: "100%", height: 220 }} resizeMode="contain" /></Pressable> : null}
      {kind === "text" || kind === "code" ? <View style={{ borderBottomWidth: 1, borderBottomColor: k.line, backgroundColor: k.tint }}><Peek id={f.id} /></View> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: mine ? "#fff" : GRAPE }}><Icon name={ICON[kind] || "box"} size={17} color={mine ? GRAPE : "#fff"} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row" }}><T f="semi" s={14} lines={1} c={mine ? "#fff" : k.ink} style={{ flexShrink: 1 }}>{stem}</T><T f="semi" s={14} c={mine ? "#fff" : k.ink}>{ext}</T></View>
          <T s={11.5} c={mine ? "rgba(255,255,255,0.75)" : k.ink60}>{`${typeLabel(f)} · ${size}`}</T>
        </View>
        <Pressable accessibilityLabel={`Download ${f.name}`} onPress={() => Linking.openURL(`${fileUri(f.id)}?dl=1`)} style={{ height: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: mine ? "#fff" : k.tint }}>
          <Icon name="download" size={15} color={GRAPE} /><T f="bold" s={13} c={GRAPE}>Download</T>
        </Pressable>
      </View>
      {big ? <Modal transparent visible onRequestClose={() => setBig(false)}><Pressable onPress={() => setBig(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", padding: 12, justifyContent: "center" }}><Image source={{ uri: fileUri(f.id), headers }} style={{ width: "100%", height: "80%" }} resizeMode="contain" /></Pressable></Modal> : null}
    </View>
  );
}
export function FileCards({ files }: { files: CardFile[] }) { return files.length ? <View style={{ marginTop: 6, width: "100%", maxWidth: 340, gap: 6 }}>{files.map((f) => <FileCard key={f.id} f={f} />)}</View> : null; }

/** Screenshots from the agent's computer: the last one large, the others small. */
export function Shots({ mid, list }: { mid: string; list?: number[] }) {
  const k = useC();
  const headers = useAuthed();
  const [big, setBig] = useState<number | null>(null);
  if (!list?.length) return null;
  const last = list[list.length - 1], rest = list.slice(0, -1);
  return (
    <View style={{ marginTop: 6, width: "100%", maxWidth: 420 }}>
      <Pressable accessibilityLabel="Open the screenshot" onPress={() => setBig(last)} style={{ borderRadius: 16, overflow: "hidden", backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}><Image source={{ uri: shotUri(mid, last), headers }} style={{ width: "100%", aspectRatio: 16 / 10 }} resizeMode="cover" /></Pressable>
      {rest.length ? <View style={{ marginTop: 6, flexDirection: "row", gap: 6 }}>{rest.map((n) => <Pressable key={n} accessibilityLabel={`Open screenshot ${n + 1}`} onPress={() => setBig(n)} style={{ width: "30%", borderRadius: 10, overflow: "hidden" }}><Image source={{ uri: shotUri(mid, n), headers }} style={{ width: "100%", aspectRatio: 16 / 10 }} /></Pressable>)}</View> : null}
      {big !== null ? <Modal transparent visible onRequestClose={() => setBig(null)}><Pressable onPress={() => setBig(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", padding: 12, justifyContent: "center" }}><Image source={{ uri: shotUri(mid, big), headers }} style={{ width: "100%", height: "70%" }} resizeMode="contain" /><Pressable onPress={() => void Share.share({ url: shotUri(mid, big), message: shotUri(mid, big) })} style={{ position: "absolute", right: 16, bottom: 24, borderRadius: 999, backgroundColor: k.card, paddingHorizontal: 14, paddingVertical: 8 }}><T f="bold" s={13}>Open full size</T></Pressable></Pressable></Modal> : null}
    </View>
  );
}
