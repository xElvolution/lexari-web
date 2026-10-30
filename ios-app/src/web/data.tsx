/** One shared snapshot of the account, from the same endpoints the web app reads (/api/me, /api/hub/state, /api/wallet). */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";

export type Agent = { slug: string; kind: string; name: string; model?: string | null; role?: string; look?: unknown; meta?: Record<string, unknown>; skills?: string[]; about?: string; tone?: string; memoryOn?: boolean; createdAt?: number };
export type Msg = { id: string; from: string; text?: string; at: number; call?: number; voice?: number; file?: { name: string; size?: number } };
export type Chat = { slug: string; kind: string; title: string; members: string[]; messages: Msg[]; createdAt?: number };
export type Me = {
  user: { wallet?: string; referralCode?: string; method?: string; email?: string | null; createdAt?: number; fullName?: string; username?: string; callName?: string; needsName?: boolean };
  profile: { name?: string; username?: string; avatar?: number | string; cover?: number | string; bio?: string };
  plan: { id: string; name: string; seats: number };
  prefs?: { defaultAgent?: string; hideBalance?: boolean; language?: string; voice?: string; tourDone?: boolean; memory?: boolean };
  agents: Agent[]; chats: Chat[]; jobs?: { id: string; assignee?: string; title?: string; prompt: string; status: string; output?: string; startedAt: number; finishedAt?: number }[];
  memories?: { id: string; agent?: string; tag?: string; source?: string; at: number }[]; hires?: { slug: string }[];
  lockOn?: boolean; biometric?: boolean;
};
export type Quest = { id: string; period: string; goal: number; reward: number; progress: number; claimed: boolean };
export type HubState = { program?: { live: boolean }; player?: { coins: number; lifetime: number; streak: number; checkedInToday: boolean; lastCheckIn?: number } | null; levels?: { slug: string; name: string; level: number; xp: number }[]; quests?: Quest[]; achievements?: { id: string; done?: boolean }[]; referrals?: number; box?: { openedToday?: boolean } };
export type Holding = { asset: string; amount: number; decimals: number; test?: boolean };
export type Wallet = { balance: number; history: { id: string; kind: string; label: string; delta: number; at: number }[]; agents: { slug: string; kind: string; name: string; wallets: { chain: string; network: string; address: string; holdings: Holding[]; explorer?: string }[] }[] };

type D = { me: Me | null; hub: HubState | null; wallet: Wallet | null; error: string; reload: () => Promise<void> };
const Ctx = createContext<D>({ me: null, hub: null, wallet: null, error: "", reload: async () => {} });

export function DataProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [hub, setHub] = useState<HubState | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!token) return;
    const [a, b, c] = await Promise.allSettled([api<Me>("/api/me", {}, token), api<HubState>("/api/hub/state", {}, token), api<Wallet>("/api/wallet", {}, token)]);
    if (a.status === "fulfilled") setMe(a.value); if (b.status === "fulfilled") setHub(b.value); if (c.status === "fulfilled") setWallet(c.value);
    setError(a.status === "rejected" ? "Couldn't reach Lexari. Pull to retry." : "");
  }, [token]);
  useEffect(() => { reload().catch(() => {}); }, [reload]);
  return <Ctx.Provider value={{ me, hub, wallet, error, reload }}>{children}</Ctx.Provider>;
}
export const useData = () => useContext(Ctx);

/**
 * webapp/lib/store.ts hello() / customHi(): an agent's first line, put at the top of its thread so a new chat never opens empty.
 * The home agent says "Hi you, I'm Nova. Ask me anything."; an agent you built yourself mentions its brief.
 */
export function withHello<T extends { id: string; at: number }>(me: Me | null, slug: string, msgs: T[]): T[] {
  if (msgs.some((m) => m.id === "hello")) return msgs;
  const home = me?.agents.find((a) => a.slug === "home");
  const you = String((home?.meta as { you?: string } | undefined)?.you || "");
  const hi = `Hi${you ? ` ${you}` : ""}`;
  let text = "", at0 = 0;
  if (slug === "home" && home) { text = `${hi}, I'm ${home.name}. Ask me anything.`; at0 = Number(new Date(me?.user.createdAt as unknown as string)); }
  else {
    const c = me?.agents.find((a) => a.slug === slug && a.kind === "custom");
    if (!c) return msgs;
    text = `${hi}, I'm ${c.name}. ${c.about ? "I've read the brief you gave me." : "Tell me what you want me to do."} What should I start with?`; at0 = Number(c.createdAt);
  }
  const at = Math.min(at0 || Date.now(), ...msgs.map((m) => m.at - 1));
  return [{ id: "hello", from: slug, at, text } as unknown as T, ...msgs];
}
export const primaryOf = (me: Me | null) => me?.prefs?.defaultAgent || "home";
/** Your nickname for an agent first (a hired specialist renamed from chat), then its name. Same rule as the web. */
export const nameOf = (me: Me | null, slug: string) => { const a = me?.agents.find((x) => x.slug === slug); return (typeof a?.meta?.nick === "string" && a.meta.nick) || a?.name || slug; };
/** Your name for badges and cards: full name, then what agents call you. Never an email. */
export const youName = (me: Me | null) => [me?.user.fullName, me?.profile?.name, me?.user.callName].find((n) => n && !n.includes("@") && n !== "You") || "You";
/** AppShell initials(): the profile name, else the sign-in label (email or short wallet address). */
export const initialsOf = (me: Me | null) => {
  const n = me?.profile?.name?.trim();
  if (n && n !== "You") return n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const w = me?.user.wallet, label = me?.user.email || (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : "");
  return me?.user.method === "wallet" ? (label || "W").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() : (label || "You").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
};
