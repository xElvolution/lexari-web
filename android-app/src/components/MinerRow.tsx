/** Port of webapp/components/miner/MinerRow.tsx: on the ORE Miner's page, your own servers, and the Mining sheet (same /api/miner/hosts calls). */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { toast } from "@/web/anim";
import { F, GRAPE, T, WSheet, useC } from "@/web/kit";

type Report = { host?: string; os?: string; cpus?: number; installed?: boolean; running?: boolean; threads?: number; hashrate?: number; hashes?: number; best?: number; load?: number | null; minerSince?: number | null };
type Host = { id: string; name: string; status: "waiting" | "online" | "offline"; lastSeen: number | null; report: Report | null; installing: boolean; commands: { id: number; cmd: string; state: string; output: string | null; at: number }[] };
type Cmd = "start" | "stop" | "status" | "install";

const fmt = (n?: number) => (n || 0).toLocaleString("en-US");
const rate = (n?: number) => (!n ? "0 H/s" : n >= 1e6 ? `${(n / 1e6).toFixed(2)} MH/s` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} kH/s` : `${n} H/s`);
const errText = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

function useHosts(on: boolean, every = 5000) {
  const { token } = useSession();
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const load = useCallback(() => { if (token) api<{ hosts: Host[] }>("/api/miner/hosts", {}, token).then((r) => setHosts(r.hosts ?? []), () => {}); }, [token]);
  useEffect(() => { load(); if (!on) return; const t = setInterval(load, every); return () => clearInterval(t); }, [load, on, every]);
  return { hosts, load };
}

export default function MinerRow() {
  const k = useC();
  const [open, setOpen] = useState(false);
  const { hosts } = useHosts(false);
  const live = hosts?.filter((h) => h.status === "online") || [];
  const mining = live.filter((h) => h.report?.running);
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.card, padding: 14, borderWidth: 1, borderColor: k.line }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#1a1206", alignItems: "center", justifyContent: "center" }}><Icon name="server" size={17} color="#f5a524" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T f="bold" s={14}>Mining</T>
            {mining.length > 0 ? <View style={{ borderRadius: 999, backgroundColor: "#e7f8ee", paddingHorizontal: 6, paddingVertical: 2 }}><T f="bold" s={10} c="#137a3d">{rate(mining.reduce((n, h) => n + (h.report?.hashrate || 0), 0))}</T></View> : null}
          </View>
          <T s={12.5} c={k.ink60} style={{ lineHeight: 17 }}>{!hosts?.length ? "Connect a server you own. Nothing mines on Lexari." : `${hosts.length} server${hosts.length === 1 ? "" : "s"} · ${live.length} online · ${mining.length} mining`}</T>
        </View>
        <Icon name="right" size={16} color={k.ink45} />
      </Pressable>
      {open ? <MinerSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function MinerSheet({ onClose }: { onClose: () => void }) {
  const k = useC();
  const { token } = useSession();
  const { hosts, load } = useHosts(true, 4000);
  const [connect, setConnect] = useState<{ id: string; command: string } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const pending = connect ? hosts?.find((h) => h.id === connect.id) : null;
  useEffect(() => { if (pending && pending.status !== "waiting") { toast(`${pending.name} connected`); setConnect(null); } }, [pending]);
  const post = (body: object) => api("/api/miner/hosts", { method: "POST", body: JSON.stringify(body) }, token);
  const start = async () => {
    setBusy("connect");
    try { const r = (await post({ op: "connect", name: name || undefined })) as { id: string; command: string }; setConnect(r); setName(""); load(); }
    catch (e) { toast(errText(e, "Couldn't make an install line.")); } finally { setBusy(""); }
  };
  const cmd = async (h: Host, c: Cmd) => {
    setBusy(`${h.id}:${c}`);
    try { await post({ op: "command", id: h.id, cmd: c }); toast(`${c === "start" ? "Starting" : c === "stop" ? "Stopping" : "Checking"} on ${h.name}`); setTimeout(load, 2500); }
    catch (e) { toast(errText(e, "That didn't go through.")); } finally { setBusy(""); }
  };
  const remove = async (h: Host) => {
    setBusy(`${h.id}:remove`);
    try { await post({ op: "remove", id: h.id }); toast(`${h.name} removed. Its agent uninstalls itself.`); load(); }
    catch (e) { toast(errText(e, "Couldn't remove it.")); } finally { setBusy(""); }
  };
  return (
    <WSheet open title="Mining" sub="Your own servers. The ORE Miner installs, runs and watches the miner there." icon="server" onClose={onClose}>
      <View style={{ marginBottom: 12, flexDirection: "row", gap: 8, borderRadius: 16, backgroundColor: "#fff4d6", paddingHorizontal: 12, paddingVertical: 10 }}>
        <Icon name="info" size={15} color="#7a5200" />
        <T s={12.5} c="#7a5200" style={{ flex: 1, lineHeight: 17 }}>Practice mode: real hashing on your CPU, real hashrate. ORE rewards are on mainnet, so none are earned here.</T>
      </View>
      {hosts === null ? <View style={{ height: 96, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={GRAPE} /></View> : (
        <View style={{ gap: 10 }}>{hosts.filter((h) => h.status !== "waiting" || h.id === connect?.id).map((h) => <HostTile key={h.id} h={h} busy={busy} onCmd={cmd} onRemove={remove} />)}</View>
      )}
      {connect ? (
        <View style={{ marginTop: 12, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(91,43,255,0.4)" }}>
          <T f="bold" s={14}>Run this on your server</T>
          <T s={12.5} c={k.ink60} style={{ marginTop: 2 }}>Linux or macOS with python3. Runs as your user, no root. Works once, for 30 minutes.</T>
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: "#14121f", padding: 10 }}>
            <T f="mono" s={11.5} c="#d6ccff" style={{ flex: 1 }}>{connect.command}</T>
            <Pressable accessibilityLabel="Copy" onPress={async () => { await Clipboard.setStringAsync(connect.command); toast("Copied"); }} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}><Icon name="copy" size={15} color="#fff" /></Pressable>
          </View>
          <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}><ActivityIndicator size="small" color={GRAPE} /><T f="semi" s={12.5} c={k.ink60}>Waiting for your server to connect…</T></View>
        </View>
      ) : (
        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <TextInput value={name} onChangeText={(t) => setName(t.slice(0, 40))} placeholder="Server name" accessibilityLabel="Server name" placeholderTextColor={k.ink45} style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 22, backgroundColor: k.tint, paddingHorizontal: 16, color: k.ink, fontFamily: F.sans, fontSize: 14 }} />
          <Pressable onPress={start} disabled={busy === "connect"} style={{ height: 44, borderRadius: 22, backgroundColor: GRAPE, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 6, opacity: busy === "connect" ? 0.5 : 1 }}>
            {busy === "connect" ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="plus" size={16} color="#fff" />}<T f="bold" s={14} c="#fff">Connect</T>
          </Pressable>
        </View>
      )}
    </WSheet>
  );
}

function HostTile({ h, busy, onCmd, onRemove }: { h: Host; busy: string; onCmd: (h: Host, c: Cmd) => void; onRemove: (h: Host) => void }) {
  const k = useC();
  const r = h.report;
  const run = !!r?.running && h.status === "online";
  const dot = h.status === "online" ? (run ? "#22c55e" : "#3b6cf0") : h.status === "offline" ? "#e5484d" : "#e0a100";
  const last = h.commands[0];
  const ib = { width: 36, height: 36, borderRadius: 18, alignItems: "center" as const, justifyContent: "center" as const, opacity: busy ? 0.4 : 1 };
  return (
    <View style={{ borderRadius: 16, padding: 12, borderWidth: 1, borderColor: k.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="server" size={16} color={k.ink} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /><T f="bold" s={14} lines={1} style={{ flexShrink: 1 }}>{h.name}</T></View>
          <T s={11.5} c={k.ink60} lines={1}>{h.status === "waiting" ? "Waiting for the install line" : h.status === "offline" ? "Offline · agent not checking in" : `${r?.host || "server"} · ${r?.cpus || "?"} CPUs${r?.load != null ? ` · load ${r.load.toFixed(2)}` : ""}`}</T>
        </View>
        {h.status === "online" ? (run
          ? <Pressable accessibilityLabel="Stop miner" disabled={!!busy} onPress={() => onCmd(h, "stop")} style={[ib, { backgroundColor: "#ffe9e9" }]}><Icon name="stop" size={15} color="#c4373b" /></Pressable>
          : <Pressable accessibilityLabel="Start miner" disabled={!!busy} onPress={() => onCmd(h, "start")} style={[ib, { backgroundColor: "#e7f8ee" }]}><Icon name="play" size={15} color="#137a3d" /></Pressable>) : null}
        {h.status !== "waiting" ? <Pressable accessibilityLabel="Remove server" disabled={!!busy} onPress={() => onRemove(h)} style={ib}><Icon name="trash" size={15} color={k.ink45} /></Pressable> : null}
      </View>
      {h.status !== "waiting" ? (
        <View style={{ marginTop: 10, flexDirection: "row", gap: 6 }}>
          <Stat k="Hashrate" v={run ? rate(r?.hashrate) : "Stopped"} />
          <Stat k="Best diff" v={fmt(r?.best)} />
          <Stat k="Threads" v={run ? String(r?.threads || 0) : "–"} />
        </View>
      ) : null}
      {last ? <T s={11.5} c={k.ink60} lines={1} style={{ marginTop: 8 }}>{`${last.cmd}: ${last.state === "done" ? last.output : last.state === "failed" ? `failed · ${last.output}` : "waiting for the server…"}`}</T> : null}
    </View>
  );
}

function Stat({ k: label, v }: { k: string; v: string }) {
  const k = useC();
  return <View style={{ flex: 1, borderRadius: 12, backgroundColor: k.tint, paddingHorizontal: 8, paddingVertical: 6 }}><T f="bold" s={10} c={k.ink45} style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</T><T f="bold" s={13} lines={1}>{v}</T></View>;
}
