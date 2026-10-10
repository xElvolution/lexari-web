import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { Screen, Title, Money, Muted, Loading, ErrorText, IconButton } from "@/components/ui";
import { useSession } from "@/state/session";
import { usePrefs } from "@/state/prefs";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { networkBadge } from "@/lib/network";
import { grape } from "@/theme/colors";
import { COINS } from "@/content/roster";

type WalletRes = { balance?: { usd?: number; micros?: number } };
type Sec = { settings?: { phrase?: string; dailySendCapUsd?: number } };

export default function WalletTab() {
  const { token, wallet } = useSession();
  const { palette, hideBalances, toggleBalances } = usePrefs();
  const [data, setData] = useState<WalletRes | null>(null);
  const [sec, setSec] = useState<Sec | null>(null);
  const [err, setErr] = useState("");
  const badge = networkBadge(env.cluster);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await api<WalletRes>("/api/wallet", {}, token));
      setSec(await api<Sec>("/api/security", {}, token));
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "The wallet did not load."); }
  }, [token]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const usd = data?.balance?.usd != null ? `$${data.balance.usd.toFixed(2)}` : data?.balance?.micros != null ? `$${(data.balance.micros / 1_000_000).toFixed(2)}` : "—";

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title>Wallet</Title>
        <IconButton label={hideBalances ? "Show balances" : "Hide balances"} onPress={toggleBalances}>
          {hideBalances ? <EyeOff color={palette.ink} size={16} /> : <Eye color={palette.ink} size={16} />}
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <Text style={{ color: badge.tone === "real" ? "#f5c542" : palette.brand, fontSize: 12, marginTop: 8 }}>{badge.label}</Text>
        {!data && !err ? <Loading /> : null}
        <View style={{ marginTop: 8 }}><Money amount={usd} /></View>
        <Muted>Daily cap ${sec?.settings?.dailySendCapUsd ?? "—"}{sec?.settings?.phrase ? ` · phrase ${sec.settings.phrase}` : ""}</Muted>
        {wallet ? (
          <View style={{ marginTop: 16, alignItems: "flex-start", gap: 6 }}>
            <QRCode value={wallet} size={148} backgroundColor="transparent" color={palette.ink} />
            <Muted>{wallet}</Muted>
          </View>
        ) : null}
        <Text style={{ color: palette.ink, marginTop: 18, fontWeight: "700" }}>Top up</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {COINS.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/topup?coin=${c.id}`)} style={{ width: "47%", backgroundColor: palette.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.id === "SKR" ? grape : palette.line }}>
              <Text style={{ color: c.color, fontWeight: "700" }}>{c.id}</Text>
              <Muted>{c.name}</Muted>
            </Pressable>
          ))}
        </View>
        {err ? <ErrorText text={err} /> : null}
      </ScrollView>
    </Screen>
  );
}
