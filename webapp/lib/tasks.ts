"use client";

/** Agent tasks in the app: meetings, background jobs and schedules (live state, the Tasks sheet, the API calls). */
import { useEffect, useSyncExternalStore } from "react";
import type { TaskView } from "@/content/tasks";
import { ACTIVE } from "@/content/tasks";
import { api } from "./api";
import { upsertMsg, type Msg } from "./store";

type Store = { tasks: Record<string, TaskView>; sheet: string | null; loaded: Record<string, boolean> };
let store: Store = { tasks: {}, sheet: null, loaded: {} };
const subs = new Set<() => void>();
const set = (p: Partial<Store>) => { store = { ...store, ...p }; subs.forEach((f) => f()); };
const EMPTY: Store = { tasks: {}, sheet: null, loaded: {} };
const useStore = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => store, () => EMPTY);

export const useTask = (id?: string) => { const s = useStore(); return id ? s.tasks[id] : undefined; };
export function useAgentTasks(agent: string) {
  const s = useStore();
  return { list: Object.values(s.tasks).filter((t) => t.agent === agent).sort((a, b) => b.createdAt - a.createdAt), loaded: !!s.loaded[agent] };
}
export const useTasksSheet = () => useStore().sheet;
export const openTasks = (agent: string) => set({ sheet: agent });
export const closeTasks = () => set({ sheet: null });
const put = (t: TaskView) => set({ tasks: { ...store.tasks, [t.id]: t } });

const inflight = new Map<string, Promise<void>>();
export function refreshTasks(agent: string) {
  const had = inflight.get(agent);
  if (had) return had;
  const p = api<{ tasks: TaskView[]; posted: { convo: string; msg: Msg }[] }>(`/api/tasks?agent=${encodeURIComponent(agent)}`).then((r) => {
    const next = { ...store.tasks };
    for (const id of Object.keys(next)) if (next[id].agent === agent && !r.tasks.some((t) => t.id === id)) delete next[id];
    for (const t of r.tasks) next[t.id] = t;
    set({ tasks: next, loaded: { ...store.loaded, [agent]: true } });
    for (const x of r.posted) upsertMsg(x.convo, x.msg);
  }, () => {}).finally(() => inflight.delete(agent));
  inflight.set(agent, p);
  return p;
}

/** Keeps an open chat's tasks fresh: every 4 s while one is running, else every 25 s (only while the tab is visible). */
export function useTaskPoll(agent: string | null) {
  const s = useStore();
  const busy = agent ? Object.values(s.tasks).some((t) => t.agent === agent && ACTIVE.includes(t.status)) : false;
  useEffect(() => {
    if (!agent) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => { if (stop) return; if (document.visibilityState === "visible") await refreshTasks(agent); if (!stop) t = setTimeout(tick, busy ? 4000 : 25_000); };
    t = setTimeout(tick, busy ? 1500 : 200);
    return () => { stop = true; clearTimeout(t); };
  }, [agent, busy]);
}

export async function joinMeeting(input: { agent: string; convo: string; url: string; as: "me" | "agent"; messageId: string }) {
  const r = await api<{ task: TaskView }>("/api/tasks", { body: { op: "meeting", ...input } });
  put(r.task);
  return r.task;
}
export async function actTask(id: string, op: "stop" | "pause" | "resume" | "delete") {
  const r = await api<{ task: TaskView | null }>(`/api/tasks/${id}`, { body: { op } });
  if (r.task) put(r.task);
  else { const next = { ...store.tasks }; delete next[id]; set({ tasks: next }); }
  return r.task;
}
