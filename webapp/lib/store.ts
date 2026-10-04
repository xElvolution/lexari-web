"use client";

/**
 * App state. The account lives on the server (Postgres, behind a signed-in session) and on Solana.
 * This module loads it once from /api/me, keeps it in memory for the UI, and sends every change
 * to the API. Memories are encrypted in the browser (lib/vault.ts) before they leave it.
 */
import type { FaceLook } from "@shared/components/avatar";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  PLANS, SPECIALISTS, WALLETS, registerCustom, shortAddr,
  type CustomAgent, type Job, type MemoryTag, type PlanId, type ToneId, type WalletId,
} from "@/content/appData";
import type { Account } from "@/server/account";
import type { HubState } from "@/server/hub/state";
import { ApiError, api } from "./api";
import { applyTheme } from "@shared/components/theme";
import { signOutSession } from "./session";
import { bridgeFor, runSignOutHooks } from "./walletBridge";
import { openNote, savedKeys, sealNote, unlock } from "./vault";

export type Msg = {
  id: string; from: string; text: string; at: number; jobId?: number;
  file?: { name: string; size: string }; // an attachment: only its name and size are sent
  voice?: number; // a voice note, length in seconds
  call?: number; // a call log line, length in seconds
  re?: Record<string, string[]>; // reactions: emoji → who reacted ("you" or an agent id)
  reply?: { id: string; from: string; text: string }; // the message this one answers
  send?: { to: string; sol: number; status: "pending" | "sent" | "cancelled" | "failed"; sig?: string; error?: string }; // a SOL transfer the agent prepared; only you can confirm it
};
/** Your own notes on any agent. Hired agents only get nick, notes and memory; the maker controls the rest. */
export type AgentMeta = { nick?: string; notes?: string; memory?: boolean; voice?: { name: string; pitch: number; rate: number; preset?: string }; about?: string; skills?: string[]; /** onchain ID card, once minted */ nft?: import("@/lib/nft").NftRecord };
export type Tour = { on: boolean; step: number; done: boolean };
/** Coins (from the onchain Player account) and check-in days. */
export type BondLog = { days: string[]; coins: number; claimed: string[] };
export type Group = { id: string; name: string; members: string[]; at: number };
export type Card = { number: string; exp: string; cvv: string; frozen: boolean; limit: number; at: number };
export type Prefs = {
  language: string; voice: string; defaultAgent: string; memory: boolean; history: boolean; improve: boolean;
  motion: boolean; demoLabels: boolean; instructions: string; twofa: boolean; signedOut: string[]; theme?: "light" | "dark" | "system";
  notif: Record<string, boolean>;
  primary?: string; // the agent you made that leads (and is the only one that levels up)
};
export type Profile = { name: string; username: string; bio: string; since: number; avatar?: number; cover?: number };
export const DEFAULT_PREFS: Prefs = {
  language: "English", voice: "Iris", defaultAgent: "home", memory: true, history: true, improve: false,
  motion: true, demoLabels: false, instructions: "", twofa: false, signedOut: [],
  notif: { replies: true, groups: true, calls: true, wallet: true, cards: true, digest: false, product: false },
};
/** A memory. `locked` until this device has the key (one wallet signature). */
export type Note = { id: string; tag: MemoryTag; text: string; source: string; at: number; chainHash?: string; chainAsset?: string; chainTx?: string; pendingChain?: boolean; serverId?: string; locked?: boolean; saving?: boolean; /** HMAC of the text: the dedupe key and the onchain hash */ hash?: string };
/** look: a seed number (null = the house face) or a face built in the creator */
export type AgentLook = number | null | FaceLook;
export type Agent = { name: string; look: AgentLook; you: string; role: string; tone: ToneId };
export type Auth = { method: "google" | "wallet"; label: string; sub: string; wallet?: WalletId; address?: string; email?: string };
export type State = {
  v: 1; auth: Auth | null; links: { google: boolean; wallet: boolean };
  agent: Agent | null; onboarded: boolean; plan: PlanId; hired: string[];
  memory: Note[]; jobs: Job[]; chat: Msg[]; nextJob: number;
  threads: Record<string, Msg[]>; // one chat per agent ("home", a specialist slug, "c-…") or per group ("g-…")
  groups: Group[]; active: string; // the conversation open on Home
  wallets: Record<string, string>; // agent id → wallet address. Your agents use your wallet.
  cards: Record<string, Card>;
  prefs: Prefs; profile: Profile | null;
  custom: CustomAgent[]; // agents you made (ids start with "c-")
  born: Record<string, number>; // agent id → the day it joined you (printed on its ID card)
  meta: Record<string, AgentMeta>;
  tour: Tour;
  bond: BondLog;
  hub?: import("@/lib/hub").HubData;
  /** Hub state from the server (chain accounts + server records). */
  live?: HubState | null;
  /** Specialists you have paid for (a released one can come back for free). */
  paid: string[];
  referralCode: string;
  memoryLocked: boolean;
  /** seats and expiry of the current plan (from the server) */
  planInfo: { seats: number; expiresAt: number | null };
  lockOn: boolean;
  biometric: boolean;
};

const EMPTY: State = { v: 1, auth: null, links: { google: false, wallet: false }, agent: null, onboarded: false, plan: "free", hired: [], memory: [], jobs: [], chat: [], nextJob: 1, threads: {}, groups: [], active: "home", wallets: {}, cards: {}, prefs: DEFAULT_PREFS, profile: null, custom: [], born: {}, meta: {}, tour: { on: false, step: 0, done: false }, bond: { days: [], coins: 0, claimed: [] }, live: null, paid: [], referralCode: "", memoryLocked: false, planInfo: { seats: 1, expiresAt: null }, lockOn: false, biometric: false };

let state: State | null = null;
let loading: Promise<void> | null = null;
let loadError = "";
const subs = new Set<() => void>();
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 12) : Math.random().toString(36).slice(2, 14));
const ACTIVE_KEY = "lexari-active-convo";

function emit() { subs.forEach((f) => f()); }
function snapshot() { return state; }
function subscribe(f: () => void) {
  subs.add(f);
  if (state === null && !loading) void hydrate();
  return () => { subs.delete(f); };
}
/** Local state change only. Callers send the change to the server themselves. */
export function set(fn: (s: State) => State) {
  const cur = state ?? EMPTY;
  const before = cur.custom;
  state = fn(cur);
  if (state.custom !== before) registerCustom(state.custom);
  emit();
}
export const get = () => state ?? EMPTY;

/** Returns null while the account loads, then the state (auth is null when signed out). */
export function useApp(): State | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
export function useLoadError() {
  return useSyncExternalStore(subscribe, () => loadError, () => "");
}
export function useNow(ms = 500) {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/* ---------- toasts (not saved) ---------- */
export type Toast = { id: string; text: string; face?: number | null | "home"; color?: string; action?: { label: string; run: () => void } };
let toasts: Toast[] = [];
const tsubs = new Set<() => void>();
export function toast(t: Omit<Toast, "id">) {
  const id = uid(); toasts = [...toasts.slice(-2), { ...t, id }]; tsubs.forEach((f) => f());
  setTimeout(() => dismiss(id), 4200);
}
export function dismiss(id: string) { toasts = toasts.filter((t) => t.id !== id); tsubs.forEach((f) => f()); }
const emptyToasts: Toast[] = [];
export function useToasts() {
  return useSyncExternalStore((f) => { tsubs.add(f); return () => { tsubs.delete(f); }; }, () => toasts, () => emptyToasts);
}
/** Runs a server call; on failure, shows why and optionally rolls the local change back. */
function sync(p: Promise<unknown>, undo?: () => void) {
  p.catch((e) => {
    undo?.();
    if (e instanceof ApiError && e.status === 401) { toast({ text: "You're signed out. Sign in again.", face: "home" }); void hydrate(); return; }
    toast({ text: (e as Error)?.message || "Could not save that.", face: "home" });
  });
}

/* ---------- loading the account ---------- */
const hello = (a: Agent, at = Date.now()): Msg => ({ id: "hello", from: "home", at, text: `Hi${a.you ? ` ${a.you}` : ""}, I'm ${a.name}. Ask me anything.` });

function customFrom(a: Account["agents"][number]): CustomAgent {
  const look = (a.look && typeof a.look === "object" ? a.look : {}) as Partial<CustomAgent>;
  return {
    id: a.slug, name: a.name, role: a.role, about: a.about, template: look.template ?? null,
    shape: look.shape ?? "round", color: look.color ?? "purple", eyes: look.eyes ?? "dot", mouth: look.mouth ?? "smile",
    tone: (a.tone || "short") as ToneId, skills: a.skills || [], memory: a.memoryOn, at: a.createdAt,
    extra: look.extra, blush: look.blush, brows: look.brows, orbit: look.orbit, dots: look.dots, bg: look.bg,
  } as CustomAgent;
}

function jobFrom(j: Account["jobs"][number], i: number): Job {
  const title = j.title || j.prompt.slice(0, 80);
  const file = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "output"}.md`;
  const body = `# ${title}\n\nAsked: ${j.prompt}\n\n${j.output}\n`;
  return {
    id: i + 1, title, prompt: j.prompt, assignee: j.assignee, status: j.status === "done" ? "done" : j.status === "failed" ? "needs-you" : "running",
    startedAt: j.startedAt, duration: Math.max(1000, (j.finishedAt ?? j.startedAt) - j.startedAt),
    steps: ["Reads the brief", "Thinks it through", "Writes the answer", "Saves the file"], terminal: [], url: "",
    files: j.output ? [{ name: file, size: `${Math.max(1, Math.round(body.length / 1024))} KB`, body }] : [],
  };
}

function fromAccount(acc: Account): State {
  const home = acc.agents.find((a) => a.slug === "home");
  const prefsRaw = acc.prefs as Partial<Prefs> & { tourDone?: boolean };
  const prefs: Prefs = { ...DEFAULT_PREFS, ...prefsRaw, demoLabels: false, notif: { ...DEFAULT_PREFS.notif, ...(prefsRaw.notif || {}) } };
  const label = acc.user.email || shortAddr(acc.user.wallet);
  const auth: Auth = acc.user.method === "google"
    ? { method: "google", label, sub: acc.user.email || "Google or email", address: acc.user.wallet, email: acc.user.email || undefined }
    : { method: "wallet", label, sub: "Solana wallet", address: acc.user.wallet };
  const agent: Agent | null = home ? { name: home.name, look: (home.look ?? null) as AgentLook, you: String((home.meta as { you?: string }).you || ""), role: home.role, tone: (home.tone || "short") as ToneId } : null;
  const meta: Record<string, AgentMeta> = {};
  const born: Record<string, number> = {};
  for (const a of acc.agents) {
    const m = a.meta as { nick?: string; notes?: string; mintTx?: string; dna?: string; voice?: AgentMeta["voice"] };
    born[a.slug] = a.createdAt;
    meta[a.slug] = {
      nick: m.nick, notes: m.notes, memory: a.memoryOn, voice: m.voice,
      ...(a.asset ? { nft: { tokenId: a.asset, tx: m.mintTx || "", dna: m.dna || "", name: a.name, role: a.role, owner: acc.user.wallet, at: a.mintedAt ?? a.createdAt, registered: true } } : {}),
    };
  }
  const threads: Record<string, Msg[]> = {};
  const groups: Group[] = [];
  for (const c of acc.chats) {
    const seen = new Set<string>();
    threads[c.slug] = c.messages.filter((m) => { const k = String((m as Msg).id); if (seen.has(k)) return false; seen.add(k); return true; }).map((m) => m as Msg);
    if (c.kind === "group") groups.push({ id: c.slug, name: c.title, members: c.members, at: c.createdAt });
  }
  if (agent && !(threads.home || []).length) threads.home = [hello(agent, Number(acc.user.createdAt) || Date.now())];
  const custom = acc.agents.filter((a) => a.kind === "custom").map(customFrom);
  let active = "home";
  try { active = localStorage.getItem(`${ACTIVE_KEY}:${acc.user.wallet}`) || "home"; } catch {}
  const memory: Note[] = acc.memories.map((m) => ({
    id: m.id, serverId: m.id, tag: (m.tag || "About you") as MemoryTag, text: "", source: m.source || "You", at: m.at, locked: true,
    hash: m.contentHash, chainHash: m.onchainPda ? m.contentHash : undefined, chainAsset: m.onchainPda ? home?.asset || undefined : undefined, chainTx: m.chainTx || undefined,
  }));
  return {
    ...EMPTY, auth, links: { google: acc.user.method === "google", wallet: acc.user.method === "wallet" },
    agent, onboarded: !!home, plan: acc.plan.id, planInfo: { seats: acc.plan.seats, expiresAt: acc.plan.expiresAt }, lockOn: acc.lockOn, biometric: acc.biometric,
    hired: acc.agents.filter((a) => a.kind === "hired").map((a) => a.slug),
    paid: acc.hires.map((h) => h.slug),
    memory, memoryLocked: memory.length > 0,
    jobs: acc.jobs.slice().reverse().map(jobFrom), nextJob: acc.jobs.length + 1,
    threads, groups, active,
    wallets: { home: acc.user.wallet },
    prefs,
    profile: { name: String((acc.profile as Partial<Profile>).name || (acc.user.email ? acc.user.email.split("@")[0] : agent?.you || "You")), username: String((acc.profile as Partial<Profile>).username || ""), bio: String((acc.profile as Partial<Profile>).bio || ""), since: acc.user.createdAt, avatar: acc.media?.avatar, cover: acc.media?.cover },
    custom, born, meta,
    tour: { on: !!home && !prefsRaw.tourDone, step: 0, done: !!prefsRaw.tourDone },
    referralCode: acc.user.referralCode,
    _memRaw: acc.memories,
  } as State;
}

type RawMem = Account["memories"];
/** Server threads plus any local message the server doesn't have yet. A thread is never emptied by a reload. */
function mergeThreads(local: Record<string, Msg[]>, server: Record<string, Msg[]>) {
  const out: Record<string, Msg[]> = { ...server };
  for (const [k, mine] of Object.entries(local)) {
    const theirs = server[k] || [];
    const ids = new Set(theirs.map((m) => m.id));
    const newest = theirs.length ? theirs[theirs.length - 1].at : 0;
    const extra = mine.filter((m) => !ids.has(m.id) && m.id !== "hello" && (m.at >= newest - 120_000 || !theirs.length));
    if (!extra.length) { if (!theirs.length && mine.length) out[k] = mine; continue; }
    out[k] = [...theirs.filter((m) => m.id !== "hello" || !extra.length), ...extra].sort((a, b) => a.at - b.at).slice(-200);
  }
  return out;
}
/** After a reload mid-reply: the server is still finishing it. Show typing and fetch again until it lands (up to ~2 min). */
let replyPolls = 0;
function awaitPendingReplies(st: State) {
  const waiting = Object.entries(st.threads).filter(([k, t]) => { const last = t[t.length - 1]; return last && last.from === "you" && Date.now() - last.at < 150_000 && !queued.has(k); }).map(([k]) => k);
  if (!waiting.length || replyPolls > 30) { if (!waiting.length) replyPolls = 0; for (const k of [...typingWho.keys()]) if (!queued.has(k) && !waiting.includes(k)) typingWho.delete(k); return; }
  for (const k of waiting) if (!typingWho.has(k)) typingWho.set(k, k.startsWith("g-") ? "home" : k);
  emit();
  replyPolls++;
  setTimeout(() => void hydrate(), 4000);
}
/** Reloads chats from the server without dropping anything on screen (after a failed reply). */
export function refreshThreads() { void hydrate(); }
/** Loads (or reloads) the account from the server. */
export function hydrate(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const acc = await api<Account>("/api/me");
      const next = fromAccount(acc);
      // Never lose messages you can see: keep anything on screen the server hasn't saved yet (a reply still streaming).
      if (state?.auth?.address && state.auth.address === next.auth?.address) next.threads = mergeThreads(state.threads, next.threads);
      // The theme you picked on another device (or before this browser's storage was cleared).
      try { const t = next.prefs.theme; if (t && !localStorage.getItem("lexari-theme")) applyTheme(t); } catch {}
      registerCustom(next.custom);
      state = next;
      loadError = "";
      emit();
      void decryptMemories(acc.user.wallet, acc.memories, false);
      awaitPendingReplies(next);
      void refreshHub();
    } catch (e) {
      if (state?.auth && !(e instanceof ApiError && e.status === 401)) { loadError = ""; } // a blip while signed in: keep what's on screen
      else if (e instanceof ApiError && (e.status === 401 || e.status === 503)) { state = { ...EMPTY }; loadError = e.status === 503 ? e.message : ""; }
      else { state = state ?? { ...EMPTY }; loadError = (e as Error).message || "Could not load your account."; }
      emit();
    } finally {
      loading = null;
    }
  })();
  return loading;
}

async function decryptMemories(wallet: string, raw: RawMem, ask: boolean) {
  if (!raw.length) return true;
  const signer = bridgeFor(wallet);
  const keys = (await savedKeys(wallet)) || (ask && signer ? await unlock(wallet, signer.signMessage) : null);
  if (!keys) return false;
  const opened = new Map<string, string>();
  for (const m of raw) {
    try { opened.set(m.id, await openNote(keys, m.ciphertext, m.iv)); } catch { /* sealed with another key */ }
  }
  set((s) => ({ ...s, memoryLocked: false, memory: s.memory.map((n) => (n.serverId && opened.has(n.serverId) ? { ...n, text: opened.get(n.serverId)!, locked: false } : n)) }));
  return true;
}

/** Asks the wallet for the memory key (once per device) and opens your memories. */
export async function unlockMemories() {
  const s = get();
  const wallet = s.auth?.address;
  if (!wallet) return false;
  if (!bridgeFor(wallet)) { toast({ text: "Connect the wallet you signed in with to open your memories.", face: "home" }); return false; }
  try {
    const raw = await api<{ memories: RawMem }>("/api/memories");
    return await decryptMemories(wallet, raw.memories, true);
  } catch (e) {
    toast({ text: (e as Error).message || "Could not open your memories.", face: "home" });
    return false;
  }
}

async function memoryKeys() {
  const wallet = get().auth?.address;
  if (!wallet) throw new Error("Sign in first.");
  const have = await savedKeys(wallet);
  if (have) return have;
  const signer = bridgeFor(wallet);
  if (!signer) throw new Error("Connect the wallet you signed in with to save memories.");
  return unlock(wallet, signer.signMessage);
}

/* ---------- hub ---------- */
let hubLoading: Promise<HubState | null> | null = null;
let hubTried = false;
/** True once the onchain Hub state has loaded (or failed to load) at least once. Until then the Hub shows a loading state. */
export const hubReady = () => hubTried;
export function refreshHub(): Promise<HubState | null> {
  if (hubLoading) return hubLoading;
  hubLoading = api<HubState>("/api/hub/state")
    .then((live) => { applyHub(live); return live; })
    .catch(() => null)
    .finally(() => { hubLoading = null; if (!hubTried) { hubTried = true; emit(); } });
  return hubLoading;
}
export function applyHub(live: HubState) {
  set((s) => ({ ...s, live, bond: { ...s.bond, coins: live.player?.coins ?? 0 } }));
}

/* ---------- helpers ---------- */
/** The current plan. Every agent (yours, hired, made by you) takes a seat. */
export const planOf = (s: State) => ({ ...(PLANS.find((p) => p.id === s.plan) ?? PLANS[0]), seats: s.planInfo?.seats ?? 1, expiresAt: s.planInfo?.expiresAt ?? null });
export const seatsUsed = (s: State) => 1 + s.hired.length + s.custom.length;
export const seatsLeft = (s: State) => planOf(s).seats - seatsUsed(s);
/** Agents past your plan's seats (newest first to lose a seat). Their chats and data stay; they wait for an upgrade. */
export const lockedAgents = (s: State) => [...s.hired, ...s.custom.map((c) => c.id)].sort((a, b) => (s.born[a] || 0) - (s.born[b] || 0)).slice(Math.max(0, planOf(s).seats - 1));
export const isLocked = (s: State, id: string) => id !== "home" && lockedAgents(s).includes(id);
export const agentName = (s: State | null) => s?.agent?.name || "Your agent";
export const jobNo = (id: number) => `#${String(id).padStart(3, "0")}`;
export function progressOf(j: Job, now: number) {
  if (j.status !== "running") return 1;
  return Math.max(0, Math.min(1, (now - j.startedAt) / j.duration));
}

/* ---------- session ---------- */
/** Called after the server set the session cookie. Loads the account. */
export async function signIn(..._args: unknown[]) {
  state = null;
  emit();
  await hydrate();
}
export async function signOut() {
  await signOutSession();
  await runSignOutHooks();
  state = { ...EMPTY };
  emit();
}
/** Deletes the account and everything in it on the server. Onchain records stay onchain. */
export async function deleteAccount() {
  await api("/api/account", { method: "DELETE" });
  await runSignOutHooks();
  state = { ...EMPTY };
  emit();
}
export const resetAll = deleteAccount;
export function linkMethod(_m: "google" | "wallet", _on: boolean) { /* one sign-in method per account */ }

const homeBody = (a: Agent) => ({ slug: "home", kind: "home", name: a.name, role: a.role, tone: a.tone, look: a.look ?? null, meta: { you: a.you } });

export async function finishOnboarding(agent: Agent, knows: string[]) {
  await api("/api/agents", { body: homeBody(agent) });
  set((s) => ({
    ...s, agent, onboarded: true, born: { ...s.born, home: Date.now() }, threads: { ...s.threads, home: s.threads.home?.length ? s.threads.home : [hello(agent)] },
    tour: { on: !s.tour.done, step: 0, done: s.tour.done },
  }));
  const notes = [...knows.filter(Boolean), ...(agent.you ? [`Calls you ${agent.you}${agent.role ? `, ${agent.role.toLowerCase()}` : ""}`] : [])];
  for (const text of notes) addNote(text, "About you", "You");
}
export function updateAgent(p: Partial<Agent>) {
  const prev = get().agent;
  if (!prev) return;
  const next = { ...prev, ...p };
  set((s) => ({ ...s, agent: next }));
  sync(api("/api/agents", { body: homeBody(next) }), () => set((s) => ({ ...s, agent: prev })));
}

/** Puts a paid specialist on the team (after /api/hires confirmed the payment). */
export function hire(slug: string): "ok" | "full" | "already" {
  const s = get();
  if (s.hired.includes(slug)) return "already";
  set((x) => ({ ...x, hired: [...x.hired, slug], paid: x.paid.includes(slug) ? x.paid : [...x.paid, slug], born: { ...x.born, [slug]: Date.now() } }));
  return "ok";
}
export function release(slug: string) {
  const prev = get();
  set((s) => ({ ...s, hired: s.hired.filter((h) => h !== slug), groups: s.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== slug) })) }));
  sync(api(`/api/agents/${encodeURIComponent(slug)}`, { method: "DELETE" }), () => set(() => prev));
}
/** After a verified upgrade. */
export function setPlan(id: PlanId, seats: number, expiresAt: number | null) { set((x) => ({ ...x, plan: id, planInfo: { seats, expiresAt } })); }

/* ---------- memory ---------- */
export function addNote(text: string, tag: MemoryTag = "About you", source = "You", chain = false) {
  const n: Note = { id: uid(), tag, text, source, at: Date.now(), pendingChain: chain || undefined, saving: true };
  set((s) => ({ ...s, memory: [n, ...s.memory] }));
  void (async () => {
    try {
      const sealed = await sealNote(await memoryKeys(), text);
      const r = await api<{ id: string; duplicate?: boolean }>("/api/memories", { body: { agentSlug: "home", tag, source: source.slice(0, 60), ...sealed } });
      if (r.duplicate) set((s) => ({ ...s, memory: s.memory.filter((m) => m.id !== n.id) }));
      else set((s) => ({ ...s, memory: s.memory.map((m) => (m.id === n.id ? { ...m, serverId: r.id, saving: false, hash: sealed.contentHash } : m)) }));
    } catch (e) {
      set((s) => ({ ...s, memory: s.memory.filter((m) => m.id !== n.id) }));
      toast({ text: `Not saved. ${(e as Error).message || ""}`.trim(), face: "home" });
    }
  })();
  return n;
}
export function editNote(id: string, p: Partial<Note>) {
  const before = get().memory.find((m) => m.id === id);
  set((s) => ({ ...s, memory: s.memory.map((m) => (m.id === id ? { ...m, ...p } : m)) }));
  if (!before?.serverId || (p.text === undefined && p.tag === undefined)) return;
  const text = p.text ?? before.text, tag = p.tag ?? before.tag;
  sync((async () => {
    const sealed = await sealNote(await memoryKeys(), text);
    await api(`/api/memories/${before.serverId}`, { method: "PATCH", body: { tag, ...sealed } });
    set((s) => ({ ...s, memory: s.memory.map((m) => (m.id === id ? { ...m, hash: sealed.contentHash, chainHash: undefined } : m)) }));
  })(), () => set((s) => ({ ...s, memory: s.memory.map((m) => (m.id === id ? before : m)) })));
}
export function forgetNote(id: string) {
  const s = get(); const idx = s.memory.findIndex((m) => m.id === id); const note = s.memory[idx];
  set((x) => ({ ...x, memory: x.memory.filter((m) => m.id !== id) }));
  if (note?.serverId) sync(api(`/api/memories/${note.serverId}`, { method: "DELETE" }), () => set((x) => ({ ...x, memory: [...x.memory.slice(0, idx), note, ...x.memory.slice(idx)] })));
  // Undo puts it back as a new memory.
  return () => { if (note) addNote(note.text, note.tag, note.source); };
}
/** Local calendar day. */
export function todayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const CHECKIN_COINS = 10;

/** Figures out who takes a job: an @mention or a keyword match with a hired specialist, else your agent. */
export function routeJob(s: State, text: string) {
  const t = text.toLowerCase();
  const hired = SPECIALISTS.filter((sp) => s.hired.includes(sp.slug));
  const mention = hired.find((sp) => t.includes(`@${sp.slug}`));
  if (mention) return mention.slug;
  const kw = hired.find((sp) => sp.words.some((w) => t.includes(w)));
  return kw?.slug ?? "home";
}

/* ---------- chats ---------- */
export const isGroup = (id: string) => id.startsWith("g-");
export const groupOf = (s: State, id: string) => s.groups.find((g) => g.id === id);
export const convoExists = (s: State, id: string | null | undefined) => !!id && (id === "home" || s.hired.includes(id) || s.custom.some((c) => c.id === id) || s.groups.some((g) => g.id === id));
export const isCustom = (id: string) => id.startsWith("c-");

const typingWho = new Map<string, string>();
const queued = new Set<string>();
export function useTyping(id: string) {
  return useSyncExternalStore(subscribe, () => typingWho.get(id) ?? null, () => null);
}
const push = (convo: string, m: Omit<Msg, "id" | "at">) => {
  const id = uid();
  set((x) => ({ ...x, threads: { ...x.threads, [convo]: [...(x.threads[convo] || []), { ...m, id, at: Date.now() }].slice(-200) } }));
  return id;
};
function setMsg(convo: string, id: string, text: string) {
  set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((m) => (m.id === id ? { ...m, text } : m)) } }));
}

/** Who answers in a conversation: the agent itself, or in a group the member you named (else members take turns). */
function speakerFor(st: State, convo: string, text: string) {
  if (!isGroup(convo)) return convo;
  const g = groupOf(st, convo);
  if (!g?.members.length) return "home";
  const t = text.toLowerCase();
  const nameOf = (m: string) => (m === "home" ? st.agent?.name : st.meta[m]?.nick || st.custom.find((c) => c.id === m)?.name || SPECIALISTS.find((p) => p.slug === m)?.name || m)?.toLowerCase() || m;
  const named = g.members.find((m) => t.includes(nameOf(m)));
  if (named) return named;
  const k = (st.threads[convo] || []).filter((m) => m.from === "you").length;
  return g.members[k % g.members.length];
}

/** Ask the model for a reply and stream the tokens into the thread. The server saves both messages. */
if (typeof window !== "undefined") (window as unknown as { __lexariBusy?: () => boolean }).__lexariBusy = () => queued.size > 0;
async function replyFromModel(convo: string, userMsg: Msg) {
  if (queued.has(convo)) return "";
  const st = get();
  if (!st.agent || !convoExists(st, convo)) return "";
  queued.add(convo);
  const speaker = speakerFor(st, convo, userMsg.text);
  typingWho.set(convo, speaker); emit();
  const bubble = push(convo, { from: speaker, text: "" });
  const history = (st.threads[convo] || []).filter((m) => m.id !== userMsg.id && m.id !== "hello" && m.text && m.from !== "system").slice(-12).map((m) => ({ from: m.from, text: m.text.slice(0, 2000) }));
  const memoryOn = st.prefs.memory !== false && st.meta[speaker]?.memory !== false;
  const recall = memoryOn ? st.memory.filter((n) => !n.locked && n.text).slice(0, 8).map((n) => ({ tag: n.tag.slice(0, 40), text: n.text.slice(0, 240) })) : [];
  const text = userMsg.text || (userMsg.voice ? `Voice note, ${userMsg.voice} seconds.` : userMsg.file ? `Attachment: ${userMsg.file.name}` : "");
  const meta: Record<string, unknown> = {};
  if (userMsg.file) meta.file = userMsg.file;
  if (userMsg.voice) meta.voice = userMsg.voice;
  if (userMsg.reply) meta.reply = { ...userMsg.reply, text: userMsg.reply.text.slice(0, 300) };
  const fail = (m: string) => { setTimeout(refreshThreads, 1500); setMsg(convo, bubble, m); set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === bubble ? { ...mm, from: "system" } : mm)) } })); return m; };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ convo, text: text.slice(0, 4000), speaker, history, recall, userMsgId: userMsg.id, replyMsgId: bubble, meta }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) void hydrate();
      return fail(typeof data.error === "string" ? data.error : "The agent could not answer.");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      buf += dec.decode(step.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        let payload: { token?: string; remember?: string; error?: string; done?: boolean; send?: Msg["send"] } = {};
        try { payload = JSON.parse(trimmed.slice(5).trim()); } catch { continue; }
        if (payload.error) return fail(payload.error);
        if (payload.send) { const sd = payload.send; set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((mm) => (mm.id === bubble ? { ...mm, send: sd } : mm)) } })); }
        if (payload.token) { full += payload.token; setMsg(convo, bubble, full.replace(/\n?REMEMBER:\s*.{0,180}\s*$/, "").trim()); }
        if (payload.remember && memoryOn) addNote(payload.remember, "About you", "Chat", true);
        if (payload.done && speaker !== "home" && text.trim().length >= 12) void refreshJobs();
      }
    }
    if (!full.trim() && !(get().threads[convo] || []).find((m) => m.id === bubble)?.send) return fail("The agent sent an empty reply.");
    return (get().threads[convo] || []).find((m) => m.id === bubble)?.text || full;
  } catch {
    return fail("Could not reach the agent.");
  } finally {
    typingWho.delete(convo);
    queued.delete(convo);
    emit();
  }
}

async function refreshJobs() {
  try {
    const acc = await api<Account>("/api/me");
    set((s) => ({ ...s, jobs: acc.jobs.slice().reverse().map(jobFrom), nextJob: acc.jobs.length + 1 }));
  } catch {}
}

/** Send a message. Resolves with the agent's reply once the model finishes. */
export function sendTo(id: string, text: string, extra: Pick<Msg, "file" | "voice" | "reply"> = {}) {
  const v = text.trim(); if (!v && !extra.file && !extra.voice) return Promise.resolve("");
  const msgId = push(id, { from: "you", text: v, ...extra });
  const msg = (get().threads[id] || []).find((m) => m.id === msgId)!;
  return replyFromModel(id, msg);
}

/* ---------- reactions ---------- */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🔥"];
export const MORE_REACTIONS = ["😮", "😢", "🙏", "💯", "✅", "👏", "🤔", "🚀", "😍", "🤝", "💡", "👋"];
export function toggleReaction(convo: string, msgId: string, emoji: string, who = "you") {
  let re: Record<string, string[]> = {};
  set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((m) => {
    if (m.id !== msgId) return m;
    re = { ...(m.re || {}) }; const list = re[emoji] || [];
    re[emoji] = list.includes(who) ? list.filter((w) => w !== who) : [...list, who];
    if (!re[emoji].length) delete re[emoji];
    return { ...m, re };
  }) } }));
  if (msgId !== "hello") sync(api("/api/messages", { method: "PATCH", body: { convo, clientId: msgId, re } }));
}
/** Nothing waits for a reply after a reload: the server saved finished turns only. */
export function ensureReplies() {}
export function logCall(id: string, secs: number) {
  if (secs <= 0) return;
  const clientId = push(id, { from: "system", text: "Voice call", call: secs });
  sync(api("/api/messages", { body: { convo: id, clientId, from: "system", text: "Voice call", meta: { call: Math.round(secs) } } }));
}
export function setActive(id: string) {
  if (get().active === id) return;
  set((x) => ({ ...x, active: id }));
  try { localStorage.setItem(`${ACTIVE_KEY}:${get().auth?.address}`, id); } catch {}
}

export function createGroup(name: string, members: string[]) {
  const g: Group = { id: `g-${uid().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`, name: name.trim().slice(0, 60) || "New group", members, at: Date.now() };
  const line = { id: uid(), from: "system", at: Date.now(), text: `You made the group “${g.name}”` };
  set((x) => ({ ...x, groups: [...x.groups, g], threads: { ...x.threads, [g.id]: [line] } }));
  sync((async () => {
    await api("/api/chats", { body: { slug: g.id, title: g.name, members } });
    await api("/api/messages", { body: { convo: g.id, clientId: line.id, from: "system", text: line.text.slice(0, 200) } });
  })(), () => set((x) => ({ ...x, groups: x.groups.filter((y) => y.id !== g.id) })));
  return g.id;
}
export function updateGroup(id: string, p: Partial<Pick<Group, "name" | "members">>) {
  const prev = get().groups.find((g) => g.id === id);
  if (!prev) return;
  const next = { ...prev, ...p };
  set((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? next : g)) }));
  sync(api("/api/chats", { body: { slug: id, title: next.name.slice(0, 60) || "Group", members: next.members.length ? next.members : ["home"] } }), () => set((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? prev : g)) })));
}
export function deleteGroup(id: string) {
  set((x) => { const threads = { ...x.threads }; delete threads[id]; return { ...x, groups: x.groups.filter((g) => g.id !== id), threads, active: x.active === id ? "home" : x.active }; });
  sync(api(`/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function resolveJob(id: number) { set((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: "done" } : j)) })); }
/** Jobs finish on the server; nothing to advance here. */
export function tick(_now = Date.now()) {}

/** Client-side download of a text file. */
export function downloadFile(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- preferences, profile, export ---------- */
let prefTimer: ReturnType<typeof setTimeout> | null = null;
function savePrefs() {
  if (prefTimer) clearTimeout(prefTimer);
  prefTimer = setTimeout(() => {
    const { language, voice, defaultAgent, memory, history, improve, motion, instructions, notif, theme, primary } = get().prefs;
    sync(api("/api/me", { method: "PATCH", body: { prefs: { language, voice, defaultAgent, memory, history, improve, motion, instructions: instructions.slice(0, 2000), notif, tourDone: get().tour.done, ...(theme ? { theme } : {}), ...(primary ? { primary } : {}) } } }));
  }, 500);
}
/** Agents you made yourself (your first agent and any you created). Hired specialists are not in here. */
export const isCreated = (s: State, id: string) => id === "home" || s.custom.some((c) => c.id === id);
/** The primary agent: one you made. Defaults to your first agent. */
export const primaryOf = (s: State | null) => { const p = s?.prefs.primary; return s && p && isCreated(s, p) ? p : "home"; };
export function setPrimary(id: string) { const s = get(); if (!s || !isCreated(s, id)) return false; setPrefs({ primary: id }); return true; }
export function setPrefs(p: Partial<Prefs>) { set((x) => ({ ...x, prefs: { ...x.prefs, ...p } })); savePrefs(); }
export function setNotif(k: string, v: boolean) { set((x) => ({ ...x, prefs: { ...x.prefs, notif: { ...x.prefs.notif, [k]: v } } })); savePrefs(); }
export function updateProfile(p: Partial<Profile>) {
  set((x) => ({ ...x, profile: { ...(x.profile ?? { name: "You", username: "", bio: "", since: Date.now() }), ...p } }));
  const { name, username, bio } = get().profile!;
  sync(api("/api/me", { method: "PATCH", body: { profile: { name: name.slice(0, 60), username: username.slice(0, 30), bio: bio.slice(0, 300) } } }));
}
/** Profile picture / cover: saves the cropped image, then shows it everywhere. */
export async function setMedia(kind: "avatar" | "cover", dataUrl: string | null) {
  if (dataUrl) {
    const r = await api<{ at: number }>(`/api/media/${kind}`, { method: "PUT", body: { data: dataUrl } });
    set((x) => ({ ...x, profile: x.profile ? { ...x.profile, [kind]: r.at } : x.profile }));
  } else {
    await api(`/api/media/${kind}`, { method: "DELETE" });
    set((x) => ({ ...x, profile: x.profile ? { ...x.profile, [kind]: undefined } : x.profile }));
  }
}
export const mediaUrl = (kind: "avatar" | "cover", at?: number) => (at ? `/api/media/${kind}?v=${at}` : "");
export function clearChats() {
  const prev = get().threads;
  set((x) => ({ ...x, threads: x.agent ? { home: [hello(x.agent)] } : ({} as Record<string, Msg[]>) }));
  sync(api("/api/chats", { method: "DELETE" }), () => set((x) => ({ ...x, threads: prev })));
}
/** Downloads everything the server holds for you, plus your memories opened on this device. */
export async function exportData() {
  try {
    const acc = await api<Account>("/api/account");
    const opened = get().memory.filter((n) => !n.locked).map((n) => ({ id: n.serverId, tag: n.tag, text: n.text, source: n.source, at: new Date(n.at).toISOString() }));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), ...acc, memoriesOpened: opened }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "lexari-export.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    toast({ text: (e as Error).message || "Could not export.", face: "home" });
  }
}

/* ---------- agents you create, your notes on any agent ---------- */
const customBody = (c: CustomAgent) => ({
  slug: c.id, kind: "custom", name: c.name.slice(0, 40), role: c.role.slice(0, 80), tone: c.tone, about: (c.about || "").slice(0, 2000), skills: (c.skills || []).slice(0, 20), memoryOn: c.memory !== false,
  look: { template: c.template, shape: c.shape, color: c.color, eyes: c.eyes, mouth: c.mouth, extra: c.extra, blush: c.blush, brows: c.brows, orbit: c.orbit, dots: c.dots, bg: c.bg },
});
export function createAgent(a: Omit<CustomAgent, "id" | "at">) {
  const c: CustomAgent = { ...a, id: `c-${uid().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`, at: Date.now() };
  const you = get().agent?.you;
  const hi = `Hi${you ? ` ${you}` : ""}, I'm ${c.name}. ${c.about ? "I've read the brief you gave me." : "Tell me what you want me to do."} What should I start with?`;
  set((x) => ({ ...x, custom: [...x.custom, c], born: { ...x.born, [c.id]: c.at }, active: c.id, threads: { ...x.threads, [c.id]: [{ id: "hello", from: c.id, at: Date.now(), text: hi }] } }));
  sync(api("/api/agents", { body: customBody(c) }), () => set((x) => ({ ...x, custom: x.custom.filter((y) => y.id !== c.id) })));
  return c.id;
}
export function updateCustom(id: string, p: Partial<CustomAgent>) {
  const prev = get().custom.find((c) => c.id === id);
  if (!prev) return;
  const next = { ...prev, ...p };
  set((x) => ({ ...x, custom: x.custom.map((c) => (c.id === id ? next : c)) }));
  sync(api("/api/agents", { body: customBody(next) }), () => set((x) => ({ ...x, custom: x.custom.map((c) => (c.id === id ? prev : c)) })));
}
export function deleteCustom(id: string) {
  const prev = get();
  set((x) => {
    const threads = { ...x.threads }; delete threads[id];
    const meta = { ...x.meta }; delete meta[id];
    return { ...x, custom: x.custom.filter((c) => c.id !== id), threads, meta, active: x.active === id ? "home" : x.active,
      groups: x.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== id) })) };
  });
  sync(api(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" }), () => set(() => prev));
}
export function setMeta(id: string, p: AgentMeta) {
  set((x) => ({ ...x, meta: { ...x.meta, [id]: { ...(x.meta[id] || {}), ...p } } }));
  const body: Record<string, unknown> = {};
  if (p.nick !== undefined) body.nick = p.nick.slice(0, 40);
  if (p.notes !== undefined) body.notes = p.notes.slice(0, 2000);
  if (p.memory !== undefined) body.memoryOn = p.memory;
  if (p.voice !== undefined) body.voice = p.voice;
  if (Object.keys(body).length) sync(api(`/api/agents/${encodeURIComponent(id)}`, { method: "PATCH", body }));
}

/* ---------- guided tour ---------- */
export function startTour() { set((x) => ({ ...x, tour: { on: true, step: 0, done: x.tour?.done ?? false } })); }
export function setTourStep(step: number) { set((x) => ({ ...x, tour: { ...x.tour, step } })); }
export function endTour() { set((x) => ({ ...x, tour: { on: false, step: 0, done: true } })); savePrefs(); }

export { WALLETS };
