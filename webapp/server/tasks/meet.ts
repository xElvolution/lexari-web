/** Meeting links the agent can join, and the display name it uses. Pure (tested in tasks.test.ts). */
import type { MeetPlatform } from "@/content/tasks";

/** A Zoom, Google Meet, Teams or Jitsi link from text, cleaned up; null when there is none. */
export function meetingLink(text: string): { url: string; platform: MeetPlatform } | null {
  const found = text.match(/https:\/\/[^\s<>"')\]]+/gi) || [];
  for (const raw of found) {
    let u: URL;
    try { u = new URL(raw.replace(/[.,;!?]+$/, "")); } catch { continue; }
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || u.username || u.password || u.port) continue;
    if (/(^|\.)zoom\.(us|com)$/.test(h) && /\/(j|w|s|wc)\/|\/wc\/join\//.test(u.pathname)) return { url: u.toString(), platform: "zoom" };
    if (h === "meet.google.com" && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}/.test(u.pathname)) return { url: `https://meet.google.com${u.pathname.slice(0, 13)}`, platform: "meet" };
    if ((h === "teams.microsoft.com" || h === "teams.live.com") && /meet/.test(u.pathname)) return { url: u.toString(), platform: "teams" };
    if ((h === "meet.jit.si" || h === "8x8.vc" || /^meet\.|^jitsi\./.test(h)) && /^\/[\w.-]{3,}/.test(u.pathname)) return { url: `${u.origin}${u.pathname}`, platform: "jitsi" };
  }
  return null;
}

/** "Rika (for Ada)" as the agent, or the person's own name. */
export function meetName(mode: "me" | "agent", agentName: string, userName: string) {
  const clean = (s: string) => s.replace(/[^\p{L}\p{N} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
  const you = clean(userName) || "my owner";
  return mode === "me" ? (clean(userName) || "Guest") : `${clean(agentName) || "Agent"} (for ${you.split(" ")[0]})`;
}
