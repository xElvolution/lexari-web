"use client";

import { openMail, useEmail } from "@/lib/email";
import Icon from "../Icon";

/** Chat header: the agent's inbox, with its unread count. Hidden when email is off. */
export default function InboxButton({ agent, name }: { agent: string; name: string }) {
  const { mode, unread } = useEmail();
  if (!mode || mode === "off") return null;
  const n = unread[agent] || 0;
  return (
    <button data-inbox-btn={agent} onClick={() => openMail(agent)} aria-label={`${name}'s email${n ? `, ${n} unread` : ""}`} title={`${name}'s email`} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/75 transition hover:bg-tint hover:text-brand-ink max-[430px]:h-9 max-[430px]:w-9">
      <Icon name="mail" size={19} />
      {n > 0 && <span className="absolute right-0.5 top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-grape px-1 text-[10px] font-bold text-white ring-2 ring-[var(--bg)]">{n > 9 ? "9+" : n}</span>}
    </button>
  );
}
