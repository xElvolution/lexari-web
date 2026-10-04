/* Call turn logic with no browser APIs (unit tested in callTurn.test.ts):
 * turn ids so a stale stream or sentence from an interrupted answer is dropped, the spoken-sentence queue,
 * what part of an answer was actually heard, and cleaning up what speech-to-text heard when you talked over the agent. */

/** Marks an assistant turn that was cut off. The server sees it and tells the model not to repeat or finish it. */
export const INTERRUPTED = "[interrupted by user]";

/** One live turn at a time. begin() kills the previous one; anything tagged with a dead id is ignored. */
export class TurnClock {
  private n = 0;
  private live = 0;
  begin() { this.live = ++this.n; return this.live; }
  /** Kill a turn (the current one when no id is given). A newer turn is never killed by an old id. */
  kill(id?: number) { if (id === undefined || id === this.live) this.live = 0; }
  isLive(id: number) { return id !== 0 && id === this.live; }
  get current() { return this.live; }
}

export type Sentence = { turn: number; start: number; end: number; text: string };
/** Sentences waiting to be spoken. Only sentences of the live turn go in or come out. */
export class SpeechQueue {
  private items: Sentence[] = [];
  constructor(private clock: TurnClock) {}
  push(s: Sentence) { if (!this.clock.isLive(s.turn) || !s.text.trim()) return false; this.items.push(s); return true; }
  next(): Sentence | null {
    while (this.items.length) { const s = this.items.shift()!; if (this.clock.isLive(s.turn)) return s; }
    return null;
  }
  clear() { this.items = []; }
  get size() { return this.items.length; }
}

/** Splits text[from, upto) into sentence pieces (with their offsets) for the queue. */
export function sentences(text: string, from: number, upto: number, turn: number): Sentence[] {
  const out: Sentence[] = [];
  const re = /[.!?…]+(?=\s|$)|\n/g;
  re.lastIndex = from;
  let start = from, m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m.index < upto) {
    const end = Math.min(upto, m.index + m[0].length);
    if (text.slice(start, end).trim()) out.push({ turn, start, end, text: text.slice(start, end) });
    start = end;
  }
  if (start < upto && text.slice(start, upto).trim()) out.push({ turn, start, end: upto, text: text.slice(start, upto) });
  return out;
}

/** Where speech had got to inside a sentence: the last boundary event, or an estimate from elapsed time
 *  (about 14 characters a second) when the voice sends no boundaries. Snapped back to the start of the word in progress. */
export function spokenUpTo(text: string, s: { start: number; end: number }, boundary: number, elapsedMs: number, rate = 1) {
  let at = boundary > s.start ? boundary : s.start + Math.floor((elapsedMs / 1000) * 14 * rate);
  at = Math.max(s.start, Math.min(s.end, at));
  if (at >= s.end) return s.end;
  while (at > s.start && /\S/.test(text[at - 1] || "")) at--;
  return at;
}

/** What the call history keeps for a cut-off answer: only the words that were spoken, then the marker. */
export function interruptedRecord(spoken: string) {
  const t = spoken.trim().replace(/[\s,;:–—-]+$/, "");
  return t ? `${t}… ${INTERRUPTED}` : INTERRUPTED;
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
const toks = (t: string) => t.split(/\s+/).filter((w) => norm(w));
export const words = (t: string) => toks(t).map(norm);

/** True when what the mic heard is mostly the agent's own words coming back out of the speaker. */
export function isEcho(heard: string, spoken: string) {
  const h = words(heard); if (!h.length) return true;
  const said = new Set(words(spoken));
  return h.filter((w) => said.has(w)).length / h.length >= 0.75;
}

/** The part of a running transcript that came after `base` (the final results from before you interrupted). */
export function afterBase(full: string, base: string) {
  const f = full.trim(), b = base.trim();
  if (!b) return f;
  if (f.toLowerCase().startsWith(b.toLowerCase())) return f.slice(b.length).trim();
  const ft = toks(f), bw = words(b);
  let i = 0; while (i < ft.length && i < bw.length && norm(ft[i]) === bw[i]) i++;
  return ft.slice(i).join(" ");
}

/** Drops a leading run of 2+ words that the agent itself had just said: its last words echoing into the start of your
 *  phrase. The run has to end where the agent stopped (give or take a word), so an ordinary phrase it used earlier is kept. */
export function stripEchoPrefix(heard: string, spoken: string) {
  const ht = toks(heard), hw = ht.map(norm), sw = words(spoken);
  if (!hw.length || !sw.length) return heard.trim();
  let best = 0;
  for (let i = 0; i < sw.length; i++) {
    let k = 0; while (k < hw.length && i + k < sw.length && sw[i + k] === hw[k]) k++;
    if (k && i + k >= sw.length - 1) best = Math.max(best, k);
  }
  return best >= 2 || best === hw.length ? ht.slice(best).join(" ") : heard.trim();
}

/** The spoken text plus the word that was in progress when it stopped (the speaker may have got it out). */
export function throughWord(text: string, cut: number) {
  const m = /^\S*/.exec(text.slice(cut));
  return text.slice(0, cut + (m ? m[0].length : 0));
}

/** What you said over the agent, without anything heard before you started or the agent's own echo.
 *  spoken: what it had said when it stopped; audible: everything the speaker could have played (for the echo check). */
export function cleanBargeIn(full: string, base: string, spoken: string, audible = spoken) {
  const fresh = stripEchoPrefix(afterBase(full, base), spoken);
  return fresh && !isEcho(fresh, audible) ? fresh : "";
}
