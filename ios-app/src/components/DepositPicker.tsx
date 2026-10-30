import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { api } from "@/lib/api";
import { Btn, Label, T, WSheet, useC } from "@/web/kit";

type Chain = { assetId: string; chain: string; chainName: string; decimals: number; direct?: boolean; network?: string; note?: string };
type Coin = { symbol: string; name: string; price: number; logo: string | null; chains: Chain[] };
type Addr = { ready: boolean; chain: string; address?: string; memo?: string | null; receive?: string | null; direct?: boolean; note?: string };

function CoinLogo({ c, size = 30 }: { c: Coin; size?: number }) {
  const k = useC();
  const [bad, setBad] = useState(false);
  if (c.logo && !bad) return <Image source={{ uri: c.logo }} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#fff" }} />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="bold" s={10}>{c.symbol.slice(0, 3)}</T></View>;
}

/** Phone deposit picker: same Aurora Intents coin list and deposit address as the web. */
export default function DepositPicker({ open, slug, name, token, onClose }: { open: boolean; slug: string; name: string; token: string | null; onClose: () => void }) {
  const k = useC();
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [coin, setCoin] = useState<Coin | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [amount, setAmount] = useState("");
  const [addr, setAddr] = useState<Addr | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (open && !coins) void api<{ ready: boolean; coins: Coin[] }>("/api/agents/deposit", {}, token).then((r) => { setCoins(r.coins); setReady(r.ready); }).catch(() => setErr("Couldn't load coins from Aurora Intents.")); }, [open, coins, token]);
  const list = useMemo(() => (coins || []).filter((c) => !q || `${c.symbol} ${c.name}`.toLowerCase().includes(q.toLowerCase())), [coins, q]);
  const go = async () => {
    if (!chain) return; setErr("");
    try { setAddr(await api<Addr>("/api/agents/deposit", { method: "POST", body: JSON.stringify({ agent: slug, assetId: chain.assetId, amount: Number(amount) }) }, token)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't get an address."); }
  };
  const input = { borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 12, color: k.ink, fontSize: 14 } as const;
  return (
    <WSheet open={open} title={coin ? `Deposit ${coin.symbol}` : `Deposit to ${name}`} sub={`Any of ${coins?.length ?? 30}+ coins. Aurora Intents converts it to USDC in ${name}'s balance.`} onClose={() => { setCoin(null); setAddr(null); onClose(); }}>
      {!coin ? (
        <View style={{ gap: 10 }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search coins" placeholderTextColor={k.ink45} style={input} />
          <ScrollView style={{ maxHeight: 420 }}><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {list.map((c) => (
              <Pressable key={c.symbol} onPress={() => { setCoin(c); setChain(c.chains[0]); }} style={{ width: "48%", flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 16, backgroundColor: k.tint }}>
                <CoinLogo c={c} /><View style={{ flex: 1 }}><T f="bold" s={13.5}>{c.symbol}</T><T s={11} c={k.ink60} lines={1}>{c.name}</T></View>
              </Pressable>
            ))}
          </View></ScrollView>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Pressable onPress={() => { setCoin(null); setAddr(null); }}><T f="semi" s={13} c={k.ink60}>Back to coins</T></Pressable>
          <Label s={9.5} c={k.ink60}>Sending from</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{coin.chains.map((x) => (
            <Pressable key={x.assetId} onPress={() => { setChain(x); setAddr(null); }} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: chain?.assetId === x.assetId ? k.ink : k.tint }}><T s={12.5} c={chain?.assetId === x.assetId ? k.bg : k.ink}>{x.direct ? `${x.network} · direct` : x.chainName}</T></Pressable>
          ))}</View>
          {chain?.direct ? <T s={12.5} c={k.ink60}>{`${chain.network}. ${chain.note}`}</T> : <TextInput value={amount} onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setAddr(null); }} keyboardType="decimal-pad" placeholder={`Amount of ${coin.symbol}`} placeholderTextColor={k.ink45} style={input} />}
          {!ready && !chain?.direct ? <T s={12.5} c={k.ink60}>Setup needed. Deposit addresses come from Aurora Intents, which isn&apos;t set up on this server yet.</T> : null}
          <Btn label={chain?.direct ? `Show ${name}'s ${chain.network} address` : "Get deposit address"} h={48} disabled={!chain?.direct && (!ready || !(Number(amount) > 0))} onPress={() => void go()} />
          {addr?.address ? (
            <View style={{ alignItems: "center", gap: 8, padding: 14, borderRadius: 16, backgroundColor: k.tint }}>
              <View style={{ padding: 10, borderRadius: 14, backgroundColor: "#fff" }}><QRCode value={addr.address} size={160} /></View>
              <Pressable onPress={() => Clipboard.setStringAsync(addr.address!)}><T f="mono" s={12} c={k.ink75} style={{ textAlign: "center" }}>{addr.address}</T></Pressable>
              {addr.memo ? <T f="bold" s={12}>{`Memo (required): ${addr.memo}`}</T> : null}
              <T s={12} c={k.ink60} style={{ textAlign: "center" }}>{addr.direct ? `Network: ${addr.chain}. ${addr.note}` : `Send exactly ${amount} ${coin.symbol} on ${addr.chain}. ${name} gets about ${addr.receive} USDC.`}</T>
            </View>
          ) : null}
        </View>
      )}
      {err ? <T s={12.5} c="#dc2626" style={{ marginTop: 8 }}>{err}</T> : null}
    </WSheet>
  );
}
