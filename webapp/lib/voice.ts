"use client";

/* Voice: microphone permission, speech-to-text with the browser's SpeechRecognition, and text-to-speech with SpeechSynthesis. */

import { SpeechQueue, TurnClock, afterBase, cleanBargeIn, isEcho, sentences, spokenUpTo, throughWord, type Sentence } from "./callTurn";
export { isEcho };

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
function session(Speech: new () => Rec, onText: (t: string, final: string) => void, maxMs: number) {
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
      onText((final + interim).trim(), final.trim());
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
export function transcribe(opts: { onText?: (t: string, final: string) => void; continuous?: boolean; maxMs?: number } = {}): Transcriber {
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
      const one = session(Speech, (t, f) => opts.onText?.(join(committed, t), join(committed, f)), Math.min(left, 60_000));
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


/** Voice activity detection on the microphone: fires when someone starts talking. Calibrates to the room and to the
 *  agent's own voice leaking from the speaker during its first ~0.6 s, so the speaker alone doesn't trip it. */
type Vad = { stop: () => void; desensitize: () => void };
let vadOff = false; // some phones can't share the mic between this and speech-to-text; then words alone do barge-in
async function startVad(onSpeech: () => void): Promise<Vad | null> {
  if (vadOff || typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } }); } catch { return null; }
  const ac = new AC();
  void ac.resume().catch(() => {});
  const an = ac.createAnalyser(); an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let floor = 0.006, echo = 0, above = 0, last = t0, fired = false, extra = 1;
  const iv = window.setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length), now = performance.now(), dt = now - last; last = now;
    if (now - t0 < 600) { echo = Math.max(echo, rms); return; } // the agent just started talking: learn its loudness
    const th = Math.max(0.018, floor * 4, echo * 1.7) * extra;
    above = rms > th ? above + dt : Math.max(0, above - dt * 2);
    if (rms < th) floor = floor * 0.97 + Math.min(rms, floor * 2) * 0.03;
    if (above >= 140 && !fired) { fired = true; onSpeech(); window.setTimeout(() => { fired = false; above = 0; }, 2500); }
  }, 30);
  return {
    stop: () => { window.clearInterval(iv); stream.getTracks().forEach((t) => t.stop()); void ac.close().catch(() => {}); },
    desensitize: () => { extra = Math.min(2.5, extra * 1.35); },
  };
}

/** A reply that is still streaming in: speakAndListen starts on the first full sentence and keeps going as more arrives. */
export type Feed = { text: () => string; done: () => boolean; more: () => Promise<void> };
/** The speakable end of a growing reply: the last sentence end (or a comma once it gets long); everything when done. */
export function ready(t: string, done: boolean) {
  if (done) return t.length;
  let cut = -1; const re = /[.!?…](?=\s)|\n/g; let m: RegExpExecArray | null;
  while ((m = re.exec(t))) cut = m.index + 1;
  if (cut < 0 && t.length > 120) { const c = Math.max(t.lastIndexOf(", "), t.lastIndexOf("; ")); if (c > 40) cut = c + 1; }
  return Math.max(0, cut);
}
/** How a spoken reply ended. said: what you said over it ("" if nothing). spoken: the part of the reply actually heard. */
export type Heard = { said: string; interrupted: boolean; spoken: string };
/**
 * Speaks while the microphone keeps listening (barge-in, like a voice-mode call):
 * - the reply is cut into sentences that go through a queue tagged with a turn id;
 * - voice activity detection (or your words) stops speech the instant you start talking and empties the queue;
 * - words you say are your new turn (the old answer is never resumed); results heard before you started are left out;
 * - only a noise with no recognised words at all lets the agent carry on from the word where it stopped.
 */
export function speakAndListen(source: string | Feed, v: VoiceSettings | undefined, opts: { onStart?: () => void; onBargeIn?: () => void; onHold?: () => void; onResume?: () => void; onText?: (t: string) => void; isStopped?: () => boolean } = {}): Promise<Heard> {
  const feed: Feed = typeof source === "string" ? { text: () => source, done: () => true, more: () => Promise.resolve() } : source;
  if (typeof window === "undefined" || !window.speechSynthesis || (feed.done() && !feed.text().trim())) return Promise.resolve({ said: "", interrupted: false, spoken: "" });
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const clock = new TurnClock();
    const queue = new SpeechQueue(clock);
    let seg = clock.begin(); // a resume after a noise starts a new segment; holding or interrupting kills the old one
    let text = feed.text();
    let queued = 0, spokenEnd = 0, cut = -1, heardTo = 0; // cut: where speech stopped when you talked; heardTo: end of the last sentence started
    let cur: Sentence | null = null, at = 0, began = 0, waiting = false, started = false;
    let interrupted = false, finished = false, settled = false, holding = false, heardInHold = false;
    let ear: Transcriber | null = null, vad: Vad | null = null;
    // per recognition session: its final results, and (once you interrupt) the finals from before that moment
    let earState: { fin: string; base: string | null } = { fin: "", base: null };
    let safety = 0, holdTimer = 0;
    const spokenAt = () => (cur ? spokenUpTo(text, cur, at, performance.now() - began, v?.rate || 1) : spokenEnd);
    const spokenText = () => text.slice(0, cut >= 0 ? cut : spokenEnd);
    const audible = () => text.slice(0, Math.max(heardTo, spokenEnd)); // what the mic could have picked up from the speaker
    const settle = (said: string) => {
      if (settled) return; settled = true;
      window.clearTimeout(safety); window.clearTimeout(holdTimer); vad?.stop(); vad = null; clock.kill(); queue.clear();
      resolve({ said, interrupted, spoken: interrupted ? spokenText() : text });
    };
    /** Silence now: kill the segment, empty the queue, cancel the voice. A late onend from the cancelled sentence is ignored. */
    const silence = () => { clock.kill(seg); queue.clear(); cur = null; window.clearTimeout(safety); window.speechSynthesis.cancel(); };
    const interrupt = () => {
      if (interrupted || settled) return;
      if (!holding) { cut = spokenAt(); if (earState.base === null) earState.base = earState.fin; }
      interrupted = true; holding = false; window.clearTimeout(holdTimer);
      silence(); vad?.stop(); vad = null; opts.onBargeIn?.();
    };
    const end = () => { if (interrupted || holding || finished || settled) return; finished = true; ear?.abort(); settle(""); };
    const stopped = () => { if (opts.isStopped?.()) { silence(); finished = true; ear?.abort(); settle(""); return true; } return false; };
    const pump = () => {
      if (interrupted || holding || finished || settled || stopped()) return;
      text = feed.text();
      const upto = ready(text, feed.done());
      if (upto > queued) { for (const x of sentences(text, queued, upto, seg)) queue.push(x); queued = upto; }
      if (cur) return;
      const s = queue.next();
      if (s) { speakOne(s); return; }
      if (feed.done()) { end(); return; }
      if (!waiting) { waiting = true; void feed.more().then(() => { waiting = false; pump(); }); }
    };
    const speakOne = (s: Sentence) => {
      cur = s; at = s.start; began = performance.now(); heardTo = Math.max(heardTo, s.end);
      if (!started) { started = true; opts.onStart?.(); }
      const u = utterance(s.text, v);
      u.onboundary = (e) => { if (cur === s) at = s.start + (e.charIndex || 0); };
      const fin = () => { if (cur !== s || !clock.isLive(s.turn)) return; cur = null; spokenEnd = s.end; window.clearTimeout(safety); pump(); };
      u.onend = fin; u.onerror = fin;
      window.clearTimeout(safety);
      safety = window.setTimeout(fin, Math.min(60_000, 2000 + s.text.length * 90 / (v?.rate || 1)));
      window.speechSynthesis.speak(u);
    };
    const startEar = () => {
      if (finished || settled || (!interrupted && opts.isStopped?.())) return;
      // a session started after you began talking has nothing from before it
      const st = { fin: "", base: holding || interrupted ? "" : null as string | null };
      earState = st;
      const me = transcribe({
        maxMs: 60_000,
        onText: (t, f) => {
          if (settled || (finished && !interrupted)) return;
          const prev = st.fin; st.fin = f;
          if (interrupted) { opts.onText?.(afterBase(t, st.base ?? "")); return; }
          const fresh = afterBase(t, st.base ?? prev);
          if (!fresh) return;
          if (holding) heardInHold = true; // words after the voice stopped: never resume the old answer
          if (!isEcho(fresh, audible())) { if (st.base === null) st.base = prev; interrupt(); opts.onText?.(afterBase(t, st.base)); }
        },
      });
      ear = me;
      void me.done.then((t) => {
        if (settled || ear !== me) return;
        if (interrupted) { settle(cleanBargeIn(t, st.base ?? "", throughWord(text, Math.max(0, cut)), audible())); return; }
        if (!finished) startEar(); // a phrase of echo or silence ended: keep listening while it speaks (or while held)
      }, () => {
        if (vad) { vad.stop(); vad = null; vadOff = true; } // the mic can't be shared here: rely on words only
        if (interrupted) { settle(""); return; }
        if (!finished) window.setTimeout(startEar, 400);
      });
    };
    // VAD heard something: stop talking now and empty the queue, then give speech-to-text a moment to say whether it was you.
    const hold = () => {
      if (interrupted || finished || holding || settled) return;
      cut = spokenAt();
      holding = true; heardInHold = false;
      if (earState.base === null) earState.base = earState.fin; // finals before this moment are not part of what you say
      silence();
      opts.onHold?.();
      holdTimer = window.setTimeout(() => {
        if (interrupted || settled) return;
        // any recognised words since it stopped (even if they looked like echo) mean someone talked: don't resume
        if (heardInHold) { interrupt(); if (!ear) settle(""); return; }
        // only a noise: carry on from the word where it stopped (never from the start)
        holding = false; vad?.desensitize(); opts.onResume?.();
        seg = clock.begin(); queued = cut; spokenEnd = cut; cut = -1;
        earState.base = null;
        pump();
      }, 2200);
    };
    pump();
    // give the speaker a moment to start so the first syllables aren't taken as you talking
    window.setTimeout(startEar, 350);
    void startVad(hold).then((x) => { if (settled || interrupted || finished) x?.stop(); else vad = x; });
  });
}

export function hush() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
