"use client";

import { useState } from "react";
import { closeTasks, useAgentTasks, useTasksSheet } from "@/lib/tasks";
import { useApp, useNow } from "@/lib/store";
import { nameOf } from "../agents";
import { AgentTile } from "../faces";
import Icon from "../Icon";
import { Sheet } from "../billing/parts";
import { TaskRow } from "./TaskCards";

/** Mounted once in the app shell: an agent's meetings, background jobs and schedules. */
export default function TasksSheetHost() {
  const open = useTasksSheet();
  return open ? <TasksSheet key={open} agent={open} /> : null;
}

function TasksSheet({ agent }: { agent: string }) {
  const s = useApp();
  const { list } = useAgentTasks(agent);
  const now = useNow(1000);
  const running = list.filter((t) => t.status === "running" || t.status === "waiting");
  const scheduled = list.filter((t) => t.kind === "schedule");
  const done = list.filter((t) => t.kind !== "schedule" && !(t.status === "running" || t.status === "waiting"));
  const [tab, setTab] = useState<"now" | "sched" | "done">(running.length ? "now" : scheduled.length ? "sched" : "done");
  const rows = tab === "now" ? running : tab === "sched" ? scheduled : done;
  const name = s ? nameOf(s, agent) : "Agent";
  return (
    <Sheet label="tasks" title="Tasks" sub={`What ${name} is doing on its computer`} icon={<AgentTile id={agent} look={s?.agent?.look} size={40} status={false} />} onClose={closeTasks}>
      <div role="tablist" className="inline-flex w-full rounded-full bg-tint p-1">
        {([["now", `Running${running.length ? ` · ${running.length}` : ""}`], ["sched", `Scheduled${scheduled.length ? ` · ${scheduled.length}` : ""}`], ["done", "Done"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} data-tasks-tab={k} onClick={() => setTab(k)} className={`h-8 flex-1 rounded-full text-[12.5px] font-bold transition ${tab === k ? "bg-card text-ink shadow-sm" : "text-ink/60"}`}>{l}</button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-tint text-ink/50"><Icon name={tab === "sched" ? "clock" : "jobs"} size={22} /></span>
          <p className="mt-2.5 text-[13px] text-ink/60">{tab === "now" ? "Nothing running right now." : tab === "sched" ? "No scheduled tasks." : "Nothing finished yet."}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((t) => <li key={t.id} data-task-row={t.kind} className="flex items-center gap-2.5 rounded-[16px] bg-base px-2.5 py-2 ring-1 ring-line"><TaskRow t={t} r={t} now={now} /></li>)}
        </ul>
      )}
    </Sheet>
  );
}
