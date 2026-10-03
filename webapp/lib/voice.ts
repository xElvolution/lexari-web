"use client";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function Ctor() {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Hear one phrase from the microphone. Rejects if the browser cannot listen. */
export function listen(ms = 8000): Promise<string> {
  const Speech = Ctor();
  if (!Speech) return Promise.reject(new Error("This browser cannot hear the microphone. Type the message instead."));
  return new Promise((resolve, reject) => {
    const rec = new Speech();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    let text = "";
    const timer = window.setTimeout(() => rec.stop(), ms);
    rec.onresult = (ev) => { text = ev.results?.[0]?.[0]?.transcript || ""; };
    rec.onerror = () => { window.clearTimeout(timer); reject(new Error("The microphone was blocked.")); };
    rec.onend = () => { window.clearTimeout(timer); resolve(text.trim()); };
    try { rec.start(); } catch { window.clearTimeout(timer); reject(new Error("The microphone is already in use.")); }
  });
}

/** Speak a reply out loud. */
export function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  window.speechSynthesis.speak(utter);
}

export function hush() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
