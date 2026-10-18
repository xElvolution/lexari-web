import { useHideBalance } from "@/lib/privacy";
import { Stage } from "@/web/anim";
import { CardDetailsSheet, PayCardFace, TempoSummary, type PayCard, type Tempo } from "@/components/PayCard";
import { useLocalSearchParams } from "expo-router";
/** Port of webapp/components/wallet/WalletsView.tsx at phone width: Wallet / Cards tabs, Lexari balance (Top up, History), each agent's wallet (Fund, Move to balance). */
import { useEffect, useState } from "react";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { env } from "@/lib/env";
import { signAndSend } from "@/lib/mwa";
import { Image, Linking, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import Icon from "@/components/Icon";
import TopUpFlow from "@/components/TopUpFlow";
import { COINS } from "@/content/roster";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { AgentTile, F, GRAPE, Label, Pill, Segs, T, WSheet, ringOf, short, useC } from "@/web/kit";
import { primaryOf, useData, type Wallet } from "@/web/data";

const usd = (micros: number) => `$${(Math.max(0, micros) / 1e6).toFixed(2)}`;
const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function Wallets() {
  const [addrs, setAddrs] = useState<{ name: string; evm?: string; sol?: string } | null>(null);
  const k = useC();
  const { token } = useSession();
  const { me, wallet, reload } = useData();
  const [hideBalances, setHide] = useHideBalance(); const toggleBalances = () => setHide(!hideBalances);
  const [tab, setTab] = useState<"wallet" | "cards">("wallet");
  const qp = useLocalSearchParams<{ topup?: string }>();
  const [sheet, setSheet] = useState<"topup" | "history" | null>(qp.topup ? "topup" : null);
  const [fund, setFund] = useState<{ slug: string; name: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [tempos, setTempos] = useState<Record<string, Tempo | null>>({});
  const [cards, setCards] = useState<PayCard[] | null>(null);
  const loadCards = async () => {
    if (!token) return;
    try {
      const r = await api<{ cards: PayCard[] }>("/api/cards", {}, token); const list = r.cards || []; setCards(list);
      const got = await Promise.all(list.map((c) => api<Tempo>(`/api/agents/card?agent=${encodeURIComponent(c.agent)}`, {}, token).then((t) => [c.agent, t] as const).catch(() => [c.agent, null] as const)));
      setTempos(Object.fromEntries(got));
    }
    catch { setCards([]); }
  };
  useEffect(() => { loadCards().catch(() => {}); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const primary = primaryOf(me);
  const say = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2800); };
  const back = async (slug: string, name: string) => {
    if (!token) return; setBusy(`back:${slug}`);
    try { const r = await api<{ micros: number }>("/api/wallet/return", { method: "POST", body: JSON.stringify({ agent: slug }) }, token); say(r.micros ? `${usd(r.micros)} back in your balance from ${name}` : `${name}'s wallet has nothing to send back`); await reload(); }
    catch { say("Couldn't send it back."); } finally { setBusy(""); }
  };
  const list = (wallet?.agents ?? []).slice().sort((a, b) => (a.slug === primary ? -1 : b.slug === primary ? 1 : 0));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={k.ink} />}><Stage>
        <Label>Money</Label>
        <T f="display" s={20.5} style={{ marginTop: 10, letterSpacing: -1.1 }}>{tab === "cards" ? "Cards." : "Wallet."}</T>
        <T s={15} c={k.ink75} style={{ marginTop: 8, lineHeight: 21 }}>{tab === "cards" ? "A card lets an agent pay for tools and compute inside a limit you set. Each agent gets its own." : "Your Lexari balance, and the wallets your agents hold."}</T>
        <Segs style={{ marginTop: 16, alignSelf: "flex-start", width: 220 }} on={tab} set={setTab} items={[{ k: "wallet", label: "Wallet", icon: "wallet" }, { k: "cards", label: "Cards", icon: "idcard" }]} />

        {tab === "wallet" ? (
          <>
            <View style={{ marginTop: 16, borderRadius: 26, backgroundColor: GRAPE, padding: 18, overflow: "hidden" }}>
              <View style={{ position: "absolute", right: -40, top: -50, width: 170, height: 170, borderRadius: 85, borderWidth: 22, borderColor: "rgba(255,255,255,0.07)" }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Label c="rgba(255,255,255,0.8)">Lexari balance</Label>
                <Pressable accessibilityLabel={hideBalances ? "Show balance" : "Hide balance"} onPress={toggleBalances} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}><Icon name={hideBalances ? "eyeoff" : "eye"} size={14} color="#fff" /></Pressable>
              </View>
              <T f="xbold" s={30} c="#fff" style={{ marginTop: 10 }}>{wallet ? (hideBalances ? "••••" : usd(wallet.balance)) : "…"}</T>
              <T s={13.5} c="rgba(255,255,255,0.8)" style={{ marginTop: 10, lineHeight: 19 }}>Pays for AI usage past your plan, hires, agent cards and funding your agents.</T>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
                <Pill kind="light" label="Top up" icon="plus" h={44} style={{ flex: 1, backgroundColor: "#fff" }} onPress={() => setSheet("topup")} />
                <Pressable onPress={() => setSheet("history")} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon name="clock" size={16} color="#fff" /><T f="bold" s={14} c="#fff">History</T>
                  {wallet?.history.length ? <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}><T f="bold" s={11} c="#fff">{String(wallet.history.length)}</T></View> : null}
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 22 }}><T f="bold" s={16}>{"Your agents' wallets"}</T><T s={12.5} c={k.ink45}>One per agent</T></View>
            <T s={13} c={k.ink60} style={{ marginTop: 4, lineHeight: 18 }}>{"Each agent holds its own funds for tasks. Fund one from your balance; what's left can come back."}</T>
            {!wallet ? <T s={14} c={k.ink60} style={{ marginTop: 12 }}>Loading…</T> : null}
            {list.map((a) => {
              const w = a.wallets[0]; const held = (w?.holdings ?? []).filter((h) => h.amount > 0); const agent = me?.agents.find((x) => x.slug === a.slug);
              const last = wallet?.history.find((h) => h.kind === "fund" && h.label.includes(a.name));
              return (
                <View key={a.slug} style={{ marginTop: 12, borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <AgentTile slug={a.slug} look={agent?.look} size={40} ring={ringOf(a.slug, a.kind, primary)} />
                    <View style={{ flex: 1 }}><T f="bold" s={15}>{`${a.name}'s wallet`}</T><T s={12.5} c={k.ink60}>{a.slug === primary ? "Its own wallet, separate from your balance" : "Its own wallet for tasks"}</T></View>
                  </View>
                  {w ? (
                    <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}>
                      <Pressable onPress={() => setAddrs({ name: a.name, evm: a.wallets.find((x) => x.chain !== "solana")?.address, sol: a.wallets.find((x) => x.chain === "solana")?.address })} style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}><Label s={8.5} c={k.ink60}>Agent wallet</Label><T f="xbold" s={20}>{`$${a.wallets.flatMap((x) => x.holdings).filter((h) => /USD/.test(h.asset)).reduce((n, h) => n + h.amount / 10 ** h.decimals, 0).toFixed(2)}`}</T></View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 10, paddingVertical: 4 }}><T f="bold" s={12} c={k.brandInk}>Addresses</T><Icon name="right" size={11} color={k.brandInk} /></View>
                      </Pressable>
                      {held.length ? held.map((h) => (
                        <View key={h.asset} style={{ marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: k.line, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Image source={COINS.find((c) => c.id === h.asset)?.logo} style={{ width: 20, height: 20, borderRadius: 10 }} />
                          <T f="bold" s={14}>{`$${(h.amount / 10 ** h.decimals).toFixed(2)}`}</T><T s={11.5} c={k.ink60}>{`${h.asset}${h.test ? " (test)" : ""}`}</T>
                        </View>
                      )) : <T s={13} c={k.ink60} style={{ marginTop: 10 }}>Empty</T>}
                      {last ? <T s={11.5} c={k.ink45} style={{ marginTop: 8 }}>{`Funded ${usd(-last.delta)} · ${day(last.at)} · receipt`}</T> : null}
                    </View>
                  ) : <T s={13} c={k.ink60} style={{ marginTop: 10 }}>Wallet not set up on this server yet.</T>}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <Pill label="Fund" icon="plus" h={42} style={{ flex: 1 }} onPress={() => setFund({ slug: a.slug, name: a.name })} />
                    {held.length ? <Pill kind="outline" label={busy === `back:${a.slug}` ? "Moving…" : "Move to balance"} h={42} style={{ flex: 1 }} onPress={() => back(a.slug, a.name)} /> : null}
                  </View>
                </View>
              );
            })}
            <T s={12} c={k.ink45} style={{ marginTop: 16, lineHeight: 17 }}>Agents are funded only from your balance. Tap an agent wallet to see its EVM and Solana addresses.</T>
            {addrs ? (
              <WSheet open title={`${addrs.name}'s addresses`} sub="Fund agents from your balance with Fund. These are for reference." icon="wallet" onClose={() => setAddrs(null)}>
                {([["EVM", "One address on Ethereum, Base, Monad, Hyperliquid EVM, Tempo and every other EVM chain", addrs.evm], ["Solana", "Solana", addrs.sol]] as const).filter((r) => r[2]).map(([t, d, ad]) => (
                  <View key={t} style={{ borderRadius: 16, backgroundColor: k.tint, padding: 12, marginBottom: 10, gap: 8 }}>
                    <T f="bold" s={14.5}>{t}</T><T s={12} c={k.ink60}>{d}</T>
                    <Pressable onPress={async () => { await Clipboard.setStringAsync(ad!); say("Address copied"); }} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T f="mono" s={12.5} style={{ flex: 1 }}>{`${ad!.slice(0, Math.ceil(ad!.length / 2))}\n${ad!.slice(Math.ceil(ad!.length / 2))}`}</T><Icon name="copy" size={14} color={k.brandInk} /></Pressable>
                    <View style={{ alignSelf: "center", padding: 8, borderRadius: 12, backgroundColor: "#fff" }}><QRCode value={ad!} size={140} /></View>
                  </View>
                ))}
              </WSheet>
            ) : null}
          </>
        ) : (
          <View style={{ marginTop: 16, gap: 14 }}>
            {(me?.agents ?? []).filter((a) => a.slug === "home" || a.kind === "custom" || a.slug.startsWith("c-")).map((a) => {
              const card = cards?.find((c) => c.agent === a.slug) ?? null;
              const pct = card ? Math.min(100, Math.round((card.spent / Math.max(1, card.limit)) * 100)) : 0;
              return (
                <View key={a.slug} style={{ borderRadius: 24, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16, alignItems: "center", gap: 12 }}>
                  {card ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${a.name}'s card`} onPress={() => setOpenCard(a.slug)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}><PayCardFace name={a.name} card={card} home={a.slug === "home"} /></Pressable> : <PayCardFace name={a.name} card={card} home={a.slug === "home"} />}
                  {card ? (
                    <>
                      <View style={{ alignSelf: "stretch" }}>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(127,127,127,0.18)", overflow: "hidden" }}><View style={{ width: `${pct}%`, height: 4, backgroundColor: GRAPE }} /></View>
                        <T f="semi" s={11.5} c={k.ink60} style={{ marginTop: 6, textAlign: "right" }}>{`${pct}% used · $${card.limit} a month`}</T>
                      </View>
                      <TempoSummary c={tempos[a.slug] ?? null} />
                      <Pill label="Card details" icon="eye" h={40} onPress={() => setOpenCard(a.slug)} />
                      <CardDetailsSheet open={openCard === a.slug} onClose={() => setOpenCard(null)} agent={a.slug} name={a.name} home={a.slug === "home"} card={card} tempo={tempos[a.slug] ?? null} />
                    </>
                  ) : (
                    <Pill label={busy === `card:${a.slug}` ? "Paying…" : busy === `ask:${a.slug}` ? "Confirm: pay $2 from balance" : "Get a Tempo card · $2"} icon="plus" h={40} onPress={async () => {
                      if (!token) return;
                      if (busy !== `ask:${a.slug}`) { setBusy(`ask:${a.slug}`); return; }
                      setBusy(`card:${a.slug}`);
                      try { await api("/api/cards", { method: "POST", body: JSON.stringify({ agent: a.slug, pay: "balance", limit: 250 }) }, token); say(`${a.name}'s card is ready`); await loadCards(); await reload(); }
                      catch (e) { say(e instanceof Error ? e.message : "The card couldn't be issued."); }
                      finally { setBusy(""); }
                    }} />
                  )}
                </View>
              );
            })}
            {cards === null ? <T s={13.5} c={k.ink60}>Loading cards…</T> : null}
          </View>
        )}
      </Stage></ScrollView>
      {note ? <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: k.ink, borderRadius: 16, padding: 12 }}><T f="semi" s={13.5} c={k.bg}>{note}</T></View> : null}
      <TopUpSheet open={sheet === "topup"} onClose={() => setSheet(null)} />
      <HistorySheet open={sheet === "history"} onClose={() => setSheet(null)} wallet={wallet} onTopUp={() => setSheet("topup")} />
      <FundSheet who={fund} onClose={() => setFund(null)} onDone={(t) => { say(t); reload(); }} />
    </View>
  );
}

const H_ICON: Record<string, string> = { topup_card: "plus", topup_crypto: "plus", dev_grant: "plus", refund: "check", fund_refund: "check", fund_return: "check", hire: "user", card: "file", fund: "wallet", plan: "star", usage: "spark" };
const MONEY_IN = new Set(["topup_card", "topup_crypto", "dev_grant", "refund", "fund_refund", "fund_return"]);
const hTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const monthOf = (t: number) => new Date(t).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
/** Port of wallet/HistorySheet.tsx: grape wallet tile, eye toggle, Added/Spent tiles, rows grouped by month. */
function HistorySheet({ open, onClose, wallet, onTopUp }: { open: boolean; onClose: () => void; wallet: Wallet | null; onTopUp: () => void }) {
  const k = useC();
  const [hideBalances, setHide] = useHideBalance(); const toggleBalances = () => setHide(!hideBalances);
  const mask = (v: string) => (hideBalances ? "••••" : v);
  const rows = wallet?.history ?? [];
  const added = rows.filter((r) => r.delta > 0).reduce((a, r) => a + r.delta, 0); const spent = rows.filter((r) => r.delta < 0).reduce((a, r) => a - r.delta, 0);
  const groups: { month: string; items: typeof rows }[] = [];
  for (const r of rows) { const m = monthOf(r.at); if (groups[groups.length - 1]?.month !== m) groups.push({ month: m, items: [] }); groups[groups.length - 1].items.push(r); }
  return (
    <WSheet open={open} title="History" icon="wallet" sub={rows.length ? `${rows.length} item${rows.length === 1 ? "" : "s"} on your Lexari balance` : "Everything your balance does shows here."} onClose={onClose}
      right={<Pressable accessibilityLabel={hideBalances ? "Show balance" : "Hide balance"} onPress={toggleBalances} style={{ marginTop: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name={hideBalances ? "eyeoff" : "eye"} size={14} color={k.ink75} /></Pressable>}>
      {rows.length ? (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, borderRadius: 16, backgroundColor: "#e7f8ee", paddingHorizontal: 14, paddingVertical: 10 }}><T f="semi" s={11.5} c="#137a3d" style={{ opacity: 0.8 }}>Added</T><T f="bold" s={15} c="#137a3d">{mask(`+${usd(added)}`)}</T></View>
            <View style={{ flex: 1, borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 10 }}><T f="semi" s={11.5} c={k.ink60}>Spent</T><T f="bold" s={15}>{mask(`\u2212${usd(spent)}`)}</T></View>
          </View>
          <View style={{ height: 1, backgroundColor: k.line, marginTop: 12, marginHorizontal: -16 }} />
          {groups.map((g) => (
            <View key={g.month}>
              <Label s={9} c={k.ink45} style={{ paddingTop: 16, paddingBottom: 4 }}>{g.month}</Label>
              {g.items.map((r, i) => { const up = r.delta > 0 || (MONEY_IN.has(r.kind) && r.delta >= 0); return (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
                  <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: up ? "#e7f8ee" : r.kind === "plan" ? "rgba(91,43,255,0.15)" : k.tint }}><Icon name={H_ICON[r.kind] || "wallet"} size={16} color={up ? "#137a3d" : r.kind === "plan" ? k.brandInk : k.ink75} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}><T f="semi" s={14} lines={1}>{r.label}</T><T s={12} c={k.ink45} lines={1}>{r.kind === "usage" ? `${day(r.at)} · AI usage that day` : `${day(r.at)}, ${hTime(r.at)}`}</T></View>
                  <T f="bold" s={14} c={up ? "#1fbf6a" : k.ink}>{r.delta === 0 ? "" : mask(`${r.delta > 0 ? "+" : "\u2212"}${usd(Math.abs(r.delta))}`)}</T>
                </View>
              ); })}
            </View>
          ))}
        </>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "rgba(91,43,255,0.12)", alignItems: "center", justifyContent: "center" }}><Icon name="wallet" size={26} color={k.brandInk} /></View>
          <T f="bold" s={16} style={{ marginTop: 16 }}>Nothing here yet</T>
          <T s={13} c={k.ink60} style={{ textAlign: "center", marginTop: 4, maxWidth: 280 }}>Top ups, plans, hires, agent funding and refunds will show up here as they happen.</T>
          <Pill label="Top up" icon="plus" h={40} style={{ marginTop: 20 }} onPress={() => { onClose(); onTopUp(); }} />
        </View>
      )}
    </WSheet>
  );
}

function FundSheet({ who, onClose, onDone }: { who: { slug: string; name: string } | null; onClose: () => void; onDone: (t: string) => void }) {
  const k = useC();
  const { token } = useSession();
  const [v, setV] = useState(5);
  const [busy, setBusy] = useState(false);
  if (!who) return null;
  const go = async () => {
    if (!token) return; setBusy(true);
    try { await api("/api/wallet/fund", { method: "POST", body: JSON.stringify({ agent: who.slug, usd: v, key: `${Date.now()}-${Math.random().toString(36).slice(2)}` }) }, token); onDone(`$${v} sent to ${who.name}'s wallet`); onClose(); }
    catch { onDone("That transfer didn't go through. Your balance was refunded."); } finally { setBusy(false); }
  };
  return (
    <WSheet open title={`Fund ${who.name}`} onClose={onClose}>
      <T s={13.5} c={k.ink60}>{`Send dollars from your balance to ${who.name}'s own wallet.`}</T>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        {[1, 5, 10, 25].map((n) => <Pressable key={n} onPress={() => setV(n)} style={{ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: v === n ? GRAPE : k.tint }}><T f="bold" s={15} c={v === n ? "#fff" : k.ink}>{`$${n}`}</T></Pressable>)}
      </View>
      <T s={12.5} c={k.ink45} style={{ marginTop: 12, lineHeight: 17 }}>It arrives in its wallet as USDC. Anything left can come back to your balance.</T>
      <Pill label={busy ? `Funding ${who.name}` : `Fund $${v} from balance`} h={48} style={{ marginTop: 14 }} disabled={busy} onPress={go} />
    </WSheet>
  );
}

type CryptoReq = { id: string; recipient: string; mint: string; reference: string; amountMinor: number; decimals: number; url: string; expiresAt: number };
const RPC = () => (env.cluster === "devnet" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const ataOf = (owner: PublicKey, mint: PublicKey) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA)[0];
/** The USDC payment the web builds with spl-token, by hand: create the treasury's token account if needed, then transferChecked with the reference key. */
function usdcTx(me: PublicKey, r: CryptoReq) {
  const mint = new PublicKey(r.mint), to = new PublicKey(r.recipient), from = ataOf(me, mint), toAta = ataOf(to, mint);
  const create = new TransactionInstruction({ programId: ATA, data: Buffer.from([1]), keys: [
    { pubkey: me, isSigner: true, isWritable: true }, { pubkey: toAta, isSigner: false, isWritable: true }, { pubkey: to, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: TOKEN, isSigner: false, isWritable: false }] });
  const data = Buffer.alloc(10); data[0] = 12; let amt = BigInt(r.amountMinor); for (let i = 1; i <= 8; i++) { data[i] = Number(amt & BigInt(255)); amt >>= BigInt(8); } data[9] = r.decimals;
  const transfer = new TransactionInstruction({ programId: TOKEN, data, keys: [
    { pubkey: from, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: toAta, isSigner: false, isWritable: true },
    { pubkey: me, isSigner: true, isWritable: false }, { pubkey: new PublicKey(r.reference), isSigner: false, isWritable: false }] });
  return new Transaction().add(create, transfer);
}

/** Port of billing/TopUpSheet.tsx: $5/$10/$25, Pay with Card (coming soon) or a coin, the USDC summary and Pay button; the coin picker is its own step. */
function TopUpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <TopUpFlow open={open} onClose={onClose} />;
}

export { default as ErrorBoundary } from "@/components/ScreenError";
