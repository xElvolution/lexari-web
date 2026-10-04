/**
 * Who did the person address? Speech-to-text mangles names ("Banda", "Bander" for Bender; "Rica", "Reeka" for Rika),
 * so names are compared by a rough phonetic key and a small edit distance, not by exact spelling.
 */

/** A rough English sound key: c/q/ck → k, ph → f, z → s, a final "er"/"re" → a, every vowel → a, doubles collapse. */
export function soundKey(word: string) {
  let w = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  if (!w) return "";
  w = w.replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k").replace(/x/g, "ks").replace(/z/g, "s")
    .replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/([^aeiou])h/g, "$1").replace(/w(?=[^aeiou]|$)/g, "")
    .replace(/(er|re|ar|or|ah|eh)$/, "a").replace(/[aeiouy]+/g, "a").replace(/(.)\1+/g, "$1");
  return w;
}

export function editDistance(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

const GREET = new Set(["hey", "hi", "hello", "yo", "ok", "okay", "so", "and", "now", "um", "uh", "well", "oi", "dear", "thanks", "thank", "you", "what", "about"]);
const COMMON = new Set(["the", "a", "an", "to", "and", "or", "is", "it", "in", "on", "of", "for", "i", "me", "my", "we", "us", "be", "do", "go", "so", "no", "yes", "what", "think", "about", "can", "you", "your"]);

/** How well one spoken word matches a name: 3 exact, 2 same sound, 1 close (one edit), 0 no. */
function wordScore(token: string, name: string) {
  const t = token.toLowerCase(), n = name.toLowerCase();
  if (!t || !n || COMMON.has(t)) return 0;
  if (t === n || t === `${n}s` || t === `${n}'s`) return 3;
  const kt = soundKey(t), kn = soundKey(n);
  if (kt && kt === kn && kn.length >= 2) return 2;
  if (n.length >= 4 && t[0] === n[0] && (editDistance(t, n) <= 1 || (kn.length >= 3 && kt.length >= kn.length && editDistance(t, n) <= 2 && editDistance(kt, kn) <= 1))) return 1;
  return 0;
}

/**
 * The member the utterance addresses, or null. `names` maps an id to the names it answers to (name, nickname).
 * Exact or same-sound matches count anywhere; a near miss only counts where people put a name
 * ("hey Bendr", "Rikka, what do you think", "... right, Bendr?").
 */
export function addressed(text: string, names: Record<string, string[]>): string | null {
  const toks = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  let best: { id: string; score: number; at: number } | null = null;
  for (const [id, list] of Object.entries(names)) {
    for (const full of list) {
      const parts = full.toLowerCase().split(/\s+/).filter((p) => p.length >= 2);
      for (const part of parts) {
        toks.forEach((t, i) => {
          let sc = wordScore(t, part);
          const slot = i <= 1 || GREET.has(toks[i - 1] || "") || i === toks.length - 1;
          if (sc === 1 && !slot) sc = 0;
          if (sc && (!best || sc > best.score || (sc === best.score && i < best.at))) best = { id, score: sc, at: i };
        });
      }
    }
  }
  return (best as { id: string } | null)?.id ?? null;
}

const STOP_WORDS = "stop|wait|hold on|hang on|shush|shut up|be quiet|quiet|enough|cancel|never ?mind|pause";
/** Only a stop word ("stop", "ok wait", "hold on please"). */
export const isStop = (t: string) => new RegExp(`^(?:(?:ok(?:ay)?|no|hey|please|just)\\s+)*(?:${STOP_WORDS})(?:\\s+(?:please|it|talking|now|there|a sec(?:ond)?|a moment))*[\\s.,!?]*$`, "i").test(t.trim());
/** "Stop, what about the hackathon?" → "what about the hackathon?" */
export const afterStop = (t: string) => { const m = t.trim().match(new RegExp(`^(?:(?:ok(?:ay)?|no|hey)\\s+)*(?:${STOP_WORDS}|actually|sorry)[\\s.,!?]+(.{3,})$`, "i")); return m && m[1].trim().split(/\s+/).length >= 2 ? m[1].trim() : t; };
