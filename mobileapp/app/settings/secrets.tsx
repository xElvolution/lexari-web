import { useEffect, useState } from "react";
import { TextInput, Pressable, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import * as Clipboard from "expo-clipboard";
import { Screen, Title, Muted, ErrorText } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";
import { findSecrets, isBlockedKind } from "@/lib/secretScan";
import { biometricGate } from "@/components/Gates";
import { grape } from "@/theme/colors";

export default function Secrets() {
  const { request } = useLocalSearchParams<{ request?: string }>();
  const { token } = useSession();
  const { palette } = usePrefs();
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  useEffect(() => { ScreenCapture.preventScreenCaptureAsync().catch(() => {}); }, []);

  const save = async () => {
    if (!token || !request) { setErr("Open this from a key card in chat."); return; }
    const found = await findSecrets(value);
    if (found.some((f) => isBlockedKind(f.kind))) { setErr("Seed phrases and private keys are blocked."); return; }
    if (!(await biometricGate("Save this key"))) return;
    try {
      await api(`/api/secrets/requests/${request}`, { method: "POST", body: JSON.stringify({ value }) }, token);
      setValue("");
      await Clipboard.setStringAsync("");
      setOk("Saved. The agent only sees the name.");
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
  };

  return (
    <Screen>
      <Title>Secrets</Title>
      <Muted>The value stays masked and is not logged.</Muted>
      <TextInput value={value} onChangeText={setValue} secureTextEntry autoComplete="off" importantForAutofill="no" autoCorrect={false} placeholder="Key" placeholderTextColor={palette.muted} style={{ marginTop: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 12, color: palette.ink, padding: 10 }} />
      <Pressable onPress={save} style={{ marginTop: 12, backgroundColor: grape, borderRadius: 12, padding: 10 }}><Text style={{ color: "#fff", textAlign: "center" }}>Save securely</Text></Pressable>
      {ok ? <Muted>{ok}</Muted> : null}
      {err ? <ErrorText text={err} /> : null}
    </Screen>
  );
}
