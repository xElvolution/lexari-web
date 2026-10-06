"use client";

import Link from "next/link";
import { useState } from "react";
import { LAMINA, PREMIUM, type ModelInfo } from "@/content/models";
import type { PlanId } from "@/content/appData";
import { CREDITS_ON_FREE } from "@/content/billing";
import { billingBlocked, closeBillingSheet, modelFor, openTopUp, setModel, useBilling, type BillingState } from "@/lib/billing";
import { toast, useApp } from "@/lib/store";
import { friendly } from "@/lib/api";
import { nameOf } from "../agents";
import Icon from "../Icon";
import UsageMeters from "./UsageMeters";
import { BurnChip, LaminaMark, ModelMark, Sheet, Spinner } from "./parts";

type Scope = "chat" | "agent";

/** Pick the model for this chat, or for an agent everywhere. Lamina first; premium models with burn chips. */
export default function ModelSheet({ convo, agent, group }: { convo: string; agent: string | null; group: boolean }) {
  const { state } = useBilling();
  const app = useApp();
  const who = agent && app ? nameOf(app, agent) : "this agent";
  const cur = modelFor(state, convo, agent);
  // A group chat has one model for everyone in it. A one-to-one chat can pick for itself or for the agent everywhere.
  const [scope, setScope] = useState<Scope>(group || !agent ? "chat" : cur.from === "chat" ? "chat" : "agent");
  const [busy, setBusy] = useState<string | null>(null);
  const selected = scope === "agent" && agent ? (state?.models.agents[agent] || LAMINA.id) : cur.model.id;

  const pick = async (m: ModelInfo) => {
    if (!state) return;
    const why = lockedWhy(state, m);
    if (why === "soon") return;
    if (why === "plan") { closeBillingSheet(); billingBlocked({ reason: "premium_locked", model: m.id, modelLabel: m.label, plan: state.plan.id as PlanId, planName: state.plan.name, resetsAt: null, credits: state.credits.balance, spendMode: state.spend.mode, spendLimit: state.spend.limit, convo, agent: agent ?? undefined }); return; }
    setBusy(m.id);
    try {
      if (scope === "agent" && agent) {
        await setModel({ scope: "agent", agent, model: m.id });
        // the agent-wide pick only shows if this chat has no pick of its own
        if (state.models.chats[convo] && !group) await setModel({ scope: "chat", convo, model: null });
      } else {
        await setModel({ scope: "chat", convo, model: m.id });
      }
      toast({ text: scope === "agent" ? `${who} now answers with ${m.label}` : `This chat now uses ${m.label}` });
      closeBillingSheet();
    } catch (e) {
      toast({ text: friendly(e, "Couldn't change the model. Try again.") });
    } finally { setBusy(null); }
  };

  return (
    <Sheet label="models" title="Model" sub={group ? "Who answers in this group. Everyone in it uses this model." : scope === "agent" ? `${who} uses this in every chat that has no model of its own.` : "Only this chat. Other chats keep their model."} icon={<LaminaMark size={20} />} onClose={closeBillingSheet}
      footer={state ? (
        <div className="grid gap-3">
          <UsageMeters s={state} compact />
          <div className="flex items-center justify-between gap-2">
            <Link href="/settings#billing" onClick={closeBillingSheet} className="text-[13px] font-bold text-brand-ink hover:underline">Usage and billing</Link>
            <button onClick={() => openTopUp({ product: state.plan.id === "free" ? "plan" : "credits" })} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-bold text-ink transition hover:bg-grape hover:text-white">{state.plan.id === "free" ? "Upgrade" : "Top up"}</button>
          </div>
        </div>
      ) : undefined}>
      {!group && agent && (
        <div className="mb-3 inline-flex w-full rounded-full bg-tint p-1" role="radiogroup" aria-label="Where this model applies">
          {([["chat", "This chat"], ["agent", `${who} everywhere`]] as const).map(([id, l]) => (
            <button key={id} role="radio" aria-checked={scope === id} onClick={() => setScope(id)} className={`h-9 flex-1 truncate rounded-full px-3 text-[13px] font-bold transition max-[430px]:h-8 max-[430px]:text-[12.5px] ${scope === id ? "bg-card text-ink shadow-sm" : "text-ink/60 hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      )}
      {!state ? <div className="grid h-40 place-items-center text-ink/50"><Spinner /></div> : (
        <div className="grid gap-2">
          <Row m={LAMINA} on={selected === LAMINA.id} busy={busy === LAMINA.id} onPick={pick} note={state.models.laminaVia === "gateway" ? "Fast, tuned for agents, with automatic fallbacks" : "Running on Lexari's backup engine on this server"} />
          <div className="mt-3 flex items-center justify-between px-1">
            <h3 className="label text-[9.5px] text-ink/50">Premium</h3>
            <span className="text-[11.5px] text-ink/45">Uses premium usage at API price + 20%</span>
          </div>
          {!state.models.gateway && (
            <div data-premium-soon className="flex items-start gap-3 rounded-2xl bg-grape/8 p-3.5 ring-1 ring-grape/25">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-grape/15 text-brand-ink"><Icon name="spark" size={17} /></span>
              <div className="min-w-0"><p className="text-[14px] font-bold text-ink">Premium models are coming soon</p><p className="mt-0.5 text-[12.5px] leading-snug text-ink/65">Claude, Grok and Gemini switch on here shortly. Lamina is ready for every agent right now.</p></div>
            </div>
          )}
          {PREMIUM.map((m) => <Row key={m.id} m={m} on={selected === m.id} busy={busy === m.id} onPick={pick} locked={lockedWhy(state, m)} />)}
          {state.plan.id === "free" && state.models.gateway && (
            <p className="mt-1 px-1 text-[12.5px] leading-snug text-ink/55">{CREDITS_ON_FREE ? "On Free, premium models run on extra credits. Pro includes $20 of premium usage every month." : "Premium models come with Pro."}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Why a model can't be picked right now: "soon" (not on this server), "plan" (Free with no credits), or null. */
function lockedWhy(s: BillingState, m: ModelInfo): "soon" | "plan" | null {
  if (!s.models.available[m.id]) return "soon";
  if (m.pool === "premium" && s.plan.id === "free" && (!CREDITS_ON_FREE || s.credits.balance <= 0)) return "plan";
  return null;
}

function Row({ m, on, busy, onPick, locked = null, note }: { m: ModelInfo; on: boolean; busy: boolean; onPick: (m: ModelInfo) => void; locked?: "soon" | "plan" | null; note?: string }) {
  const lamina = m.pool === "lamina";
  return (
    <button
      data-model={m.id}
      onClick={() => onPick(m)}
      disabled={locked === "soon" || busy}
      aria-pressed={on}
      className={`flex w-full items-center gap-3 rounded-[18px] p-3 text-left transition max-[430px]:gap-2.5 max-[430px]:p-2.5 ${on ? "bg-grape text-white ring-1 ring-grape" : lamina ? "bg-card ring-2 ring-grape/40 hover:ring-grape" : "bg-card ring-1 ring-line hover:ring-grape/50"} ${locked === "soon" ? "cursor-not-allowed opacity-55" : ""}`}
    >
      <span className={on && lamina ? "rounded-[14px] ring-2 ring-white/40" : ""}><ModelMark m={m} size={40} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><span className="truncate text-[15px] font-bold max-[430px]:text-[14px]">{m.label}</span><BurnChip m={m} on={on} /></span>
        <span className={`mt-0.5 block text-[12.5px] leading-snug max-[430px]:text-[12px] ${on ? "text-white/80" : "text-ink/60"}`}>{note ?? m.blurb}</span>
      </span>
      <span className="shrink-0">
        {busy ? <Spinner /> : on ? <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand-ink"><Icon name="check" size={14} stroke={3} /></span>
          : locked === "soon" ? <span className="label rounded-full bg-tint px-2 py-1 text-[8.5px] text-ink/60">Soon</span>
          : locked === "plan" ? <span className="label inline-flex items-center gap-1 rounded-full bg-ink px-2 py-1 text-[8.5px] text-[var(--bg)]"><Icon name="lock" size={10} />Pro</span>
          : <span className="grid h-7 w-7 place-items-center rounded-full ring-1 ring-line" />}
      </span>
    </button>
  );
}
