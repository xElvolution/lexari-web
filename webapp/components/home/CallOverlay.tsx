"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { logCall, sendTo, type State } from "@/lib/store";
import { BLOCKED, ensureMic, hush, listen, speak } from "@/lib/voice";
import Icon from "../Icon";
import { AgentTile, GroupTile } from "../faces";
import { convoOf, fmtSecs } from "../agents";

/** Voice call: listens through the microphone, sends what you said to the agent and reads the reply aloud, with captions. */
export default function CallOverlay({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const c = convoOf(s, id)!;
  const [secs, setSecs] = useState(0);
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [caption, setCaption] = useState("Starting the microphone…");
  const [thinking, setThinking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const secsRef = useRef(0);
  const mutedRef = useRef(false);
  const speakerRef = useRef(true);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo("[data-call-card]", { y: 20, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" });
  }, []);
  const [last, setLast] = useState(""); // the agent's last answer stays on screen while it listens again
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { speakerRef.current = speaker; if (!speaker) hush(); }, [speaker]);
  useEffect(() => { setLive(true); }, []);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { secsRef.current += 1; setSecs(secsRef.current); }, 1000);
    return () => clearInterval(t);
  }, [live]);
  useEffect(() => {
    let stop = false;
    (async () => {
      try { await ensureMic(); } catch (e) { setCaption((e as Error).message); setLive(false); return; }
      let quiet = 0;
      while (!stop) {
        if (mutedRef.current) { await new Promise((r) => setTimeout(r, 400)); continue; }
        setCaption("Listening…");
        let said = "";
        try { said = await listen(9000, (t) => { if (!stop && t) setCaption(`You: ${t}`); }); }
        catch (e) {
          const m = (e as Error).message;
          if (stop) return;
          setCaption(m);
          // blocked or unsupported can't recover by retrying; a network blip can
          if (m === BLOCKED || /can't|turned off|No microphone/.test(m)) return;
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (stop) return;
        if (!said) { if (++quiet >= 3) setCaption("I'm listening. Say something, or tap end."); continue; }
        quiet = 0;
        setCaption(`You: ${said}`);
        setThinking(true);
        const reply = await sendTo(id, said).catch(() => "");
        setThinking(false);
        if (stop) return;
        if (!reply) { setCaption(`${c.name} couldn't answer. Try again.`); continue; }
        setLast(`${c.name}: ${reply}`);
        setCaption(speakerRef.current ? "Speaking…" : "");
        if (speakerRef.current) await speak(reply);
      }
    })();
    return () => { stop = true; hush(); };
  }, [id, c.name]);
  const end = () => { hush(); logCall(id, secsRef.current); onClose(); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") end(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = (on: boolean) => `grid h-14 w-14 place-items-center rounded-full transition ${on ? "bg-white text-[#0a0a0a]" : "bg-white/10 text-white hover:bg-white/20"}`;

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label={`Call with ${c.name}`} className="fixed inset-0 z-[80] grid place-items-center bg-[#07050e]/95 p-5 backdrop-blur-md">
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-grape/35 blur-[120px]" />
      <div data-call-card className="relative flex w-full max-w-[420px] flex-col items-center text-center text-white">
        <div className="relative mt-10 grid place-items-center max-[430px]:mt-4 max-[430px]:[zoom:.72]">
          {live && [0, 0.7, 1.4].map((d) => <span key={d} className="ring-out absolute inset-0 rounded-[40px] border-2 border-lilac/70" style={{ animationDelay: `${d}s` }} />)}
          {!live && <span className="ring-out absolute inset-0 rounded-[40px] border-2 border-white/40" />}
          {c.group ? <GroupTile members={c.members} look={s.agent?.look} size={132} /> : <AgentTile id={id} look={s.agent?.look} size={132} radius={40} />}
        </div>
        <h2 className="display mt-8 text-[44px] leading-none max-[430px]:mt-5">{c.name}</h2>
        <p className="mt-3 flex items-center gap-2 font-mono text-[13px] text-white/75">{live ? <><i className="h-2 w-2 rounded-full bg-lilac live-dot" />{fmtSecs(secs)}</> : "Calling…"}</p>
        <div className="mt-8 min-h-[72px] w-full rounded-2xl bg-white/[.06] px-5 py-4 ring-1 ring-white/10" aria-live="polite">
          {last && <p className="mb-2 max-h-40 overflow-y-auto text-[15px] leading-snug text-white">{last}</p>}
          <p className="text-[15px] leading-snug text-white/75">{caption}{thinking && <span className="ml-1 text-white/60">· thinking…</span>}</p>
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
