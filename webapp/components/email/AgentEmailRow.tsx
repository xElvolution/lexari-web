"use client";

import { openMail, useEmail } from "@/lib/email";
import Icon from "../Icon";

/** In the agent panel: the agent's own email. Opens its inbox. */
export default function AgentEmailRow({ agent, name }: { agent: string; name: string }) {
  const { mode, unread } = useEmail();
  if (!mode || mode === "off") return null;
  const n = unread[agent] || 0;
  return (
    <button type="button" data-agent-email={agent} onClick={() => openMail(agent)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left ring-1 ring-line transition hover:ring-grape/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-grape text-white"><Icon name="mail" size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">Email{n > 0 && <span className="rounded-full bg-grape px-1.5 py-0.5 text-[10px] font-bold text-white">{n} new</span>}{mode === "mock" && <span className="label rounded-full bg-[#fff4d6] px-1.5 py-0.5 text-[8px] text-[#8a5a00]">Test</span>}</span>
        <span className="block truncate text-[12.5px] text-ink/60">{name}&apos;s own inbox, forwarding and drafts you approve.</span>
      </span>
      <Icon name="right" size={16} className="shrink-0 text-ink/35" />
    </button>
  );
}
