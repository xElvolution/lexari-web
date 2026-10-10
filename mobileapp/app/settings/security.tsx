import { useEffect, useState } from "react";
import { ScrollView, Switch, Text } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import { Screen, Title, Row, Muted } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";
import { biometricGate } from "@/components/Gates";

type Sec = { settings?: { phrase?: string; dailySendCapUsd?: number }; sessions?: { id: string; device: string; current?: boolean }[] };

export default function Security() {
  const { token } = useSession();
  const { lockOn, setLock, palette } = usePrefs();
  const [sec, setSec] = useState<Sec | null>(null);
  useEffect(() => { ScreenCapture.preventScreenCaptureAsync().catch(() => {}); load().catch(() => {}); }, [token]);

  const load = async () => {
    if (!token) return;
    setSec(await api<Sec>("/api/security", {}, token).catch(() => null));
  };

  return (
    <Screen>
      <Title>Security</Title>
      <ScrollView>
        <Muted>Phrase {sec?.settings?.phrase || "not set"} · daily cap ${sec?.settings?.dailySendCapUsd ?? "—"}</Muted>
        <Row title="App lock" detail={lockOn ? "On" : "Off"} />
        <Switch value={lockOn} onValueChange={async (on) => { if (on && !(await biometricGate("Turn on the app lock"))) return; setLock(on); }} />
        {(sec?.sessions || []).map((s) => <Row key={s.id} title={s.device} detail={s.current ? "This phone" : "Other"} />)}
        <Text style={{ color: palette.muted, fontSize: 11, marginTop: 8 }}>Step-up still asks the server for a PIN or wallet signature. Biometrics only gate this phone.</Text>
      </ScrollView>
    </Screen>
  );
}
