"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import type { State } from "@/lib/store";
import { api, friendly } from "@/lib/api";
import Icon from "../Icon";
import { nameOf } from "../agents";

type Entry = { name: string; dir: boolean; size: number; mtime: number };
const HOME = "/home/agent";
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);

/** The agent's real computer: a live terminal into your own locked-down container, plus its files. */
export default function DesktopPane({ s, id, onClose }: { s: State; id: string; onClose: () => void; full?: boolean }) {
  const name = nameOf(s, id);
  const [tab, setTab] = useState<"terminal" | "files">("terminal");
  const [status, setStatus] = useState<"connecting" | "live" | "closed" | "error">("connecting");
  const [err, setErr] = useState("");
  const [path, setPath] = useState(HOME);
  const [files, setFiles] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState<{ name: string; text: string } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [gen, setGen] = useState(0);

  const loadFiles = useCallback(async (p = path) => {
    try { const r = await api<{ entries: Entry[] }>(`/api/desktop/files?path=${encodeURIComponent(p)}`); setFiles(r.entries); setPath(p); }
    catch (e) { setFiles([]); setErr(friendly(e, "Could not list files.")); }
  }, [path]);

  useEffect(() => {
    let disposed = false;
    let term: import("@xterm/xterm").Terminal | null = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !host.current) return;
      const small = window.matchMedia("(max-width: 430px)").matches;
      term = new Terminal({ fontSize: small ? 12 : 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", cursorBlink: true, convertEol: false,
        theme: { background: "#0d0b14", foreground: "#e9e4ff", cursor: "#b9a3ff", selectionBackground: "#5b2bff66" } });
      const fit = new FitAddon(); term.loadAddon(fit); term.open(host.current); fit.fit();
      setStatus("connecting"); setErr("");
      let t: { path: string; ticket: string };
      try { t = await api("/api/desktop/ticket"); } catch (e) { setStatus("error"); setErr(friendly(e, "Could not open the desktop.")); return; }
      if (disposed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}${t.path}?t=${encodeURIComponent(t.ticket)}&c=${term.cols}&r=${term.rows}`);
      wsRef.current = ws;
      ws.onopen = () => { if (!disposed) setStatus("live"); };
      ws.onclose = () => { if (!disposed) setStatus((st) => (st === "error" ? st : "closed")); };
      ws.onerror = () => { if (!disposed) { setStatus("error"); setErr("The connection to the desktop dropped."); } };
      ws.onmessage = (ev) => {
        let m: { t: string; d?: string; cmd?: string; out?: string };
        try { m = JSON.parse(String(ev.data)); } catch { return; }
        if (m.t === "out" && m.d) term?.write(m.d);
        else if (m.t === "agent" && m.cmd) term?.write(`\r\n\x1b[38;5;141m● ${name} ran:\x1b[0m ${m.cmd}\r\n`);
        else if (m.t === "agentOut") { term?.write(`${(m.out || "").replace(/\n/g, "\r\n")}\x1b[38;5;141m● done\x1b[0m\r\n`); void loadFiles(); }
      };
      term.onData((d) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "in", d })); });
      ro = new ResizeObserver(() => { try { fit.fit(); if (ws.readyState === WebSocket.OPEN && term) ws.send(JSON.stringify({ t: "resize", c: term.cols, r: term.rows })); } catch { /* hidden */ } });
      ro.observe(host.current);
      if (!small) term.focus();
    })();
    return () => { disposed = true; ro?.disconnect(); wsRef.current?.close(); wsRef.current = null; term?.dispose(); };
  }, [gen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === "files") void loadFiles(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = async (f: Entry) => {
    const full = `${path}/${f.name}`;
    if (f.dir) { setOpen(null); void loadFiles(full); return; }
    try { const r = await api<{ text: string }>(`/api/desktop/files?read=${encodeURIComponent(full)}`); setOpen({ name: f.name, text: r.text }); } catch (e) { setErr(friendly(e)); }
  };

  const dot = status === "live" ? "bg-[#2fd27a]" : status === "connecting" ? "bg-[#ffb020]" : "bg-[#e5484d]";
  return (
    <aside aria-label={`${name}'s desktop`} className="flex h-full min-h-0 flex-col border-l border-line bg-alt">
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-line px-4 max-[430px]:h-[54px] max-[430px]:px-3">
        <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-grape text-white max-[430px]:h-9 max-[430px]:w-9"><Icon name="monitor" size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold text-ink">{name}&apos;s computer</h2>
          <p className="flex items-center gap-1.5 truncate text-[12.5px] text-ink/60"><i className={`h-1.5 w-1.5 rounded-full ${dot}`} />{status === "live" ? "Live · Linux, no internet · /home/agent" : status === "connecting" ? "Starting…" : status === "closed" ? "Disconnected" : "Not available"}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 hover:bg-tint"><Icon name="x" size={19} /></button>
      </header>
      <div role="tablist" className="flex gap-1 border-b border-line px-3 py-2">
        {(["terminal", "files"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-8 rounded-full px-3.5 text-[13px] font-bold capitalize ${tab === t ? "bg-grape text-white" : "text-ink/65 hover:bg-tint"}`}>{t}</button>)}
        {(status === "closed" || status === "error") && <button onClick={() => setGen((g) => g + 1)} className="ml-auto h-8 rounded-full bg-tint px-3.5 text-[13px] font-bold text-brand-ink">Reconnect</button>}
      </div>
      <div className={`relative min-h-0 flex-1 bg-[#0d0b14] p-2 ${tab === "terminal" ? "" : "hidden"}`}>
        <div ref={host} className="h-full w-full" data-terminal />
        {err && status === "error" && <p className="absolute inset-x-3 top-3 rounded-xl bg-[#e5484d]/15 px-3 py-2 text-[13px] text-[#ffb4b4]">{err}</p>}
      </div>
      {tab === "files" && (
        <div className="no-bar min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex items-center gap-2 text-[12.5px] text-ink/60">
            {path !== HOME && <button onClick={() => { setOpen(null); void loadFiles(path.split("/").slice(0, -1).join("/") || HOME); }} className="rounded-full bg-tint px-2.5 py-1 font-bold text-brand-ink">Up</button>}
            <span className="truncate font-mono">{path}</span>
            <button onClick={() => void loadFiles()} className="ml-auto rounded-full bg-tint px-2.5 py-1 font-bold text-brand-ink">Refresh</button>
          </div>
          {open ? (
            <div className="mt-3 rounded-2xl bg-card ring-1 ring-line">
              <div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="truncate font-mono text-[13px] font-bold text-ink">{open.name}</span><button onClick={() => setOpen(null)} className="text-[12.5px] font-bold text-brand-ink">Close</button></div>
              <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap p-3 font-mono text-[12.5px] text-ink">{open.text || "(empty)"}</pre>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--line)] rounded-2xl bg-card ring-1 ring-line">
              {files === null ? <li className="p-3 text-[13px] text-ink/60">Loading…</li> : !files.length ? <li className="p-3 text-[13px] text-ink/60">No files yet.</li> : files.map((f) => (
                <li key={f.name}><button onClick={() => void openFile(f)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-tint text-brand-ink"><Icon name={f.dir ? "folder" : "file"} size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{f.name}</span><span className="block text-[12px] text-ink/55">{f.dir ? "Folder" : kb(f.size)} · {new Date(f.mtime).toLocaleString()}</span></span>
                </button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
