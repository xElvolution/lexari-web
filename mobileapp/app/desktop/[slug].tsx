import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";
import { Screen, Title, Muted, ErrorText } from "@/components/ui";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { grape } from "@/theme/colors";

type Ticket = { path: string; ticket: string };

function page(ws: string, ticket: string, control: boolean) {
  return `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0d0b14;color:#fff;font:13px sans-serif">
<div id="s" style="padding:12px">Connecting…</div>
<div id="host" style="width:100%;height:100vh"></div>
<script type="module">
import RFB from "https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js";
const s = document.getElementById("s");
try {
  const rfb = new RFB(document.getElementById("host"), ${JSON.stringify(ws)}, { wsProtocols: ["binary", ${JSON.stringify("lxt.")} + ${JSON.stringify(ticket)}], shared: true });
  rfb.scaleViewport = true; rfb.resizeSession = true; rfb.viewOnly = ${control ? "false" : "true"};
  rfb.addEventListener("connect", () => { s.textContent = ${control ? '"You have the keyboard."' : '"View only."'}; });
  rfb.addEventListener("disconnect", () => { s.textContent = "Disconnected."; });
} catch (e) { s.textContent = "Viewer failed to load."; }
</script></body></html>`;
}

export default function Desktop() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useSession();
  const [html, setHtml] = useState("");
  const [control, setControl] = useState(false);
  const [err, setErr] = useState("");

  const open = async (take: boolean) => {
    if (!token) return;
    try {
      const t = await api<Ticket>("/api/desktop/ticket", {}, token);
      const host = new URL(env.apiUrl).host;
      const ws = `wss://${host}${t.path}?k=vnc`;
      setControl(take);
      setHtml(page(ws, t.ticket, take));
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Desktop failed"); }
  };

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: 14 }}>
        <Title>Computer</Title>
        <Muted>{slug} · view only until you take over.</Muted>
        <Pressable onPress={() => open(false)} style={{ marginTop: 8 }}><Text style={{ color: grape }}>Open</Text></Pressable>
        <Pressable onPress={() => open(true)} style={{ marginTop: 4 }}><Text style={{ color: grape }}>{control ? "Take over is on" : "Take over"}</Text></Pressable>
        {err ? <ErrorText text={err} /> : null}
      </View>
      {html ? <WebView originWhitelist={["*"]} source={{ html }} style={{ flex: 1, marginTop: 8, backgroundColor: "#0d0b14" }} /> : null}
    </Screen>
  );
}
