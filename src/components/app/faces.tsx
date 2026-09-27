"use client";

import Face from "../Face";
import { specialistBySlug } from "@/content/appData";

/** Your agent's face. look null is the house face from the landing badge. */
export function AgentFace({ look, size = 48, track = false, className = "" }: { look: number | null | undefined; size?: number; track?: boolean; className?: string }) {
  return look === null || look === undefined ? <Face size={size} track={track} className={className} /> : <Face seed={look} size={size} track={track} className={className} />;
}

/** A marketplace specialist's face, same seed and color as the landing roster. */
export function SpecFace({ slug, size = 48, track = false, className = "" }: { slug: string; size?: number; track?: boolean; className?: string }) {
  const s = specialistBySlug(slug);
  if (!s) return null;
  return <Face seed={s.seed} variant={{ color: s.color }} size={size} track={track} className={className} />;
}

/** Either one, by assignee id ("home" or a slug). */
export function WhoFace({ who, look, size = 40, className = "" }: { who: string; look: number | null | undefined; size?: number; className?: string }) {
  return who === "home" || who === "you" ? <AgentFace look={look} size={size} className={className} /> : <SpecFace slug={who} size={size} className={className} />;
}
