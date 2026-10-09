"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { callTurn, get, logCall, setCalling, speakerFor, type State } from "@/lib/store";
import { cheer, isWarm, setMood } from "@/lib/mood";
import { BLOCKED, ensureMic, hush, listen, ready, speakAndListen, transcribe, type Feed, type Transcriber } from "@/lib/voice";
import { voiceOf } from "@/lib/voices";
import Icon from "../Icon";
import { AgentTile, GroupTile } from "../faces";
import { convoOf, fmtSecs, nameOf as agentLabel } from "../agents";
import { afterStop, isStop } from "@/lib/names";
import { MERGE_MS, TurnClock, capSentences, interruptedRecord, maybeGreeting, mergeUtterances, stripGreeting } from "@/lib/callTurn";


type Phase = "connecting" | "listening" | "hearing" | "thinking" | "speaking" | "muted" | "error";
const LABEL: Record<Phase, string> = { connecting: "Connecting…", listening: "Listening", hearing: "Listening", thinking: "Thinking…", speaking: "Speaking", muted: "Muted", error: "" };

/**
 * Live voice call. Nothing from the call goes into the chat thread (only a "Voice call · 2:14" line after it ends).
 * The reply streams in and the agent starts talking on its first sentence; talk over it any time to interrupt.
 */
export default function CallOverlay({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const c = convoOf(s, id)!;
  const [secs, setSecs] = useState(0);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [note, setNote] = useState("");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState("");
  const nameOf = (who: string) => (who === id ? c.name : agentLabel(s, who) === "Agent" ? s.custom.find((x) => x.id === who)?.name || "Agent" : agentLabel(s, who));
  const root = useRef<HTMLDivElement>(null);
  const secsRef = useRef(0);
  const mutedRef = useRef(false);
  const ended = useRef(false);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo("[data-call-card]", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" });
  }, []);
  useEffect(() => { mutedRef.current = muted; if (muted) { hush(); setPhase("muted"); } }, [muted]);
  useEffect(() => { setCalling(id); return () => setCalling(null); }, [id]);
  useEffect(() => {
    if (phase === "connecting") return;
    const t = setInterval(() => { secsRef.current += 1; setSecs(secsRef.current); }, 1000);
    return () => clearInterval(t);
  }, [phase === "connecting"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let stop = false;
    let abort: AbortController | null = null;
    let ear: Transcriber | null = null;
    // one live turn at a time: a newer turn (or talking over the agent) kills the old id, and its late stream is dropped
    const turns = new TurnClock();
    // the call remembers what was said in it (and the last few chat messages), but none of it is shown in the chat
    const history: { from: string; text: string }[] = (s.threads[id] || []).filter((m) => m.text && m.id !== "hello" && m.from !== "system").slice(-8).map((m) => ({ from: m.from, text: m.text }));
    let lastWho = c.members[0] || id;
    (async () => {
      try { await ensureMic(); } catch (e) { setNote((e as Error).message); setPhase("error"); return; }
      let quiet = 0;
      let next = ""; // words you said over the agent (barge-in) become the next turn
      let answered = 0; // agent replies so far in this call: only the first may open with a greeting
      while (!stop) {
        if (mutedRef.current) { next = ""; await new Promise((r) => setTimeout(r, 300)); continue; }
        setPhase("listening"); setNote(quiet >= 3 ? "Say something, or tap end." : "");
        let said = next;
        next = "";
        if (!said) try { said = await listen(9000, (t) => { if (!stop && t && !mutedRef.current) setPhase("hearing"); }); }
        catch (e) {
          const m = (e as Error).message;
          if (stop) return;
          setNote(m); setPhase("error");
          if (m === BLOCKED || /can't|turned off|No microphone/.test(m)) return; // can't recover by retrying
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (stop) return;
        const heardAt = performance.now(); // when your phrase ended
        if (mutedRef.current) continue;
        if (!said) { quiet++; continue; }
        quiet = 0;
        // "stop" / "wait" on its own: stop talking and listen again. "Stop, what about X?" answers only X.
        if (isStop(said)) { hush(); setSpeaker(""); continue; }
        said = afterStop(said);
        const who = speakerFor(get(), id, said, lastWho);
        lastWho = who;
        if (isWarm(said)) cheer(who);
        setSpeaker(who);
        setPhase("thinking"); setNote("");
        // stream the reply into a feed; speech starts on the first full sentence
        let text = "", raw = "", done = false, failed = "", capped = false;
        const firstReply = answered === 0;
        // what gets spoken: no greeting after the first reply, and never more than two sentences
        const shape = (t: string, fin: boolean) => {
          if (!firstReply) { if (maybeGreeting(t, fin)) return { text: "", capped: false }; t = stripGreeting(t); }
          return capSentences(t, 2, fin);
        };
        let wake: () => void = () => {};
        const bump = () => { const w = wake; wake = () => {}; w(); };
        const feed: Feed = { text: () => text, done: () => done, more: () => new Promise<void>((r) => { wake = r; if (done) r(); }) };
        abort?.abort(); // never two answers in flight
        const mine = new AbortController();
        abort = mine;
        const tid = turns.begin();
        const live = () => turns.isLive(tid);
        const kill = () => { turns.kill(tid); mine.abort(); hush(); };
        // the second sentence ended: that's the whole spoken reply, so the stream (and the model) stops there
        const take = (t: string, fin: boolean) => { raw = t; const v = shape(t, fin); text = v.text; if (v.capped && !fin) { capped = true; done = true; mine.abort(); } bump(); };
        const turn = callTurn(id, said, history, (t) => { if (live() && !capped) take(t, false); }, mine.signal, who)
          .then((t) => { if (live() && !capped) take(t || raw, true); }, (e: Error) => { if (e.name !== "AbortError" && live()) failed = e.message || "Couldn't answer."; })
          .finally(() => { if (live() && !capped && raw) text = shape(raw, true).text; done = true; bump(); });
        history.push({ from: "you", text: said });
        // Keep listening while it thinks: if you say something new first, that becomes the turn and this answer is dropped.
        let newer = "", newerAt = 0;
        const replyReady = (async () => { while (!done && !ready(text, false)) await feed.more(); })();
        while (!stop && !newer && !(done || ready(text, false))) {
          ear = transcribe({ maxMs: 15000, onText: (t) => { if (t && !newerAt) newerAt = performance.now(); if (!stop && t) setPhase("hearing"); } });
          const r = await Promise.race([replyReady.then(() => "\u0000"), ear.done.catch(() => "")]);
          if (r === "\u0000") { ear.abort(); ear = null; break; }
          ear = null;
          if (r && r.trim()) newer = r.trim();
          else if (!stop) setPhase("thinking");
        }
        if (stop) return;
        if (newer) {
          kill();
          // words that started right after your phrase ended are the rest of it (phones split a phrase at short pauses)
          if (newerAt && newerAt - heardAt <= MERGE_MS) { history.pop(); next = mergeUtterances(said, newer); }
          else { history.push({ from: who, text: interruptedRecord("") }); next = newer; }
          continue;
        }
        if (!text.trim()) { setNote(failed || `${nameOf(who)} couldn't answer. Say it again.`); setPhase("error"); await new Promise((r) => setTimeout(r, 1200)); continue; }
        if (mutedRef.current) { await turn; answered++; history.push({ from: who, text }); continue; }
        const heard = await speakAndListen(feed, voiceOf(who), {
          isStopped: () => stop || mutedRef.current || !live(),
          onStart: () => { if (!stop) setPhase("speaking"); },
          onHold: () => { if (!stop) setPhase("listening"); },
          onResume: () => { if (!stop) setPhase("speaking"); },
          onBargeIn: () => { kill(); if (!stop) setPhase("hearing"); }, // stop the old answer for good, request included
        });
        if (stop) return;
        if (heard.interrupted) {
          // You talked over it: the old answer is dead. The call remembers only the words it actually said, marked as cut off,
          // and the next turn is only what you said after it stopped (nothing at all if it was just a noise).
          kill();
          if (heard.spoken.trim()) answered++;
          history.push({ from: who, text: interruptedRecord(heard.spoken) });
          next = heard.said;
          continue;
        }
        await turn;
        answered++;
        if (text.trim()) history.push({ from: who, text }); // only what was spoken (two sentences at most)
      }
    })();
    return () => { stop = true; abort?.abort(); ear?.abort(); hush(); };
  }, [id, c.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // the face on the call follows the turn: thinking, then talking, idle while it listens
  const face = c.group ? speaker : id;
  useEffect(() => {
    if (!face) return;
    setMood(face, phase === "thinking" ? "thinking" : phase === "speaking" ? "speaking" : "idle");
    return () => setMood(face, "idle");
  }, [face, phase]);

  const end = () => { if (ended.current) return; ended.current = true; hush(); logCall(id, secsRef.current); onClose(); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") end(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }); // eslint-disable-line react-hooks/exhaustive-deps

  const talking = phase === "speaking";
  const ears = phase === "listening" || phase === "hearing";
  const label = phase === "error" ? note : LABEL[phase];

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label={`Call with ${c.name}`} data-call data-call-phase={phase} className="fixed inset-0 z-[80] flex flex-col bg-[#07050e] text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
      <div className="pointer-events-none absolute left-1/2 top-[34%] h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-grape/30 blur-[110px]" />
      <div data-call-card className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center px-6 text-center">
        <p className="mt-6 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/55"><Icon name="call" size={13} />Lexari voice call</p>
        <div className="flex flex-1 flex-col items-center justify-center pb-6">
          <div className="relative grid place-items-center">
            {talking && [0, 0.6, 1.2].map((d) => <span key={d} className="ring-out absolute inset-0 rounded-[38px] border-2 border-lilac/80" style={{ animationDelay: `${d}s`, animationDuration: "1.8s" }} />)}
            {ears && <span className="ring-out absolute inset-0 rounded-[38px] border-2 border-white/35" style={{ animationDuration: "2.6s" }} />}
            <span className={`block transition-transform duration-300 ${talking ? "scale-[1.04]" : ""}`}>{c.group && speaker && phase !== "listening" && phase !== "hearing" ? <AgentTile id={speaker} look={s.agent?.look} size={120} radius={38} status={false} /> : c.group ? <GroupTile members={c.members} look={s.agent?.look} size={120} /> : <AgentTile id={id} look={s.agent?.look} size={120} radius={38} status={false} />}</span>
          </div>
          <h2 className="display mt-7 text-[34px] leading-none">{c.name}</h2>
          {c.group && <p data-call-speaker className="mt-2 min-h-[20px] text-[14px] font-semibold text-lilac">{speaker && (talking || phase === "thinking") ? `${nameOf(speaker)} ${talking ? "is talking" : "is thinking"}` : "Say a name to ask someone"}</p>}
          <p data-call-timer className="mt-2 font-mono text-[14px] tabular-nums text-white/70">{phase === "connecting" ? "Calling…" : fmtSecs(secs)}</p>
          <p data-call-state aria-live="polite" className={`mt-5 flex min-h-[28px] items-center gap-2 rounded-full px-3.5 py-1 text-[13.5px] font-semibold ${phase === "error" ? "max-w-[300px] text-[#ff9a9d]" : "bg-white/[.07] text-white/85"}`}>
            {phase === "thinking" && <span className="typing flex gap-1"><i /><i /><i /></span>}
            {(ears || talking) && <i className={`h-2 w-2 rounded-full ${talking ? "bg-lilac" : "bg-[#22c55e]"} live-dot`} />}
            {phase === "muted" && <Icon name="micoff" size={14} />}
            {label}
          </p>
          {note && phase !== "error" && <p className="mt-2 text-[12.5px] text-white/50">{note}</p>}
        </div>
        <div className="mb-6 flex items-center justify-center gap-10">
          <span className="flex flex-col items-center gap-1.5">
            <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} data-call-mute className={`grid h-16 w-16 place-items-center rounded-full transition ${muted ? "bg-white text-[#0a0a0a]" : "bg-white/12 text-white hover:bg-white/20"}`}><Icon name={muted ? "micoff" : "mic"} size={24} /></button>
            <span className="text-[11.5px] text-white/55">{muted ? "Unmute" : "Mute"}</span>
          </span>
          <span className="flex flex-col items-center gap-1.5">
            <button onClick={end} aria-label="End call" data-call-end className="grid h-16 w-16 place-items-center rounded-full bg-[#f04e4e] text-white shadow-[0_10px_30px_-8px_rgba(240,78,78,.7)] transition hover:scale-105"><Icon name="hangup" size={28} /></button>
            <span className="text-[11.5px] text-white/55">End</span>
          </span>
        </div>
      </div>
    </div>
  );
}
