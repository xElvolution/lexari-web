"use client";

import { useEffect, useRef, useState } from "react";
import { sendTo, toast, useApp } from "@/lib/store";
import { ensureMic, transcribe, type Transcriber } from "@/lib/voice";
import Icon from "../Icon";
import { fmtSecs } from "../agents";

const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const BARS = 36;

/** Message box: attach, text, voice note, call and send. Enter sends, Shift+Enter adds a line. */
type Reply = { id: string; from: string; text: string };
export default function Composer({ id, name, suggestions, onCall, onDesktop, desktopOpen, reply = null, replyName = "", onClearReply }: { id: string; name: string; suggestions: string[]; onCall: () => void; onDesktop: () => void; desktopOpen: boolean; reply?: Reply | null; replyName?: string; onClearReply?: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [rec, setRec] = useState<number | null>(null); // seconds recorded, null when not recording
  const [heard, setHeard] = useState(""); // live transcript while recording
  const tr = useRef<Transcriber | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => { if (window.matchMedia("(min-width: 1024px)").matches) input.current?.focus(); }, [id]);
  useEffect(() => {
    if (rec === null) return;
    const t = setInterval(() => setRec((r) => (r === null ? r : Math.min(300, r + 0.1))), 100);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") cancelVoice(); };
    window.addEventListener("keydown", esc);
    return () => { clearInterval(t); window.removeEventListener("keydown", esc); };
  }, [rec === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const grow = () => { const t = input.current; if (!t) return; t.style.height = "auto"; t.style.height = `${Math.min(160, t.scrollHeight)}px`; };
  const send = (v = text) => {
    if (!v.trim() && !file) return;
    sendTo(id, v, { ...(file ? { file } : {}), ...(reply ? { reply } : {}) }); setText(""); setFile(null); onClearReply?.(); requestAnimationFrame(grow); input.current?.focus();
  };
  /* Voice note: ask for the mic, transcribe while recording, then put the text in the box to check before sending. */
  const startVoice = async () => {
    try { await ensureMic(); } catch (e) { toast({ text: (e as Error).message }); return; }
    setHeard("");
    const t = transcribe({ continuous: true, onText: setHeard });
    tr.current = t;
    setRec(0);
    t.done.catch((e: Error) => { if (tr.current === t) { tr.current = null; setRec(null); toast({ text: e.message }); } });
  };
  const finishVoice = async () => {
    const t = tr.current; if (!t) { setRec(null); return; }
    tr.current = null;
    let said = "";
    try { said = await t.stop(); } catch (e) { setRec(null); toast({ text: (e as Error).message }); return; }
    setRec(null);
    if (!said) { toast({ text: "I didn't catch anything. Try again a little closer to the mic." }); return; }
    setText((cur) => (cur.trim() ? `${cur.trim()} ${said}` : said).slice(0, 2000));
    requestAnimationFrame(() => { grow(); input.current?.focus(); });
  };
  function cancelVoice() { tr.current?.abort(); tr.current = null; setRec(null); setHeard(""); }
  useEffect(() => { if (reply) input.current?.focus(); }, [reply]);
  const ready = !!text.trim() || !!file;
  const iconBtn = "grid h-10 w-10 max-[430px]:h-9 max-[430px]:w-9 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-tint hover:text-brand-ink";

  return (
    <div className="pb-safe border-t border-line bg-base">
      <div className="mx-auto max-w-[820px] px-3 pb-2.5 pt-3 sm:px-5">
        {suggestions.length > 0 && rec === null && (
          <div className="no-bar -mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,black_88%,transparent)]">
            {suggestions.map((c) => <button key={c} onClick={() => send(c)} className="shrink-0 rounded-full bg-tint px-3.5 py-2 text-[13px] font-semibold text-ink/80 transition hover:bg-grape hover:text-white">{c}</button>)}
          </div>
        )}
        <div data-tour="composer" className={`rounded-[26px] max-[430px]:rounded-[22px] bg-card ring-1 transition ${rec !== null ? "ring-grape" : "ring-line focus-within:ring-2 focus-within:ring-grape"}`}>
          {reply && rec === null && (
            <div className="flex items-center gap-2.5 px-3 pt-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-tint text-brand-ink"><Icon name="reply" size={16} /></span>
              <span className="min-w-0 flex-1 border-l-[3px] border-grape pl-2.5"><span className="block text-[12px] font-bold text-brand-ink">Replying to {replyName}</span><span className="block truncate text-[13px] text-ink/65">{reply.text || "Attachment"}</span></span>
              <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-line"><Icon name="x" size={14} /></button>
            </div>
          )}
          {file && rec === null && (
            <div className="flex px-3 pt-3">
              <span className="flex max-w-full items-center gap-2 rounded-2xl bg-tint py-1.5 pl-2 pr-1.5 text-[13px] text-ink">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-grape text-white"><Icon name="file" size={16} /></span>
                <span className="min-w-0"><span className="block truncate font-semibold">{file.name}</span><span className="block text-[11.5px] text-ink/60">{file.size}</span></span>
                <button onClick={() => setFile(null)} aria-label="Remove attachment" className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-line"><Icon name="x" size={14} /></button>
              </span>
            </div>
          )}
          {rec === null ? (
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-1 p-1.5">
              <input ref={picker} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile({ name: f.name, size: kb(f.size) }); e.target.value = ""; }} />
              <button type="button" onClick={onDesktop} data-tour="desktop-btn" aria-pressed={desktopOpen} aria-label={`Open ${name}'s desktop`} title="Desktop" className={desktopOpen ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grape text-white transition" : iconBtn}><Icon name="monitor" size={19} /></button>
              <button type="button" onClick={() => picker.current?.click()} aria-label="Attach a file" title="Attach a file" className={iconBtn}><Icon name="clip" size={19} /></button>
              <textarea ref={input} value={text} rows={1} onChange={(e) => { setText(e.target.value.slice(0, 2000)); grow(); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } else if (e.key === "Escape" && reply) onClearReply?.(); }} placeholder={`Message ${name}`} aria-label={`Message ${name}`} className="max-h-40 min-h-[40px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-[16px] leading-6 text-ink outline-none placeholder:text-ink/45" />
              <button type="button" onClick={() => void startVoice()} aria-label="Record a voice message" title="Voice message" className={iconBtn}><Icon name="mic" size={19} /></button>
              <button type="button" onClick={onCall} aria-label={`Call ${name}`} title="Voice call" className={iconBtn}><Icon name="call" size={18} /></button>
              <button disabled={!ready} aria-label="Send" className="grid h-10 w-10 max-[430px]:h-9 max-[430px]:w-9 shrink-0 place-items-center rounded-full bg-grape text-white transition hover:bg-grape-deep disabled:bg-ink/15 disabled:text-ink/40"><Icon name="send" size={18} stroke={2.4} /></button>
            </form>
          ) : (
            <div className="flex items-center gap-2 p-1.5" role="status" aria-label="Recording a voice message">
              <button onClick={cancelVoice} aria-label="Cancel recording" title="Cancel" className={iconBtn}><Icon name="trash" size={18} /></button>
              <span className="flex items-center gap-2 pl-1"><i className="h-2.5 w-2.5 rounded-full bg-grape live-dot" /><span className="tab-num w-10 font-mono text-[13px] font-semibold text-ink">{fmtSecs(rec)}</span></span>
              {/* Keeps recording through pauses until you tap ✓ or the bin; the words appear in the box afterwards. */}
              <span data-recording className="flex h-10 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
                {Array.from({ length: BARS }).map((_, i) => <i key={i} className="wave w-[3px] shrink-0 rounded-full bg-brand-ink" style={{ animationDelay: `${(i * 97) % 900}ms`, height: `${30 + ((i * 37) % 60)}%` }} />)}
              </span>
              <span className="sr-only">{heard ? "Hearing you" : "Listening"}</span>
              <button onClick={() => void finishVoice()} aria-label="Done recording, check the text" title="Done" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grape text-white transition hover:bg-grape-deep"><Icon name="check" size={18} stroke={2.6} /></button>
            </div>
          )}
        </div>
        <p className="label mt-2 hidden text-center text-[8.5px] text-ink/45 sm:block">Enter to send · Shift+Enter for a new line</p>
      </div>
    </div>
  );
}
