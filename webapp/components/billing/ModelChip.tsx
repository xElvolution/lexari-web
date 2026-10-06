"use client";

import { modelFor, openModels, useBilling } from "@/lib/billing";
import Icon from "../Icon";
import { LaminaMark, ModelMark } from "./parts";

/** The chat header's model chip: shows who answers here and opens the model picker. */
export default function ModelChip({ convo, agent, group }: { convo: string; agent: string | null; group: boolean }) {
  const { state } = useBilling();
  const { model } = modelFor(state, convo, agent);
  const lamina = model.pool === "lamina";
  return (
    <button
      data-model-chip={model.id}
      onClick={() => openModels(convo, agent, group)}
      aria-label={`Model: ${model.label}. Change model`}
      title={`${model.label}. Change model`}
      className={`group flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-2.5 text-[13px] font-bold transition max-[430px]:h-8 max-[430px]:pr-2 max-[430px]:text-[12px] ${lamina ? "bg-tint text-ink hover:bg-grape hover:text-white" : "bg-ink text-[var(--bg)] hover:bg-grape hover:text-white"}`}
    >
      {lamina ? <span className="grid h-6 w-6 place-items-center rounded-full bg-grape text-white max-[430px]:h-5 max-[430px]:w-5"><LaminaMark size={13} /></span> : <span className="overflow-hidden rounded-full"><ModelMark m={model} size={22} /></span>}
      <span className="max-w-[92px] truncate">{model.short}</span>
      <Icon name="right" size={12} className="rotate-90 opacity-60" />
    </button>
  );
}
