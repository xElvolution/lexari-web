/**
 * Recurring tasks: "hourly", "daily 08:00", "weekdays 09:30", "weekly mon 08:00", in the person's timezone.
 * Pure functions (no database), tested in tasks.test.ts.
 */
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export type Every = { kind: "hourly" } | { kind: "daily" | "weekdays"; h: number; m: number } | { kind: "weekly"; dow: number; h: number; m: number };

/** Reads the agent's every="…" (also loose phrasings like "every morning", "9am", "monday 8:30"). */
export function parseEvery(raw: string): Every | null {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/^(hourly|every hour)$/.test(s)) return { kind: "hourly" };
  const tm = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(s.replace(/^(daily|weekdays|weekly|every day|every weekday)\s*/, "").replace(/^[a-z]{3,9}\s+/, ""));
  let h = tm ? Number(tm[1]) : /morning/.test(s) ? 8 : /evening/.test(s) ? 18 : /noon|midday/.test(s) ? 12 : /night/.test(s) ? 21 : NaN;
  const m = tm?.[2] ? Number(tm[2]) : 0;
  if (tm?.[3] === "pm" && h < 12) h += 12;
  if (tm?.[3] === "am" && h === 12) h = 0;
  if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59)) return null;
  const day = DOW.findIndex((d) => new RegExp(`\\b${d}`).test(s));
  if (/weekday/.test(s)) return { kind: "weekdays", h, m };
  if (day >= 0 && !/daily|every day/.test(s)) return { kind: "weekly", dow: day, h, m };
  return { kind: "daily", h, m };
}

export const everyText = (e: Every) => {
  if (e.kind === "hourly") return "hourly";
  const t = `${String(e.h).padStart(2, "0")}:${String(e.m).padStart(2, "0")}`;
  return e.kind === "weekly" ? `weekly ${DOW[(e as { dow: number }).dow]} ${t}` : `${e.kind} ${t}`;
};
/** "Every day at 8:00 AM", for cards. */
export function everyLabel(e: Every) {
  if (e.kind === "hourly") return "Every hour";
  const h12 = e.h % 12 || 12, ap = e.h < 12 ? "AM" : "PM";
  const t = `${h12}:${String(e.m).padStart(2, "0")} ${ap}`;
  if (e.kind === "daily") return `Every day at ${t}`;
  if (e.kind === "weekdays") return `Weekdays at ${t}`;
  return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][(e as { dow: number }).dow]} at ${t}`;
}

/** The local wall clock of an instant in a timezone. */
function wall(at: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" })
    .formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, dow: DOW.indexOf(String(p.weekday).toLowerCase().slice(0, 3)) };
}
/** The instant when the wall clock in tz reads y-mo-d h:mi. */
function instant(y: number, mo: number, d: number, h: number, mi: number, tz: string) {
  let t = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) { const w = wall(t, tz); t -= Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Date.UTC(y, mo - 1, d, h, mi); }
  return t;
}
export const okTz = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };

/** The next time after `from` this schedule runs. */
export function nextRun(e: Every, tz: string, from = Date.now()): number {
  if (!okTz(tz)) tz = "UTC";
  if (e.kind === "hourly") return Math.floor(from / 3_600_000) * 3_600_000 + 3_600_000;
  const w = wall(from, tz);
  for (let add = 0; add < 9; add++) {
    const day = new Date(Date.UTC(w.y, w.mo - 1, w.d + add));
    const dow = day.getUTCDay();
    if (e.kind === "weekdays" && (dow === 0 || dow === 6)) continue;
    if (e.kind === "weekly" && dow !== e.dow) continue;
    const t = instant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), e.h, e.m, tz);
    if (t > from + 30_000) return t;
  }
  return from + 86_400_000;
}
