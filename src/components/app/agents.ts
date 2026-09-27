import { specialistBySlug } from "@/content/appData";
import { PALETTE } from "@/components/avatar";
import { agentName, isGroup, type Msg, type State } from "@/lib/store";

export type MyAgent = { id: string; name: string; role: string; seat: number; last?: Msg };
export type Convo = { id: string; group: boolean; name: string; sub: string; members: string[]; last?: Msg };

const lastOf = (s: State, id: string) => { const t = (s.threads[id] || []).filter((m) => m.from !== "system" || m.call); return t.length ? t[t.length - 1] : undefined; };

/** Everyone on your team: your own agent first, then hired specialists in seat order. */
export function myAgents(s: State): MyAgent[] {
  return [
    { id: "home", name: agentName(s), role: "Your personal agent", seat: 1, last: lastOf(s, "home") },
    ...s.hired.map((h, i) => { const sp = specialistBySlug(h)!; return { id: h, name: sp.name, role: sp.job, seat: i + 2, last: lastOf(s, h) }; }),
  ];
}
export const nameOf = (s: State, id: string) => (id === "home" ? agentName(s) : specialistBySlug(id)?.name ?? "Agent");

/** Direct chats and groups together, most recent first. */
export function convos(s: State): Convo[] {
  const direct: Convo[] = myAgents(s).map((a) => ({ id: a.id, group: false, name: a.name, sub: a.role, members: [a.id], last: a.last }));
  const groups: Convo[] = s.groups.map((g) => ({ id: g.id, group: true, name: g.name, sub: `${g.members.length} agents`, members: g.members, last: lastOf(s, g.id) }));
  const t = (c: Convo) => c.last?.at ?? (c.group ? s.groups.find((g) => g.id === c.id)?.at ?? 0 : 0);
  return [...direct, ...groups].sort((a, b) => (a.id === "home" && !a.last ? -1 : 0) || t(b) - t(a));
}
export function convoOf(s: State, id: string): Convo | undefined {
  if (isGroup(id)) { const g = s.groups.find((x) => x.id === id); return g && { id, group: true, name: g.name, sub: g.members.map((m) => nameOf(s, m)).join(", "), members: g.members, last: lastOf(s, id) }; }
  return myAgents(s).map((a) => ({ id: a.id, group: false, name: a.name, sub: a.role, members: [a.id], last: a.last })).find((c) => c.id === id);
}

/** Soft tile colour behind an agent's face, from the face's own colour. Your agent sits on purple. */
export function tileBg(id: string) {
  if (id === "home") return "var(--color-grape)";
  const sp = specialistBySlug(id);
  return sp ? `color-mix(in oklab, ${PALETTE[sp.color].fill} 24%, var(--card))` : "var(--tint)";
}

export function preview(m: Msg | undefined, s: State, group: boolean) {
  if (!m) return "Say hi";
  const who = m.from === "you" ? "You: " : group && m.from !== "system" ? `${nameOf(s, m.from)}: ` : "";
  const body = m.call ? `Voice call · ${fmtSecs(m.call)}` : m.voice ? `Voice note · ${fmtSecs(m.voice)}` : m.file && !m.text ? `Sent ${m.file.name}` : m.text;
  return who + body;
}
export const fmtSecs = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

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
