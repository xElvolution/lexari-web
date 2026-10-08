"use client";

import { useState } from "react";
import { CREDITS_ON_FREE } from "@/content/billing";
import { LAMINA, modelById } from "@/content/models";
import { friendly } from "@/lib/api";
import { closeBillingSheet, openSpend, openTopUp, setModel, useBilling, type OutInfo } from "@/lib/billing";
import { openUpgrade } from "../overlays";
import { toast } from "@/lib/store";
import Icon from "../Icon";
import { LaminaMark, ModelMark, Sheet, dateShort, money, timeShort } from "./parts";

/**
 * When a turn can't run: keep going on Lamina (within its allowance), top up extra credits, or move up a plan.
 * Nothing is downgraded silently; the person picks.
 */
export default function OutOfUsageSheet({ info }: { info: OutInfo }) {
  const { state } = useBilling();
  const [busy, setBusy] = useState(false);
  const model = modelById(info.model) ?? LAMINA;
  const premium = model.pool === "premium";
  const plan = state?.plan.id ?? ("plan" in info ? info.plan : "free");
  const free = plan === "free";
  const laminaLeft = state ? (free ? state.usage.lamina.used < state.usage.lamina.limit : state.usage.lamina.used < state.usage.lamina.limit || state.usage.premium.used < state.usage.premium.limit || state.credits.available > 0) : true;
  const canLamina = premium && !!info.convo && laminaLeft;
  const resets = "resetsAt" in info && info.resetsAt ? info.resetsAt : null;

  const copy = (() => {
    switch (info.reason) {
      case "free_daily": return { title: "You've used today's free Lamina", body: `Free comes with a small Lamina allowance every day.${resets ? ` It refills at ${timeShort(resets)}.` : ""} Pro keeps Lamina going all month, with $20 of premium models.` };
      case "premium_locked": return { title: `${model.label} is a premium model`, body: free ? (CREDITS_ON_FREE ? "Premium models run on Pro's included usage, or on extra credits. Lamina stays free for your daily messages." : "Premium models come with Pro. Lamina stays free for your daily messages.") : "Your plan's premium usage covers it." };
      case "spend_limit": return { title: "You've hit your spend limit", body: `Extra credits are capped at ${state ? money(state.spend.limit) : "your limit"} a cycle and that's used. Raise the limit, or wait for the next cycle${state?.plan.refillsAt ? ` on ${dateShort(state.plan.refillsAt)}` : ""}.` };
      case "model_unavailable": return { title: `${model.label} isn't available yet`, body: "Premium models are coming soon on this server. Lamina is ready right now." };
      default: return { title: premium ? "Premium usage is used up" : "Included usage is used up", body: `You've used everything included this cycle${state?.plan.refillsAt ? `. It resets on ${dateShort(state.plan.refillsAt)}` : ""}. Top up extra credits to keep going${plan !== "plus" ? ", or move up a plan for more" : ""}.` };
    }
  })();

  const lamina = async () => {
    if (!info.convo) return;
    setBusy(true);
    try { await setModel({ scope: "chat", convo: info.convo, model: LAMINA.id }); toast({ text: "Switched to Lamina. Send your message again." }); closeBillingSheet(); }
    catch (e) { toast({ text: friendly(e, "Couldn't switch models.") }); }
    finally { setBusy(false); }
  };
  const upgradeTo = plan === "pro" ? "plus" : "pro";
  const showUpgrade = plan !== "plus" && plan !== "max";
  const showTopUp = info.reason !== "model_unavailable" && info.reason !== "spend_limit" && (!free || CREDITS_ON_FREE);

  return (
    <Sheet label="out-of-usage" title={copy.title} sub={copy.body} icon={premium ? <ModelMark m={model} size={26} /> : <LaminaMark size={20} />} onClose={closeBillingSheet}>
      <div data-out-reason={info.reason} className="grid gap-2">
        {canLamina && (
          <Choice icon={<LaminaMark size={18} />} title="Continue on Lamina" body={free ? "Your free daily allowance, included." : "Included in your plan. Fast and tuned for your agents."} onClick={lamina} disabled={busy} primary />
        )}
        {info.reason === "spend_limit" && <Choice icon={<Icon name="settings" size={18} />} title="Raise your spend limit" body="Pick a higher monthly cap, or none." onClick={openSpend} primary={!canLamina} />}
        {showTopUp && <Choice icon={<Icon name="wallet" size={18} />} title="Top up extra credits" body="$5, $10 or $25, by card or USDC. Used after your included usage." onClick={() => openTopUp({ product: "credits" })} primary={!canLamina && info.reason !== "free_daily"} />}
        {showUpgrade && info.reason !== "model_unavailable" && (
          <Choice icon={<Icon name="star" size={18} />} title={`Upgrade to ${upgradeTo === "pro" ? "Pro" : "Max"}`} body={upgradeTo === "pro" ? "$20 a month: Lamina all month plus $20 of premium models." : "$60 a month: 3x the usage of Pro plus $60 of premium models."} onClick={() => { closeBillingSheet(); openUpgrade("plans"); }} primary={info.reason === "free_daily"} />
        )}
        {info.reason === "free_daily" && <button onClick={closeBillingSheet} className="mt-1 h-10 text-[13.5px] font-bold text-ink/60 hover:text-ink">I&apos;ll wait for tomorrow</button>}
      </div>
    </Sheet>
  );
}

function Choice({ icon, title, body, onClick, primary = false, disabled = false }: { icon: React.ReactNode; title: string; body: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex w-full items-center gap-3 rounded-[18px] p-3.5 text-left transition disabled:opacity-60 max-[430px]:p-3 ${primary ? "bg-grape text-white shadow-[0_5px_0_var(--color-grape-deep)] hover:-translate-y-0.5" : "bg-card ring-1 ring-line hover:ring-grape/50"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${primary ? "bg-white/15" : "bg-tint text-brand-ink"}`}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{title}</span><span className={`mt-0.5 block text-[12.5px] leading-snug ${primary ? "text-white/80" : "text-ink/60"}`}>{body}</span></span>
      <Icon name="right" size={16} className={primary ? "text-white/80" : "text-ink/35"} />
    </button>
  );
}
