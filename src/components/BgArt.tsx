"use client";

import { useId } from "react";
import { bgMarkup } from "@/lib/backgrounds";

/** Fills its parent with an ID-card background (cover, like object-fit). */
export default function BgArt({ id, className = "" }: { id?: string; className?: string }) {
  const uid = "bg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden dangerouslySetInnerHTML={{ __html: bgMarkup(id, uid) }} />;
}
