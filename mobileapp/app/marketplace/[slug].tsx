import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Screen, Title, Muted, Face, ErrorText } from "@/components/ui";
import { ROSTER } from "@/content/roster";
import { useSession } from "@/state/session";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { networkBadge } from "@/lib/network";
import { grape } from "@/theme/colors";

export default function HireDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useSession();
  const person = ROSTER.find((s) => s.slug === slug);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const badge = networkBadge(env.cluster);

  const hire = async (pay: "balance" | "skr") => {
    if (!token || !person) return;
    setErr("");
    try {
      if (pay === "balance" || person.free) {
        await api("/api/hires", { method: "POST", body: JSON.stringify({ slug: person.slug, pay: "balance" }) }, token);
        setOk(`${person.name} is on your team.`);
        return;
      }
      router.push({ pathname: "/topup", params: { coin: "SKR", hire: person.slug } });
    } catch (e) { setErr(e instanceof Error ? e.message : "Hire did not go through."); }
  };

  if (!person) return <Screen><Title>Unknown specialist</Title></Screen>;
  return (
    <Screen>
      <Face color={person.color} />
      <Title>{person.name}</Title>
      <Muted>{person.job}. {person.quip}</Muted>
      <Text style={{ marginTop: 10, fontSize: 12, color: badge.tone === "real" ? "#f5c542" : grape }}>{badge.label}</Text>
      <View style={{ marginTop: 16, gap: 10 }}>
        <Pressable onPress={() => hire("balance")} style={{ backgroundColor: grape, borderRadius: 14, padding: 12 }}>
          <Text style={{ color: "#fff", textAlign: "center" }}>{person.free ? "Add for free" : "Pay from balance"}</Text>
        </Pressable>
        {!person.free ? (
          <Pressable onPress={() => hire("skr")} style={{ borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#14F1D9" }}>
            <Text style={{ color: "#14F1D9", textAlign: "center" }}>Pay in SKR</Text>
          </Pressable>
        ) : null}
      </View>
      {ok ? <Muted>{ok}</Muted> : null}
      {err ? <ErrorText text={err} /> : null}
    </Screen>
  );
}
