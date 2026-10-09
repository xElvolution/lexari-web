"use client";

import { useSyncExternalStore } from "react";
import type { FaceState } from "@shared/components/avatar";

/**
 * What each agent's face is doing right now, by agent id: thinking while a reply is being written, speaking while it
 * streams in or is read aloud, happy for a few seconds after you thank, praise or react warmly, idle otherwise.
 * Happy sits on top of the others and wears off by itself.
 */
const base = new Map<string, FaceState>();
const happyUntil = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const subs = new Set<() => void>();
const emit = () => { for (const f of subs) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function moodOf(id: string): FaceState {
  if ((happyUntil.get(id) || 0) > Date.now()) return "happy";
  return base.get(id) || "idle";
}
export function useMood(id: string, on = true): FaceState {
  return useSyncExternalStore(subscribe, () => (on ? moodOf(id) : "idle"), () => "idle");
}
/** thinking / speaking / idle for an agent (idle clears it). */
export function setMood(id: string, state: Exclude<FaceState, "happy">) {
  if (!id || id === "you" || id === "system") return;
  if ((base.get(id) || "idle") === state) return;
  if (state === "idle") base.delete(id); else base.set(id, state);
  emit();
}
/** Happy for `ms`, then back to whatever it was doing. */
export function cheer(id: string, ms = 3200) {
  if (!id || id === "you" || id === "system") return;
  happyUntil.set(id, Date.now() + ms);
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { happyUntil.delete(id); timers.delete(id); emit(); }, ms + 20));
  emit();
}

const WARM = /\b(thanks?|thank\s*(you|u)|thx|ty|tysm|cheers|appreciate[ds]?|appreciation|grateful|great|awesome|amazing|excellent|fantastic|brilliant|perfect|wonderful|superb|outstanding|impressive|incredible|lovely|beautiful|nice(\s+(one|job|work))?|cool|sweet|well\s+done|good\s+(job|work|boy|girl|bot|stuff|one)|great\s+(job|work)|you\s*(are|'re|r)\s+(the\s+best|great|awesome|amazing|smart|brilliant|good|so\s+helpful|helpful|a\s+genius|a\s+star)|love\s+(it|this|that|you|u)|i\s+like\s+(it|this|that|you)|genius|legend|goat|bravo|kudos|congrat(s|ulations)|yay|woo+|wow|helpful|nailed\s+it|spot\s+on|exactly|well\s+played|proud\s+of\s+you|you\s+rock|you\s+rule)\b/i;
const COLD = /\b(not|never|no|isn'?t|wasn'?t|don'?t|didn'?t|doesn'?t|stop|wrong|bad|terrible|awful|hate|useless|worst|stupid)\b/i;
const WARM_EMOJI = /(👍|❤️|❤|♥️|😍|🥰|😊|😁|😄|😃|🙂|😂|🤣|🎉|🥳|🔥|💯|👏|🙌|🙏|✅|🚀|💪|⭐|🌟|✨|💜|💙|💚|🧡|💛|🤩|😎|🤝|👌)/u;

/** A light check for thanks, praise or a warm reaction in what you wrote (a "not great" does not count). */
export function isWarm(text: string) {
  const t = (text || "").trim().slice(0, 400);
  if (!t || !(WARM.test(t) || WARM_EMOJI.test(t))) return false;
  if (/\b(thank|thx|appreciate|grateful)/i.test(t)) return true;
  return !COLD.test(t.replace(/\b(no\s+(problem|worries)|not\s+bad)\b/gi, ""));
}
/** Emoji reactions that read as positive. */
export const isWarmReaction = (emoji: string) => WARM_EMOJI.test(emoji);
