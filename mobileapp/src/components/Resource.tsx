import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Screen, Title, Muted, Loading, ErrorText } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";

function rowsOf(data: unknown): { title: string; detail: string }[] {
  if (Array.isArray(data)) {
    return data.slice(0, 40).map((item, i) => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const title = String(o.name || o.title || o.slug || o.id || `Item ${i + 1}`);
        const detail = String(o.role || o.job || o.kind || o.status || "").slice(0, 80);
        return { title, detail };
      }
      return { title: String(item).slice(0, 80), detail: "" };
    });
  }
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).slice(0, 24).map(([k, v]) => ({
      title: k,
      detail: typeof v === "object" ? "" : String(v).slice(0, 80),
    }));
  }
  return [];
}

/** A readable page for an account route. It does not print secrets. */
export function Resource({ title, path, hint }: { title: string; path: string; hint: string }) {
  const { token } = useSession();
  const { palette } = usePrefs();
  const [rows, setRows] = useState<{ title: string; detail: string }[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!token) return;
    api<unknown>(path, {}, token).then((data) => { setRows(rowsOf(data)); setErr(""); }).catch((e: Error) => setErr(e.message));
  }, [token, path]);
  return (
    <Screen>
      <Title>{title}</Title>
      <Muted>{hint}</Muted>
      <ScrollView>
        {rows === null && !err ? <Loading /> : null}
        {(rows || []).map((r) => (
          <View key={r.title + r.detail} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line }}>
            <Text style={{ color: palette.ink, fontSize: 14 }}>{r.title}</Text>
            {r.detail ? <Text style={{ color: palette.muted, fontSize: 11 }}>{r.detail}</Text> : null}
          </View>
        ))}
        {rows && rows.length === 0 ? <Muted>Nothing here yet.</Muted> : null}
        {err ? <ErrorText text={err} /> : null}
      </ScrollView>
    </Screen>
  );
}
