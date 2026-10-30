/** The agent's computer, ported from the web DesktopPane: header (grape monitor tile, "<name>'s computer", live dot and
 * status), Screen / Terminal / Files tabs. Screen is the noVNC view with the address bar and the Full desktop /
 * Keyboard / Address bar row; Terminal is xterm over the same ticketed socket; Files lists /home/agent and opens text files. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { useSession } from "@/state/session";
import { nameOf, useData } from "@/web/data";
import { GRAPE, T, useC } from "@/web/kit";
import { specialist } from "@/content/roster";

type Status = "connecting" | "live" | "closed" | "error";
type Entry = { name: string; dir: boolean; size: number; mtime: number };
const HOME = "/home/agent";
const BG = "#0d0b14";
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);
const wsBase = () => { const u = new URL(env.apiUrl); return `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`; };

const POST = `const up=(m)=>{const s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage(s,"*");};`;
function screenPage(ws: string, ticket: string) {
  return `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1,user-scalable=no"><style>html,body{margin:0;height:100%;background:${BG};overflow:hidden}#h{position:absolute;inset:0}#h>div{background:transparent!important}</style></head><body><div id="h"></div>
<script type="module">${POST}
import RFB from "https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js";
let r=null;
try{ r=new RFB(document.getElementById("h"),${JSON.stringify(ws)},{wsProtocols:["binary","lxt."+${JSON.stringify(ticket)}],shared:true});
  r.scaleViewport=true;r.resizeSession=true;r.background="${BG}";r.qualityLevel=6;r.compressionLevel=4;r.showDotCursor=true;
  r.addEventListener("connect",()=>up({s:"live"}));r.addEventListener("disconnect",(e)=>up({s:e.detail&&e.detail.clean?"closed":"error"}));
}catch(e){up({s:"error"})}
const key=(k)=>{if(!r)return;r.sendKey(k,null,true);r.sendKey(k,null,false)};
const sym=(c)=>{const n=c.codePointAt(0)||0;return n<256?n:0x01000000+n};
window.addEventListener("message",(e)=>{let m;try{m=typeof e.data==="string"?JSON.parse(e.data):e.data}catch{return}if(!m||!r)return;
  if(m.op==="big")r.resizeSession=!m.on; if(m.op==="key")key(m.k); if(m.op==="type")for(const c of [...m.t])key(sym(c));
  if(m.op==="addr"){r.sendKey(0xffe3,"ControlLeft",true);key(0x6c);r.sendKey(0xffe3,"ControlLeft",false)}});
</script></body></html>`;
}
function termPage(ws: string, ticket: string, name: string) {
  return `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1,user-scalable=no"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css"><style>html,body{margin:0;height:100%;background:${BG}}#t{position:absolute;inset:8px}</style></head><body><div id="t"></div>
<script type="module">${POST}
import { Terminal } from "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm";
import { FitAddon } from "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm";
const term=new Terminal({fontSize:12,fontFamily:"ui-monospace, Menlo, monospace",cursorBlink:true,theme:{background:"${BG}",foreground:"#e9e4ff",cursor:"#b9a3ff",selectionBackground:"#5b2bff66"}});
const fit=new FitAddon();term.loadAddon(fit);term.open(document.getElementById("t"));fit.fit();
const ws=new WebSocket(${JSON.stringify(ws)}+"&c="+term.cols+"&r="+term.rows,["lx","lxt."+${JSON.stringify(ticket)}]);
ws.onopen=()=>up({s:"live"});ws.onclose=()=>up({s:"closed"});ws.onerror=()=>up({s:"error"});
ws.onmessage=(ev)=>{let m;try{m=JSON.parse(String(ev.data))}catch{return}
  if(m.t==="out"&&m.d)term.write(m.d);else if(m.t==="agent"&&m.cmd)term.write("\\r\\n\\x1b[38;5;141m● "+${JSON.stringify(name)}+" ran:\\x1b[0m "+m.cmd+"\\r\\n");
  else if(m.t==="agentOut"){term.write((m.out||"").replace(/\\n/g,"\\r\\n")+"\\x1b[38;5;141m● done\\x1b[0m\\r\\n");up({files:1})}};
term.onData((d)=>{if(ws.readyState===1)ws.send(JSON.stringify({t:"in",d}))});
addEventListener("resize",()=>{fit.fit();if(ws.readyState===1)ws.send(JSON.stringify({t:"resize",c:term.cols,r:term.rows}))});
</script></body></html>`;
}

/** WebView on the phone; an iframe in the web preview. send() posts a command into the page. */
function Page({ html, onMsg, sendRef }: { html: string; onMsg: (m: { s?: Status; files?: number }) => void; sendRef?: { current: ((m: object) => void) | null } }) {
  const wv = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (!sendRef) return;
    sendRef.current = (m) => {
      if (Platform.OS === "web") frame.current?.contentWindow?.postMessage(JSON.stringify(m), "*");
      else wv.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent("message",{data:${JSON.stringify(JSON.stringify(m))}}));true;`);
    };
  }, [sendRef]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const f = (e: MessageEvent) => { if (e.source !== frame.current?.contentWindow) return; try { onMsg(JSON.parse(String(e.data))); } catch { /* not ours */ } };
    window.addEventListener("message", f); return () => window.removeEventListener("message", f);
  }, [onMsg]);
  if (Platform.OS === "web") return <View style={{ flex: 1 }}>{(() => { const El = "iframe" as unknown as React.ComponentType<Record<string, unknown>>; return <El ref={frame} srcDoc={html} style={{ border: 0, width: "100%", height: "100%", background: BG }} />; })()}</View>;
  return <WebView ref={wv} originWhitelist={["*"]} source={{ html, baseUrl: env.apiUrl }} onMessage={(e) => { try { onMsg(JSON.parse(e.nativeEvent.data)); } catch { /* not ours */ } }} style={{ flex: 1, backgroundColor: BG }} javaScriptEnabled />;
}

function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={{ height: 32, borderRadius: 16, paddingHorizontal: 12, justifyContent: "center", backgroundColor: on ? GRAPE : "rgba(255,255,255,0.10)", opacity: disabled ? 0.4 : 1 }}><T f="bold" s={12.5} c="#fff">{label}</T></Pressable>;
}

export default function Desktop() {
  const { slug: id = "home" } = useLocalSearchParams<{ slug: string }>();
  const k = useC();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me } = useData();
  const name = me?.agents.find((a) => a.slug === id)?.name || specialist(id)?.name || nameOf(me, id);
  const [tab, setTab] = useState<"screen" | "terminal" | "files">("screen");
  const [screen, setScreen] = useState<{ html: string; status: Status; err: string }>({ html: "", status: "connecting", err: "" });
  const [term, setTerm] = useState<{ html: string; status: Status }>({ html: "", status: "connecting" });
  const [gen, setGen] = useState(0); const [tgen, setTgen] = useState(0);
  const [url, setUrl] = useState(""); const [opening, setOpening] = useState(false);
  const [big, setBig] = useState(false); const [kbd, setKbd] = useState(false); const [typed, setTyped] = useState("");
  const [path, setPath] = useState(HOME); const [files, setFiles] = useState<Entry[] | null>(null); const [open, setOpen] = useState<{ name: string; text: string } | null>(null);
  const send = useRef<((m: object) => void) | null>(null);

  useEffect(() => {
    if (!token) return; setScreen((s) => ({ ...s, status: "connecting", err: "" }));
    api<{ path: string; ticket: string }>("/api/desktop/ticket", {}, token)
      .then((t) => setScreen({ html: screenPage(`${wsBase()}${t.path}?k=vnc`, t.ticket), status: "connecting", err: "" }))
      .catch(() => setScreen({ html: "", status: "error", err: "Could not open the desktop." }));
  }, [token, gen]);
  useEffect(() => {
    if (!token || (tab !== "terminal" && !term.html)) return; if (term.html && tgen === 0) return;
    api<{ path: string; ticket: string }>("/api/desktop/ticket", {}, token)
      .then((t) => setTerm({ html: termPage(`${wsBase()}${t.path}?x=1`, t.ticket, name), status: "connecting" }))
      .catch(() => setTerm({ html: "", status: "error" }));
  }, [token, tab, tgen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFiles = useCallback(async (p = path) => {
    try { const r = await api<{ entries: Entry[] }>(`/api/desktop/files?path=${encodeURIComponent(p)}`, {}, token); setFiles(r.entries); setPath(p); } catch { setFiles([]); }
  }, [path, token]);
  useEffect(() => { if (tab === "files") void loadFiles(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const openFile = async (f: Entry) => {
    const full = `${path}/${f.name}`;
    if (f.dir) { setOpen(null); void loadFiles(full); return; }
    try { const r = await api<{ text: string }>(`/api/desktop/files?read=${encodeURIComponent(full)}`, {}, token); setOpen({ name: f.name, text: r.text }); } catch { /* shown as empty */ }
  };
  const go = async () => {
    if (!url.trim() || opening) return; setOpening(true);
    try { const r = await api<{ url: string }>("/api/desktop/open", { method: "POST", body: JSON.stringify({ url }) }, token); setUrl(r.url); }
    catch { setScreen((s) => ({ ...s, err: "Could not open that page." })); } finally { setOpening(false); }
  };
  useEffect(() => { send.current?.({ op: "big", on: big }); if (big && token) void api("/api/desktop/open", { method: "POST", body: JSON.stringify({ size: "desktop" }) }, token).catch(() => {}); }, [big, token]);

  const shown = tab === "screen" ? screen.status : term.status;
  const dot = shown === "live" ? "#2fd27a" : shown === "connecting" ? "#ffb020" : "#e5484d";
  const line = shown === "live" ? (tab === "screen" ? "Live · Linux desktop · browser on the web" : "Live · Linux · /home/agent") : shown === "connecting" ? "Starting…" : shown === "closed" ? "Disconnected" : "Not available";
  return (
    <View style={{ flex: 1, backgroundColor: k.alt, paddingTop: insets.top }}>
      <View style={{ height: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: k.line }}>
        <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><Icon name="monitor" size={18} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T f="bold" s={15} lines={1}>{name}&apos;s computer</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /><T s={12.5} c={k.ink60} lines={1}>{line}</T></View>
        </View>
        <Pressable accessibilityLabel="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/chat/${id}`))} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={19} color={k.ink75} /></Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: k.line }}>
        {(["screen", "terminal", "files"] as const).map((t) => <Pressable key={t} onPress={() => setTab(t)} style={{ height: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", backgroundColor: tab === t ? GRAPE : "transparent" }}><T f="bold" s={13} c={tab === t ? "#fff" : k.ink60}>{t[0].toUpperCase() + t.slice(1)}</T></Pressable>)}
        {tab === "terminal" && (term.status === "closed" || term.status === "error") ? <Pressable onPress={() => setTgen((g) => g + 1)} style={{ marginLeft: "auto", height: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", backgroundColor: k.tint }}><T f="bold" s={13} c={k.brandInk}>Reconnect</T></Pressable> : null}
      </View>

      <View style={{ flex: 1, display: tab === "screen" ? "flex" : "none", backgroundColor: BG }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.10)" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" }}><Icon name="globe" size={16} color="#cbbcff" /></View>
          <TextInput value={url} onChangeText={setUrl} onSubmitEditing={() => void go()} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" placeholder="Search or type a web address" placeholderTextColor="rgba(255,255,255,0.45)" accessibilityLabel="Web address"
            style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 14, color: "#fff", fontSize: 14 }} />
          <Pressable onPress={() => void go()} disabled={opening || !url.trim()} style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: "center", backgroundColor: GRAPE, opacity: opening || !url.trim() ? 0.5 : 1 }}><T f="bold" s={13} c="#fff">{opening ? "…" : "Go"}</T></Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {screen.html ? <Page html={screen.html} sendRef={send} onMsg={(m) => m.s && setScreen((s) => ({ ...s, status: m.s!, err: m.s === "error" ? "The screen connection dropped." : s.err }))} /> : null}
          {screen.status !== "live" ? (
            <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", padding: 24 }}>
              {screen.status === "connecting" ? <><View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "rgba(139,108,255,0.3)", borderTopColor: "#b9a3ff" }} /><T s={13.5} c="rgba(255,255,255,0.7)" style={{ marginTop: 12 }}>Starting the desktop…</T></>
                : <><T s={14} c="rgba(255,255,255,0.8)" style={{ textAlign: "center" }}>{screen.err || "The screen is disconnected."}</T><Pressable onPress={() => setGen((g) => g + 1)} style={{ marginTop: 12, height: 36, borderRadius: 18, paddingHorizontal: 16, justifyContent: "center", backgroundColor: GRAPE }}><T f="bold" s={13} c="#fff">Reconnect</T></Pressable></>}
            </View>
          ) : null}
        </View>
        {kbd ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" }}>
            <TextInput autoFocus value={typed} onChangeText={setTyped} onSubmitEditing={() => { send.current?.({ op: "type", t: typed }); setTyped(""); }} autoCapitalize="none" placeholder="Type into the desktop" placeholderTextColor="rgba(255,255,255,0.45)" style={{ flex: 1, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 14, color: "#fff", fontSize: 14 }} />
            {[["Type", () => { send.current?.({ op: "type", t: typed }); setTyped(""); }], ["Enter", () => send.current?.({ op: "key", k: 0xff0d })], ["⌫", () => send.current?.({ op: "key", k: 0xff08 })]].map(([l, f]) => <Pressable key={l as string} onPress={f as () => void} style={{ height: 36, borderRadius: 18, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" }}><T f="bold" s={12.5} c="#fff">{l as string}</T></Pressable>)}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 + insets.bottom, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" }}>
          <Chip label={big ? "Fit to screen" : "Full desktop"} on={false} onPress={() => setBig((z) => !z)} />
          <Chip label="Keyboard" on={kbd} onPress={() => setKbd((x) => !x)} />
          <Chip label="Address bar" onPress={() => send.current?.({ op: "addr" })} disabled={screen.status !== "live"} />
          <T s={11.5} c="rgba(255,255,255,0.45)" style={{ marginLeft: "auto" }}>Tap to click</T>
        </View>
      </View>

      <View style={{ flex: 1, display: tab === "terminal" ? "flex" : "none", backgroundColor: BG }}>
        {term.html ? <Page html={term.html} onMsg={(m) => { if (m.s) setTerm((t) => ({ ...t, status: m.s! })); if (m.files) void loadFiles(); }} /> : null}
      </View>

      {tab === "files" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {path !== HOME ? <Pressable onPress={() => { setOpen(null); void loadFiles(path.split("/").slice(0, -1).join("/") || HOME); }} style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 10, paddingVertical: 4 }}><T f="bold" s={12.5} c={k.brandInk}>Up</T></Pressable> : null}
            <T f="mono" s={12} c={k.ink60} lines={1} style={{ flexShrink: 1 }}>{path}</T>
            <Pressable onPress={() => void loadFiles()} style={{ marginLeft: "auto", borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 10, paddingVertical: 4 }}><T f="bold" s={12.5} c={k.brandInk}>Refresh</T></Pressable>
          </View>
          {open ? (
            <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: k.line }}><T f="monoB" s={12.5} lines={1} style={{ flexShrink: 1 }}>{open.name}</T><Pressable onPress={() => setOpen(null)}><T f="bold" s={12.5} c={k.brandInk}>Close</T></Pressable></View>
              <ScrollView style={{ maxHeight: 420 }}><T f="mono" s={12} style={{ padding: 12 }}>{open.text || "(empty)"}</T></ScrollView>
            </View>
          ) : (
            <View style={{ marginTop: 8, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}>
              {files === null ? <T s={13} c={k.ink60} style={{ padding: 12 }}>Loading…</T> : !files.length ? <T s={13} c={k.ink60} style={{ padding: 12 }}>No files yet.</T> : files.map((f, i) => (
                <Pressable key={f.name} onPress={() => void openFile(f)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={f.dir ? "folder" : "file"} size={15} color={k.brandInk} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}><T f="semi" s={14} lines={1}>{f.name}</T><T s={12} c={k.ink45}>{f.dir ? "Folder" : kb(f.size)} · {new Date(f.mtime).toLocaleString()}</T></View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
