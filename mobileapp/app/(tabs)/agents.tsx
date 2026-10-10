import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Title, Face, Muted, Loading, ErrorText, Sheet } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";

type Agent = { slug: string; name: string; role?: string; kind?: string };

const COLORS = ["#c9b8ff", "#8b5cf6", "#14F1D9", "#f9a8d4", "#34d399"];

export default function Agents() {
  const { token } = useSession();
  const { palette } = usePrefs();
  const [rows, setRows] = useState<Agent[] | null>(null);
  const [open, setOpen] = useState<Agent | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api<{ agents: Agent[] }>("/api/agents", {}, token);
      setRows(res.agents || []);
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Agents did not load."); }
  }, [token]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const go = (path: string) => { setOpen(null); router.push(path); };

  return (
    <Screen>
      <Title>Agents</Title>
      <Muted>Tap one to chat, call, or open its computer.</Muted>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {rows === null && !err ? <Loading /> : null}
        {(rows || []).map((a, i) => (
          <Pressable key={a.slug} onPress={() => setOpen(a)} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 }}>
            <Face color={COLORS[i % COLORS.length]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "600" }}>{a.name}</Text>
              <Muted>{a.role || a.kind || "Agent"}</Muted>
            </View>
          </Pressable>
        ))}
        {rows && rows.length === 0 ? <Muted>You have no agents yet. Hire one from the marketplace.</Muted> : null}
        {err ? <ErrorText text={err} /> : null}
      </ScrollView>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: palette.ink, fontSize: 18, fontWeight: "700" }}>{open.name}</Text>
            <Muted>{open.role || open.slug}</Muted>
            <Pressable onPress={() => go(`/chat/${open.slug}`)}><Text style={{ color: palette.brand, fontSize: 15 }}>Chat</Text></Pressable>
            <Pressable onPress={() => go(`/call/${open.slug}`)}><Text style={{ color: palette.brand, fontSize: 15 }}>Call</Text></Pressable>
            <Pressable onPress={() => go(`/desktop/${open.slug}`)}><Text style={{ color: palette.brand, fontSize: 15 }}>Computer</Text></Pressable>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
