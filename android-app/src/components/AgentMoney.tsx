/**
 * Port of webapp/components/wallet/AgentMoney.tsx: the agent's own wallet (Fund, Move to balance, addresses) and, for
 * agents you made, its card row with Get a card / Manage. Never your balance.
 */
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import Icon from "@/components/Icon";
import { PayCardFace, type PayCard } from "@/components/PayCard";
import { COINS } from "@/content/roster";
import { api } from "@/lib/api";
import { useHideBalance } from "@/lib/privacy";
import { useSession } from "@/state/session";
import { toast } from "@/web/anim";
import { useData } from "@/web/data";
import { AgentTile, GRAPE, Label, Pill, T, WSheet, useC } from "@/web/kit";

const CARD_LIMITS = [100, 250, 500, 1000];
const CARD_PRICE = "$2";
const CARD_TEST_NOTE = "A Tempo card: your agent pays merchants in stablecoins on Tempo, inside the limits you set. Every payment waits for your Confirm.";
const MASK = "••••";
const usd = (micros: number) => `$${(Math.max(0, micros) / 1e6).toFixed(2)}`;
const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const errText = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

export default function AgentMoney({ slug, name, created, look }: { slug: string; name: string; created: boolean; look?: unknown }) {
  const k = useC();
  const { token } = useSession();
  const { wallet, reload } = useData();
  const [hide] = useHideBalance();
  const [cards, setCards] = useState<PayCard[] | null>(null);
  const [fund, setFund] = useState(false);
  const [getCard, setGetCard] = useState(false);
  const [addrs, setAddrs] = useState(false);
  const [back, setBack] = useState(false);
  const loadCards = useCallback(() => { if (token && created) api<{ cards: PayCard[] }>("/api/cards", {}, token).then((r) => setCards(r.cards || []), () => setCards((c) => c ?? [])); }, [token, created]);
  useEffect(loadCards, [loadCards]);
  if (wallet === null) return <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 16 }}><T s={13.5} c={k.ink60}>{`Loading ${name}'s wallet…`}</T></View>;
  const a = wallet.agents.find((x) => x.slug === slug);
  if (!a) return null;
  const sol = a.wallets.find((w) => w.chain === "solana");
  const evm = a.wallets.find((w) => w.chain !== "solana");
  const held = (sol?.holdings ?? []).filter((h) => h.amount > 0);
  const usdc = held.find((h) => h.asset === "USDC");
  const total = a.wallets.flatMap((w) => w.holdings).filter((h) => /USD/.test(h.asset)).reduce((n, h) => n + h.amount / 10 ** h.decimals, 0);
  const last = wallet.history.find((h) => (h.kind === "fund" || h.kind === "fund_return" || h.kind === "fund_refund") && h.label.includes(name));
  const card = cards?.find((c) => c.agent === slug) ?? null;
  const moveBack = async () => {
    if (!token) return; setBack(true);
    try { const r = await api<{ micros: number }>("/api/wallet/return", { method: "POST", body: JSON.stringify({ agent: slug }) }, token); toast(r.micros ? `${usd(r.micros)} back in your balance from ${name}` : `${name}'s wallet has nothing to send back`); await reload(); }
    catch (e) { toast(errText(e, "Couldn't send it back.")); } finally { setBack(false); }
  };
  return (
    <View>
      <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AgentTile slug={slug} look={look as never} size={38} dot={false} />
          <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={15.5} lines={1}>{`${name}'s wallet`}</T><T s={12.5} c={k.ink60}>{a.kind === "hired" ? "Its own wallet for tasks" : "Its own wallet, separate from your balance"}</T></View>
        </View>
        {sol ? (
          <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${name}'s addresses`} onPress={() => setAddrs(true)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}><Label s={8.5} c={k.ink60}>Agent wallet</Label><T f="xbold" s={20}>{hide ? MASK : `$${total.toFixed(2)}`}</T></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 10, paddingVertical: 4 }}><T f="bold" s={12} c={k.brandInk}>Addresses</T><Icon name="right" size={11} color={k.brandInk} /></View>
            </Pressable>
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {held.length ? held.map((h) => (
                <View key={h.asset} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Image source={COINS.find((c) => c.id === h.asset)?.logo} style={{ width: 18, height: 18, borderRadius: 9 }} />
                  <T f="bold" s={16}>{hide ? MASK : h.asset === "USDC" ? `$${(h.amount / 10 ** h.decimals).toFixed(2)}` : String(+(h.amount / 10 ** h.decimals).toFixed(4))}</T>
                  <T f="semi" s={11.5} c={k.ink60}>{`${h.asset}${h.test ? " (test)" : ""}`}</T>
                </View>
              )) : <T f="semi" s={13.5} c={k.ink60}>Empty</T>}
            </View>
            {last ? <T s={12} c={k.ink60} lines={1} style={{ marginTop: 8 }}>{`${last.delta < 0 ? `Funded ${hide ? MASK : usd(-last.delta)}` : `${hide ? MASK : usd(last.delta)} sent back to your balance`} · ${day(last.at)}`}</T> : null}
          </View>
        ) : <T s={13} c={k.ink60} style={{ marginTop: 12 }}>Wallet not set up on this server yet.</T>}
        {sol ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pill label="Fund" icon="plus" h={40} style={{ flex: 1 }} onPress={() => setFund(true)} />
            {usdc ? <Pill kind="outline" label={back ? "Moving…" : "Move to balance"} h={40} style={{ flex: 1 }} disabled={back} onPress={moveBack} /> : null}
          </View>
        ) : null}
        {created ? (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: k.line, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="file" size={16} color={k.brandInk} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><T f="bold" s={14}>Card</T><T s={12} c={k.ink60} lines={1}>{cards === null ? "Checking…" : card ? `Test card ·· ${card.last4} · $${card.limit}/mo${card.frozen ? " · frozen" : ""}` : "No card yet"}</T></View>
            {card ? (
              <Pressable onPress={() => router.navigate({ pathname: "/(tabs)/wallets", params: { tab: "cards" } })} style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 12, paddingVertical: 6 }}><T f="bold" s={12.5} c={k.brandInk}>Manage</T></Pressable>
            ) : cards !== null ? (
              <Pressable onPress={() => setGetCard(true)} style={{ borderRadius: 999, backgroundColor: GRAPE, paddingHorizontal: 12, paddingVertical: 6 }}><T f="bold" s={12.5} c="#fff">Get a card</T></Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable onPress={() => router.navigate("/(tabs)/wallets")} style={{ marginTop: 8, alignSelf: "center", paddingVertical: 4 }}><T f="bold" s={12.5} c={k.brandInk}>Your balance and all wallets</T></Pressable>
      <FundSheet open={fund} slug={slug} name={name} onClose={() => setFund(false)} onDone={() => void reload()} />
      <GetCardSheet open={getCard} slug={slug} name={name} home={slug === "home"} onClose={() => setGetCard(false)} onDone={() => { loadCards(); void reload(); }} />
      <WSheet open={addrs} title={`${name}'s addresses`} sub="Fund agents from your balance with Fund. These are for reference." icon="wallet" onClose={() => setAddrs(false)}>
        {([["EVM", "One address on Ethereum, Base, Monad, Hyperliquid EVM, Tempo and every other EVM chain", evm?.address], ["Solana", "Solana", sol?.address]] as const).filter((r) => r[2]).map(([t, d, ad]) => (
          <View key={t} style={{ borderRadius: 16, backgroundColor: k.tint, padding: 12, marginBottom: 10, gap: 8 }}>
            <T f="bold" s={14.5}>{t}</T><T s={12} c={k.ink60}>{d}</T>
            <Pressable accessibilityLabel={`Copy ${t} address`} onPress={async () => { await Clipboard.setStringAsync(ad!); toast("Address copied"); }} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T f="mono" s={12.5} style={{ flex: 1 }}>{ad!}</T><Icon name="copy" size={14} color={k.brandInk} /></Pressable>
            <View style={{ alignSelf: "center", padding: 8, borderRadius: 12, backgroundColor: "#fff" }}><QRCode value={ad!} size={140} /></View>
          </View>
        ))}
      </WSheet>
    </View>
  );
}

/** Fund agent: dollars from your balance arrive in the agent's wallet as test USDC. Same call as the web (POST /api/wallet/fund). */
function FundSheet({ open, slug, name, onClose, onDone }: { open: boolean; slug: string; name: string; onClose: () => void; onDone: () => void }) {
  const k = useC();
  const { token } = useSession();
  const [v, setV] = useState(5);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!token) return; setBusy(true);
    try {
      const r = await api<{ funding?: { status: string; sig: string | null } }>("/api/wallet/fund", { method: "POST", body: JSON.stringify({ agent: slug, usd: v, key: `${Date.now()}-${Math.random().toString(36).slice(2)}` }) }, token);
      if (r.funding && r.funding.status !== "sent") throw new Error("That transfer didn't go through. Your balance was refunded.");
      toast(`$${v} sent to ${name}'s wallet${r.funding?.sig ? " · confirmed" : ""}`); onDone(); onClose();
    } catch (e) { toast(errText(e, "That transfer didn't go through. Your balance was refunded.")); } finally { setBusy(false); }
  };
  return (
    <WSheet open={open} title={`Fund ${name}`} sub={`Send dollars from your balance to ${name}'s own wallet.`} icon="wallet" onClose={onClose}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 5, 10, 25].map((n) => <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: v === n }} onPress={() => setV(n)} style={{ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: v === n ? GRAPE : k.tint }}><T f="bold" s={15} c={v === n ? "#fff" : k.ink}>{`$${n}`}</T></Pressable>)}
      </View>
      <T s={12.5} c={k.ink60} style={{ marginTop: 12, lineHeight: 17 }}>It arrives in its wallet as USDC. Anything left can come back to your balance.</T>
      <Pill label={busy ? `Funding ${name}` : `Fund $${v} from balance`} h={48} style={{ marginTop: 14 }} disabled={busy} onPress={go} />
    </WSheet>
  );
}

/** Port of GetCardDialog: preview, pick a monthly limit, pay from your balance (POST /api/cards), and the card is issued. */
function GetCardSheet({ open, slug, name, home, onClose, onDone }: { open: boolean; slug: string; name: string; home: boolean; onClose: () => void; onDone: () => void }) {
  const k = useC();
  const { token } = useSession();
  const [limit, setLimit] = useState(250);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [card, setCard] = useState<PayCard | null>(null);
  const close = () => { if (busy) return; setCard(null); setErr(""); onClose(); };
  const buy = async () => {
    if (!token) return; setBusy(true); setErr("");
    try { const r = await api<{ card: PayCard }>("/api/cards", { method: "POST", body: JSON.stringify({ agent: slug, pay: "balance", limit }) }, token); setCard(r.card); toast(`${name}'s card is ready`); onDone(); }
    catch (e) { setErr(errText(e, "The card couldn't be issued. Nothing was charged.")); }
    finally { setBusy(false); }
  };
  return (
    <WSheet open={open} title={card ? "Card issued" : `A card for ${name}`} sub="Virtual card · one per agent · test card" icon="file" onClose={close}>
      <View style={{ alignItems: "center" }}><PayCardFace name={name} card={card} home={home} width={300} /></View>
      {card ? (
        <>
          <T s={14} c={k.ink75} style={{ marginTop: 14, lineHeight: 20 }}>{`${name}'s card is ready with a $${card.limit} monthly limit. You can freeze it or change the limit from Cards.`}</T>
          <Pill label="Done" h={48} style={{ marginTop: 14 }} onPress={close} />
        </>
      ) : (
        <>
          <T s={14} c={k.ink75} style={{ marginTop: 14, lineHeight: 20 }}>{`${name} can pay for tools, compute and subscriptions with its own card, up to the monthly limit you set.`}</T>
          <View accessibilityRole="radiogroup" accessibilityLabel="Monthly spending limit" style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
            {CARD_LIMITS.map((l) => (
              <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: limit === l }} onPress={() => setLimit(l)} style={{ flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: "center", backgroundColor: limit === l ? k.tint : "transparent", borderWidth: limit === l ? 2 : 1, borderColor: limit === l ? GRAPE : k.line }}>
                <T f="bold" s={15}>{`$${l}`}</T><T s={11} c={k.ink60}>a month</T>
              </Pressable>
            ))}
          </View>
          <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 12, borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 10 }}><T s={13.5} c={k.ink75}>Card price</T><T f="semi" s={13.5}>{`${CARD_PRICE} from your balance`}</T></View>
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}><Icon name="info" size={15} color={k.brandInk} /><T s={12.5} c={k.ink75} style={{ flex: 1, lineHeight: 17 }}>{CARD_TEST_NOTE}</T></View>
          {err ? <T s={13} c="#e5484d" style={{ marginTop: 12 }}>{err}</T> : null}
          <Pill label={busy ? "Paying…" : `Get the card · ${CARD_PRICE}`} h={48} style={{ marginTop: 14 }} disabled={busy} onPress={buy} />
        </>
      )}
    </WSheet>
  );
}
