import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import { Screen, Face, Title, Muted } from "@/components/ui";
import { useSession } from "@/state/session";
import { msgId, streamChat } from "@/lib/api";
import { grape } from "@/theme/colors";

export default function Call() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useSession();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [live, setLive] = useState(false);
  const [line, setLine] = useState("Tap the mic and talk.");
  const [mood, setMood] = useState<"idle" | "speaking" | "thinking">("idle");

  const toggle = async () => {
    if (!token || !slug) return;
    if (!live) {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setLine("Microphone permission is off."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await activateKeepAwakeAsync();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setLive(true);
      setMood("thinking");
      setLine("Listening… tap again to send the turn.");
      return;
    }
    await recorder.stop();
    setLive(false);
    deactivateKeepAwake();
    const reply = msgId();
    setLine("");
    await streamChat({
      convo: slug, text: "Voice turn", speaker: slug, history: [], recall: [],
      userMsgId: msgId(), replyMsgId: reply, meta: { voice: 1 }, call: true, tz: "UTC",
    }, token, (ev) => {
      if (ev.token) { setMood("speaking"); setLine((t) => t + ev.token); }
      if (ev.done) setMood("idle");
    }).catch((e: Error) => setLine(e.message));
  };

  return (
    <Screen style={{ alignItems: "center" }}>
      <Face mood={mood === "speaking" ? "speaking" : mood === "thinking" ? "thinking" : "idle"} />
      <Title>{slug || "Call"}</Title>
      <Muted>{line}</Muted>
      <Pressable onPress={toggle} accessibilityLabel={live ? "Send turn" : "Record"} style={{ marginTop: 24, backgroundColor: grape, width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff" }}>{live ? "Send" : "Mic"}</Text>
      </Pressable>
      <View />
    </Screen>
  );
}
