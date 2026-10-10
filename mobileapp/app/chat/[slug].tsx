import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Screen, Title, Face, Muted, ErrorText } from "@/components/ui";
import { ConfirmCard } from "@/components/ConfirmCard";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { msgId, streamChat, type ChatEvent } from "@/lib/api";
import { findSecrets, isBlockedKind, scanSecrets } from "@/lib/secretScan";
import { grape } from "@/theme/colors";

type Line = {
  id: string;
  from: "me" | "agent";
  text: string;
  confirm?: { title: string; amount: string; to: string };
  secretId?: string;
};

function asConfirm(send: Record<string, unknown> | undefined) {
  if (!send) return undefined;
  const amount = String(send.amount ?? send.usd ?? send.title ?? "Payment");
  const to = String(send.to ?? send.recipient ?? "Lexari treasury");
  const title = String(send.title ?? "Confirm");
  return { title, amount, to };
}

export default function Chat() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useSession();
  const { palette } = usePrefs();
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<"idle" | "thinking" | "speaking" | "happy">("idle");
  const [err, setErr] = useState("");

  const send = async () => {
    if (!token || !text.trim() || !slug) return;
    const found = await findSecrets(text);
    if (found.some((f) => isBlockedKind(f.kind))) {
      setErr("Seed phrases and private keys are blocked. They are not sent.");
      return;
    }
    const key = found.find((f) => f.kind === "key");
    if (key) { setErr(`That looks like ${key.label}. Save it in Secrets.`); return; }
    const mine: Line = { id: msgId(), from: "me", text: text.trim() };
    const replyId = msgId();
    setLines((xs) => [...xs, mine, { id: replyId, from: "agent", text: "" }]);
    setText("");
    setMood("thinking");
    setErr("");
    try {
      await streamChat({
        convo: slug, text: mine.text, speaker: slug, history: [], recall: [],
        userMsgId: mine.id, replyMsgId: replyId, meta: {}, tz: "UTC",
      }, token, (ev: ChatEvent) => {
        if (ev.token) {
          setMood("speaking");
          setLines((xs) => xs.map((l) => l.id === replyId ? { ...l, text: l.text + (ev.token || "") } : l));
        }
        if (ev.replace) setLines((xs) => xs.map((l) => l.id === replyId ? { ...l, text: ev.replace || "" } : l));
        if (ev.send) setLines((xs) => xs.map((l) => l.id === replyId ? { ...l, confirm: asConfirm(ev.send) } : l));
        if (ev.secret?.id) setLines((xs) => xs.map((l) => l.id === replyId ? { ...l, secretId: ev.secret?.id } : l));
        if (ev.error) setErr(ev.error);
        if (ev.done) setMood("happy");
      });
    } catch (e) {
      setMood("idle");
      setErr(e instanceof Error ? e.message : "Chat failed.");
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Face mood={mood} />
        <View>
          <Title>{slug || "Chat"}</Title>
          <Muted>{mood === "thinking" ? "Thinking" : mood === "speaking" ? "Speaking" : "Ready"}</Muted>
        </View>
      </View>
      <ScrollView style={{ flex: 1, marginTop: 10 }} contentContainerStyle={{ paddingBottom: 12 }}>
        {lines.map((l) => (
          <View key={l.id} style={{ marginBottom: 10, alignSelf: l.from === "me" ? "flex-end" : "flex-start", maxWidth: "92%", backgroundColor: l.from === "me" ? palette.tint : "transparent", borderRadius: 14, paddingHorizontal: l.from === "me" ? 10 : 0, paddingVertical: 6 }}>
            {l.text ? <Text style={{ color: palette.ink, fontSize: 14 }}>{l.text}</Text> : null}
            {l.confirm ? (
              <ConfirmCard title={l.confirm.title} amount={l.confirm.amount} to={l.confirm.to} onReview={() => router.push({ pathname: "/confirm/[id]", params: { id: l.id, payload: JSON.stringify(l.confirm) } })} />
            ) : null}
            {l.secretId ? <Pressable onPress={() => router.push(`/settings/secrets?request=${l.secretId}`)}><Text style={{ color: grape, fontSize: 13 }}>Save a key securely</Text></Pressable> : null}
          </View>
        ))}
      </ScrollView>
      {err ? <ErrorText text={err} /> : null}
      <View style={{ flexDirection: "row", gap: 8, paddingBottom: 8 }}>
        <TextInput
          value={text}
          onChangeText={(v) => { setText(v); if (scanSecrets(v).some((f) => isBlockedKind(f.kind))) setErr("That text contains a seed or a private key."); }}
          placeholder="Message"
          placeholderTextColor={palette.muted}
          style={{ flex: 1, borderWidth: 1, borderColor: palette.line, borderRadius: 16, color: palette.ink, paddingHorizontal: 12, fontSize: 14, minHeight: 44 }}
        />
        <Pressable onPress={send} style={{ backgroundColor: grape, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 14 }}>Send</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
