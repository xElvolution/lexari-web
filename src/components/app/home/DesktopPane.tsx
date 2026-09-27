"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { desktopFor, type DesktopScript } from "@/content/appData";
import { agentName, downloadFile, groupOf, isGroup, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { myAgents, nameOf } from "../agents";
import VpsTerminal, { type Step } from "./VpsTerminal";

const TABS = [{ id: "desktop", label: "Desktop", icon: "monitor" }, { id: "terminal", label: "Terminal", icon: "terminal" }, { id: "files", label: "Files", icon: "folder" }] as const;
type Tab = (typeof TABS)[number]["id"];

function vps(s: State, id: string) {
  const seat = Math.max(1, myAgents(s).findIndex((a) => a.id === id) + 1);
  const handle = nameOf(s, id).toLowerCase().replace(/[^a-z0-9]/g, "") || "agent";
  const host = `lexari-vps-${String(seat).padStart(2, "0")}`;
  return { seat, handle, host, ip: `203.0.113.${20 + seat * 7}`, uptime: `${9 + seat * 3} days, ${String(2 + seat).padStart(2, "0")}:1${seat}` };
}
const stamp = (mins: number) => { const d = new Date(Date.now() - mins * 6e4); return `${d.toLocaleDateString("en-US", { month: "short" })} ${String(d.getDate()).padStart(2, " ")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`; };

function scriptFor(d: DesktopScript, handle: string): Step[] {
  const py = d.kind === "sheet" ? "clean_sheet.py" : d.kind === "doc" ? "draft.py" : "scrape.py";
  return [
    { cmd: "apt update -qq && apt install -y -qq jq", out: ["Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease", "Reading package lists... Done", "jq is already the newest version (1.7.1)."] },
    { cmd: "ls -la ~/work", out: ["total 24", `drwxr-xr-x 4 root root 4096 ${stamp(9)} .`, `-rw-r--r-- 1 root root 2210 ${stamp(8)} brief.md`, `-rwxr-xr-x 1 root root 1893 ${stamp(7)} ${py}`, `drwxr-xr-x 2 root root 4096 ${stamp(1)} output`] },
    { cmd: `curl -sI https://${d.url} | head -1`, out: ["HTTP/2 200"] },
    { cmd: `python3 ${py} --out output/`, out: [`[1/3] ${d.steps[1].toLowerCase()} ... ok (212 ms)`, `[2/3] ${d.steps[2].toLowerCase()} ... ok (188 ms)`, `[3/3] ${d.steps[3].toLowerCase()} ... ok (240 ms)`, ...d.files.map((f) => `wrote output/${f.name} (${f.size})`)] },
    { cmd: "tail -n 3 /var/log/lexari/agent.log", out: [`${stamp(2).slice(-5)}:07 INFO  task started: "${d.title.toLowerCase()}"`, `${stamp(1).slice(-5)}:19 INFO  ${d.files.length} file(s) saved`, `${stamp(0).slice(-5)}:02 INFO  agent ${handle} idle, waiting for next message`] },
    { cmd: "top -bn1 | head -2", out: ["CPU[||||||||        38.2%]  Mem[|||||      1.9G/4.0G]  Swp[          0K/1.0G]", "Tasks: 42, 1 running   Load average: 0.42 0.37 0.30"] },
  ];
}

function Meter({ label, v, text }: { label: string; v: number; text: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 font-mono text-[10px]"><span className="text-ink/55">{label}</span><span className="tab-num text-ink/80">{text}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-grape transition-[width] duration-700" style={{ width: `${v}%` }} /></div>
    </div>
  );
}

function Win({ title, icon, front, className, children }: { title: string; icon: string; front: boolean; className: string; children: React.ReactNode }) {
  return (
    <div className={`absolute flex flex-col overflow-hidden rounded-lg bg-[#15121f] shadow-[0_18px_40px_-12px_rgba(0,0,0,.7)] ring-1 transition-[box-shadow] duration-300 ${front ? "z-20 ring-lilac/50" : "z-10 ring-white/10"} ${className}`}>
      <div className={`flex h-6 shrink-0 items-center gap-1.5 px-2 text-[9.5px] font-semibold ${front ? "bg-[#231d36] text-white" : "bg-[#1b1729] text-white/55"}`}>
        <Icon name={icon} size={10} /><span className="truncate">{title}</span>
        <span className="ml-auto flex gap-1"><i className="h-2 w-2 rounded-full bg-white/25" /><i className="h-2 w-2 rounded-full bg-white/25" /><i className={`h-2 w-2 rounded-full ${front ? "bg-lilac" : "bg-white/25"}`} /></span>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

function LinuxDesktop({ d, v, step, who }: { d: DesktopScript; v: ReturnType<typeof vps>; step: number; who: string }) {
  const front = step % 3;
  const clock = new Date().toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const cur = d.steps[step % d.steps.length];
  const tail = scriptFor(d, v.handle).flatMap((s) => [`# ${s.cmd}`, ...s.out]).slice(0, 4 + (step % 12));
  return (
    <div className="relative h-full min-h-[340px] overflow-hidden rounded-[14px] bg-[radial-gradient(120%_90%_at_70%_20%,#3b1fb8_0%,#1a0f45_45%,#07050e_100%)] font-sans">
      {/* top panel */}
      <div className="absolute inset-x-0 top-0 z-30 flex h-6 items-center justify-between bg-black/70 px-2.5 text-[10px] font-semibold text-white/85">
        <span>Activities</span><span suppressHydrationWarning>{clock}</span>
        <span className="flex items-center gap-1.5 text-white/70"><Icon name="globe" size={10} /><Icon name="speaker" size={10} /><i className="h-2 w-3.5 rounded-[2px] border border-white/60" /></span>
      </div>
      {/* dock */}
      <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-1.5 rounded-2xl bg-black/45 p-1.5 ring-1 ring-white/10 backdrop-blur">
        {["globe", "folder", "terminal", "file", "settings"].map((ic, i) => <span key={ic} className={`relative grid h-7 w-7 place-items-center rounded-lg ${i === front || (i === 2 && front === 2) ? "bg-grape text-white" : "bg-white/10 text-white/75"}`}><Icon name={ic} size={14} />{i < 3 && <i className="absolute -bottom-1 h-1 w-1 rounded-full bg-white/70" />}</span>)}
      </div>
      {/* wallpaper mark */}
      <span className="absolute bottom-16 right-5 font-mono text-[9px] text-white/25">{v.host}</span>
      {/* windows */}
      <Win title={`${d.title} · Browser`} icon="globe" front={front === 0} className="left-[4%] top-[12%] h-[54%] w-[66%]">
        <div className="flex h-full flex-col bg-[#0d0a17] p-2">
          <div className="flex items-center gap-1.5 rounded-md bg-white/[.08] px-2 py-1 font-mono text-[9px] text-white/75"><Icon name="globe" size={9} className="text-lilac" /><span className="truncate">https://{d.url}</span></div>
          <div className="relative mt-2 flex-1 overflow-hidden rounded-md bg-white/[.04] p-2">
            <div className="h-2 w-1/2 rounded-full bg-white/50" /><div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-white/20" />
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className={`rounded p-1.5 transition-colors duration-500 ${i === step % 3 ? "bg-grape" : "bg-white/[.07]"}`}><div className="h-1.5 w-3/4 rounded-full bg-white/60" /><div className="mt-1 h-1 rounded-full bg-white/25" /><div className="mt-1 h-1 w-2/3 rounded-full bg-white/25" /></div>)}</div>
            {[92, 80, 86].map((w, k) => <div key={k} className="mt-1.5 h-1 rounded-full bg-white/15" style={{ width: `${w}%` }} />)}
            <div className="scan pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-grape/30 to-transparent" />
          </div>
        </div>
      </Win>
      <Win title="Files · /root/output" icon="folder" front={front === 1} className="right-[3%] top-[30%] h-[46%] w-[52%]">
        <div className="flex h-full bg-[#0d0a17]">
          <div className="w-[34%] shrink-0 space-y-1 border-r border-white/10 p-1.5 text-[8.5px] text-white/55">{["Home", "Documents", "Downloads", "output"].map((f) => <div key={f} className={`truncate rounded px-1 py-0.5 ${f === "output" ? "bg-grape/60 text-white" : ""}`}>{f}</div>)}</div>
          <div className="grid flex-1 grid-cols-3 content-start gap-1.5 p-2">{[...d.files.map((f) => f.name), "brief.md", "logs"].slice(0, 6).map((f, i) => <div key={f} className="flex min-w-0 flex-col items-center gap-0.5"><span className={`grid h-6 w-5 place-items-center rounded-sm text-[6px] font-bold uppercase text-white ${f === "logs" ? "bg-white/25" : i === step % 3 ? "bg-lilac text-[#0a0a0a]" : "bg-grape"}`}>{f.includes(".") ? f.split(".").pop() : ""}</span><span className="w-full truncate text-center text-[7.5px] text-white/70">{f}</span></div>)}</div>
        </div>
      </Win>
      <Win title={`root@${v.host}: ~`} icon="terminal" front={front === 2} className="bottom-[16%] left-[8%] h-[34%] w-[50%]">
        <div className="no-bar h-full overflow-hidden bg-[#07050e] p-1.5 font-mono text-[8px] leading-[1.55] text-white/75">
          {tail.slice(-7).map((l, i) => <div key={i} className="truncate">{l.startsWith("# ") ? <><span className="text-[#c9b8ff]">root@{v.host}</span>:~# <span className="text-white">{l.slice(2)}</span></> : l}</div>)}
          <span className="term-caret !h-[1em]" />
        </div>
      </Win>
      {/* notification */}
      <div key={step} className="pop absolute right-2.5 top-8 z-30 flex max-w-[60%] items-center gap-2 rounded-xl bg-black/70 px-2.5 py-1.5 text-[10px] text-white ring-1 ring-white/10 backdrop-blur">
        <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-lilac live-dot" /><span className="truncate"><b>{who}</b> · {cur}</span>
      </div>
      <svg className="cursor-path pointer-events-none absolute z-40 h-4 w-4 drop-shadow" viewBox="0 0 24 24" aria-hidden><path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.5" strokeLinejoin="round" /></svg>
    </div>
  );
}

function FileManager({ d, who, host }: { d: DesktopScript; who: string; host: string }) {
  const rows = [
    ...d.files.map((f, i) => ({ name: f.name, size: f.size, when: stamp(1 + i), kind: f.name.split(".").pop() ?? "" })),
    { name: "brief.md", size: "2 KB", when: stamp(8), kind: "md" },
    { name: "logs", size: "—", when: stamp(0), kind: "dir" },
  ];
  return (
    <div className="flex h-full min-h-[320px] overflow-hidden rounded-[14px] bg-[#0d0a17] text-white ring-1 ring-white/10">
      <nav className="hidden w-[150px] shrink-0 space-y-0.5 border-r border-white/10 p-2.5 text-[12.5px] sm:block">
        <div className="label px-2 pb-1.5 text-[8.5px] text-white/40">Places</div>
        {[["user", "Home"], ["monitor", "Desktop"], ["file", "Documents"], ["download", "Downloads"], ["folder", "output"], ["trash", "Trash"]].map(([ic, n]) => <div key={n} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${n === "output" ? "bg-grape text-white" : "text-white/65"}`}><Icon name={ic} size={14} />{n}</div>)}
        <div className="label px-2 pb-1 pt-4 text-[8.5px] text-white/40">Disk</div>
        <div className="px-2"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[38%] rounded-full bg-lilac" /></div><div className="mt-1 text-[10.5px] text-white/50">15 of 40 GB</div></div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 font-mono text-[11px] text-white/70"><Icon name="left" size={13} /><Icon name="right" size={13} className="text-white/30" /><span className="ml-1 truncate rounded-md bg-white/[.07] px-2 py-1">{host}:/root/output</span></div>
        <div className="grid grid-cols-[1fr_64px_96px_32px] gap-2 border-b border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40"><span>Name</span><span>Size</span><span>Modified</span><span /></div>
        <ul className="no-bar min-h-0 flex-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.name} className="grid grid-cols-[1fr_64px_96px_32px] items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-white/[.05]">
              <span className="flex min-w-0 items-center gap-2"><span className={`grid h-6 w-5 shrink-0 place-items-center rounded-sm text-[7px] font-bold uppercase ${r.kind === "dir" ? "bg-white/20" : "bg-grape"}`}>{r.kind === "dir" ? "" : r.kind}</span><span className="truncate font-mono text-[12px]">{r.name}</span></span>
              <span className="text-[11.5px] text-white/55">{r.size}</span>
              <span className="truncate font-mono text-[10.5px] text-white/45">{r.when}</span>
              {r.kind !== "dir" ? <button onClick={() => downloadFile(r.name, `${r.name}\nDemo file from ${who}'s server.\n`)} aria-label={`Download ${r.name}`} className="grid h-7 w-7 place-items-center rounded-full text-white/70 hover:bg-grape hover:text-white"><Icon name="download" size={14} /></button> : <span />}
            </li>
          ))}
        </ul>
        <div className="border-t border-white/10 px-3 py-1.5 text-[10.5px] text-white/40">{rows.length} items · demo files</div>
      </div>
    </div>
  );
}

/** Each agent's own cloud machine, seen through a remote-desktop window. Demo only: nothing here is a real server. */
export default function DesktopPane({ s, id, onClose, full = false }: { s: State; id: string; onClose: () => void; full?: boolean }) {
  const members = isGroup(id) ? groupOf(s, id)?.members ?? ["home"] : [id];
  const [who, setWho] = useState(members[0]);
  const [tab, setTab] = useState<Tab>("desktop");
  const [step, setStep] = useState(0);
  const root = useRef<HTMLElement>(null);
  const name = nameOf(s, who);
  const d = desktopFor(who, agentName(s));
  const v = vps(s, who);
  const script = useMemo(() => scriptFor(d, v.handle), [who]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setWho(members[0]); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setStep(0); const t = setInterval(() => setStep((x) => x + 1), 2600); return () => clearInterval(t); }, [who]);
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(root.current, { opacity: 0, x: full ? 0 : 24, y: full ? 16 : 0 }, { opacity: 1, x: 0, y: 0, duration: 0.35, ease: "power3.out", clearProps: "transform" });
  }, [full]);
  const cpu = 24 + ((step * 37 + v.seat * 11) % 38), ram = 44 + ((step * 13) % 9);

  return (
    <aside ref={root} data-tour="pane" aria-label={`${name}'s remote desktop`} className={`flex h-full min-h-0 flex-col bg-alt ${full ? "" : "border-l border-line"}`}>
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-line px-4">
        <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-grape text-white"><Icon name="monitor" size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold text-ink">{name}&apos;s computer</h2>
          <p className="truncate text-[12.5px] text-ink/60">Remote desktop · Ubuntu 24.04 · demo</p>
        </div>
        <span className="label hidden rounded-full border border-dashed border-ink/35 px-2 py-1 text-[8.5px] text-ink/70 sm:inline">Demo</span>
        <button onClick={onClose} aria-label="Close desktop" data-tour="pane-close" className="grid h-10 w-10 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-ink"><Icon name={full ? "back" : "x"} size={19} /></button>
      </header>
      {members.length > 1 && (
        <div className="no-bar flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2">
          {members.map((m) => (
            <button key={m} onClick={() => setWho(m)} aria-pressed={who === m} className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold transition ${who === m ? "bg-grape text-white" : "bg-card text-ink/75 ring-1 ring-line hover:text-ink"}`}>
              <AgentTile id={m} look={s.agent?.look} size={24} radius={12} />{nameOf(s, m)}
            </button>
          ))}
        </div>
      )}
      {/* connection bar */}
      <div className="shrink-0 border-b border-line px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-brand-ink"><i className="h-2 w-2 rounded-full bg-grape live-dot" />Connected</span>
          <span className="text-ink">{v.handle}@{v.host}</span>
          <span className="text-ink/50">{v.ip}</span>
          <span className="text-ink/50">up {v.uptime.split(",")[0]}</span>
          <span className="ml-auto text-ink/40">VNC · TLS · 38 ms</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Meter label="CPU" v={cpu} text={`${cpu}%`} />
          <Meter label="RAM" v={ram} text={`${(ram / 25).toFixed(1)}/4G`} />
          <Meter label="Disk" v={38} text="15/40G" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 px-3 pt-2.5" role="tablist" aria-label="Remote desktop view">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${tab === t.id ? "bg-ink text-[var(--bg)]" : "text-ink/65 hover:bg-tint hover:text-ink"}`}><Icon name={t.icon} size={14} />{t.label}</button>)}
        <span className="label ml-auto text-[8.5px] text-ink/40">1280×800</span>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <div className="h-full rounded-[18px] bg-frame p-1.5 ring-1 ring-line">
          {tab === "desktop" && <LinuxDesktop d={d} v={v} step={step} who={name} />}
          {tab === "terminal" && <div className="h-full min-h-[320px] overflow-hidden rounded-[14px]"><VpsTerminal key={who} host={v.host} agent={name} ip={v.ip} uptime={v.uptime} script={script} files={d.files.map((f) => f.name)} /></div>}
          {tab === "files" && <FileManager d={d} who={name} host={v.host} />}
        </div>
      </div>
      <p className="label shrink-0 px-4 pb-3 text-center text-[8.5px] text-ink/40">Demo view · no real server is running</p>
    </aside>
  );
}
