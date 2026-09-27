import { specialistBySlug } from "@/content/appData";
import { agentName, type Msg, type State } from "@/lib/store";

export type MyAgent = { id: string; name: string; role: string; seat: number; last?: Msg };

/** Everyone on your team: your own agent first, then hired specialists in seat order. */
export function myAgents(s: State): MyAgent[] {
  const last = (id: string) => { const t = s.threads[id]; return t && t.length ? t[t.length - 1] : undefined; };
  return [
    { id: "home", name: agentName(s), role: "Your personal agent", seat: 1, last: last("home") },
    ...s.hired.map((h, i) => { const sp = specialistBySlug(h)!; return { id: h, name: sp.name, role: sp.job, seat: i + 2, last: last(h) }; }),
  ];
}

export function shortTime(ms: number, now: number) {
  if (!ms || !now) return "";
  const d = new Date(ms), days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function dayLabel(ms: number, now: number) {
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return "Today"; if (days === 1) return "Yesterday";
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}
