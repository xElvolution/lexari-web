"use client";

import { useState } from "react";
import { saveNames, toast, type State } from "@/lib/store";
import NameFields, { namesValid, type NameDraft } from "./NameFields";
import { AgentFace } from "./faces";

/**
 * Accounts made before names were asked for (or that skipped them) add a full name and username on their next visit.
 * Until then agents use no name at all, never the email.
 */
export default function NameGate({ s }: { s: State }) {
  const [d, setD] = useState<NameDraft>({ fullName: s.names.fullName, username: s.names.username, callName: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr("");
    try { await saveNames({ fullName: d.fullName.trim(), username: d.username, callName: d.callName.trim() }); toast({ text: "Thanks. Your agents know your name now.", face: "home" }); }
    catch (e) { setErr((e as Error).message || "Could not save that. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <div data-name-gate role="dialog" aria-modal="true" aria-labelledby="name-gate-title" className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 px-4 py-8">
      <form onSubmit={(e) => { e.preventDefault(); if (namesValid(d) && !busy) void save(); }} className="relative w-full max-w-[480px] rounded-[30px] bg-card p-6 shadow-[0_14px_0_#5b2bff] ring-1 ring-line sm:p-8">
        <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-[var(--face-tile)] ring-1 ring-line"><AgentFace look={s.agent?.look} size={52} /></span>
        <h2 id="name-gate-title" className="display mt-5 text-[30px] leading-none text-ink sm:text-[36px]">What should we call you?</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/70">Add your name and a username. {s.agent?.name || "Your agent"} and the rest of your team use your name now and then, never your email.</p>
        <div className="mt-6"><NameFields value={d} onChange={(x) => { setD(x); setErr(""); }} error={err} /></div>
        <button type="submit" disabled={!namesValid(d) || busy} className="btn btn-brand mt-6 w-full disabled:opacity-40">{busy ? "Saving…" : "Save and continue"}</button>
      </form>
    </div>
  );
}
