"use client";

import { useEffect } from "react";
import { planOf, useApp } from "@/lib/store";
import Icon from "./Icon";
import { PlansGrid } from "./Plans";
import { closeUpgrade, useOverlays } from "./overlays";

/** Blocking sheet when the plan has no free seat (or "see plans"). */
export default function UpgradeSheet() {
  const { upgrade } = useOverlays();
  const s = useApp();
  useEffect(() => { if (!upgrade) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeUpgrade(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [upgrade]);
  if (!upgrade || !s) return null;
  const p = planOf(s);
  const title = upgrade === "plans" ? (p.id === "free" ? "Upgrade your plan" : "Plans") : p.id === "free" ? "Free plan includes one agent." : `Your ${p.name} plan is full.`;
  const body = upgrade === "plans" ? "More seats for more agents. Your own agent always sits at desk one."
    : p.id === "free" ? "Upgrade to Pro to hire more." : `All ${p.seats} seats are taken. Move up a plan or release someone from the Team page.`;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) closeUpgrade(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="up-title" data-upgrade-sheet className="pop pb-safe-dlg flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-[26px] bg-card ring-1 ring-line sm:rounded-[26px]">
        <div className="flex items-start gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grape text-white"><Icon name="team" size={20} /></span>
          <div className="min-w-0 flex-1"><h2 id="up-title" className="display text-[24px] leading-[1.05] text-ink">{title}</h2><p className="mt-1 text-[14px] text-ink/65">{body}</p></div>
          <button onClick={closeUpgrade} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
        </div>
        <div className="no-bar min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6"><PlansGrid onUpgraded={closeUpgrade} /></div>
      </div>
    </div>
  );
}
