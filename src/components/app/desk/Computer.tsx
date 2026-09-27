"use client";

import { useEffect, useRef, useState } from "react";
import { IDLE_LINES, type Job } from "@/content/appData";
import { downloadFile, jobNo, progressOf } from "@/lib/store";
import Icon from "../Icon";
import { AgentFace, WhoFace } from "../faces";

const TABS = [
  { id: "live", label: "Live", icon: "spark" },
  { id: "browser", label: "Browser", icon: "globe" },
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "files", label: "Files", icon: "folder" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const SCREEN_FOR_STEP = ["brief", "browser", "terminal", "files"] as const;

function Terminal({ lines, p, host }: { lines: string[]; p: number; host: string }) {
  const shownChars = Math.floor(p * lines.join("").length * 1.05);
  let left = shownChars;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); });
  return (
    <div ref={box} className="no-bar h-full overflow-y-auto font-mono text-[11.5px] leading-[1.95] sm:text-[13px]">
      <div className="text-white/45">{host}@lexari:~$ session open</div>
      {lines.map((l, i) => {
        const s = l.slice(0, Math.max(0, left)); left -= l.length;
        if (!s) return null;
        return <div key={i} className={l.startsWith("$") ? "text-white" : "text-lilac"}>{s}</div>;
      })}
      <span className="caret" />
    </div>
  );
}

function Browser({ job, p }: { job: Job; p: number }) {
  const page = Math.min(3, 1 + Math.floor(p * 6) % 3);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-mono text-[11px] text-white/80 sm:text-[12px]">
        <span className="h-2 w-2 rounded-full bg-lilac live-dot" /><span className="truncate">https://{job.url}/page-{page}</span><span className="ml-auto label text-[8.5px] text-white/55">tab {page}/3</span>
      </div>
      <div className="relative mt-3 flex-1 overflow-hidden rounded-xl bg-white/[.06] p-3 ring-1 ring-white/10 sm:p-4">
        <div className="h-3 w-2/3 rounded-full bg-white/30" />
        <div className="mt-2 h-2 w-1/3 rounded-full bg-white/15" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`rounded-lg p-2 ${i === page - 1 ? "bg-grape" : "bg-white/[.07]"}`}>
              <div className="h-2 w-3/4 rounded-full bg-white/60" />{[0, 1, 2].map((k) => <div key={k} className="mt-1.5 h-1.5 rounded-full bg-white/25" style={{ width: `${88 - k * 18}%` }} />)}
            </div>
          ))}
        </div>
        {[0, 1, 2, 3].map((k) => <div key={k} className="mt-2.5 h-1.5 rounded-full bg-white/15" style={{ width: `${95 - k * 12}%` }} />)}
        <div className="scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-grape/35 to-transparent" />
        <span className="label pop absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-1 text-[9px] text-[#0a0a0a]">reading page {page} of 3</span>
      </div>
    </div>
  );
}

function Files({ job, done }: { job: Job; done: boolean }) {
  return (
    <div>
      <div className="label text-[9px] text-white/55">~/output · job {jobNo(job.id)}</div>
      <div className="mt-3 grid gap-2">
        {job.files.map((f, i) => (
          <div key={f.name} className="pop flex items-center gap-3 rounded-xl bg-white/[.07] px-3 py-2.5 ring-1 ring-white/10" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="grid h-8 w-7 place-items-center rounded-md bg-grape text-[9px] font-bold uppercase text-white">{f.name.split(".").pop()}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-white sm:text-[13px]">{f.name}</span>
            <span className="text-[11px] text-white/60">{done ? f.size : "writing…"}</span>
            <button disabled={!done} onClick={() => downloadFile(f.name, f.body)} aria-label={`Download ${f.name}`} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-grape disabled:opacity-30"><Icon name="download" size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Computer({ job, now, look, host }: { job: Job | undefined; now: number; look: number | null; host: string }) {
  const [tab, setTab] = useState<Tab>("live");
  const running = job?.status === "running";
  const p = job ? progressOf(job, now) : 0;
  const step = running ? Math.min(3, Math.floor(p * 4)) : 3;
  const screen = !job ? "idle" : tab === "live" ? (running ? SCREEN_FOR_STEP[step] : "files") : tab;
  const clock = now ? new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--:--";

  return (
    <div>
      <div className="rounded-[26px] bg-frame p-2.5 shadow-[0_24px_0_-10px_var(--tint),0_40px_80px_-30px_var(--glow)] ring-1 ring-line sm:rounded-[32px] sm:p-3">
        <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 sm:px-2">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-grape" /><i className="h-2.5 w-2.5 rounded-full bg-lilac" /><i className="h-2.5 w-2.5 rounded-full bg-white/60" /></span>
          <div className="no-bar ml-2 flex gap-1 overflow-x-auto" role="tablist" aria-label="Computer view">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold transition ${tab === t.id ? "bg-white text-[#0a0a0a]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                <Icon name={t.icon} size={13} />{t.label}
              </button>
            ))}
          </div>
          <span className="label ml-auto hidden text-[9px] text-lilac sm:inline">{clock}</span>
        </div>
        <div className="relative h-[250px] overflow-hidden rounded-[18px] bg-[#07050e] p-4 sm:h-[340px] sm:rounded-[22px] sm:p-5">
          {screen === "idle" && (
            <div className="grid h-full grid-rows-[1fr_auto]">
              <Terminal lines={IDLE_LINES} p={1} host={host} />
              <div className="flex items-center gap-3 rounded-xl bg-white/[.06] p-3 ring-1 ring-white/10"><span className="bob"><AgentFace look={look} size={40} /></span><p className="text-[13px] text-white/80">Computer is on. Waiting for a job.</p></div>
            </div>
          )}
          {job && screen === "brief" && (
            <div key={job.id}>
              <div className="pop ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-grape p-3 text-[13px] font-semibold text-white sm:text-[15px]">{job.prompt}</div>
              <div className="pop mt-3 flex items-end gap-2" style={{ animationDelay: ".35s" }}><WhoFace who={job.assignee} look={look} size={40} /><div className="max-w-[75%] rounded-2xl rounded-bl-md bg-white/10 p-3 text-[13px] text-white sm:text-[15px]">Reading the brief. Planning 4 steps.</div></div>
              <div className="mt-5 grid gap-1.5">{job.steps.map((s, i) => <div key={s} className="flex items-center gap-2 text-[12px] text-white/70"><span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-lilac live-dot" : "bg-white/25"}`} />{s}</div>)}</div>
            </div>
          )}
          {job && screen === "browser" && <Browser job={job} p={p} />}
          {job && screen === "terminal" && <Terminal lines={job.terminal} p={running ? Math.max(0, (p - 0.4) / 0.45) : 1} host={host} />}
          {job && screen === "files" && <Files job={job} done={!running || p > 0.97} />}
          {running && <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-lilac transition-[width] duration-300" style={{ width: `${p * 100}%` }} /></div>}
        </div>
      </div>
      <div className="mx-auto h-4 w-24 bg-frame sm:h-6" /><div className="mx-auto h-2.5 w-44 rounded-full bg-frame" />
    </div>
  );
}
