"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { Sheet, Spinner } from "../billing/parts";

type Report = { host?: string; os?: string; cpus?: number; installed?: boolean; running?: boolean; threads?: number; hashrate?: number; hashes?: number; best?: number; load?: number | null; minerSince?: number | null };
type Host = { id: string; name: string; status: "waiting" | "online" | "offline"; lastSeen: number | null; report: Report | null; installing: boolean; commands: { id: number; cmd: string; state: string; output: string | null; at: number }[] };

const fmt = (n?: number) => (n || 0).toLocaleString("en-US");
const rate = (n?: number) => (!n ? "0 H/s" : n >= 1e6 ? `${(n / 1e6).toFixed(2)} MH/s` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} kH/s` : `${n} H/s`);

export function useHosts(on: boolean, every = 5000) {
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const load = useCallback(() => api<{ hosts: Host[] }>("/api/miner/hosts").then((r) => setHosts(r.hosts)).catch(() => {}), []);
  useEffect(() => { void load(); if (!on) return; const t = setInterval(load, every); return () => clearInterval(t); }, [load, on, every]);
  return { hosts, load };
}

/** In the ORE Miner's panel: your own servers. Opens the Mining sheet. */
export default function MinerRow() {
  const [open, setOpen] = useState(false);
  const { hosts } = useHosts(false);
  const live = hosts?.filter((h) => h.status === "online") || [];
  const mining = live.filter((h) => h.report?.running);
  return (
    <>
      <button type="button" data-miner-row onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left ring-1 ring-line transition hover:ring-grape/60">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#1a1206] text-[#f5a524]"><Icon name="server" size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">Mining{mining.length > 0 && <span className="rounded-full bg-[#e7f8ee] px-1.5 py-0.5 text-[10px] font-bold text-[#137a3d]">{rate(mining.reduce((n, h) => n + (h.report?.hashrate || 0), 0))}</span>}</span>
          <span className="block text-[12.5px] leading-snug text-ink/60">{!hosts?.length ? "Connect a server you own. Nothing mines on Lexari." : `${hosts.length} server${hosts.length === 1 ? "" : "s"} · ${live.length} online · ${mining.length} mining`}</span>
        </span>
        <Icon name="right" size={16} className="shrink-0 text-ink/35" />
      </button>
      {open && <MinerSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function MinerSheet({ onClose }: { onClose: () => void }) {
  const { hosts, load } = useHosts(true, 4000);
  const [connect, setConnect] = useState<{ id: string; command: string } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const pending = connect ? hosts?.find((h) => h.id === connect.id) : null;
  useEffect(() => { if (pending && pending.status !== "waiting") { toast({ text: `${pending.name} connected` }); setConnect(null); } }, [pending]);
  const start = async (id?: string) => {
    setBusy("connect");
    try { const r = await api<{ id: string; command: string }>("/api/miner/hosts", { body: { op: "connect", name: name || undefined, ...(id ? { id } : {}) } }); setConnect(r); void load(); }
    catch (e) { toast({ text: friendly(e, "Couldn't make an install line.") }); }
    finally { setBusy(""); }
  };
  const cmd = async (h: Host, c: "start" | "stop" | "status" | "install") => {
    setBusy(`${h.id}:${c}`);
    try { await api("/api/miner/hosts", { body: { op: "command", id: h.id, cmd: c } }); toast({ text: `${c === "start" ? "Starting" : c === "stop" ? "Stopping" : "Checking"} on ${h.name}` }); setTimeout(load, 2500); }
    catch (e) { toast({ text: friendly(e, "That didn't go through.") }); }
    finally { setBusy(""); }
  };
  const remove = async (h: Host) => {
    setBusy(`${h.id}:remove`);
    try { await api("/api/miner/hosts", { body: { op: "remove", id: h.id } }); toast({ text: `${h.name} removed. Its agent uninstalls itself.` }); void load(); }
    catch (e) { toast({ text: friendly(e, "Couldn't remove it.") }); }
    finally { setBusy(""); }
  };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t); toast({ text: "Copied" }); };
  return (
    <Sheet label="mining" title="Mining" sub="Your own servers. The ORE Miner installs, runs and watches the miner there." icon={<Icon name="server" size={20} />} onClose={onClose}>
      <div className="mb-3 flex items-start gap-2 rounded-2xl bg-[#fff4d6] px-3 py-2.5 text-[12.5px] leading-snug text-[#7a5200]">
        <Icon name="info" size={15} className="mt-px shrink-0" />
        <span>Devnet practice mode: real hashing on your CPU, real hashrate. ORE rewards are on mainnet, so none are earned here.</span>
      </div>
      {hosts === null ? <div className="grid h-24 place-items-center"><Spinner /></div> : (
        <div className="space-y-2.5">
          {hosts.filter((h) => h.status !== "waiting" || h.id === connect?.id).map((h) => <HostTile key={h.id} h={h} busy={busy} onCmd={cmd} onRemove={remove} />)}
        </div>
      )}
      {connect ? (
        <div data-miner-connect className="mt-3 rounded-2xl p-3.5 ring-1 ring-grape/40">
          <div className="text-[14px] font-bold text-ink">Run this on your server</div>
          <p className="mt-0.5 text-[12.5px] text-ink/60">Linux or macOS with python3. Runs as your user, no root. Works once, for 30 minutes.</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#14121f] p-2.5">
            <code data-miner-cmd className="no-bar min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-[#d6ccff]">{connect.command}</code>
            <button type="button" aria-label="Copy" onClick={() => copy(connect.command)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white"><Icon name="copy" size={15} /></button>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-ink/60"><Spinner className="!h-3.5 !w-3.5" />Waiting for your server to connect…</div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Server name" aria-label="Server name" className="h-11 min-w-0 flex-1 rounded-full bg-tint px-4 text-[14px] text-ink outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-grape/40" />
          <button type="button" data-miner-add onClick={() => start()} disabled={busy === "connect"} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-grape px-4 text-[14px] font-bold text-white disabled:opacity-50">{busy === "connect" ? <Spinner /> : <Icon name="plus" size={16} />}Connect</button>
        </div>
      )}
    </Sheet>
  );
}

function HostTile({ h, busy, onCmd, onRemove }: { h: Host; busy: string; onCmd: (h: Host, c: "start" | "stop" | "status" | "install") => void; onRemove: (h: Host) => void }) {
  const r = h.report;
  const run = !!r?.running && h.status === "online";
  const dot = h.status === "online" ? (run ? "bg-[#22c55e] animate-pulse" : "bg-[#3b6cf0]") : h.status === "offline" ? "bg-[#e5484d]" : "bg-[#e0a100]";
  const last = h.commands[0];
  const ib = "grid h-9 w-9 place-items-center rounded-full disabled:opacity-40";
  return (
    <div data-miner-host={h.status} className="rounded-2xl p-3 ring-1 ring-line">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-tint text-ink"><Icon name="server" size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-ink"><i className={`h-2 w-2 rounded-full ${dot}`} /><span className="truncate">{h.name}</span></div>
          <div className="truncate text-[11.5px] text-ink/55">{h.status === "waiting" ? "Waiting for the install line" : h.status === "offline" ? "Offline · agent not checking in" : `${r?.host || "server"} · ${r?.cpus || "?"} CPUs${r?.load != null ? ` · load ${r.load.toFixed(2)}` : ""}`}</div>
        </div>
        {h.status === "online" && (run
          ? <button type="button" aria-label="Stop miner" disabled={!!busy} onClick={() => onCmd(h, "stop")} className={`${ib} bg-[#ffe9e9] text-[#c4373b]`}><Icon name="stop" size={15} /></button>
          : <button type="button" aria-label="Start miner" data-miner-start disabled={!!busy} onClick={() => onCmd(h, "start")} className={`${ib} bg-[#e7f8ee] text-[#137a3d]`}><Icon name="play" size={15} /></button>)}
        {h.status !== "waiting" && <button type="button" aria-label="Remove server" disabled={!!busy} onClick={() => onRemove(h)} className={`${ib} text-ink/45 hover:bg-tint`}><Icon name="trash" size={15} /></button>}
      </div>
      {h.status !== "waiting" && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <Stat k="Hashrate" v={run ? rate(r?.hashrate) : "Stopped"} />
          <Stat k="Best diff" v={fmt(r?.best)} />
          <Stat k="Threads" v={run ? String(r?.threads || 0) : "–"} />
        </div>
      )}
      {last && <div className="mt-2 truncate text-[11.5px] text-ink/50">{last.cmd}: {last.state === "done" ? last.output : last.state === "failed" ? `failed · ${last.output}` : "waiting for the server…"}</div>}
    </div>
  );
}
const Stat = ({ k, v }: { k: string; v: string }) => <div className="rounded-xl bg-tint/60 px-2 py-1.5"><div className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{k}</div><div className="truncate text-[13px] font-bold tabular-nums text-ink">{v}</div></div>;
