"use client";

/* Voice: microphone permission, speech-to-text with the browser's SpeechRecognition, and text-to-speech with SpeechSynthesis. */

type RecResult = { isFinal: boolean; 0: { transcript: string } };
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<RecResult> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function Ctor() {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export const canTranscribe = () => !!Ctor();
export const BLOCKED = "Microphone access is blocked. Allow the microphone for app.lexari.ai in your browser settings, then try again.";

/** Asks for the microphone properly. Says "blocked" only when the browser really denied it. */
export async function ensureMic(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use a microphone here. Open Lexari in Chrome or Safari.");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") throw new Error(BLOCKED);
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new Error("No microphone was found on this device.");
    if (name === "NotReadableError" || name === "AbortError") throw new Error("Another app is using the microphone. Close it and try again.");
    throw new Error("The microphone could not start. Try again.");
  }
}

function recError(code: string) {
  if (code === "not-allowed") return BLOCKED;
  if (code === "service-not-allowed") return "Speech-to-text is turned off in this browser. Type the message instead.";
  if (code === "audio-capture") return "Speech-to-text couldn't hear the microphone. Check no other app is using it, then try again.";
  if (code === "network") return "Speech-to-text needs a connection. Check your internet and try again.";
  if (code === "language-not-supported") return "Speech-to-text doesn't support this language here.";
  return "Speech-to-text stopped. Try again.";
}

export type Transcriber = { stop: () => Promise<string>; abort: () => void; done: Promise<string> };

/** One recognition session: ends after a phrase (or silence). onText gets final + interim for this session. */
function session(Speech: new () => Rec, onText: (t: string) => void, maxMs: number) {
  const rec = new Speech();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  // Single-phrase sessions everywhere: Android Chrome's continuous mode stops on silence anyway and repeats results.
  rec.continuous = false;
  let final = "", interim = "", failed: Error | null = null, heardAny = false;
  const timer = window.setTimeout(() => { try { rec.stop(); } catch { /* ended */ } }, maxMs);
  const done = new Promise<{ text: string; error: Error | null; heardAny: boolean }>((resolve) => {
    rec.onresult = (ev) => {
      interim = "";
      final = "";
      for (let i = 0; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript; }
      heardAny = true;
      onText((final + interim).trim());
    };
    rec.onerror = (ev) => { if (ev.error === "no-speech" || ev.error === "aborted") return; failed = new Error(recError(ev.error)); };
    rec.onend = () => { window.clearTimeout(timer); resolve({ text: (final + interim).trim(), error: failed, heardAny }); };
  });
  try { rec.start(); } catch { window.clearTimeout(timer); return { rec, done: Promise.resolve({ text: "", error: new Error("The microphone is already in use."), heardAny: false }) }; }
  return { rec, done };
}

/**
 * Starts transcribing. onText gets the running transcript.
 * continuous: keeps listening until stop() or abort(), restarting the recognizer whenever the browser ends it
 * (silence, a pause, the phone's own time limit), so a voice note records until you tap Send or Cancel.
 * Otherwise it ends after one phrase (calls).
 */
export function transcribe(opts: { onText?: (t: string) => void; continuous?: boolean; maxMs?: number } = {}): Transcriber {
  const Speech = Ctor();
  if (!Speech) {
    const err = Promise.reject(new Error("This browser can't turn speech into text. Use Chrome or Safari, or type the message."));
    err.catch(() => {});
    return { stop: () => err, abort: () => {}, done: err };
  }
  const until = Date.now() + (opts.maxMs ?? (opts.continuous ? 5 * 60_000 : 120_000));
  let committed = "";
  let current: Rec | null = null;
  let stopping = false, aborted = false;
  let resolveDone!: (t: string) => void, rejectDone!: (e: Error) => void;
  const done = new Promise<string>((res, rej) => { resolveDone = res; rejectDone = rej; });
  done.catch(() => {});
  const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b).trim();
  (async () => {
    let fails = 0;
    while (true) {
      const left = until - Date.now();
      if (left <= 0) break;
      const one = session(Speech, (t) => opts.onText?.(join(committed, t)), Math.min(left, 60_000));
      current = one.rec;
      const r = await one.done;
      current = null;
      if (aborted) return;
      committed = join(committed, r.text);
      if (r.error) {
        // blocked / unsupported can't recover; anything else gets a few quick retries
        if (r.error.message === BLOCKED || /turned off|support/.test(r.error.message) || ++fails > 3) { if (!committed) { rejectDone(r.error); return; } break; }
        await new Promise((x) => setTimeout(x, 300));
      } else fails = 0;
      if (!opts.continuous || stopping) break;
    }
    resolveDone(committed);
  })();
  return {
    done,
    stop: () => { stopping = true; try { current?.stop(); } catch { /* ended */ } return done; },
    abort: () => { aborted = true; try { current?.abort(); } catch { /* ended */ } resolveDone(""); },
  };
}

/** Hear one phrase (used by calls). */
export function listen(ms = 9000, onText?: (t: string) => void): Promise<string> {
  return transcribe({ onText, maxMs: ms }).done;
}

export type VoiceSettings = { name?: string; pitch?: number; rate?: number };
let voicesCache: SpeechSynthesisVoice[] = [];
/** The browser's voices (they load late on some phones). */
export function voices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) { voicesCache = now; return Promise.resolve(now); }
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
    window.speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); voicesCache = window.speechSynthesis.getVoices(); resolve(voicesCache); }, { once: true });
  });
}
function utterance(text: string, v?: VoiceSettings) {
  const utter = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, "").slice(0, 1200));
  utter.lang = navigator.language || "en-US";
  if (v?.name) { const hit = (voicesCache.length ? voicesCache : window.speechSynthesis.getVoices()).find((x) => x.name === v.name); if (hit) { utter.voice = hit; utter.lang = hit.lang; } }
  if (v?.pitch) utter.pitch = v.pitch;
  if (v?.rate) utter.rate = v.rate;
  return utter;
}

/** Speak a reply out loud; resolves when it finishes (or right away if speech is unavailable). */
export function speak(text: string, v?: VoiceSettings): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return Promise.resolve();
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const utter = utterance(text, v);
    const end = () => resolve();
    utter.onend = end; utter.onerror = end;
    window.setTimeout(end, Math.min(60_000, 2000 + text.length * 90 / (v?.rate || 1)));
    window.speechSynthesis.speak(utter);
  });
}

const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
/** True when what the mic heard is mostly the agent's own words coming out of the speaker. */
export function isEcho(heard: string, spoken: string) {
  const h = words(heard); if (!h.length) return true;
  const said = new Set(words(spoken));
  return h.filter((w) => said.has(w)).length / h.length >= 0.6;
}

/**
 * Speaks while the microphone keeps listening (barge-in). As soon as you start talking (and it isn't the
 * agent's own voice echoing back) speech stops and what you say becomes the next turn.
 * Resolves with your words, or "" when the agent finished without being interrupted.
 */
export function speakAndListen(text: string, v: VoiceSettings | undefined, opts: { onBargeIn?: () => void; onText?: (t: string) => void; isStopped?: () => boolean } = {}): Promise<string> {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return Promise.resolve("");
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    let interrupted = false, finished = false, settled = false;
    const settle = (t: string) => { if (!settled) { settled = true; resolve(t); } };
    let ear: Transcriber | null = null;
    const startEar = () => {
      if (finished || interrupted || opts.isStopped?.()) return;
      ear = transcribe({
        maxMs: 60_000,
        onText: (t) => {
          if (finished && !interrupted) return;
          if (!interrupted && t && !isEcho(t, text)) { interrupted = true; window.speechSynthesis.cancel(); opts.onBargeIn?.(); }
          if (interrupted) opts.onText?.(t);
        },
      });
      void ear.done.then((t) => {
        if (interrupted) { settle(t && !isEcho(t, text) ? t : ""); return; }
        if (!finished) startEar(); // a phrase of echo or silence ended: keep listening while it speaks
      }, () => { if (!interrupted && !finished) setTimeout(startEar, 400); });
    };
    const utter = utterance(text, v);
    const end = () => { if (interrupted) return; finished = true; ear?.abort(); settle(""); };
    utter.onend = end; utter.onerror = end;
    window.setTimeout(end, Math.min(60_000, 2000 + text.length * 90 / (v?.rate || 1)));
    window.speechSynthesis.speak(utter);
    // give the speaker a moment to start so the first syllables aren't taken as you talking
    setTimeout(startEar, 350);
  });
}

export function hush() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
