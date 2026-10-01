"use client";

import { lookVariant, type FaceState } from "../avatar";
import type { AgentLook } from "@/lib/store";
import Face from "../Face";
import { specialistBySlug } from "@/content/appData";
import { tileBg } from "./agents";

/** Your agent's face. look null is the house face from the landing badge. */
export function AgentFace({ look, size = 48, track = false, className = "", animated = false, state }: { look: AgentLook | undefined; size?: number; track?: boolean; className?: string; animated?: boolean; state?: FaceState }) {
  if (look && typeof look === "object") return <Face variant={lookVariant(look)} size={size} track={track} className={className} animated={animated} state={state} />;
  return look === null || look === undefined ? <Face size={size} track={track} className={className} /> : <Face seed={look} size={size} track={track} className={className} />;
}

/** A marketplace specialist's face, same seed and color as the landing roster. */
export function SpecFace({ slug, size = 48, track = false, className = "", animated = false }: { slug: string; size?: number; track?: boolean; className?: string; animated?: boolean }) {
  const s = specialistBySlug(slug);
  if (!s) return null;
  return <Face seed={s.seed} variant={{ color: s.color, ...s.face }} size={size} track={track} className={className} animated={animated} />;
}

/** Either one, by assignee id ("home" or a slug). */
export function WhoFace({ who, look, size = 40, className = "", animated = false }: { who: string; look: AgentLook | undefined; size?: number; className?: string; animated?: boolean }) {
  return who === "home" || who === "you" ? <AgentFace look={look} size={size} className={className} animated={animated} /> : <SpecFace slug={who} size={size} className={className} animated={animated} />;
}

/** An agent's face on its soft colour tile. Rounded square, sized in px. */
export function AgentTile({ id, look, size = 48, face, className = "", radius }: { id: string; look: AgentLook | undefined; size?: number; face?: number; className?: string; radius?: number }) {
  return (
    <span className={`grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.32), background: tileBg(id), boxShadow: "inset 0 0 0 1px var(--line)" }}>
      <WhoFace who={id} look={look} size={face ?? Math.round(size * 0.8)} />
    </span>
  );
}

/** A group: two members overlapped on a diagonal, plus a count when there are more. */
export function GroupTile({ members, look, size = 48, className = "" }: { members: string[]; look: AgentLook | undefined; size?: number; className?: string }) {
  const m = members.slice(0, 2); const sub = Math.round(size * 0.66); const extra = members.length - 2;
  return (
    <span className={`relative block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {m.map((id, i) => (
        <span key={id} className="absolute grid place-items-center" style={{ width: sub, height: sub, borderRadius: Math.round(sub * 0.34), left: i ? size - sub : 0, top: i ? size - sub : 0, background: tileBg(id), boxShadow: i ? `0 0 0 ${Math.max(2, Math.round(size / 22))}px var(--alt)` : undefined }}>
          <WhoFace who={id} look={look} size={Math.round(sub * 0.8)} />
        </span>
      ))}
      {extra > 0 && <span className="absolute grid place-items-center rounded-full bg-ink font-bold text-[var(--bg)]" style={{ right: -2, top: -2, minWidth: Math.round(size * 0.36), height: Math.round(size * 0.36), fontSize: Math.max(9, Math.round(size * 0.2)), boxShadow: `0 0 0 2px var(--alt)` }}>+{extra}</span>}
    </span>
  );
}
