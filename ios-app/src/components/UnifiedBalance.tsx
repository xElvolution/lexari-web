import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "@/lib/api";
import { Btn, Label, T, useC } from "@/web/kit";
import { router } from "expo-router";

type B = { totalUsd: number; assets: { asset: string; amount: number; usd: number; where: string[] }[]; partial: boolean };
const fmt = (n: number) => (+n.toFixed(n < 1 ? 6 : 4)).toLocaleString("en-US", { maximumFractionDigits: 6 });

/** One balance on the phone: a USD total and its assets. Where funds sit is a small detail. Same API as the web. */
export default function UnifiedBalance({ slug, name, token }: { slug: string; name: string; token: string | null }) {
  const k = useC();
  const [b, setB] = useState<B | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { void api<B>(`/api/agents/balance?agent=${encodeURIComponent(slug)}`, {}, token).then(setB).catch(() => setB(null)); }, [slug, token]);
  if (!b) return null;
  const held = b.assets.filter((x) => x.amount > 0);
  return (
    <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16 }}>
      <Label s={9} c={k.ink45}>{name}&apos;s balance</Label>
      <T f="bold" s={28} style={{ marginTop: 4 }}>${b.totalUsd.toFixed(2)}</T>
      <T s={12} c={k.ink60}>Your agent moves money to whichever chain a trade needs, with your Confirm.</T>
      {held.length ? held.map((x) => (
        <View key={x.asset} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <T f="bold" s={13.5}>{x.asset}</T><T s={13.5} c={k.ink75}>{fmt(x.amount)} · ${x.usd.toFixed(2)}</T>
        </View>
      )) : <T s={13} c={k.ink60} style={{ marginTop: 6 }}>Nothing here yet. Fund {name} from your Lexari balance.</T>}
      <Btn label={`Fund ${name} from your balance`} h={44} style={{ marginTop: 10 }} onPress={() => router.push("/(tabs)/wallets")} />
      <T f="semi" s={12.5} c={k.ink60} style={{ marginTop: 6 }} onPress={() => setOpen(!open)}>Advanced: where funds sit</T>
      {open ? held.map((x) => <T key={x.asset} s={12} c={k.ink60}>{x.asset}: {x.where.join(", ")}</T>) : null}
    </View>
  );
}
