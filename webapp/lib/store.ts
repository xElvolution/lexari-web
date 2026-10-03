"use client";

/**
 * Client-side app state, saved in localStorage.
 * The ID card and memory records also write to Solana when a wallet is connected.
 * Chat replies are still sample lines until a model is connected.
 */
import type { FaceLook } from "@shared/components/avatar";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DEMO_GOOGLE, PLANS, SEED_JOBS, SEED_MEMORY, SPECIALISTS, WALLETS, cannedReply, groupReply, registerCustom, scriptFor, shortAddr, walletFor,
  type CustomAgent, type Job, type MemoryTag, type PlanId, type ToneId, type WalletId,
} from "@/content/appData";

export type Msg = {
  id: string; from: string; text: string; at: number; jobId?: number;
  file?: { name: string; size: string }; // an attachment (demo: only the name and size are kept)
  voice?: number; // a voice note, length in seconds
  call?: number; // a call log line, length in seconds
  re?: Record<string, string[]>; // reactions: emoji → who reacted ("you" or an agent id)
  reply?: { id: string; from: string; text: string }; // the message this one answers
};
/** Your own notes on any agent. Hired agents only get nick, notes and memory; the maker controls the rest. */
export type AgentMeta = { nick?: string; notes?: string; memory?: boolean; about?: string; skills?: string[]; /** onchain ID card, once minted */ nft?: import("@/lib/nft").NftRecord };
export type Tour = { on: boolean; step: number; done: boolean };
/** Local coins and the days they checked in. Coins are kept on this device. */
export type BondLog = { days: string[]; coins: number; claimed: string[] };
export type Group = { id: string; name: string; members: string[]; at: number };
export type Card = { number: string; exp: string; cvv: string; frozen: boolean; limit: number; at: number };
export type Prefs = {
  language: string; voice: string; defaultAgent: string; memory: boolean; history: boolean; improve: boolean;
  motion: boolean; demoLabels: boolean; instructions: string; twofa: boolean; signedOut: string[];
  notif: Record<string, boolean>;
};
export type Profile = { name: string; username: string; bio: string; since: number };
export const DEFAULT_PREFS: Prefs = {
  language: "English", voice: "Iris", defaultAgent: "home", memory: true, history: true, improve: false,
  motion: true, demoLabels: true, instructions: "", twofa: false, signedOut: [],
  notif: { replies: true, groups: true, calls: true, wallet: true, cards: true, digest: false, product: false },
};
export type Note = { id: string; tag: MemoryTag; text: string; source: string; at: number; chainHash?: string; chainAsset?: string; pendingChain?: boolean };
/** look: a seed number (null = the house face) or a face built in the creator */
export type AgentLook = number | null | FaceLook;
export type Agent = { name: string; look: AgentLook; you: string; role: string; tone: ToneId };
export type Auth = { method: "google" | "wallet"; label: string; sub: string; wallet?: WalletId; address?: string };
export type State = {
  v: 1; auth: Auth | null; links: { google: boolean; wallet: boolean };
  agent: Agent | null; onboarded: boolean; plan: PlanId; hired: string[];
  memory: Note[]; jobs: Job[]; chat: Msg[]; nextJob: number;
  threads: Record<string, Msg[]>; // one chat per agent ("home" or a specialist slug) or per group ("g-…")
  groups: Group[]; active: string; // the conversation open on Home
  wallets: Record<string, string>; // agent id → wallet address (demo). Only your own agent has one at first.
  cards: Record<string, Card>; // agent id → its virtual card (demo)
  prefs: Prefs; profile: Profile | null;
  custom: CustomAgent[]; // agents you made (ids start with "c-")
  born: Record<string, number>; // agent id → the day it joined you (printed on its ID card)
  meta: Record<string, AgentMeta>;
  tour: Tour;
  bond: BondLog;
  /** Hub: quests, agent levels, referrals, achievements. See lib/hub.ts. Coins live in bond.coins. */
  hub?: import("@/lib/hub").HubData;
};

const KEY = "lexari-app-v1";
const EMPTY: State = { v: 1, auth: null, links: { google: false, wallet: false }, agent: null, onboarded: false, plan: "free", hired: [], memory: [], jobs: [], chat: [], nextJob: 1, threads: {}, groups: [], active: "home", wallets: {}, cards: {}, prefs: DEFAULT_PREFS, profile: null, custom: [], born: {}, meta: {}, tour: { on: false, step: 0, done: false }, bond: { days: [], coins: 0, claimed: [] } };

let state: State | null = null;
const subs = new Set<() => void>();
const uid = () => Math.random().toString(36).slice(2, 10);

function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) { const st: State = { ...EMPTY, ...s }; if (!s.threads) st.threads = { home: (st.chat || []).filter((m) => m.from === "home" || m.from === "you") }; if (!Array.isArray(st.groups)) st.groups = [];
      if (!s.wallets) st.wallets = s.agent ? { home: walletFor("home").address } : {};
      st.prefs = { ...DEFAULT_PREFS, ...(s.prefs || {}), notif: { ...DEFAULT_PREFS.notif, ...(s.prefs?.notif || {}) } };
      if (!Array.isArray(s.custom)) st.custom = [];
      if (!s.meta) st.meta = {};
      if (!s.born) { const t0 = s.profile?.since ?? Date.now(); st.born = { home: t0 }; (st.hired || []).forEach((h, i) => { st.born[h] = t0 + (i + 1) * 36e5; }); }
      if (!s.tour) st.tour = { on: !!s.onboarded, step: 0, done: false }; // saved before the tour existed: show it once
      if (!s.bond || !Array.isArray(s.bond.days)) st.bond = { days: [], coins: 0, claimed: [] };
      else st.bond = {
        days: s.bond.days.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)),
        coins: typeof s.bond.coins === "number" && s.bond.coins > 0 ? Math.floor(s.bond.coins) : 0,
        claimed: Array.isArray(s.bond.claimed) ? s.bond.claimed.filter((id: unknown) => typeof id === "string") : [],
      };
      registerCustom(st.custom);
      return st; } } } catch {}
  registerCustom([]);
  return EMPTY;
}
function snapshot() { if (state === null) state = load(); return state; }
function subscribe(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { state = load(); subs.forEach((s) => s()); } };
  window.addEventListener("storage", onStorage);
  return () => { subs.delete(f); window.removeEventListener("storage", onStorage); };
}
export function set(fn: (s: State) => State) {
  const before = snapshot().custom;
  state = fn(snapshot());
  if (state.custom !== before) registerCustom(state.custom);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  subs.forEach((f) => f());
}
export const get = snapshot;

/** Returns null during the server render and the first hydration pass, then the saved state. */
export function useApp(): State | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
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

/* ---------- helpers ---------- */
export const planOf = (s: State) => PLANS.find((p) => p.id === s.plan) ?? PLANS[0];
export const seatsLeft = (s: State) => planOf(s).seats - 1 - s.hired.length;
export const agentName = (s: State | null) => s?.agent?.name || "Your agent";
export const jobNo = (id: number) => `#${String(id).padStart(3, "0")}`;
export function progressOf(j: Job, now: number) {
  if (j.status !== "running") return 1;
  return Math.max(0, Math.min(1, (now - j.startedAt) / j.duration));
}

/* ---------- actions ---------- */
export function signIn(method: "google" | "wallet", wallet?: WalletId, address?: string) {
  const auth: Auth = method === "google"
    ? { method, label: DEMO_GOOGLE.name, sub: DEMO_GOOGLE.email }
    : { method, label: shortAddr(address || "wallet"), sub: WALLETS.find((w) => w.id === wallet)?.name || "Solana wallet", wallet, address };
  set((s) => ({ ...s, auth, links: { ...s.links, [method]: true } }));
}
export function signOut() { set((s) => ({ ...s, auth: null })); }
export function resetAll() { set(() => EMPTY); }
export function linkMethod(m: "google" | "wallet", on: boolean) { set((s) => ({ ...s, links: { ...s.links, [m]: on } })); }

function seeded(s: State, agent: Agent, knows: string[]): State {
  const now = Date.now();
  const jobs: Job[] = [...SEED_JOBS].sort((a, b) => b.ago - a.ago).map((j, i) => ({
    ...scriptFor(j.prompt, j.assignee, agent.name), id: i + 1, status: j.status, startedAt: now - j.ago,
  }));
  const memory: Note[] = [
    ...knows.filter(Boolean).map((text) => ({ id: uid(), tag: "About you" as MemoryTag, text, source: "You, day one", at: now })),
    ...(agent.you ? [{ id: uid(), tag: "About you" as MemoryTag, text: `Calls you ${agent.you}${agent.role ? `, ${agent.role.toLowerCase()}` : ""}`, source: "You, day one", at: now }] : []),
    ...SEED_MEMORY.map((m) => ({ id: uid(), tag: m.tag, text: m.text, source: m.source, at: now - m.ago })),
  ];
  const chat: Msg[] = [{ id: uid(), from: "home", at: now, re: { "👋": ["you"] }, text: `Hi${agent.you ? ` ${agent.you}` : ""}, I'm ${agent.name}. I've read what you told me and my computer is on. Ask me for anything, or just say hi.` }];
  const threads: Record<string, Msg[]> = {
    home: chat,
    scout: [
      { id: uid(), from: "scout", at: now - 3 * 864e5, text: "Scout here. I'm in seat 02. Send me anything that needs reading, comparing or checking." },
      { id: uid(), from: "you", at: now - 3 * 864e5 + 6e4, text: "Compare three budgeting tools and keep it to one page", re: { "👍": ["scout"] } },
      { id: uid(), from: "scout", at: now - 3 * 864e5 + 9e4, text: "Done. Read 3 feature pages and 14 plans. The one-page summary and a table are in Files, with links to every source.", re: { "🔥": ["you"] } },
      { id: uid(), from: "you", at: now - 3 * 864e5 + 12e4, text: "Perfect, thank you!", re: { "❤️": ["scout"] } },
      { id: uid(), from: "scout", at: now - 3 * 864e5 + 15e4, text: "Anytime. Want the same one-pager for note apps next?" },
    ],
  };
  const d = (days: number, min = 0) => now - days * 864e5 + min * 6e4;
  threads.quill = [
    { id: uid(), from: "quill", at: d(2), text: "Quill here, seat 03. Send me a rough idea and I'll give it back sharp." },
    { id: uid(), from: "you", at: d(2, 2), text: "Tighten the intro of my launch post" },
    { id: uid(), from: "quill", at: d(2, 4), text: "Cut it from 90 words to 41 and led with the one line people will quote. Draft is in Files." },
  ];
  threads.tally = [{ id: uid(), from: "tally", at: d(1), text: "Tally here, seat 04. Messy sheet? Send it over and I'll tell you what changed." }];
  const crew: Group = { id: "g-launch", name: "Launch crew", members: ["home", "scout", "quill"], at: d(1, 30) };
  threads[crew.id] = [
    { id: uid(), from: "you", at: d(0, -95), text: "Launch is Friday. What do we still need?", re: { "👀": ["home"], "👍": ["scout"] } },
    { id: uid(), from: "home", at: d(0, -94), text: `I'll keep the list. Scout, can you check what similar launches did? Quill, the post needs a final pass.` },
    { id: uid(), from: "scout", at: d(0, -93), text: "On it. Reading five recent launches now. Short table by tonight." },
    { id: uid(), from: "quill", at: d(0, -92), text: "Final pass on the post is done. Two headline options are in Files.", re: { "🎉": ["you", "home"], "🔥": ["scout"] } },
  ];
  const who = s.auth?.method === "google" ? s.auth.label : agent.you || "You";
  const profile: Profile = { name: who, username: who.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "you", bio: agent.role ? `${agent.role}.` : "", since: now };
  return { ...s, agent, onboarded: true, plan: "pro", hired: ["scout", "quill", "tally"], memory, jobs, chat, threads, groups: [crew], active: "home", nextJob: jobs.length + 1,
    wallets: { home: walletFor("home").address }, cards: {}, profile,
    custom: [], meta: {}, born: { home: now, scout: now - 3 * 864e5 - 36e5, quill: now - 2 * 864e5 - 36e5, tally: now - 864e5 - 36e5 }, tour: { on: true, step: 0, done: false } };
}
export function finishOnboarding(agent: Agent, knows: string[]) { set((s) => seeded(s, agent, knows)); }
export function startDemo() {
  set((s) => seeded({ ...s, auth: s.auth ?? { method: "google", label: DEMO_GOOGLE.name, sub: DEMO_GOOGLE.email }, links: { ...s.links, google: true } },
    { name: "Juniper", look: null, you: "Ada", role: "Founder", tone: "short" }, ["Keep summaries to one page", "Always link your sources"]));
}
export function updateAgent(p: Partial<Agent>) { set((s) => (s.agent ? { ...s, agent: { ...s.agent, ...p } } : s)); }

export function hire(slug: string): "ok" | "full" | "already" {
  const s = get();
  if (s.hired.includes(slug)) return "already";
  if (seatsLeft(s) <= 0) return "full";
  set((x) => ({ ...x, hired: [...x.hired, slug], born: { ...x.born, [slug]: Date.now() } }));
  return "ok";
}
export function release(slug: string) { set((s) => ({ ...s, hired: s.hired.filter((h) => h !== slug), groups: s.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== slug) })) })); }
export function setPlan(id: PlanId) {
  set((s) => { const seats = PLANS.find((p) => p.id === id)!.seats; return { ...s, plan: id, hired: s.hired.slice(0, seats - 1) }; });
}

export function addNote(text: string, tag: MemoryTag = "About you", source = "You", chain = false) {
  const n: Note = { id: uid(), tag, text, source, at: Date.now(), pendingChain: chain || undefined };
  set((s) => ({ ...s, memory: [n, ...s.memory] }));
  return n;
}
export function editNote(id: string, p: Partial<Note>) { set((s) => ({ ...s, memory: s.memory.map((m) => (m.id === id ? { ...m, ...p } : m)) })); }
/** Local calendar day, so a check-in matches the day the person is actually in. */
export function todayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const CHECKIN_COINS = 10;
export const TASK_COINS = 25;
export const LEASE_COST = 40;

function bondOf(s: State): BondLog {
  return { days: s.bond?.days || [], coins: s.bond?.coins || 0, claimed: s.bond?.claimed || [] };
}
/** Daily check-in. Pays coins once per local day. It does not ask anything. */
export function claimCheckIn(now = Date.now()) {
  const key = todayKey(now);
  if ((get().bond?.days || []).includes(key)) return false;
  set((s) => { const b = bondOf(s); return { ...s, bond: { ...b, days: [...b.days, key].slice(-420), coins: b.coins + CHECKIN_COINS } }; });
  return true;
}
/** Collect the coins for one finished job. A second collect does nothing. */
export function claimTask(jobId: number) {
  const key = `job-${jobId}`;
  const cur = get();
  const job = cur.jobs.find((j) => j.id === jobId && j.status === "done");
  if (!job || (cur.bond?.claimed || []).includes(key)) return false;
  set((s) => { const b = bondOf(s); return { ...s, bond: { ...b, coins: b.coins + TASK_COINS, claimed: [...b.claimed, key] } }; });
  return true;
}
/** Spend coins to put a specialist in an open seat. */
export function leaseAgent(slug: string): "ok" | "full" | "already" | "short" {
  if ((get().bond?.coins || 0) < LEASE_COST) return "short";
  const hired = hire(slug);
  if (hired !== "ok") return hired;
  set((s) => { const b = bondOf(s); return { ...s, bond: { ...b, coins: Math.max(0, b.coins - LEASE_COST) } }; });
  return "ok";
}
export function forgetNote(id: string) {
  const s = get(); const idx = s.memory.findIndex((m) => m.id === id); const note = s.memory[idx];
  set((x) => ({ ...x, memory: x.memory.filter((m) => m.id !== id) }));
  return () => set((x) => { const mem = [...x.memory]; mem.splice(Math.min(idx, mem.length), 0, note); return { ...x, memory: mem }; });
}

/** Figures out who takes a job: an @mention or a keyword match with a hired specialist, else your agent. */
export function routeJob(s: State, text: string) {
  const t = text.toLowerCase();
  const hired = SPECIALISTS.filter((sp) => s.hired.includes(sp.slug));
  const mention = hired.find((sp) => t.includes(`@${sp.slug}`));
  if (mention) return mention.slug;
  const kw = hired.find((sp) => sp.words.some((w) => t.includes(w)));
  return kw?.slug ?? "home";
}

/* ---------- chats: one thread per agent or group, demo replies ---------- */
export const isGroup = (id: string) => id.startsWith("g-");
export const groupOf = (s: State, id: string) => s.groups.find((g) => g.id === id);
/** Every conversation id that still exists: your agent, hired specialists and groups. */
export const convoExists = (s: State, id: string | null | undefined) => !!id && (id === "home" || s.hired.includes(id) || s.custom.some((c) => c.id === id) || s.groups.some((g) => g.id === id));
export const isCustom = (id: string) => id.startsWith("c-");

const typingWho = new Map<string, string>(); // conversation → the agent typing in it
const queued = new Set<string>();
/** Which agent is typing its demo reply in a conversation, or null. */
export function useTyping(id: string) {
  return useSyncExternalStore(subscribe, () => typingWho.get(id) ?? null, () => null);
}
const ping = () => subs.forEach((f) => f());
const push = (convo: string, m: Omit<Msg, "id" | "at">) => {
  const id = uid();
  set((x) => ({ ...x, threads: { ...x.threads, [convo]: [...(x.threads[convo] || []), { ...m, id, at: Date.now() }].slice(-120) } }));
  return id;
};

const fmtSecs = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;

function replyText(convo: string, who: string, last: Msg, turn: number, others: string[]) {
  const st = get(); const a = st.agent!;
  const n = (st.threads[convo] || []).filter((m) => m.from === who).length;
  if (last.voice) return who === "home" ? `Got your voice note (${fmtSecs(last.voice)}). I've written it down and I'm on it.` : `Heard your voice note. I'll take my part and post it here.`;
  if (last.file && !last.text) return `Thanks, I have ${last.file.name}. What should I do with it?`;
  if (isGroup(convo)) return groupReply({ who, text: last.text, turn, n, agentName: a.name, you: a.you, others });
  const c = st.custom.find((x) => x.id === who);
  if (c && n <= 1 && !/^(hi|hey|hello)/i.test(last.text)) return `${c.name} here. ${c.about ? "Going by the brief you gave me, " : ""}I'll start on "${last.text.replace(/[?.!]+$/, "").split(/\s+/).slice(0, 7).join(" ")}" now.`;
  return cannedReply({ id: who, text: last.text, n, agentName: a.name, you: a.you, tone: c?.tone ?? a.tone });
}

/** Queue demo replies. In a group, one or two members answer in turn, each after a typing pause. */
function scheduleReplies(convo: string, delay: number) {
  if (queued.has(convo)) return;
  const st = get(); const thread = st.threads[convo] || []; const last = thread[thread.length - 1];
  if (!st.agent || !last || last.from !== "you") return;
  let who: string[] = [convo];
  if (isGroup(convo)) {
    const g = groupOf(st, convo); if (!g || !g.members.length) return;
    const names = g.members.map((m) => ({ m, name: (m === "home" ? st.agent!.name : st.meta[m]?.nick || (st.custom.find((c) => c.id === m)?.name ?? SPECIALISTS.find((p) => p.slug === m)?.name ?? m)).toLowerCase() }));
    const t = last.text.toLowerCase();
    const named = names.filter((x) => t.includes(x.name) || t.includes(`@${x.name}`)).map((x) => x.m);
    const k = thread.filter((m) => m.from === "you").length;
    who = named.length ? named.slice(0, 3) : g.members.length === 1 ? g.members : [g.members[k % g.members.length], g.members[(k + 1) % g.members.length]];
  }
  queued.add(convo);
  const step = (i: number, wait: number) => {
    typingWho.set(convo, who[i]); ping();
    setTimeout(() => {
      const now = get(); const l = (now.threads[convo] || []).filter((m) => m.from === "you").pop();
      if (!now.agent || !l || !convoExists(now, convo)) { typingWho.delete(convo); queued.delete(convo); ping(); return; }
      let text = replyText(convo, who[i], l, i, who.filter((w) => w !== who[i]));
      const rem = convo === "home" && !l.voice ? l.text.match(/^\s*(please\s+)?remember( that)?\s+(.{3,120})/i) : null; // "remember ..." really files a memory
      if (rem) { const note = rem[3].replace(/[.!\s]+$/, ""); addNote(note.charAt(0).toUpperCase() + note.slice(1), "About you", "Chat", true); text = `Filed in my brain under About you: "${note}". I'll use it from now on.`; }
      typingWho.delete(convo);
      push(convo, { from: who[i], text });
      if (i + 1 < who.length) step(i + 1, 1100 + Math.random() * 700);
      else { queued.delete(convo); ping(); }
    }, wait);
  };
  step(0, delay);
}

/** Send a message (text, an attachment or a voice note) to an agent or a group. Demo replies follow. */
export function sendTo(id: string, text: string, extra: Pick<Msg, "file" | "voice" | "reply"> = {}) {
  const v = text.trim(); if (!v && !extra.file && !extra.voice) return;
  const mid = push(id, { from: "you", text: v, ...extra });
  scheduleReplies(id, 900 + Math.min(1400, v.length * 18));
  agentReacts(id, mid, v, !!extra.voice);
}

/* ---------- reactions ---------- */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🔥"];
export const MORE_REACTIONS = ["😮", "😢", "🙏", "💯", "✅", "👏", "🤔", "🚀", "😍", "🤝", "💡", "👋"];
/** Add or remove one person's reaction on a message. */
export function toggleReaction(convo: string, msgId: string, emoji: string, who = "you") {
  set((x) => ({ ...x, threads: { ...x.threads, [convo]: (x.threads[convo] || []).map((m) => {
    if (m.id !== msgId) return m;
    const re = { ...(m.re || {}) }; const list = re[emoji] || [];
    re[emoji] = list.includes(who) ? list.filter((w) => w !== who) : [...list, who];
    if (!re[emoji].length) delete re[emoji];
    return { ...m, re };
  }) } }));
}
/** Demo: agents sometimes react to what you send. Thanks get a heart, good news a party, requests a thumbs up. */
function agentReacts(convo: string, msgId: string, text: string, voice: boolean) {
  const t = text.toLowerCase();
  const pick = /\b(thanks|thank you|thx|ty|love|appreciate)\b/.test(t) ? "❤️"
    : /\b(launched|shipped|done|won|finally|great news|good news|yay|we did it|live|passed|hired)\b|!{2,}/.test(t) ? "🎉"
    : /\b(haha|lol|lmao|funny)\b|😂/.test(t) ? "😂"
    : /\b(urgent|asap|now|deadline|tonight)\b/.test(t) ? "👀"
    : voice || /\b(please|can you|could you|compare|find|write|draft|plan|make|build|check|fix|review|remember)\b|\?$/.test(t) ? "👍" : null;
  if (!pick) return;
  const strong = pick !== "👍";
  if (!strong && Math.random() > 0.65) return;
  const st = get();
  const who: string[] = isGroup(convo) ? [...(groupOf(st, convo)?.members ?? [])].sort(() => Math.random() - 0.5).slice(0, strong ? 2 : 1) : [convo];
  who.forEach((w, i) => setTimeout(() => {
    const m = (get().threads[convo] || []).find((x) => x.id === msgId); if (!m) return;
    const emoji = i === 0 ? pick : pick === "🎉" ? "🔥" : pick === "❤️" ? "🙏" : "👍";
    if (!(m.re?.[emoji] || []).includes(w)) toggleReaction(convo, msgId, emoji, w);
  }, 650 + i * 900 + Math.random() * 500));
}
/** After a reload, answer any message that was still waiting for a reply. */
export function ensureReplies() {
  const st = get();
  Object.entries(st.threads).forEach(([id, t]) => { if (t[t.length - 1]?.from === "you" && convoExists(st, id)) scheduleReplies(id, 700); });
}
export function logCall(id: string, secs: number) { if (secs > 0) push(id, { from: "system", text: "Voice call", call: secs }); }
export function setActive(id: string) { if (get().active !== id) set((x) => ({ ...x, active: id })); }

export function createGroup(name: string, members: string[]) {
  const g: Group = { id: `g-${uid()}`, name: name.trim() || "New group", members, at: Date.now() };
  set((x) => ({ ...x, groups: [...x.groups, g], threads: { ...x.threads, [g.id]: [{ id: uid(), from: "system", at: Date.now(), text: `You made the group “${g.name}”` }] } }));
  return g.id;
}
export function updateGroup(id: string, p: Partial<Pick<Group, "name" | "members">>) { set((x) => ({ ...x, groups: x.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) })); }
export function deleteGroup(id: string) {
  set((x) => { const threads = { ...x.threads }; delete threads[id]; return { ...x, groups: x.groups.filter((g) => g.id !== id), threads, active: x.active === id ? "home" : x.active }; });
}

export function resolveJob(id: number) { set((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: "done" } : j)) })); }
/** Called every second by the app shell. Finishes jobs whose time is up and files what they learned. */
export function tick(now = Date.now()) {
  const s = get();
  const done = s.jobs.filter((j) => j.status === "running" && now >= j.startedAt + j.duration);
  if (!done.length || !s.agent) return;
  const learned: Note[] = [];
  const msgs: Msg[] = done.map((j) => {
    if (j.learned && !s.memory.some((m) => m.text === j.learned) && !learned.some((m) => m.text === j.learned))
      learned.push({ id: uid(), tag: "Preferences", text: j.learned, source: `Job ${jobNo(j.id)}`, at: now });
    return { id: uid(), from: j.assignee, at: now, jobId: j.id, text: `Done with ${jobNo(j.id)}. ${j.files.map((f) => f.name).join(" and ")} ${j.files.length > 1 ? "are" : "is"} in my output folder.` };
  });
  set((x) => ({ ...x, jobs: x.jobs.map((j) => (done.some((d) => d.id === j.id) ? { ...j, status: "done" } : j)), memory: [...learned, ...x.memory], chat: [...x.chat, ...msgs].slice(-60) }));
  done.forEach((j) => { const sp = SPECIALISTS.find((p) => p.slug === j.assignee); toast({ text: `Job ${jobNo(j.id)} is done`, face: sp ? sp.seed : "home", color: sp?.color }); });
  learned.forEach((n) => toast({ text: `${s.agent!.name} remembered: ${n.text}`, face: "home" }));
}

/** Real client-side download of a job output file. */
export function downloadFile(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- wallets, cards, preferences, profile (all demo) ---------- */
export function createWallet(id: string) { set((x) => ({ ...x, wallets: { ...x.wallets, [id]: walletFor(id).address } })); }
export function issueCard(id: string, limit: number) {
  const d = () => Math.floor(Math.random() * 10);
  const number = `4000${Array.from({ length: 12 }, d).join("")}`;
  const now = new Date();
  const card: Card = { number, exp: `${String(now.getMonth() + 1).padStart(2, "0")}/${String((now.getFullYear() + 3) % 100).padStart(2, "0")}`, cvv: `${d()}${d()}${d()}`, frozen: false, limit, at: Date.now() };
  set((x) => ({ ...x, cards: { ...x.cards, [id]: card } }));
  return card;
}
export function updateCard(id: string, p: Partial<Card>) { set((x) => (x.cards[id] ? { ...x, cards: { ...x.cards, [id]: { ...x.cards[id], ...p } } } : x)); }
export function cancelCard(id: string) { set((x) => { const cards = { ...x.cards }; delete cards[id]; return { ...x, cards }; }); }
export function setPrefs(p: Partial<Prefs>) { set((x) => ({ ...x, prefs: { ...x.prefs, ...p } })); }
export function setNotif(k: string, v: boolean) { set((x) => ({ ...x, prefs: { ...x.prefs, notif: { ...x.prefs.notif, [k]: v } } })); }
export function updateProfile(p: Partial<Profile>) { set((x) => ({ ...x, profile: { ...(x.profile ?? { name: "You", username: "you", bio: "", since: Date.now() }), ...p } })); }
export function clearChats() { set((x) => ({ ...x, threads: {} })); }
export function exportData() {
  const st = get();
  const url = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), note: "Lexari demo export", ...st }, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "lexari-export.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- agents you create, your notes on any agent ---------- */
export function createAgent(a: Omit<CustomAgent, "id" | "at">) {
  const c: CustomAgent = { ...a, id: `c-${uid()}`, at: Date.now() };
  const you = get().agent?.you;
  const hello = `Hi${you ? ` ${you}` : ""}, I'm ${c.name}. ${c.about ? `I've read the brief you gave me: “${c.about.replace(/\s+$/, "")}”` : "Tell me what you want me to do."} My computer is on and my memory is ${c.memory ? "on" : "off"}. What should I start with?`;
  set((x) => ({ ...x, custom: [...x.custom, c], born: { ...x.born, [c.id]: c.at }, active: c.id,
    threads: { ...x.threads, [c.id]: [{ id: uid(), from: c.id, at: Date.now(), text: hello }] } }));
  return c.id;
}
export function updateCustom(id: string, p: Partial<CustomAgent>) { set((x) => ({ ...x, custom: x.custom.map((c) => (c.id === id ? { ...c, ...p } : c)) })); }
export function deleteCustom(id: string) {
  set((x) => {
    const threads = { ...x.threads }; delete threads[id];
    const wallets = { ...x.wallets }; delete wallets[id];
    const cards = { ...x.cards }; delete cards[id];
    const meta = { ...x.meta }; delete meta[id];
    return { ...x, custom: x.custom.filter((c) => c.id !== id), threads, wallets, cards, meta, active: x.active === id ? "home" : x.active,
      groups: x.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== id) })) };
  });
}
export function setMeta(id: string, p: AgentMeta) { set((x) => ({ ...x, meta: { ...x.meta, [id]: { ...(x.meta[id] || {}), ...p } } })); }

/* ---------- guided tour ---------- */
export function startTour() { set((x) => ({ ...x, tour: { on: true, step: 0, done: x.tour?.done ?? false } })); }
export function setTourStep(step: number) { set((x) => ({ ...x, tour: { ...x.tour, step } })); }
export function endTour() { set((x) => ({ ...x, tour: { on: false, step: 0, done: true } })); }
