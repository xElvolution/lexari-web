"use client";

import { LAMINA, modelById } from "@/content/models";
import { openModels, useBilling } from "@/lib/billing";
import Icon from "../Icon";
import { BurnChip, ModelMark } from "./parts";

/** In the agent panel: the model this agent answers with everywhere. Opens the model picker. */
export default function AgentModelRow({ agent, name }: { agent: string; name: string }) {
  const { state } = useBilling();
  const m = modelById(state?.models.agents[agent]) ?? LAMINA;
  return (
    <button type="button" data-agent-model={m.id} onClick={() => openModels(agent, agent, false)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left ring-1 ring-line transition hover:ring-grape/60">
      <ModelMark m={m} size={36} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">Model<span className="font-semibold text-ink/55">· {m.label}</span><BurnChip m={m} /></span>
        <span className="block truncate text-[12.5px] text-ink/60">{m.pool === "lamina" ? `${name} answers with Lamina unless a chat picks another.` : `${name} answers with ${m.short} in chats without their own pick.`}</span>
      </span>
      <Icon name="right" size={16} className="shrink-0 text-ink/35" />
    </button>
  );
}
