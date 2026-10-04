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

/**
 * Starts transcribing. onText gets the running transcript (final + interim).
 * continuous: keeps listening until stop() (voice notes); otherwise ends after one phrase (calls).
 */
export function transcribe(opts: { onText?: (t: string) => void; continuous?: boolean; maxMs?: number } = {}): Transcriber {
  const Speech = Ctor();
  if (!Speech) {
    const err = Promise.reject(new Error("This browser can't turn speech into text. Use Chrome or Safari, or type the message."));
    err.catch(() => {});
    return { stop: () => err, abort: () => {}, done: err };
  }
  const rec = new Speech();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = !!opts.continuous;
  let final = "";
  let interim = "";
  let failed: Error | null = null;
  let resolveDone!: (t: string) => void;
  let rejectDone!: (e: Error) => void;
  const done = new Promise<string>((res, rej) => { resolveDone = res; rejectDone = rej; });
  done.catch(() => {});
  const timer = window.setTimeout(() => { try { rec.stop(); } catch { /* ended */ } }, opts.maxMs ?? 120_000);
  rec.onresult = (ev) => {
    interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
    }
    opts.onText?.((final + interim).trim());
  };
  rec.onerror = (ev) => {
    // silence and our own stop/abort are not errors
    if (ev.error === "no-speech" || ev.error === "aborted") return;
    failed = new Error(recError(ev.error));
  };
  rec.onend = () => {
    window.clearTimeout(timer);
    const text = (final + interim).trim();
    if (failed && !text) rejectDone(failed); else resolveDone(text);
  };
  try { rec.start(); } catch { window.clearTimeout(timer); rejectDone(new Error("The microphone is already in use.")); }
  return {
    done,
    stop: () => { try { rec.stop(); } catch { /* ended */ } return done; },
    abort: () => { try { rec.abort(); } catch { /* ended */ } },
  };
}

/** Hear one phrase (used by calls). */
export function listen(ms = 9000, onText?: (t: string) => void): Promise<string> {
  return transcribe({ onText, maxMs: ms }).done;
}

/** Speak a reply out loud; resolves when it finishes (or right away if speech is unavailable). */
export function speak(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return Promise.resolve();
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, "").slice(0, 1200));
    utter.lang = navigator.language || "en-US";
    const end = () => resolve();
    utter.onend = end; utter.onerror = end;
    window.setTimeout(end, Math.min(60_000, 2000 + text.length * 90));
    window.speechSynthesis.speak(utter);
  });
}

export function hush() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
