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
      className={`group flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[13.5px] font-bold ring-1 transition max-[430px]:h-9 max-[430px]:gap-1 max-[430px]:pr-2 max-[430px]:text-[13px] ${lamina ? "bg-grape/10 text-ink ring-grape/35 hover:bg-grape hover:text-white hover:ring-grape" : "bg-ink text-[var(--bg)] ring-ink hover:bg-grape hover:text-white hover:ring-grape"}`}
    >
      {lamina ? <span className="grid h-7 w-7 place-items-center rounded-full bg-grape text-white max-[430px]:h-[26px] max-[430px]:w-[26px]"><LaminaMark size={14} /></span> : <span className="overflow-hidden rounded-full"><ModelMark m={model} size={26} /></span>}
      <span className="max-w-[96px] truncate max-[430px]:max-w-[78px]">{model.short}</span>
      <Icon name="right" size={14} stroke={2.6} className="rotate-90" />
    </button>
  );
}
