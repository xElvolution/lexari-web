"use client";

import { hardReload, isStale, reportError } from "../ClientErrors";
import { useEffect, useRef, useState } from "react";
import { api, friendly } from "@/lib/api";
import Icon from "../Icon";

type Status = "connecting" | "live" | "closed" | "error";
type Rfb = import("@novnc/novnc/lib/rfb").default;

/** X11 keysyms for the keys the on-screen bar sends. Printable characters map to their code point (Unicode beyond Latin-1 to 0x01000000 + code). */
const KEY = { Enter: 0xff0d, Backspace: 0xff08, Tab: 0xff09, Escape: 0xff1b, Left: 0xff51, Up: 0xff52, Right: 0xff53, Down: 0xff54, Ctrl: 0xffe3, L: 0x006c };
const sym = (ch: string) => { const c = ch.codePointAt(0) || 0; return c < 0x100 ? c : 0x01000000 + c; };

/**
 * The desktop's screen: a noVNC view of the container's X display (Openbox + Chromium), over the ticketed websocket.
 * The remote screen resizes to fit this view (a phone gets a phone-sized desktop, so pages render like a phone browser);
 * "Full desktop" switches it to 1280x800 scaled down. An address bar opens pages in the desktop's browser, and a
 * keyboard bar types into whatever has focus (phones have no physical keys for the canvas).
 */
export default function DesktopScreen({ active, onStatus }: { active: boolean; onStatus?: (s: Status) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<Rfb | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [err, setErr] = useState("");
  const [gen, setGen] = useState(0);
  const [big, setBig] = useState(false);
  const [url, setUrl] = useState("");
  const [opening, setOpening] = useState(false);
  const [kbd, setKbd] = useState(false);
  const [typed, setTyped] = useState("");
  const set = (s: Status) => { setStatus(s); onStatus?.(s); };
  const [started, setStarted] = useState(active);
  useEffect(() => { if (active) setStarted(true); }, [active]);

  useEffect(() => {
    if (!started) return; // connect the first time the tab is shown, then stay connected across tab switches
    let disposed = false;
    (async () => {
      set("connecting"); setErr("");
      let t: { path: string; ticket: string };
      try { t = await api("/api/desktop/ticket"); } catch (e) { set("error"); setErr(friendly(e, "Could not open the desktop.")); return; }
      // The viewer loads on demand. A failed load (an older deploy's chunk, a dropped connection) shows a retry state
      // instead of an unhandled rejection. Keep @novnc/novnc at 1.4.x: 1.5+ ships a top-level await in lib/util/browser.js,
      // which the bundler turns into an async module where `exports` is undefined ("exports is not defined" on phones).
      let RFB: typeof import("@novnc/novnc/lib/rfb").default;
      try { RFB = (await import("@novnc/novnc/lib/rfb")).default; }
      catch (e) {
        const m = (e as Error)?.message || "";
        if (isStale(m)) { hardReload(m); return; }
        reportError("novnc-load", e);
        if (!disposed) { set("error"); setErr("The screen viewer couldn't load. Tap Reconnect."); }
        return;
      }
      if (disposed || !host.current) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const rfb = new RFB(host.current, `${proto}://${location.host}${t.path}?k=vnc&t=${encodeURIComponent(t.ticket)}`, { wsProtocols: ["binary"], shared: true });
      rfb.scaleViewport = true; rfb.resizeSession = true; rfb.background = "#0d0b14"; rfb.qualityLevel = 6; rfb.compressionLevel = 4; rfb.showDotCursor = true;
      rfb.addEventListener("connect", () => { if (!disposed) set("live"); });
      rfb.addEventListener("disconnect", (e) => {
        rfbRef.current = null;
        if (disposed) return;
        const clean = (e as CustomEvent<{ clean: boolean }>).detail?.clean;
        set(clean ? "closed" : "error"); if (!clean) setErr("The screen connection dropped.");
      });
      rfbRef.current = rfb;
    })();
    return () => { disposed = true; try { rfbRef.current?.disconnect(); } catch { /* gone */ } rfbRef.current = null; };
  }, [gen, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const r = rfbRef.current; if (!r || status !== "live") return;
    r.resizeSession = !big;
    if (big) void api("/api/desktop/open", { body: { size: "desktop" } }).catch(() => {});
  }, [big, status]);

  const go = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim() || opening) return;
    setOpening(true); setErr("");
    try { const r = await api<{ url: string }>("/api/desktop/open", { body: { url } }); setUrl(r.url); }
    catch (e2) { setErr(friendly(e2, "Could not open that page.")); }
    finally { setOpening(false); }
  };
  const press = (k: number) => { const r = rfbRef.current; if (!r) return; r.sendKey(k, null, true); r.sendKey(k, null, false); };
  const typeText = (e?: React.FormEvent) => {
    e?.preventDefault();
    const r = rfbRef.current; if (!r || !typed) return;
    for (const ch of [...typed]) press(sym(ch));
    setTyped("");
  };
  const focusAddress = () => { const r = rfbRef.current; if (!r) return; r.sendKey(KEY.Ctrl, "ControlLeft", true); press(KEY.L); r.sendKey(KEY.Ctrl, "ControlLeft", false); };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0d0b14]">
      <form onSubmit={go} className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[#cbbcff]"><Icon name="globe" size={16} /></span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" enterKeyHint="go" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          placeholder="Search or type a web address" aria-label="Web address"
          className="h-9 min-w-0 flex-1 rounded-full bg-white/10 px-3.5 text-[14px] text-white placeholder:text-white/45 outline-none focus:ring-2 focus:ring-[#8b6cff]" />
        <button type="submit" disabled={opening || !url.trim()} className="h-9 shrink-0 rounded-full bg-grape px-3.5 text-[13px] font-bold text-white disabled:opacity-50">{opening ? "…" : "Go"}</button>
      </form>
      <div className="relative min-h-0 flex-1 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
        <div ref={host} data-screen className="absolute inset-0 [&>div]:!bg-transparent" style={{ touchAction: "manipulation" }} />
        {status !== "live" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              {status === "connecting" ? <><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-[3px] border-[#8b6cff]/30 border-t-[#b9a3ff]" /><p className="mt-3 text-[13.5px] text-white/70">Starting the desktop…</p></>
                : <><p className="text-[14px] text-white/80">{err || "The screen is disconnected."}</p><button onClick={() => setGen((g) => g + 1)} className="mt-3 h-9 rounded-full bg-grape px-4 text-[13px] font-bold text-white">Reconnect</button></>}
            </div>
          </div>
        )}
        {status === "live" && err && <p className="absolute inset-x-3 top-3 rounded-xl bg-[#e5484d]/20 px-3 py-2 text-[13px] text-[#ffb4b4]">{err}</p>}
      </div>
      {kbd && (
        <form onSubmit={typeText} className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2">
          <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} enterKeyHint="send" autoCapitalize="off" placeholder="Type into the desktop" aria-label="Type into the desktop"
            className="h-9 min-w-0 flex-1 rounded-full bg-white/10 px-3.5 text-[14px] text-white placeholder:text-white/45 outline-none" />
          <button type="submit" className="h-9 rounded-full bg-white/15 px-3 text-[12.5px] font-bold text-white">Type</button>
          <button type="button" onClick={() => press(KEY.Enter)} className="h-9 rounded-full bg-white/15 px-3 text-[12.5px] font-bold text-white">Enter</button>
          <button type="button" onClick={() => press(KEY.Backspace)} aria-label="Backspace" className="h-9 rounded-full bg-white/15 px-3 text-[12.5px] font-bold text-white">⌫</button>
        </form>
      )}
      <div className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2">
        <button onClick={() => setBig((z) => !z)} aria-pressed={big} className="h-8 rounded-full bg-white/10 px-3 text-[12.5px] font-bold text-white">{big ? "Fit to screen" : "Full desktop"}</button>
        <button onClick={() => setKbd((k) => !k)} aria-pressed={kbd} className={`h-8 rounded-full px-3 text-[12.5px] font-bold ${kbd ? "bg-grape text-white" : "bg-white/10 text-white"}`}>Keyboard</button>
        <button onClick={focusAddress} disabled={status !== "live"} className="h-8 rounded-full bg-white/10 px-3 text-[12.5px] font-bold text-white disabled:opacity-40">Address bar</button>
        <span className="ml-auto text-[11.5px] text-white/45 max-[360px]:hidden">Tap to click</span>
      </div>
    </div>
  );
}
