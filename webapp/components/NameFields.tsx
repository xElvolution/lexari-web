"use client";

import { useState } from "react";

export type NameDraft = { fullName: string; username: string; callName: string };
export const USERNAME_OK = /^[a-z0-9_.]{3,20}$/;
const cleanUser = (v: string) => v.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "").slice(0, 20);
/** A username suggestion from a full name: "Ada Lovelace" -> "adalovelace". */
export const suggestUsername = (full: string) => cleanUser(full.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ""));
export const firstOf = (full: string) => full.trim().split(/\s+/)[0] || "";
/** Full name (2+ letters, not an email) and a valid username. */
export const namesValid = (d: NameDraft) => d.fullName.trim().length >= 2 && !d.fullName.includes("@") && USERNAME_OK.test(d.username) && !d.callName.includes("@");

/**
 * Full name, username and what agents call you. Used in onboarding, the "add your name" prompt and Personalization.
 * The username follows the full name until you edit it; the call name defaults to your first name.
 */
export default function NameFields({ value, onChange, error, compact = false }: { value: NameDraft; onChange: (d: NameDraft) => void; error?: string; compact?: boolean }) {
  const [ownUser, setOwnUser] = useState(!!value.username);
  const lbl = "label text-[10px] text-ink/70";
  const badUser = value.username.length > 0 && !USERNAME_OK.test(value.username);
  return (
    <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : ""}`}>
      <label className="block">
        <span className={lbl}>Full name</span>
        <input value={value.fullName} autoComplete="name" required placeholder="Ada Lovelace" className="field mt-2"
          onChange={(e) => { const fullName = e.target.value.slice(0, 60); onChange({ ...value, fullName, ...(ownUser ? {} : { username: suggestUsername(fullName) }) }); }} />
      </label>
      <label className="block">
        <span className={lbl}>Username</span>
        <span className="relative mt-2 block">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-semibold text-ink/45">@</span>
          <input value={value.username} autoComplete="username" required placeholder="adalovelace" aria-invalid={badUser || undefined} className="field !pl-9"
            onChange={(e) => { setOwnUser(true); onChange({ ...value, username: cleanUser(e.target.value) }); }} />
        </span>
        <span className={`mt-1.5 block text-[12.5px] ${badUser ? "text-[#e5484d]" : "text-ink/50"}`}>3 to 20 letters, numbers, dots or underscores.</span>
      </label>
      <label className={`block ${compact ? "sm:col-span-2" : ""}`}>
        <span className={lbl}>What your agents call you</span>
        <input value={value.callName} placeholder={firstOf(value.fullName) || "Ada"} className="field mt-2" onChange={(e) => onChange({ ...value, callName: e.target.value.replace(/@/g, "").slice(0, 30) })} />
        <span className="mt-1.5 block text-[12.5px] text-ink/50">Leave it empty to use your first name. Agents never use your email.</span>
      </label>
      {error && <p role="alert" className={`text-[13.5px] font-semibold text-[#e5484d] ${compact ? "sm:col-span-2" : ""}`}>{error}</p>}
    </div>
  );
}
