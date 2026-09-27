"use client";

/**
 * Client-side app state for the Lexari demo. Kept in localStorage so the flows feel real:
 * your agent's name sticks, hiring fills a seat, jobs keep running across pages.
 * There is no server. Everything here is mocked on purpose.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DEMO_ADDRESS, DEMO_GOOGLE, PLANS, SEED_JOBS, SEED_MEMORY, SPECIALISTS, cannedReply, scriptFor, shortAddr,
  type Job, type MemoryTag, type PlanId, type ToneId, type WalletId,
} from "@/content/appData";

export type Msg = { id: string; from: string; text: string; at: number; jobId?: number };
export type Note = { id: string; tag: MemoryTag; text: string; source: string; at: number };
export type Agent = { name: string; look: number | null; you: string; role: string; tone: ToneId };
export type Auth = { method: "google" | "wallet"; label: string; sub: string; wallet?: WalletId };
export type State = {
  v: 1; auth: Auth | null; links: { google: boolean; wallet: boolean };
  agent: Agent | null; onboarded: boolean; plan: PlanId; hired: string[];
  memory: Note[]; jobs: Job[]; chat: Msg[]; nextJob: number;
  threads: Record<string, Msg[]>; // one chat per agent: "home" or a specialist slug
};

const KEY = "lexari-app-v1";
const EMPTY: State = { v: 1, auth: null, links: { google: false, wallet: false }, agent: null, onboarded: false, plan: "free", hired: [], memory: [], jobs: [], chat: [], nextJob: 1, threads: {} };

let state: State | null = null;
const subs = new Set<() => void>();
const uid = () => Math.random().toString(36).slice(2, 10);

function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) { const st: State = { ...EMPTY, ...s }; if (!s.threads) st.threads = { home: (st.chat || []).filter((m) => m.from === "home" || m.from === "you") }; return st; } } } catch {}
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
  state = fn(snapshot());
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
export function signIn(method: "google" | "wallet", wallet?: WalletId) {
  const auth: Auth = method === "google"
    ? { method, label: DEMO_GOOGLE.name, sub: DEMO_GOOGLE.email }
    : { method, label: shortAddr(DEMO_ADDRESS), sub: wallet === "okx" ? "OKX Wallet" : wallet === "phone" ? "Phone wallet" : "Browser wallet", wallet };
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
  const chat: Msg[] = [{ id: uid(), from: "home", at: now, text: `Hi${agent.you ? ` ${agent.you}` : ""}, I'm ${agent.name}. I've read what you told me and my computer is on. Ask me for anything, or just say hi.` }];
  const threads: Record<string, Msg[]> = {
    home: chat,
    scout: [
      { id: uid(), from: "scout", at: now - 3 * 864e5, text: "Scout here. I'm in seat 02. Send me anything that needs reading, comparing or checking." },
      { id: uid(), from: "you", at: now - 3 * 864e5 + 6e4, text: "Compare three budgeting tools and keep it to one page" },
      { id: uid(), from: "scout", at: now - 3 * 864e5 + 9e4, text: "Done. Read 3 feature pages and 14 plans. The one-page summary and a table are in Files, with links to every source." },
    ],
  };
  return { ...s, agent, onboarded: true, plan: "pro", hired: ["scout"], memory, jobs, chat, threads, nextJob: jobs.length + 1 };
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
  set((x) => ({ ...x, hired: [...x.hired, slug] }));
  return "ok";
}
export function release(slug: string) { set((s) => ({ ...s, hired: s.hired.filter((h) => h !== slug) })); }
export function setPlan(id: PlanId) {
  set((s) => { const seats = PLANS.find((p) => p.id === id)!.seats; return { ...s, plan: id, hired: s.hired.slice(0, seats - 1) }; });
}

export function addNote(text: string, tag: MemoryTag = "About you", source = "You") {
  const n: Note = { id: uid(), tag, text, source, at: Date.now() };
  set((s) => ({ ...s, memory: [n, ...s.memory] }));
  return n;
}
export function editNote(id: string, p: Partial<Note>) { set((s) => ({ ...s, memory: s.memory.map((m) => (m.id === id ? { ...m, ...p } : m)) })); }
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

/* ---------- chats: one thread per agent, demo replies ---------- */
const replying = new Set<string>();
/** True while an agent is "typing" its demo reply. */
export function useTyping(id: string) {
  return useSyncExternalStore(subscribe, () => replying.has(id), () => false);
}

function scheduleReply(id: string, delay: number) {
  if (replying.has(id)) return;
  replying.add(id); subs.forEach((f) => f());
  setTimeout(() => {
    replying.delete(id);
    const st = get(); const thread = st.threads[id] || []; const last = thread[thread.length - 1];
    if (!st.agent || !last || last.from !== "you") { subs.forEach((f) => f()); return; }
    let text = cannedReply({ id, text: last.text, n: thread.filter((m) => m.from !== "you").length, agentName: st.agent.name, you: st.agent.you, tone: st.agent.tone });
    // "remember ..." really files a memory in the brain
    const rem = id === "home" ? last.text.match(/^\s*(please\s+)?remember( that)?\s+(.{3,120})/i) : null;
    if (rem) { const note = rem[3].replace(/[.!\s]+$/, ""); addNote(note.charAt(0).toUpperCase() + note.slice(1), "About you", "Chat"); text = `Filed in my brain under About you: "${note}". I'll use it from now on.`; }
    set((x) => ({ ...x, threads: { ...x.threads, [id]: [...(x.threads[id] || []), { id: uid(), from: id, text, at: Date.now() }].slice(-80) } }));
  }, delay);
}

/** Send a message to one agent. A demo reply follows after a short typing pause. */
export function sendTo(id: string, text: string) {
  const v = text.trim(); if (!v) return;
  set((x) => ({ ...x, threads: { ...x.threads, [id]: [...(x.threads[id] || []), { id: uid(), from: "you", text: v, at: Date.now() }].slice(-80) } }));
  scheduleReply(id, 900 + Math.min(1400, v.length * 18));
}
/** After a reload, answer any message that was still waiting for a reply. */
export function ensureReplies() {
  const st = get();
  Object.entries(st.threads).forEach(([id, t]) => { if (t[t.length - 1]?.from === "you") scheduleReply(id, 700); });
}

export function resolveJob(id: number) { set((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: "done" } : j)) })); }
/** Sends a past job's request to the same agent again. Returns the chat id. */
export function rerunJob(id: number) {
  const j = get().jobs.find((x) => x.id === id); if (!j) return "home";
  sendTo(j.assignee, j.prompt); return j.assignee;
}

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
