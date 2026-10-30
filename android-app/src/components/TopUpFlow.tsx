/**
 * Port of webapp/components/billing/TopUpSheet.tsx + TopUpCrypto.tsx at phone width: $5 / $10 or any amount (min $5),
 * every coin in one searchable list (Lexari deposit networks + every coin Aurora Intents routes), then your own deposit
 * address with QR, copy and the exact amount. Credited automatically once final on chain, exactly once (server side).
 * Below: pay from a connected wallet (Solana via Mobile Wallet Adapter, EVM via your wallet app).
 */
import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { useSession } from "@/state/session";
import { F, GRAPE, Label, Pill, T, WSheet, useC } from "@/web/kit";

type LRail = { key: string; coin: string; symbol: string; name: string; chain: string; chainName: string; network: string; family: string; chainId: number | null; token: string | null; decimals: number; tag: boolean; logo: string | null };
type ACoin = { symbol: string; name: string; logo: string | null; chains: { assetId: string; chainName: string }[] };
type Opt = { kind: "rail"; rail: LRail; chainName: string } | { kind: "aurora"; assetId: string; chainName: string };
type Entry = { symbol: string; name: string; logo: string | null; opts: Opt[] };
type Dep = { address: string; tag?: number; price: number | null; status: string; incoming: number; credited: { usd: number } | null };
type Aur = { address: string; memo: string | null; amount: number; chain: string; receive: string; watch: string };
const MIN = 5;
/** SKR perk, same as the web (content/topup.ts SKR_BONUS): top ups paid in SKR are credited with this bonus. */
export const SKR_BONUS = 0.05;
const abs = (u: string | null) => (!u ? null : u.startsWith("/") ? `${env.apiUrl}${u}` : u);

export default function TopUpFlow({ open, onClose, coin: preset, usd: presetUsd }: { open: boolean; onClose: () => void; coin?: string; usd?: number }) {
  const k = useC();
  const { token } = useSession();
  const [amt, setAmt] = useState(String(presetUsd ?? 5));
  const [data, setData] = useState<{ rails: LRail[]; coins: ACoin[] } | null>(null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [coin, setCoin] = useState<Entry | null>(null);
  const [opt, setOpt] = useState<{ o: Opt; symbol: string } | null>(null);
  useEffect(() => { if (open && token && !data) api<{ rails: LRail[]; coins: ACoin[] }>("/api/topup/aurora", {}, token).then(setData).catch(() => setData({ rails: [], coins: [] })); }, [open, token]);
  // Opened for a coin (Pay with SKR): start on that coin's own deposit network with the amount that covers the price.
  useEffect(() => { if (open && presetUsd !== undefined) setAmt(String(presetUsd)); }, [open, presetUsd]);
  useEffect(() => {
    if (!open || !preset || !data) return;
    const r = data.rails.find((x) => x.coin.toUpperCase() === preset.toUpperCase());
    if (r) setOpt({ o: { kind: "rail", rail: r, chainName: r.chainName }, symbol: r.symbol });
  }, [open, preset, data]);
  const usd = Math.round(Number(amt) * 100) / 100;
  const ok = usd >= MIN && usd <= 1000;
  const list = useMemo(() => {
    const by = new Map<string, Entry>();
    for (const r of data?.rails || []) { const e = by.get(r.symbol.toUpperCase()) || { symbol: r.symbol, name: r.name, logo: abs(r.logo), opts: [] }; e.opts.push({ kind: "rail", rail: r, chainName: r.chainName }); by.set(r.symbol.toUpperCase(), e); }
    for (const a of data?.coins || []) {
      const e = by.get(a.symbol.toUpperCase()) || { symbol: a.symbol, name: a.name, logo: a.logo, opts: [] };
      const have = new Set(e.opts.map((o) => o.chainName.toLowerCase()));
      for (const c of a.chains) if (!have.has(c.chainName.toLowerCase())) e.opts.push({ kind: "aurora", assetId: c.assetId, chainName: c.chainName });
      by.set(a.symbol.toUpperCase(), e);
    }
    const s = q.trim().toLowerCase();
    return [...by.values()].filter((e) => !s || `${e.symbol} ${e.name} ${e.opts.map((o) => o.chainName).join(" ")}`.toLowerCase().includes(s));
  }, [data, q]);
  const close = () => { setPicking(false); setCoin(null); onClose(); };
  const pick = (o: Opt, e: Entry) => { setOpt({ o, symbol: e.symbol }); setPicking(false); setCoin(null); };
  const Mark = ({ e, size = 32 }: { e: Entry; size?: number }) => e.logo ? <Image source={{ uri: e.logo }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: k.tint }} /> : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="bold" s={11}>{e.symbol.slice(0, 3)}</T></View>;

  if (picking) {
    return (
      <WSheet open={open} title="Pay with crypto" icon="wallet" sub="Pick any coin, then the network you'll send on." onClose={() => setPicking(false)}>
        {coin ? (
          <View>
            <Pressable onPress={() => setCoin(null)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}><Icon name="back" size={15} color={k.ink60} /><T f="bold" s={13} c={k.ink60}>All coins</T></Pressable>
            {coin.opts.map((o) => (
              <Pressable key={o.kind === "rail" ? o.rail.key : o.assetId} onPress={() => pick(o, coin)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, marginBottom: 6 }}>
                <View style={{ flex: 1 }}><T f="bold" s={14}>{o.chainName}</T><T s={11.5} c={k.ink60}>{o.kind === "rail" ? o.rail.network : "Converted to dollars on arrival"}</T></View>
                <Icon name="right" size={14} color={k.ink45} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable accessibilityLabel="Back" onPress={() => setPicking(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="back" size={16} color={k.ink60} /></Pressable>
              <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: k.tint, borderWidth: 1, borderColor: k.line, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 }}>
                <Icon name="search" size={16} color={k.ink45} />
                <TextInput value={q} onChangeText={setQ} placeholder={`Search ${list.length || ""} coins or networks`} placeholderTextColor={k.ink45} style={{ flex: 1, color: k.ink, fontFamily: F.sans, fontSize: 14 }} />
              </View>
            </View>
            {!data ? <T s={13} c={k.ink60} style={{ marginTop: 16, textAlign: "center" }}>Loading every coin…</T> : null}
            {list.map((e) => (
              <Pressable key={e.symbol} onPress={() => (e.opts.length === 1 ? pick(e.opts[0], e) : setCoin(e))} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
                <Mark e={e} />
                <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14.5}>{e.symbol}</T><T s={12} c={k.ink60} lines={1}>{e.name}</T></View>
                <T s={11.5} c={k.ink45}>{e.opts.length > 1 ? `${e.opts.length} networks` : e.opts[0].chainName}</T>
                <Icon name="right" size={14} color={k.ink45} />
              </Pressable>
            ))}
          </View>
        )}
      </WSheet>
    );
  }
  return (
    <WSheet open={open} title="Top up" icon="wallet" sub="Add to your Lexari balance." onClose={close}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[5, 10].map((v) => <Pressable key={v} onPress={() => setAmt(String(v))} style={{ flex: 1, borderRadius: 16, paddingVertical: 10, alignItems: "center", backgroundColor: usd === v ? GRAPE : k.card, borderWidth: 1, borderColor: usd === v ? GRAPE : k.line }}><T f="xbold" s={22} c={usd === v ? "#fff" : k.ink}>{`$${v}`}</T></Pressable>)}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 10, backgroundColor: k.card, borderWidth: usd === 5 || usd === 10 ? 1 : 2, borderColor: usd === 5 || usd === 10 ? k.line : GRAPE }}>
          <T f="bold" s={18} c={k.ink45}>$</T>
          <TextInput value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, "").slice(0, 7))} keyboardType="decimal-pad" placeholder="Other" placeholderTextColor={k.ink45} accessibilityLabel="Custom amount" style={{ flex: 1, color: k.ink, fontFamily: F.sans, fontSize: 20, fontWeight: "700" }} />
        </View>
      </View>
      {!ok ? <T s={12.5} c="#e5484d" style={{ marginTop: 8 }}>{usd > 1000 ? "Top ups go up to $1000 at a time." : `The minimum top up is $${MIN}.`}</T> : null}
      <Label s={9.5} c={k.ink60} style={{ marginTop: 20, marginBottom: 8 }}>Pay with</Label>
      <Pressable onPress={() => setPicking(true)} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 12, backgroundColor: k.ink }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}><Icon name="wallet" size={18} color={k.bg} /></View>
        <View style={{ flex: 1 }}><T f="bold" s={14} c={k.bg}>{opt ? opt.symbol : "Crypto"}</T><T s={11.5} c={k.bg}>{opt ? opt.o.chainName : "Any coin, any network"}</T></View>
        <Icon name="right" size={14} color={k.bg} />
      </Pressable>
      <View style={{ marginTop: 16 }}>
        {!opt ? <Pill label="Choose a coin" h={44} onPress={() => setPicking(true)} />
          : !ok ? null
          : opt.o.kind === "rail" ? <RailPay key={`${opt.o.rail.key}-${usd}`} r={opt.o.rail} usd={usd} />
          : <AuroraPay key={`${opt.o.assetId}-${usd}`} assetId={opt.o.assetId} symbol={opt.symbol} usd={usd} />}
      </View>
      <T s={11.5} c={k.ink45} style={{ marginTop: 12, textAlign: "center", lineHeight: 16 }}>{"Your balance pays for AI usage, hires, agent cards and funding agents. It can't be withdrawn."}</T>
    </WSheet>
  );
}

function useWatch(rail: string | null) {
  const { token } = useSession();
  const [v, setV] = useState<Dep | null>(null);
  useEffect(() => {
    if (!rail || !token) return;
    let live = true, first = true, t: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      try { const d = await api<Dep>("/api/topup/deposit", { method: "POST", body: JSON.stringify({ rail, ...(first ? {} : { check: true }) }) }, token); if (live) setV((p) => (p?.credited ? p : d)); } catch { /* retried */ }
      first = false; if (live) t = setTimeout(loop, 8000);
    };
    void loop();
    return () => { live = false; if (t) clearTimeout(t); };
  }, [rail, token]);
  return v;
}

function Box({ address, memo, label, amount, symbol, usd }: { address: string; memo?: string | null; label: string; amount: string; symbol: string; usd: number }) {
  const k = useC();
  return (
    <View style={{ borderRadius: 16, backgroundColor: k.tint, padding: 14, alignItems: "center", gap: 10 }}>
      <View style={{ padding: 10, borderRadius: 16, backgroundColor: "#fff" }}><QRCode value={address} size={160} /></View>
      <Label s={9.5} c={k.ink60}>{label}</Label>
      <Pressable onPress={() => Clipboard.setStringAsync(address)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T f="mono" s={12.5} c={k.ink} style={{ flex: 1, textAlign: "center" }}>{address}</T><Icon name="copy" size={15} color={k.brandInk} /></Pressable>
      {memo ? <Pressable onPress={() => Clipboard.setStringAsync(memo)} style={{ alignSelf: "stretch", borderRadius: 12, backgroundColor: k.card, padding: 10 }}><T f="bold" s={10.5} c={k.ink60}>MEMO / TAG (REQUIRED)</T><T f="mono" s={15}>{memo}</T></Pressable> : null}
      {amount ? <Pressable onPress={() => Clipboard.setStringAsync(amount)} style={{ alignSelf: "stretch", borderRadius: 14, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 12 }}>
        <T s={11.5} c={k.ink60}>Send exactly</T><T f="xbold" s={18}>{`${amount} ${symbol}`}</T><T s={11.5} c={k.ink60}>{`for $${usd.toFixed(2)} on your balance`}</T>
      </Pressable> : null}
    </View>
  );
}

function Status({ v }: { v: Dep | null }) {
  const k = useC();
  const done = !!v?.credited;
  return (
    <View style={{ marginTop: 12, borderRadius: 16, padding: 12, backgroundColor: done ? GRAPE : k.card, borderWidth: done ? 0 : 1, borderColor: k.line, flexDirection: "row", alignItems: "center", gap: 8 }}>
      {done ? <Icon name="check" size={16} color="#fff" /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GRAPE }} />}
      <T f="semi" s={13} c={done ? "#fff" : k.ink} style={{ flex: 1 }}>{done ? `$${v!.credited!.usd.toFixed(2)} added to your balance` : v?.status === "incoming" ? "Arrived, confirming…" : v?.status === "below" ? `Arrived, but under $${MIN}. Send the rest and it's added together.` : v?.status === "capped" ? "Arrived. Test top ups are capped at $50 a day; it's added tomorrow." : "Waiting for your payment. It's added automatically."}</T>
    </View>
  );
}

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const ataOf = (o: PublicKey, m: PublicKey) => PublicKey.findProgramAddressSync([o.toBuffer(), TOKEN.toBuffer(), m.toBuffer()], ATA)[0];
const toAtoms = (amount: string, d: number) => { const [w, f = ""] = amount.split("."); return BigInt(w + (f + "0".repeat(d)).slice(0, d)); };

function RailPay({ r, usd }: { r: LRail; usd: number }) {
  const k = useC();
  const v = useWatch(r.key);
  const [msg, setMsg] = useState("");
  const digits = /USD/.test(r.symbol.toUpperCase()) ? 2 : Math.min(r.decimals, 8);
  const amount = v?.price ? String(+(usd / v.price).toFixed(digits)) : "";
  const walletPay = async () => {
    if (!v) return; setMsg("");
    try {
      if (r.family === "solana") { await payFromSolana(r, v.address, amount); setMsg("Sent. It's added as soon as it confirms."); return; }
      const atoms = toAtoms(amount, r.decimals).toString();
      await Linking.openURL(r.token ? `ethereum:${r.token}@${r.chainId}/transfer?address=${v.address}&uint256=${atoms}` : `ethereum:${v.address}@${r.chainId}?value=${atoms}`);
    } catch (e) { setMsg(e instanceof Error && e.message ? e.message : "Couldn't open a wallet. Scan the QR code from your wallet app instead."); }
  };
  return (
    <View>
      <Warn symbol={r.symbol} network={r.network} />
      <View style={{ marginTop: 12 }}>{v ? <Box address={v.address} memo={v.tag !== undefined ? String(v.tag) : null} label={r.tag ? "Lexari XRP address" : `Your ${r.chainName} deposit address`} amount={amount} symbol={r.symbol} usd={usd} /> : <T s={13} c={k.ink60}>Making your address…</T>}</View>
      {r.coin.toUpperCase() === "SKR" ? <View style={{ marginTop: 10, borderRadius: 16, backgroundColor: "rgba(20,241,217,0.12)", paddingHorizontal: 12, paddingVertical: 8 }}><T f="semi" s={12.5} c={k.ink}>{`SKR perk: you get ${Math.round(SKR_BONUS * 100)}% extra credit, $${(usd * (1 + SKR_BONUS)).toFixed(2)} for this deposit.`}</T></View> : null}
      <Status v={v} />
      {v && amount && !v.credited && (r.family === "solana" || r.family === "evm") ? (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: k.line, paddingTop: 14 }}>
          <Label s={9.5} c={k.ink45}>Or</Label>
          <Pill label="Pay from connected wallet" h={44} style={{ marginTop: 8 }} onPress={() => void walletPay()} />
          <T s={11.5} c={k.ink45} style={{ marginTop: 6, textAlign: "center" }}>{`Sends ${amount} ${r.symbol} from your ${r.family === "evm" ? "EVM" : "Solana"} wallet to the address above. You approve it in the wallet.`}</T>
          {msg ? <T s={12.5} c={k.ink60} style={{ marginTop: 6, textAlign: "center" }}>{msg}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Solana via Mobile Wallet Adapter: the wallet you connect pays, to your own deposit address. */
async function payFromSolana(r: LRail, to: string, amount: string) {
  const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol-web3js");
  const { Connection } = await import("@solana/web3.js");
  const conn = new Connection(env.cluster === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com", "confirmed");
  const atoms = toAtoms(amount, r.decimals);
  await transact(async (w) => {
    const auth = await w.authorize({ identity: { name: "Lexari", uri: "https://lexari.ai" }, chain: env.cluster === "devnet" ? "solana:devnet" : "solana:mainnet" });
    const me = new PublicKey(Buffer.from(auth.accounts[0].address, "base64"));
    const dest = new PublicKey(to);
    const tx = new Transaction();
    if (!r.token) tx.add(SystemProgram.transfer({ fromPubkey: me, toPubkey: dest, lamports: Number(atoms) }));
    else {
      const mint = new PublicKey(r.token), from = ataOf(me, mint), toAta = ataOf(dest, mint);
      tx.add(new TransactionInstruction({ programId: ATA, data: Buffer.from([1]), keys: [
        { pubkey: me, isSigner: true, isWritable: true }, { pubkey: toAta, isSigner: false, isWritable: true }, { pubkey: dest, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: TOKEN, isSigner: false, isWritable: false }] }));
      const data = Buffer.alloc(10); data[0] = 12; let a = atoms; for (let i = 1; i <= 8; i++) { data[i] = Number(a & BigInt(255)); a >>= BigInt(8); } data[9] = r.decimals;
      tx.add(new TransactionInstruction({ programId: TOKEN, data, keys: [
        { pubkey: from, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: toAta, isSigner: false, isWritable: true }, { pubkey: me, isSigner: true, isWritable: false }] }));
    }
    tx.feePayer = me; tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    await w.signAndSendTransactions({ transactions: [tx] });
  });
}

function AuroraPay({ assetId, symbol, usd }: { assetId: string; symbol: string; usd: number }) {
  const k = useC();
  const { token } = useSession();
  const [a, setA] = useState<Aur | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Aur>("/api/topup/aurora", { method: "POST", body: JSON.stringify({ assetId, usd }) }, token).then(setA, (e: Error) => setErr(e.message || "Couldn't get an address for that coin. Try another.")); }, [assetId, usd, token]);
  const v = useWatch(a?.watch ?? null);
  return (
    <View>
      {a ? <Warn symbol={symbol} network={a.chain} /> : null}
      <View style={{ marginTop: 12 }}>{a ? <Box address={a.address} memo={a.memo} label={`Your ${symbol} deposit address on ${a.chain}`} amount={String(a.amount)} symbol={symbol} usd={usd} /> : err ? null : <T s={13} c={k.ink60}>Making your address…</T>}</View>
      {a ? <T s={11.5} c={k.ink45} style={{ marginTop: 8, lineHeight: 16 }}>{`Converted to dollars by Aurora Intents when it arrives (about $${a.receive}). This address is for this top up only; if it can't be converted, it's refunded.`}</T> : null}
      {a ? <Status v={v} /> : null}
      {err ? <T s={13} c="#b42318" style={{ marginTop: 12 }}>{err}</T> : null}
    </View>
  );
}

function Warn({ symbol, network }: { symbol: string; network: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, borderRadius: 16, backgroundColor: "#fff4d6", borderWidth: 1, borderColor: "#f5d27a", padding: 12 }}>
      <Icon name="info" size={16} color="#5c4300" />
      <T s={12.5} c="#5c4300" style={{ flex: 1, lineHeight: 17 }}>{`Send only ${symbol} on ${network}. Anything sent on another network is lost.`}</T>
    </View>
  );
}
