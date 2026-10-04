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
/**
 * Speaks while the microphone keeps listening (barge-in, like a voice-mode call):
 * - voice activity detection stops the agent's speech the instant you start talking;
 * - speech-to-text confirms it was you (not the agent's own voice echoing back) and keeps listening until you finish;
 * - if it was only a noise, the agent carries on from the word where it stopped.
 * Resolves with your words, or "" when the agent finished without being interrupted.
 */
export function speakAndListen(source: string | Feed, v: VoiceSettings | undefined, opts: { onStart?: () => void; onBargeIn?: () => void; onHold?: () => void; onResume?: () => void; onText?: (t: string) => void; isStopped?: () => boolean } = {}): Promise<string> {
  const feed: Feed = typeof source === "string" ? { text: () => source, done: () => true, more: () => Promise.resolve() } : source;
  if (typeof window === "undefined" || !window.speechSynthesis || (feed.done() && !feed.text().trim())) return Promise.resolve("");
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    let text = feed.text();
    let interrupted = false, finished = false, settled = false, holding = false;
    let at = 0, from = 0, began = 0;
    let ear: Transcriber | null = null, vad: Vad | null = null;
    let safety = 0, holdTimer = 0;
    const settle = (t: string) => { if (settled) return; settled = true; window.clearTimeout(safety); window.clearTimeout(holdTimer); vad?.stop(); vad = null; resolve(t); };
    const interrupt = () => {
      if (interrupted) return;
      interrupted = true; holding = false; gen++; window.clearTimeout(holdTimer); window.clearTimeout(safety);
      window.speechSynthesis.cancel(); vad?.stop(); vad = null; opts.onBargeIn?.();
    };
    const end = () => { if (interrupted || holding || finished) return; finished = true; ear?.abort(); settle(""); };
    const startEar = () => {
      if (finished || interrupted || settled || opts.isStopped?.()) return;
      ear = transcribe({
        maxMs: 60_000,
        onText: (t) => {
          if (finished && !interrupted) return;
          if (!interrupted && t && !isEcho(t, text)) interrupt();
          if (interrupted) opts.onText?.(t);
        },
      });
      void ear.done.then((t) => {
        if (interrupted) { settle(t && !isEcho(t, text) ? t : ""); return; }
        if (!finished) startEar(); // a phrase of echo or silence ended: keep listening while it speaks
      }, () => {
        if (vad) { vad.stop(); vad = null; vadOff = true; } // the mic can't be shared here: rely on words only
        if (!interrupted && !finished) window.setTimeout(startEar, 400);
      });
    };
    let began0 = false;
    let gen = 0; // each utterance gets a number so a stale onend can't move things along
    const say = (start: number) => {
      if (interrupted || holding || finished || settled || opts.isStopped?.()) { if (opts.isStopped?.()) end(); return; }
      text = feed.text();
      const stop = ready(text, feed.done());
      if (stop <= start || !text.slice(start, stop).trim()) {
        if (feed.done()) { if (!text.slice(start).trim()) { end(); return; } }
        else { void feed.more().then(() => say(start)); return; } // wait for the next sentence
      }
      const upto = feed.done() ? text.length : stop;
      const chunk = text.slice(start, upto);
      if (!chunk.trim()) { end(); return; }
      from = start; at = start; began = performance.now();
      const my = ++gen;
      if (!began0) { began0 = true; opts.onStart?.(); }
      const u = utterance(chunk, v);
      u.onboundary = (e) => { at = start + (e.charIndex || 0); };
      const next = () => { if (my !== gen || holding) return; gen++; window.clearTimeout(safety); if (upto >= feed.text().length && feed.done()) end(); else say(upto); };
      u.onend = next; u.onerror = next;
      window.clearTimeout(safety);
      safety = window.setTimeout(next, Math.min(60_000, 2000 + chunk.length * 90 / (v?.rate || 1)));
      window.speechSynthesis.speak(u);
    };
    // VAD heard something: stop talking now, and give speech-to-text a moment to say whether it was you.
    const hold = () => {
      if (interrupted || finished || holding || settled) return;
      holding = true; gen++; window.speechSynthesis.cancel(); window.clearTimeout(safety);
      opts.onHold?.();
      // where it stopped: the last word boundary, or an estimate from elapsed time when the voice has no boundary events
      const est = from + Math.floor(((performance.now() - began) / 1000) * 14 * (v?.rate || 1));
      let resumeAt = at > from ? at : Math.min(text.length, est);
      while (resumeAt > from && /\S/.test(text[resumeAt - 1] || "")) resumeAt--;
      holdTimer = window.setTimeout(() => {
        if (interrupted || settled) return;
        holding = false; vad?.desensitize(); opts.onResume?.(); say(resumeAt); // only a noise or the speaker's echo
      }, 1700);
    };
    say(0);
    // give the speaker a moment to start so the first syllables aren't taken as you talking
    window.setTimeout(startEar, 350);
    void startVad(hold).then((x) => { if (settled || interrupted || finished) x?.stop(); else vad = x; });
  });
}

export function hush() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
