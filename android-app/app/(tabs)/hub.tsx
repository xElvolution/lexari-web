/** Port of webapp/components/hub/HubPhone.tsx: balance, check-in, Mystery box / Level up, quests, Invite and Achievements rows with their sheets, Store. */
import { useHideBalance } from "@/lib/privacy";
import { useEffect, useState } from "react";
import { Modal } from "react-native";
import { Bounce, Burst, Float, Pop, PopIn, RiseText, Spin, toast, Stage } from "@/web/anim";
import { Pressable, RefreshControl, ScrollView, Share, Text, Vibration, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { openSettings } from "@/lib/nav";
import * as Clipboard from "expo-clipboard";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { ChatBg, MyBubble, bubbleInk } from "@/web/cosmetics";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { AgentTile, Card, Coin, F, GRAPE, Label, Pill, Segs, T, WSheet, useC } from "@/web/kit";
import { primaryOf, useData, type HubState } from "@/web/data";
import { ACHIEVEMENTS, MAX_LEVEL, PERKS, QUESTS, STORE_CATEGORIES, STORE_ITEMS, STREAK_PAY, countdown, nextReset, xpFor, type Period } from "@/web/hubData";

type SheetId = "train" | "invite" | "badges" | "store" | null;
type ActResult = { ok?: boolean; error?: string; coins?: number; level?: number; levelsGained?: number };

export default function Hub() {
  const k = useC();
  const { token } = useSession();
  const { me, hub, reload } = useData();
  const [hideBalances, setHide] = useHideBalance(); const toggleBalances = () => setHide(!hideBalances);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState("");
  const [box, setBox] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  /** POST /api/hub/act, then a toast (null = no toast, the caller shows its own result). */
  const act = async (body: Record<string, unknown>, label: string, ok: ((r: ActResult) => string) | null): Promise<ActResult> => {
    if (!token) return { ok: false, error: "Sign in first." }; setBusy(label);
    try {
      const r = await api<ActResult>("/api/hub/act", { method: "POST", body: JSON.stringify(body) }, token);
      if (r.ok === false) { if (ok) toast(r.error || "Not ready yet."); } else if (ok) toast(ok(r));
      await reload(); return r;
    } catch (e) { const m = e instanceof Error ? e.message : "Something went wrong."; if (ok) toast(m); return { ok: false, error: m }; }
    finally { setBusy(""); }
  };

  const p = hub?.player;
  const coins = p?.coins ?? 0;
  const mask = "••••";
  const week = weekEarned(hub, now);
  const team = me?.agents.length ?? 0;
  const primary = primaryOf(me);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={k.ink} />}><Stage>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View><Label s={9.5}>Hub</Label><T f="xbold" s={20.5} style={{ marginTop: 4, letterSpacing: -0.4 }}>Earn and level up</T></View>
          <Pill kind="ghost" label="Store" icon="box" h={36} fs={13} onPress={() => setSheet("store")} />
        </View>

        <View style={{ backgroundColor: GRAPE, borderRadius: 20, padding: 16, overflow: "hidden" }}>
          <View style={{ position: "absolute", right: -48, top: -64, width: 176, height: 176, borderRadius: 88, borderWidth: 22, borderColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Label s={9} c="rgba(255,255,255,0.7)">Your balance</Label>
            <Pressable accessibilityLabel={hideBalances ? "Show balance" : "Hide balance"} onPress={toggleBalances} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}><Icon name={hideBalances ? "eyeoff" : "eye"} size={13} color="#fff" /></Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
            <Coin size={30} />
            <T f="xbold" s={28} c="#fff">{hub ? (hideBalances ? mask : coins.toLocaleString("en-US")) : "…"}</T>
            <T s={12} c="rgba(255,255,255,0.75)" style={{ marginLeft: "auto", textAlign: "right", lineHeight: 15 }}>{`+${hideBalances ? mask : week} this week\n${hideBalances ? mask : (p?.lifetime ?? 0).toLocaleString("en-US")} all time`}</T>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><T f="semi" s={12} c="#fff">{`🔥 ${p?.streak ?? 0}-day streak`}</T></View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><T f="semi" s={12} c="#fff">{`${team} on your team`}</T></View>
          </View>
        </View>

        {hub && hub.program && !hub.program.live ? <View style={{ backgroundColor: k.tint, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: k.line }}><T f="semi" s={13} c={k.ink75}>Rewards open soon: the Lexari program is not live on Solana yet. Your progress still counts.</T></View> : null}

        <CheckIn hub={hub} now={now} busy={busy} onCheck={(pay) => act({ action: "checkin" }, "checkin", (r) => `Checked in · +${r.coins ?? pay} coins`)} />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: "#0a0a0a", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <Float ms={3200} y={5} on={!boxOpened(hub)} style={{ alignSelf: "flex-start" }}><Text style={{ fontSize: 24, opacity: boxOpened(hub) ? 0.7 : 1 }}>🎁</Text></Float>
            <T f="bold" s={15} c="#fff" style={{ marginTop: 8 }}>Mystery box</T>
            <T s={12} c="rgba(255,255,255,0.6)" style={{ lineHeight: 16 }}>{boxOpened(hub) ? `Opened today${boxWon(hub) ? ` · won ${boxWon(hub)}` : ""}` : "15 to 250 coins, once a day"}</T>
            <View style={{ marginTop: "auto", paddingTop: 12 }}>
              {boxOpened(hub) ? <Pill kind="soft" h={32} fs={13} label={`Next in ${countdown(nextReset("daily", now) - now).replace(/ \d+s$/, "")}`} />
                : <Pill kind="white" h={32} fs={13} label="Open" onPress={() => setBox(true)} />}
            </View>
          </View>
          <Card style={{ flex: 1, padding: 14 }} onPress={() => setSheet("train")}>
            <AgentTile slug={primary} look={me?.agents.find((a) => a.slug === primary)?.look} size={30} ring="primary" />
            <T f="bold" s={15} style={{ marginTop: 8 }}>Level up</T>
            <T s={12.5} c={k.ink60} style={{ lineHeight: 16 }}>Spend coins to level up your agent.</T>
            <View style={{ marginTop: 12, height: 32, borderRadius: 16, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><T f="bold" s={13} c={k.brandInk}>Train agents</T></View>
          </Card>
        </View>

        <Quests hub={hub} now={now} busy={busy} onGo={(go) => { if (go === "#level") setSheet("train"); else if (go === "#invite") setSheet("invite"); else if (go === "#store") setSheet("store"); else if (go === "/settings#social") openSettings("social"); else if (go.startsWith("/")) router.navigate(go === "/agents" ? "/(tabs)/agents" : go === "/brain" ? "/(tabs)/brain" : "/(tabs)/marketplace"); }}
          onClaim={(id, title) => act({ action: "quest", questId: id }, `quest:${id}`, (r) => `${title} · +${r.coins ?? 0} coins`)} />

        <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => setSheet("invite")}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="users" size={18} color={k.brandInk} /></View>
          <View style={{ flex: 1 }}>
            <T f="bold" s={15}>{`Invite friends · ${friends(hub)} joined`}</T>
            <T s={12.5} c={k.ink60}>{nextTier(hub) ? `${nextTier(hub)!.friends - friends(hub)} more for +${nextTier(hub)!.reward} coins` : "Every milestone reached"}</T>
          </View>
          <Icon name="right" size={16} color={k.ink45} />
        </Card>
        <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => setSheet("badges")}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="star" size={18} color={k.brandInk} /></View>
          <View style={{ flex: 1 }}>
            <T f="bold" s={15}>{`Achievements · ${badges(hub, me?.agents.length ?? 0).filter((b) => b.got).length} of ${ACHIEVEMENTS.length}`}</T>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: k.tint, marginTop: 6, overflow: "hidden" }}><View style={{ height: 6, borderRadius: 3, backgroundColor: GRAPE, width: `${(badges(hub, 0).filter((b) => b.got).length / ACHIEVEMENTS.length) * 100}%` }} /></View>
          </View>
          <Icon name="right" size={16} color={k.ink45} />
        </Card>
      </Stage></ScrollView>

      <BoxModal open={box} onClose={() => setBox(false)} onOpen={async () => { const r = await act({ action: "box" }, "box", null); return { ok: r.ok !== false, coins: r.coins ?? 0, error: r.error }; }} />

      <TrainSheet open={sheet === "train"} onClose={() => setSheet(null)} hub={hub} coins={coins} busy={busy} onTrain={(agent, n) => act({ action: "train", agent, coins: n }, "train", null)} />
      <InviteSheet open={sheet === "invite"} onClose={() => setSheet(null)} hub={hub} code={me?.user.referralCode || ""} busy={busy} onClaim={(i) => act({ action: "tier", tier: i }, `tier:${i}`, (r) => `Milestone · +${r.coins ?? 0} coins`)} />
      <WSheet open={sheet === "badges"} title="Achievements" onClose={() => setSheet(null)}>
        {(() => { const list = badges(hub, me?.agents.length ?? 0); const n = list.filter((b) => b.got).length; return (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T s={13} c={k.ink60}>Badges you collect as you go.</T><T f="bold" s={13} c={k.brandInk}>{`${n} of ${list.length}`}</T></View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: k.tint, marginTop: 8, overflow: "hidden" }}><View style={{ height: 8, backgroundColor: GRAPE, width: `${(n / list.length) * 100}%` }} /></View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {list.map((a) => (
                <View key={a.id} style={{ flexBasis: "46%", flexGrow: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, backgroundColor: k.tint, opacity: a.got ? 1 : 0.6 }}>
                  <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Svg width={40} height={40} viewBox="0 0 56 56" style={{ position: "absolute" }}><Path d="M28 3 L50 15.5 V40.5 L28 53 L6 40.5 V15.5 Z" fill={a.got ? GRAPE : "none"} stroke={a.got ? "#3514b0" : k.ink45} strokeWidth={3} strokeDasharray={a.got ? undefined : "4 4"} strokeLinejoin="round" /></Svg><Icon name={a.icon} size={16} color={a.got ? "#fff" : k.ink45} /></View>
                  <View style={{ flex: 1 }}><T f="bold" s={13.5} c={a.got ? k.ink : k.ink60}>{a.title}</T><T s={12} c={k.ink60}>{a.body}</T></View>
                </View>
              ))}
            </View>
          </>
        ); })()}
      </WSheet>
      <StoreSheet open={sheet === "store"} onClose={() => setSheet(null)} hub={hub} coins={coins} onBuy={(id, name) => act({ action: "buy", item: id }, `buy:${id}`, () => `${name} is yours. It's on in your chats.`)} onWear={(kind, id) => act({ action: "wear", kind, item: id }, `wear:${kind}`, () => (id ? "Applied" : "Taken off"))} />
    </View>
  );
}

/** Port of webapp/components/hub/BoxModal.tsx: idle (the box bounces) → opening (it shakes while the claim signs) → revealed (coin pops in with a burst) or error. */
function BoxModal({ open, onOpen, onClose }: { open: boolean; onOpen: () => Promise<{ ok: boolean; coins: number; error?: string }>; onClose: () => void }) {
  const [phase, setPhase] = useState<"idle" | "opening" | "revealed" | "error">("idle");
  const [coins, setCoins] = useState(0);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setPhase("idle"); setErr(""); } }, [open]);
  if (!open) return null;
  const go = async () => {
    setPhase("opening"); setErr("");
    const started = Date.now();
    const r = await onOpen();
    await new Promise((x) => setTimeout(x, Math.max(0, 1400 - (Date.now() - started)))); // let the shake play
    if (!r.ok) { setErr(r.error || "The box did not open."); setPhase("error"); return; }
    setCoins(r.coins); setPhase("revealed");
  };
  const close = () => { if (phase !== "opening") onClose(); };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <PopIn style={{ width: "100%", maxWidth: 380 }}>
          <Pressable accessibilityViewIsModal accessibilityLabel="Mystery box" onPress={() => {}} style={{ borderRadius: 30, backgroundColor: "#0a0a0a", padding: 24, alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            {/* web: a 224px bg-grape/50 circle under blur(70px), a soft glow rather than a disc. A radial gradient draws the same falloff. */}
            <Svg pointerEvents="none" width={380} height={380} style={{ position: "absolute", top: 96 + 112 - 190, alignSelf: "center" }}>
              <Defs><RadialGradient id="boxglow" cx="190" cy="190" r="190" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={GRAPE} stopOpacity={0.42} /><Stop offset="0.3" stopColor={GRAPE} stopOpacity={0.32} /><Stop offset="0.6" stopColor={GRAPE} stopOpacity={0.1} /><Stop offset="1" stopColor={GRAPE} stopOpacity={0} />
              </RadialGradient></Defs>
              <Rect width={380} height={380} fill="url(#boxglow)" />
            </Svg>
            <Pressable accessibilityLabel="Close" disabled={phase === "opening"} onPress={onClose} style={{ position: "absolute", right: 12, top: 12, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: phase === "opening" ? 0.3 : 1 }}><Icon name="x" size={18} color="rgba(255,255,255,0.7)" /></Pressable>
            <Label s={9.5} c="rgba(255,255,255,0.6)">Mystery box</Label>
            <View style={{ marginTop: 24, width: 180, height: 180, alignItems: "center", justifyContent: "center" }}>
              {phase === "revealed" ? (
                <Pop k={coins} from={0.3} style={{ alignItems: "center" }}><Coin size={96} /><Text style={{ fontFamily: F.display, fontSize: 44, lineHeight: 44, color: "#fff", marginTop: 12 }}>{`+${coins}`}</Text></Pop>
              ) : (
                <Bounce mode={phase === "opening" ? "shake" : "box"}><Text style={{ fontSize: 120, lineHeight: 140 }}>🎁</Text></Bounce>
              )}
            </View>
            <Text style={{ fontFamily: F.display, fontSize: 28, color: "#fff", marginTop: 16 }}>{phase === "revealed" ? (coins >= 120 ? "Jackpot!" : "Nice!") : phase === "opening" ? "Opening…" : "What's inside?"}</Text>
            <T s={13.5} c="rgba(255,255,255,0.65)" style={{ marginTop: 8, textAlign: "center" }}>{phase === "revealed" ? "Coins added to your balance." : "15 to 250 coins, once a day."}</T>
            {err ? <T s={13} c="#ff7a7f" style={{ marginTop: 8, textAlign: "center" }}>{err}</T> : null}
            <View style={{ alignSelf: "stretch", marginTop: 20 }}>
              {phase === "revealed" ? <Pill kind="white" h={44} label="Collect" onPress={onClose} />
                : <Pill kind="white" h={44} label={phase === "opening" ? "Opening…" : phase === "error" ? "Try again" : "Open the box"} disabled={phase === "opening"} onPress={() => void go()} />}
            </View>
          </Pressable>
        </PopIn>
      </Pressable>
    </Modal>
  );
}

const boxOpened = (h: HubState | null) => !!(h?.box as { opened?: boolean } | undefined)?.opened;
const boxWon = (h: HubState | null) => (h?.box as { coins?: number | null } | undefined)?.coins ?? 0;
type Tier = { tier: number; friends: number; reward: number; claimed: boolean };
const tiers = (h: HubState | null): Tier[] => ((h as { referral?: { tiers?: Tier[] } } | null)?.referral?.tiers) ?? [];
const friends = (h: HubState | null) => (h as { referral?: { friends?: number } } | null)?.referral?.friends ?? 0;
const nextTier = (h: HubState | null) => tiers(h).find((t) => friends(h) < t.friends);
function weekEarned(h: HubState | null, now: number) {
  const d = new Date(now); const day = (d.getDay() + 6) % 7; const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
  return ((h as { ledger?: { amount: number; at: number }[] } | null)?.ledger ?? []).filter((e) => e.at >= start).reduce((a, e) => a + e.amount, 0);
}
function badges(h: HubState | null, team: number) {
  const p = h?.player; const lv = Math.max(1, ...(h?.levels ?? []).map((l) => l.level)); const claimed = (h as { claimedTotal?: number } | null)?.claimedTotal ?? 0;
  const test: Record<string, boolean> = { "first-in": !!p, "streak-3": (p?.streak ?? 0) >= 3, "streak-7": (p?.streak ?? 0) >= 7, "lvl-2": lv >= 2, "lvl-5": lv >= 5, friend: friends(h) > 0, rich: (p?.lifetime ?? 0) >= 1000, quests: claimed >= 10 };
  void team;
  return ACHIEVEMENTS.map((a) => ({ ...a, got: !!test[a.id] }));
}

function CheckIn({ hub, now, busy, onCheck }: { hub: HubState | null; now: number; busy: string; onCheck: (pay: number) => void }) {
  const k = useC();
  const done = !!hub?.player?.checkedInToday; const streak = hub?.player?.streak ?? 0;
  const cur = done ? Math.max(1, streak) : streak + 1; const pay = STREAK_PAY[Math.min(STREAK_PAY.length, cur) - 1];
  const start = Math.max(1, cur - 6);
  return (
    <Card style={{ padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 20 }}>🔥</Text></View>
        <View style={{ flex: 1 }}><T f="bold" s={15}>Daily check-in</T><T s={12.5} c={k.ink60}>{done ? `Done · next in ${countdown(nextReset("daily", now) - now)}` : `Day ${cur} pays ${pay} coins`}</T></View>
        {done ? <View style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: k.tint, flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="check" size={14} stroke={3} color={k.ink75} /><T f="bold" s={13} c={k.ink75}>Done</T></View>
          : <Pill h={32} fs={13} label={busy === "checkin" ? "…" : `Check in +${pay}`} onPress={() => onCheck(pay)} disabled={!!busy} />}
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }}>
        {Array.from({ length: 7 }, (_, i) => start + i).map((d) => {
          const got = d < cur || (d === cur && done);
          return (
            <View key={d} style={{ flex: 1, borderRadius: 9, paddingVertical: 4, alignItems: "center", backgroundColor: got ? GRAPE : k.tint, borderWidth: !got && d === cur ? 1 : 0, borderColor: GRAPE }}>
              <T f="bold" s={9.5} c={got ? "#fff" : d === cur ? k.ink : k.ink45}>{`D${d}`}</T>
              <T f="xbold" s={11.5} c={got ? "#fff" : d === cur ? k.ink : k.ink45}>{String(STREAK_PAY[Math.min(STREAK_PAY.length, d) - 1])}</T>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Quests({ hub, now, busy, onGo, onClaim }: { hub: HubState | null; now: number; busy: string; onGo: (go: string) => void; onClaim: (id: string, title: string) => void }) {
  const k = useC();
  const [tab, setTab] = useState<Period>("daily");
  const live = hub?.quests ?? [];
  const all = QUESTS.map((q) => { const l = live.find((x) => x.id === q.id); const have = Math.min(q.goal, l?.progress ?? 0); return { ...q, have, claimed: !!l?.claimed, done: have >= q.goal }; });
  const ready = (p: Period) => all.filter((q) => q.period === p && q.done && !q.claimed).length;
  const list = all.filter((q) => q.period === tab);
  return (
    <Card style={{ padding: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T f="bold" s={17}>Quests</T>
        {tab !== "hard" ? <T s={12} c={k.ink45}>{`Resets in ${countdown(nextReset(tab, now) - now)}`}</T> : null}
      </View>
      <Segs style={{ marginTop: 10 }} on={tab} set={setTab} items={[{ k: "daily", label: "Daily", badge: ready("daily") }, { k: "weekly", label: "Weekly", badge: ready("weekly") }, { k: "hard", label: "Hard", badge: ready("hard") }]} />
      <View style={{ marginTop: 4 }}>
        {list.map((q, i) => (
          <View key={q.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: k.line }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: q.claimed ? GRAPE : k.tint }}><Icon name={q.claimed ? "check" : q.icon} size={15} color={q.claimed ? "#fff" : k.brandInk} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><T f="semi" s={14.5}>{q.title}</T><Coin size={12} /><T f="bold" s={12} c={k.brandInk}>{String(q.reward)}</T></View>
              <T s={12.5} c={k.ink60}>{q.hint}</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k.tint, overflow: "hidden" }}><View style={{ height: 4, backgroundColor: GRAPE, width: `${Math.round((q.have / q.goal) * 100)}%` }} /></View>
                <T s={11} c={k.ink45}>{`${q.have}/${q.goal}`}</T>
              </View>
            </View>
            {q.claimed ? <View style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: k.tint, justifyContent: "center" }}><T f="bold" s={13} c={k.ink45}>Done</T></View>
              : q.done ? <Pill h={32} fs={13} label={busy === `quest:${q.id}` ? "…" : "Claim"} onPress={() => onClaim(q.id, q.title)} />
              : <Pill kind="ghost" h={32} fs={13} label="Go" onPress={() => onGo(q.go)} />}
          </View>
        ))}
      </View>
    </Card>
  );
}

function TrainSheet({ open, onClose, hub, coins, busy, onTrain }: { open: boolean; onClose: () => void; hub: HubState | null; coins: number; busy: string; onTrain: (agent: string, n: number) => Promise<ActResult> }) {
  const k = useC();
  const { me } = useData();
  const made = (me?.agents ?? []).filter((a) => a.kind === "home" || a.kind === "custom");
  const [pick, setPick] = useState("home");
  const a = made.find((x) => x.slug === pick) ?? made[0];
  const lv = hub?.levels?.find((l) => l.slug === a?.slug) ?? { level: 1, xp: 0 };
  const max = lv.level >= MAX_LEVEL; const need = max ? 0 : xpFor(lv.level); const toNext = Math.max(0, need - lv.xp);
  const nextPerk = PERKS.find((p) => p.level > lv.level);
  // web TrainSheet: the face bounces while a level-up signs, then pops with a burst when the new level lands; "+25 XP" rises.
  const [won, setWon] = useState<{ level: number; n: number } | null>(null);
  const [rises, setRises] = useState<{ k: number; t: string }[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const leveling = busy === "train" && pending !== null && pending >= toNext;
  const perk = won ? PERKS.find((p) => p.level === won.level) : undefined;
  const train = (n: number) => {
    if (!a) return; const before = lv.level; setPending(n); setWon(null);
    void onTrain(a.slug, n).then((r) => {
      setPending(null);
      if (r.ok === false) { toast(r.error || "Not enough coins. Do a quest first."); return; }
      const key = Date.now(); setRises((x) => [...x.slice(-2), { k: key, t: `+${Math.min(n, coins)} XP` }]);
      setTimeout(() => setRises((x) => x.filter((y) => y.k !== key)), 1200);
      const after = r.level ?? before + (r.levelsGained ?? 0);
      if (after > before || (r.levelsGained ?? 0) > 0) { Vibration.vibrate([0, 20, 40, 30]); setWon((w) => ({ level: Math.max(after, before + 1), n: (w?.n ?? 0) + 1 })); }
    });
  };
  const mood = leveling || won ? "happy" : "idle";
  return (
    <WSheet open={open} title="Train your agents" onClose={onClose}>
      {!a ? <T s={14} c={k.ink60} style={{ textAlign: "center", paddingVertical: 24 }}>Make an agent to start training.</T> : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <T s={13} c={k.ink60} style={{ flex: 1 }}>Coins become XP. Every level unlocks a perk.</T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: k.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Coin size={13} /><T f="bold" s={12.5}>{coins.toLocaleString("en-US")}</T></View>
          </View>
          {made.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
            {made.map((x) => <Pressable key={x.slug} onPress={() => { setPick(x.slug); setWon(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, backgroundColor: x.slug === a.slug ? GRAPE : k.tint }}><AgentTile slug={x.slug} look={x.look} size={26} dot={false} /><T f="bold" s={13} c={x.slug === a.slug ? "#fff" : k.ink75}>{x.name}</T></Pressable>)}
          </ScrollView> : null}
          <View style={{ marginTop: 12, borderRadius: 22, backgroundColor: "#3514b0", padding: 14, alignItems: "center", overflow: "hidden" }}>
            <View style={{ position: "absolute", top: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: "#6a3dff", opacity: 0.6 }} />
            {/* .hub-rays: the sunburst turns slowly, brighter while levelling up */}
            <Spin ms={14000} style={{ position: "absolute", top: -90, width: 420, height: 420, opacity: leveling || won ? 1 : 0.45 }}>
              <Svg pointerEvents="none" width={420} height={420} viewBox="0 0 400 400">{Array.from({ length: 24 }, (_, i) => { const t = (i / 24) * Math.PI * 2; return <Path key={i} d={`M200 200 L${200 + 260 * Math.cos(t - 0.07)} ${200 + 260 * Math.sin(t - 0.07)} L${200 + 260 * Math.cos(t + 0.07)} ${200 + 260 * Math.sin(t + 0.07)}Z`} fill="#fff" opacity={0.09} />; })}</Svg>
            </Spin>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Float ms={1200} y={4} on={leveling || !!won}><View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#ffd84d", alignItems: "center", justifyContent: "center", shadowColor: "#ffd84d", shadowOpacity: 0.7, shadowRadius: 9, elevation: 6 }}><Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#3514b0" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 13l6-6 6 6" /><Path d="M6 19l6-6 6 6" /></Svg></View></Float>
              <Pop k={`lv-${lv.level}-${won?.n ?? 0}`} from={won ? 0.6 : 1}><Text style={{ fontFamily: F.display, fontSize: 26, color: "#fff", letterSpacing: -0.8 }}>{`Level ${lv.level}`}</Text></Pop>
            </View>
            <View style={{ marginTop: 12, width: 136, height: 136, alignItems: "center", justifyContent: "center" }}>
              {won ? <Burst key={`b${won.n}`} /> : null}
              <Bounce mode={leveling ? "level" : "none"}>
                <Float ms={2600} y={6} on={!leveling && !won}>
                  <Pop k={`f${won?.n ?? 0}`} from={won ? 0.6 : 1}>
                    <View style={{ width: 124, height: 124, borderRadius: 62, backgroundColor: "#0a0a0a", borderWidth: 4, borderColor: won ? "#ffd84d" : "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <AgentTile slug={a.slug} look={a.look} size={116} dot={false} radius={58} mood={mood} animate />
                    </View>
                  </Pop>
                </Float>
              </Bounce>
              <View style={{ position: "absolute", right: 0, bottom: 4, width: 26, height: 26, borderRadius: 7, backgroundColor: "#f5c542", borderWidth: 2, borderColor: "#3514b0", alignItems: "center", justifyContent: "center", transform: [{ rotate: "45deg" }] }}><View style={{ transform: [{ rotate: "-45deg" }] }}><T f="xbold" s={11} c="#3514b0">{String(lv.level)}</T></View></View>
              {rises.map((r) => <RiseText key={r.k} text={r.t} />)}
            </View>
            <T f="bold" s={16} c="#fff" style={{ marginTop: 8, textAlign: "center" }}>{won ? `${a.name} reached level ${won.level}!` : leveling ? `${a.name} is levelling up…` : a.name}</T>
            {won && perk ? <T s={12.5} c="rgba(255,255,255,0.8)" style={{ marginTop: 2, textAlign: "center" }}>{`Perk unlocked: ${perk.title} · ${perk.body}`}</T> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, alignSelf: "stretch" }}>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}><XpFill pct={max ? 100 : Math.round((lv.xp / need) * 100)} /></View>
              <T f="semi" s={11.5} c="rgba(255,255,255,0.75)">{max ? "max" : `${lv.xp}/${need} XP`}</T>
            </View>
            <T f="semi" s={12.5} c="rgba(255,255,255,0.65)" style={{ marginTop: 6 }}>{max ? "Max level. A legend." : `${toNext} XP to level ${lv.level + 1}`}</T>
            {!max ? <View style={{ flexDirection: "row", gap: 6, marginTop: 12, alignSelf: "stretch" }}>
              {[25, 100].map((n) => <Pressable key={n} disabled={!!busy || coins <= 0} onPress={() => train(n)} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}><T f="bold" s={14} c="#fff">{`+${n} XP`}</T><T f="semi" s={11} c="rgba(255,255,255,0.6)">{String(n)}</T></Pressable>)}
              <Pressable disabled={!!busy || coins < toNext} onPress={() => train(toNext)} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: "#ffd84d", alignItems: "center", justifyContent: "center", opacity: coins < toNext ? 0.45 : 1 }}><T f="xbold" s={14} c="#2a0f8f">Level up</T><T f="semi" s={11} c="#2a0f8f">{String(toNext)}</T></Pressable>
            </View> : null}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}><T f="bold" s={15}>Perks</T>{nextPerk ? <T f="semi" s={12} c={k.ink45}>{`Next: ${nextPerk.title} at Lv ${nextPerk.level}`}</T> : null}</View>
          <View style={{ marginTop: 8, gap: 4 }}>
            {PERKS.map((p) => { const got = lv.level >= p.level; const next = p === nextPerk; return (
              <View key={p.level} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 6, borderRadius: 14, backgroundColor: next ? k.tint : "transparent" }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: got ? GRAPE : k.card, borderWidth: got ? 0 : 1, borderColor: next ? GRAPE : k.line }}>{got ? <Icon name="check" size={14} stroke={3} color="#fff" /> : <T f="xbold" s={12} c={k.ink45}>{String(p.level)}</T>}</View>
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: got ? "rgba(91,43,255,0.15)" : k.tint }}><Icon name={p.icon} size={17} color={got ? k.brandInk : k.ink45} /></View>
                <View style={{ flex: 1 }}><T f="bold" s={14} c={got || next ? k.ink : k.ink60}>{p.title}</T><T s={12.5} c={k.ink60}>{p.body}</T></View>
                <Label s={8.5} c={got ? k.brandInk : k.ink45}>{got ? "Unlocked" : `Lv ${p.level}`}</Label>
              </View>
            ); })}
          </View>
        </>
      )}
    </WSheet>
  );
}

/** The XP bar fills smoothly (web: transition-[width] duration-700 ease-out). */
function XpFill({ pct }: { pct: number }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) }); }, [pct, w]);
  const st = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: "#ffd84d" }, st]} />;
}

/** The referral orbit (hub/referral.tsx Orbit at zoom .72): dashed ring, your agent in a grape tile, a slot per friend. */
function Orbit({ n, slots, look }: { n: number; slots: number; look?: unknown }) {
  const W = 209, r = W * 0.36;
  return (
    <View style={{ width: W, height: W, marginTop: -4 }}>
      <View style={{ position: "absolute", left: W * 0.14, top: W * 0.14, right: W * 0.14, bottom: W * 0.14, borderRadius: W, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.2)" }} />
      <View style={{ position: "absolute", left: W * 0.3, top: W * 0.3, width: W * 0.4, height: W * 0.4, borderRadius: W, backgroundColor: "rgba(91,43,255,0.25)" }} />
      <View style={{ position: "absolute", left: W / 2 - 37, top: W / 2 - 37, width: 75, height: 75, borderRadius: 22, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center", shadowColor: GRAPE, shadowOpacity: 0.9, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
        <Float ms={3200} y={4}><AgentTile slug="home" look={look} size={62} dot={false} mood={n ? "happy" : "idle"} radius={18} animate /></Float>
      </View>
      {/* .hub-orbit: the friend slots circle your agent once every 48s, each slot counter-spinning to stay upright */}
      <Spin ms={48000} style={{ position: "absolute", left: 0, top: 0, width: W, height: W }}>
        {Array.from({ length: slots }, (_, i) => { const a = (i / slots) * Math.PI * 2 - Math.PI / 2; return (
          <Spin key={i} ms={48000} reverse style={{ position: "absolute", left: W / 2 + r * Math.cos(a) - 19, top: W / 2 + r * Math.sin(a) - 19, width: 38, height: 38 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderStyle: "dashed", borderColor: i < n ? "#fff" : "rgba(255,255,255,0.3)", backgroundColor: i < n ? "#fff" : "transparent", alignItems: "center", justifyContent: "center" }}>
              {i < n ? <Icon name="user" size={14} color="#0a0a0a" /> : <Icon name="plus" size={13} color="rgba(255,255,255,0.45)" />}
            </View>
          </Spin>
        ); })}
      </Spin>
    </View>
  );
}

function InviteSheet({ open, onClose, hub, code, busy, onClaim }: { open: boolean; onClose: () => void; hub: HubState | null; code: string; busy: string; onClaim: (i: number) => void }) {
  const k = useC();
  const { me } = useData(); const look = me?.agents.find((a) => a.slug === "home")?.look;
  const link = `https://app.lexari.ai/signin?ref=${code}`;
  const msg = `I've got my own AI agent on Lexari. Join with my code ${code} and we both get coins.`;
  const n = friends(hub); const next = nextTier(hub);
  const [copied, setCopied] = useState(false);
  return (
    <WSheet open={open} title="Invite friends" onClose={onClose}>
      <View style={{ borderRadius: 22, backgroundColor: "#0a0a0a", paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <View style={{ position: "absolute", left: -60, top: 20, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(91,43,255,0.35)" }} />
        <Orbit n={n} slots={Math.min(10, Math.max(n + 1, next?.friends ?? n, 4))} look={look} />
        <Label s={9} c="#c9b8ff">Invite friends</Label>
        <Text style={{ fontFamily: F.display, fontSize: 30, color: "#fff", letterSpacing: -1.3, marginTop: 4 }}>Fill your orbit.</Text>
        <T s={13} c="rgba(255,255,255,0.7)" style={{ textAlign: "center", marginTop: 8, lineHeight: 18 }}>{`Friends who join with your code start with 50 coins. You collect a bonus at each milestone. ${n} joined${next ? ` · ${next.friends - n} more for +${next.reward}` : ""}.`}</T>
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, backgroundColor: k.tint, padding: 8, paddingLeft: 14 }}>
        <View style={{ flex: 1 }}>
          <Label s={8.5} c={k.ink45}>Your code</Label>
          <Text style={{ fontFamily: F.monoB, fontSize: 18, color: k.brandInk, letterSpacing: 1.5 }}>{code || "…"}</Text>
          <T s={11} c={k.ink45} style={{ fontFamily: F.mono }}>{link.replace(/^https?:\/\//, "")}</T>
        </View>
        <Pressable accessibilityLabel="Copy invite link" onPress={async () => { await Clipboard.setStringAsync(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: copied ? GRAPE : k.card, borderWidth: 1, borderColor: k.line }}><Icon name={copied ? "check" : "copy"} size={16} color={copied ? "#fff" : k.ink75} /></Pressable>
      </View>
      <Pill label="Share invite" icon="arrow" h={48} style={{ marginTop: 10 }} onPress={() => Share.share({ message: `${msg} ${link}` }).catch(() => {})} />
      <T f="bold" s={15} style={{ marginTop: 16 }}>Milestones</T>
      <View style={{ marginTop: 8, gap: 4 }}>
        {tiers(hub).map((t, i) => { const reached = n >= t.friends; return (
          <View key={t.friends} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: k.tint, borderWidth: reached && !t.claimed ? 1 : 0, borderColor: GRAPE }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: reached ? GRAPE : k.card }}><Icon name={t.claimed ? "check" : "box"} size={15} color={reached ? "#fff" : k.ink45} /></View>
            <View style={{ flex: 1 }}><T f="bold" s={14}>{TIER_TITLES[i] ?? `Milestone ${i + 1}`}</T><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><T s={12.5} c={k.ink60}>{`${t.friends} ${t.friends === 1 ? "friend" : "friends"} · `}</T><Coin size={11} /><T s={12.5} c={k.ink60}>{t.reward.toLocaleString("en-US")}</T></View></View>
            {reached && !t.claimed ? <Pill h={32} fs={13} label={busy === `tier:${i}` ? "…" : "Claim"} onPress={() => onClaim(i)} /> : <T f="semi" s={12} c={t.claimed ? k.brandInk : k.ink45}>{t.claimed ? "Collected" : `${t.friends - n} to go`}</T>}
          </View>
        ); })}
      </View>
    </WSheet>
  );
}
const TIER_TITLES = ["First friend", "Small crew", "Full desk", "Founding circle"];

function StoreSheet({ open, onClose, hub, coins, onBuy, onWear }: { open: boolean; onClose: () => void; hub: HubState | null; coins: number; onBuy: (id: string, name: string) => void; onWear: (kind: string, id: string | null) => void }) {
  const k = useC();
  const cos = ((hub as { cosmetics?: { owned?: string[]; bg?: string; bubble?: string } } | null)?.cosmetics) ?? {};
  const owned = new Set(cos.owned ?? []);
  const [full, setFull] = useState<"bg" | "bubble" | null>(null);
  const cat = full ? STORE_CATEGORIES.find((c) => c.kind === full) : null;
  const card = (it: (typeof STORE_ITEMS)[number], small: boolean) => {
    const have = owned.has(it.id); const on = (cos as Record<string, unknown>)[it.kind] === it.id; 
    return (
      <View key={it.id} style={{ width: small ? 80 : "48.5%", borderRadius: small ? 16 : 18, padding: small ? 6 : 8, backgroundColor: k.tint, borderWidth: on ? 2 : 1, borderColor: on ? GRAPE : k.line }}>
        <View style={{ height: small ? 64 : 88, borderRadius: small ? 12 : 14, backgroundColor: k.bg, borderWidth: 1, borderColor: k.line, overflow: "hidden" }}>
          {it.kind === "bg" ? <>
            <ChatBg id={it.id} w={small ? 68 : 190} h={small ? 64 : 88} />
            {small ? <><View style={{ position: "absolute", left: 6, top: 8, width: 36, height: 12, borderRadius: 6, borderBottomLeftRadius: 2, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }} /><View style={{ position: "absolute", right: 6, bottom: 8, width: 28, height: 12, borderRadius: 6, borderBottomRightRadius: 2, backgroundColor: GRAPE }} /></>
              : <><View style={{ position: "absolute", left: 8, top: 10, borderRadius: 12, borderBottomLeftRadius: 6, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, paddingHorizontal: 10, paddingVertical: 4 }}><T s={10.5}>Morning! Ready?</T></View><View style={{ position: "absolute", right: 8, bottom: 10, borderRadius: 12, borderBottomRightRadius: 6, backgroundColor: GRAPE, paddingHorizontal: 10, paddingVertical: 4 }}><T s={10.5} c="#fff">{"Let's go"}</T></View></>}
          </> : (
            <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "center", gap: small ? 4 : 6, paddingHorizontal: small ? 6 : 10 }}>
              {(small ? ["Hi!", "Nice"] : ["This is my style", "Looks good?"]).map((t) => <MyBubble key={t} id={it.id} style={{ borderRadius: small ? 10 : 14, borderBottomRightRadius: small ? 3 : 6, paddingHorizontal: small ? 8 : 12, paddingVertical: small ? 2 : 6 }}><T f="semi" s={small ? 9.5 : 11.5} c={bubbleInk(it.id)}>{t}</T></MyBubble>)}
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: small ? 6 : 8 }}>
          <T f="bold" s={small ? 12 : 13.5} lines={1} style={{ flexShrink: 1 }}>{it.name}</T>
          {!small && !have ? <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><Coin size={12} /><T f="bold" s={12.5} c={k.ink75}>{String(it.price)}</T></View> : null}
          {!small && have ? <Label s={8} c={k.brandInk}>Owned</Label> : null}
        </View>
        {!have ? <Pressable disabled={coins < it.price} onPress={() => onBuy(it.id, it.name)} style={{ marginTop: 6, height: small ? 32 : 36, borderRadius: 18, backgroundColor: coins < it.price ? (k.dark ? "rgba(255,255,255,0.15)" : "rgba(10,10,10,0.15)") : GRAPE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>{small ? <><Coin size={11} /><T f="bold" s={12} c={coins < it.price ? k.ink45 : "#fff"}>{String(it.price)}</T></> : <T f="bold" s={13} c={coins < it.price ? k.ink45 : "#fff"}>{coins < it.price ? `Need ${it.price - coins} more` : "Buy"}</T>}</Pressable>
          : on ? <Pressable onPress={() => onWear(it.kind, null)} style={{ marginTop: 6, height: small ? 32 : 36, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: GRAPE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}><Icon name="check" size={13} stroke={3} color={k.brandInk} /><T f="bold" s={12} c={k.brandInk}>{small ? "On" : "Applied"}</T></Pressable>
          : <Pressable onPress={() => onWear(it.kind, it.id)} style={{ marginTop: 6, height: small ? 32 : 36, borderRadius: 18, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, alignItems: "center", justifyContent: "center" }}><T f="bold" s={12}>Apply</T></Pressable>}
      </View>
    );
  };
  return (
    <WSheet open={open} title={cat ? cat.title : "Store"} onClose={() => { setFull(null); onClose(); }} right={<View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: k.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Coin size={13} /><T f="bold" s={12.5}>{coins.toLocaleString("en-US")}</T></View>}>
      {cat ? (
        <View>
          <Pressable onPress={() => setFull(null)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}><Icon name="back" size={16} color={k.ink} /><T f="bold" s={13}>Back</T></Pressable>
          <T s={12.5} c={k.ink45} style={{ marginTop: 6 }}>{cat.sub}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{STORE_ITEMS.filter((x) => x.kind === cat.kind).map((it) => card(it, false))}</View>
        </View>
      ) : STORE_CATEGORIES.map((c) => (
        <View key={c.kind} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ borderRadius: 999, backgroundColor: "rgba(91,43,255,0.15)", borderWidth: 1, borderColor: "rgba(91,43,255,0.3)", paddingHorizontal: 12, paddingVertical: 4 }}><T f="xbold" s={13.5} c={k.brandInk}>{c.title}</T></View>
            <Pressable onPress={() => setFull(c.kind)} style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 2 }}><T f="bold" s={13} c={k.brandInk}>See more</T><Icon name="arrow" size={14} color={k.brandInk} /></Pressable>
          </View>
          <T s={12} c={k.ink45} style={{ marginTop: 4 }}>{c.sub}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>{STORE_ITEMS.filter((x) => x.kind === c.kind).map((it) => card(it, true))}</ScrollView>
        </View>
      ))}
    </WSheet>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
