/** Voice call, ported from the web CallOverlay: dark grape glow, "Lexari voice call", the agent's face (rings while it
 * talks or listens), name, timer, state pill, Mute and End. Turn loop: listen → the agent answers (call mode, two
 * sentences) → it speaks → listen again. The call is logged in the chat as "Voice call · m:ss" when it ends. */
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Icon from "@/components/Icon";
import { api, msgId, streamChat } from "@/lib/api";
import { useSession } from "@/state/session";
import { nameOf, useData } from "@/web/data";
import { AgentTile, T } from "@/web/kit";
import { specialist } from "@/content/roster";

type Phase = "connecting" | "listening" | "hearing" | "thinking" | "speaking" | "muted" | "error";
const LABEL: Record<Phase, string> = { connecting: "Connecting…", listening: "Listening", hearing: "Listening", thinking: "Thinking…", speaking: "Speaking", muted: "Muted", error: "" };
const LILAC = "#c9b8ff";
const fmtSecs = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

/** One expanding ring around the face (the web's ring-out). */
function RingOut({ delay, dur, color }: { delay: number; dur: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, [v, delay, dur]);
  return <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: 100, height: 100, borderRadius: 32, borderWidth: 2, borderColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] }} />;
}

/** Listens for one phrase. Resolves with the words ("" on silence). */
function listenOnce(maxMs: number, onText: (t: string) => void): { done: Promise<string>; abort: () => void } {
  let fin = "", settled = false;
  let res: (v: string) => void = () => {};
  const done = new Promise<string>((r) => { res = r; });
  const subs = [
    ExpoSpeechRecognitionModule.addListener("result", (e) => { const t = e.results?.[0]?.transcript || ""; onText(t); if (e.isFinal) fin = t; }),
    ExpoSpeechRecognitionModule.addListener("end", () => finish(fin)),
    ExpoSpeechRecognitionModule.addListener("error", () => finish(fin)),
  ];
  const timer = setTimeout(() => { try { ExpoSpeechRecognitionModule.stop(); } catch { finish(fin); } }, maxMs);
  function finish(v: string) { if (settled) return; settled = true; clearTimeout(timer); subs.forEach((s) => s.remove()); res(v.trim()); }
  try { ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: false }); } catch { finish(""); }
  return { done, abort: () => { try { ExpoSpeechRecognitionModule.abort(); } catch { /* already stopped */ } finish(""); } };
}

export default function Call() {
  const { slug: id = "home" } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me, reload } = useData();
  const name = me?.agents.find((a) => a.slug === id)?.name || specialist(id)?.name || nameOf(me, id);
  const look = me?.agents.find((a) => a.slug === id)?.look ?? (id === "home" ? me?.agents.find((a) => a.slug === "home")?.look : undefined);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [note, setNote] = useState("");
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const secsRef = useRef(0); secsRef.current = secs;
  const mutedRef = useRef(false); mutedRef.current = muted;
  const ended = useRef(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => { if (phase === "connecting") return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [phase === "connecting"]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { Animated.timing(scale, { toValue: phase === "speaking" ? 1.04 : 1, duration: 300, useNativeDriver: true }).start(); }, [phase, scale]);
  useEffect(() => { if (muted) { Speech.stop(); setPhase("muted"); } else setPhase((p) => (p === "muted" ? "listening" : p)); }, [muted]);

  useEffect(() => {
    let stop = false; let ear: ReturnType<typeof listenOnce> | null = null;
    const history: { from: string; text: string }[] = [];
    void activateKeepAwakeAsync().catch(() => {});
    (async () => {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => ({ granted: false }));
      if (!perm.granted) { setNote("No microphone was found on this device."); setPhase("error"); return; }
      let quiet = 0;
      while (!stop) {
        if (mutedRef.current) { await new Promise((r) => setTimeout(r, 300)); continue; }
        setPhase("listening"); setNote(quiet >= 3 ? "Say something, or tap end." : "");
        ear = listenOnce(9000, (t) => { if (!stop && t && !mutedRef.current) setPhase("hearing"); });
        const said = await ear.done; ear = null;
        if (stop) return;
        if (!said || mutedRef.current) { quiet++; continue; }
        quiet = 0; setPhase("thinking");
        let text = "";
        try {
          await streamChat({ convo: id, text: said.slice(0, 4000), speaker: id, history: history.slice(-12), recall: [], userMsgId: msgId(), replyMsgId: msgId(), meta: {}, call: true, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }, token || "", (ev) => {
            if (ev.token) text += ev.token; if (ev.replace !== undefined) text = ev.replace;
          });
        } catch { /* falls through to the error below */ }
        if (stop) return;
        history.push({ from: "you", text: said });
        if (!text.trim()) { setNote(`${name} couldn't answer. Say it again.`); setPhase("error"); await new Promise((r) => setTimeout(r, 1200)); continue; }
        history.push({ from: id, text });
        if (mutedRef.current) continue;
        setPhase("speaking");
        await new Promise<void>((r) => Speech.speak(text, { onDone: () => r(), onStopped: () => r(), onError: () => r() }));
      }
    })();
    return () => { stop = true; ear?.abort(); Speech.stop(); deactivateKeepAwake(); };
  }, [id, token, name]);

  const end = () => {
    if (ended.current) return; ended.current = true; Speech.stop();
    const s = secsRef.current;
    if (s > 0 && token) void api("/api/messages", { method: "POST", body: JSON.stringify({ convo: id, clientId: msgId(), from: "system", text: "Voice call", meta: { call: s } }) }, token).then(() => reload()).catch(() => {});
    router.canGoBack() ? router.back() : router.replace(`/chat/${id}`);
  };

  const talking = phase === "speaking", ears = phase === "listening" || phase === "hearing";
  const label = phase === "error" ? note : LABEL[phase];
  return (
    <View style={{ flex: 1, backgroundColor: "#07050e", paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <Svg pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        <Defs><RadialGradient id="g" cx="50%" cy="34%" r="60%"><Stop offset="0" stopColor="#5b2bff" stopOpacity={0.3} /><Stop offset="0.45" stopColor="#5b2bff" stopOpacity={0.1} /><Stop offset="1" stopColor="#5b2bff" stopOpacity={0} /></RadialGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 24 }}>
        <View style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="call" size={13} color="rgba(255,255,255,0.55)" /><T f="semi" s={12.5} c="rgba(255,255,255,0.55)">Lexari voice call</T></View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
          <View style={{ width: 100, height: 100 }}>
            {talking ? [0, 600, 1200].map((d) => <RingOut key={d} delay={d} dur={1800} color="rgba(201,184,255,0.8)" />) : null}
            {ears ? <RingOut delay={0} dur={2600} color="rgba(255,255,255,0.35)" /> : null}
            <Animated.View style={{ transform: [{ scale }] }}><AgentTile slug={id} look={look} size={100} radius={32} ring={id === (me?.prefs?.defaultAgent || "home") ? "primary" : null} dot={false} mood={phase === "thinking" ? "thinking" : talking ? "speaking" : "idle"} /></Animated.View>
          </View>
          <T f="display" s={22} c="#fff" style={{ marginTop: 28 }}>{name}</T>
          <T f="mono" s={14} c="rgba(255,255,255,0.7)" style={{ marginTop: 8 }}>{phase === "connecting" ? "Calling…" : fmtSecs(secs)}</T>
          {label ? (
            <View style={{ marginTop: 20, minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: phase === "error" ? "transparent" : "rgba(255,255,255,0.07)", maxWidth: 300 }}>
              {phase === "thinking" ? <View style={{ flexDirection: "row", gap: 4 }}>{[0, 1, 2].map((i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff", opacity: 0.4 + i * 0.25 }} />)}</View> : null}
              {ears || talking ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: talking ? LILAC : "#22c55e" }} /> : null}
              {phase === "muted" ? <Icon name="micoff" size={14} /> : null}
              <T f="semi" s={13.5} c={phase === "error" ? "#ff9a9d" : "rgba(255,255,255,0.85)"} style={{ textAlign: "center" }}>{label}</T>
            </View>
          ) : null}
          {note && phase !== "error" ? <T s={12.5} c="rgba(255,255,255,0.5)" style={{ marginTop: 8 }}>{note}</T> : null}
        </View>
        <View style={{ marginBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40 }}>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Pressable accessibilityLabel={muted ? "Unmute" : "Mute"} onPress={() => setMuted((m) => !m)} style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: muted ? "#fff" : "rgba(255,255,255,0.12)" }}><Icon name={muted ? "micoff" : "mic"} size={24} color={muted ? "#0a0a0a" : "#fff"} /></Pressable>
            <T s={11.5} c="rgba(255,255,255,0.55)">{muted ? "Unmute" : "Mute"}</T>
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Pressable accessibilityLabel="End call" onPress={end} style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#f04e4e", shadowColor: "#f04e4e", shadowOpacity: 0.7, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } }}><Icon name="hangup" size={28} /></Pressable>
            <T s={11.5} c="rgba(255,255,255,0.55)">End</T>
          </View>
        </View>
      </View>
    </View>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
