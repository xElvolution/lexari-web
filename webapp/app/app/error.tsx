"use client";

import { useEffect } from "react";
import { hardReload, isStale, reportError } from "@/components/ClientErrors";

/** Any crash inside the app shows this instead of a blank "page couldn't load" screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[app] page error", error); if (isStale(error.message || "")) hardReload(error.message); else reportError("boundary", error, { digest: error.digest }); }, [error]);
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-[20px] bg-card p-5 text-center ring-1 ring-line">
      <h1 className="text-[18px] font-bold text-ink">Something went wrong on this screen</h1>
      <p className="mt-1.5 text-[14px] text-ink/65">Nothing was lost. Try again, and if it keeps happening, reload the app.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-brand btn-sm">Try again</button>
        <button onClick={() => window.location.reload()} className="btn btn-line btn-sm text-ink">Reload</button>
      </div>
    </div>
  );
}
