"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { logCall, sendTo, type State } from "@/lib/store";
import { hush, listen, speak } from "@/lib/voice";
import Icon from "../Icon";
import { AgentTile, GroupTile } from "../faces";
import { convoOf, fmtSecs, nameOf } from "../agents";

const LINES = (you: string) => [
  `Hi${you ? ` ${you}` : ""}, I can hear you.`,
  "Go ahead, I'm taking notes.",
  "Got it. I'll send a short summary to the chat after this.",
  "Anything else before I start?",
];

/** Demo voice call: rings, connects, shows live captions. No audio is recorded or sent. */
export default function CallOverlay({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const c = convoOf(s, id)!;
  const [secs, setSecs] = useState(0);
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [line, setLine] = useState(0);
  const [caption, setCaption] = useState("Listening…");
  const root = useRef<HTMLDivElement>(null);
  const secsRef = useRef(0);
  const mutedRef = useRef(false);
  const speakerRef = useRef(true);
  const demo = s.prefs.demoLabels !== false;
  const lines = LINES(s.agent?.you ?? "");
  const speakers = c.members;

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo("[data-call-card]", { y: 20, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" });
  }, []);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { speakerRef.current = speaker; if (!speaker) hush(); }, [speaker]);
  useEffect(() => { if (!demo) { setLive(true); return; } const t = setTimeout(() => setLive(true), 1600); return () => clearTimeout(t); }, [demo]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { secsRef.current += 1; setSecs(secsRef.current); }, 1000);
    const l = demo ? setInterval(() => setLine((x) => x + 1), 3200) : 0;
    return () => { clearInterval(t); if (l) clearInterval(l); };
  }, [live, demo]);
  useEffect(() => {
    if (demo) return;
    let stop = false;
    (async () => {
      while (!stop) {
        if (mutedRef.current) { await new Promise((r) => setTimeout(r, 400)); continue; }
        let said = "";
        try { said = await listen(7000); } catch (e) { if (!stop) setCaption((e as Error).message); break; }
        if (stop || !said) continue;
        setCaption(`You: ${said}`);
        const reply = await sendTo(id, said);
        if (stop) return;
        setCaption(`${c.name}: ${reply}`);
        if (speakerRef.current) speak(reply);
      }
    })();
    return () => { stop = true; hush(); };
  }, [demo, id, c.name]);
  const end = () => { hush(); logCall(id, secsRef.current); onClose(); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") end(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }); // eslint-disable-line react-hooks/exhaustive-deps

  const talker = speakers[line % speakers.length];
  const btn = (on: boolean) => `grid h-14 w-14 place-items-center rounded-full transition ${on ? "bg-white text-[#0a0a0a]" : "bg-white/10 text-white hover:bg-white/20"}`;

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label={`Call with ${c.name}`} className="fixed inset-0 z-[80] grid place-items-center bg-[#07050e]/95 p-5 backdrop-blur-md">
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-grape/35 blur-[120px]" />
      <div data-call-card className="relative flex w-full max-w-[420px] flex-col items-center text-center text-white">
        {demo && <span className="label rounded-full border border-dashed border-white/35 px-2.5 py-1 text-[9px] text-white/75">Demo call · no audio</span>}
        <div className="relative mt-10 grid place-items-center">
          {live && [0, 0.7, 1.4].map((d) => <span key={d} className="ring-out absolute inset-0 rounded-[40px] border-2 border-lilac/70" style={{ animationDelay: `${d}s` }} />)}
          {!live && <span className="ring-out absolute inset-0 rounded-[40px] border-2 border-white/40" />}
          {c.group ? <GroupTile members={c.members} look={s.agent?.look} size={132} /> : <AgentTile id={id} look={s.agent?.look} size={132} radius={40} />}
        </div>
        <h2 className="display mt-8 text-[44px] leading-none">{c.name}</h2>
        <p className="mt-3 flex items-center gap-2 font-mono text-[13px] text-white/75">{live ? <><i className="h-2 w-2 rounded-full bg-lilac live-dot" />{fmtSecs(secs)}</> : "Calling…"}</p>
        <div className="mt-8 min-h-[72px] w-full rounded-2xl bg-white/[.06] px-5 py-4 ring-1 ring-white/10" aria-live="polite">
          {demo && live ? (
            <p key={line} className="text-[16px] leading-snug text-white/90"><b className="text-lilac">{c.group ? nameOf(s, talker) : c.name}:</b> {lines[line % lines.length]}</p>
          ) : <p className="text-[16px] leading-snug text-white/90">{demo ? "Live captions show up here." : caption}</p>}
        </div>
        <div className="mt-10 flex items-center gap-5">
          <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} className={btn(muted)}><Icon name={muted ? "micoff" : "mic"} size={22} /></button>
          <button onClick={end} aria-label="End call" className="grid h-16 w-16 place-items-center rounded-full bg-[#f04e4e] text-white shadow-[0_10px_30px_-8px_rgba(240,78,78,.7)] transition hover:scale-105"><Icon name="hangup" size={28} /></button>
          <button onClick={() => setSpeaker((m) => !m)} aria-pressed={speaker} aria-label="Speaker" className={btn(speaker)}><Icon name="speaker" size={22} /></button>
        </div>
      </div>
    </div>
  );
}
