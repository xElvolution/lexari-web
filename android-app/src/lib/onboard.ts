/** webapp/lib/store.ts finishOnboarding: save the home agent, then file what you told it as sealed first memories. */
import { Platform } from "react-native";
import { api } from "./api";
import { KEY_MESSAGE, rememberKeys, savedKeys, sealNote } from "./vault";

export const LOOKS: (number | null)[] = [null, 3, 14, 27, 41, 52, 66, 78, 90, 105, 117, 131];
export const ROLES = ["Founder", "Designer", "Developer", "Marketer", "Researcher", "Student", "Community lead", "Trader"];
export const TONES = [
  { id: "short", label: "Short and direct" },
  { id: "warm", label: "Warm and chatty" },
  { id: "formal", label: "Formal" },
  { id: "playful", label: "Playful" },
] as const;
export type ToneId = (typeof TONES)[number]["id"];
export const KNOW_SUGGESTIONS = [
  "Keep summaries to one page",
  "I like tables more than long text",
  "My weekly report goes out on Friday",
  "Always link your sources",
  "Call me by my first name",
  "No jargon, short sentences",
];
export const NAMES = ["Juniper", "Nova", "Pip", "Otto", "Mika", "Sol"];
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 12);

export type HomeAgent = { name: string; look: unknown; you: string; role: string; tone: ToneId; country?: string };

export async function memoryKeys(wallet?: string) {
  const have = await savedKeys(wallet);
  if (have || !wallet || Platform.OS !== "android") return have;
  // a wallet sign-in from before keys were taken at sign-in: ask the wallet once, like the web does
  const { signMessage } = await import("./mwa");
  return rememberKeys(wallet, await signMessage(wallet, KEY_MESSAGE));
}

/** Returns how many first memories were filed (they need the memory key on this phone). */
export async function finishOnboarding(token: string, wallet: string | undefined, a: HomeAgent, knows: string[]): Promise<{ saved: number; total: number }> {
  await api("/api/agents", { method: "POST", body: JSON.stringify({ slug: "home", kind: "home", name: a.name, role: a.role, tone: a.tone, look: a.look ?? null, meta: { you: a.you } }) }, token);
  const notes = [...knows.filter(Boolean), ...(a.role ? [`Works as a ${a.role.toLowerCase()}`] : []), ...(a.country ? [`Based in ${a.country}`] : [])];
  if (!notes.length) return { saved: 0, total: 0 };
  let keys = null;
  try { keys = await memoryKeys(wallet); } catch (e) { console.warn("[lexari] memory key", e); }
  if (!keys) return { saved: 0, total: notes.length };
  let saved = 0;
  for (const text of notes) {
    try {
      await api("/api/memories", { method: "POST", body: JSON.stringify({ agentSlug: "home", tag: "About you", source: "You", ...sealNote(keys, text) }) }, token);
      saved++;
    } catch (e) { console.warn("[lexari] memory", e); }
  }
  return { saved, total: notes.length };
}
