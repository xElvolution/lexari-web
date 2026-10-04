"use client";

import { useEffect } from "react";
import { hardReload, isStale, reportError } from "@/components/ClientErrors";

/** Last-resort screen if the root layout itself fails. Reloads stale clients; otherwise reports and offers a reload. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { if (isStale(error.message || "")) hardReload(error.message); else reportError("global", error, { digest: error.digest }); }, [error]);
  return (
    <html lang="en" data-theme="dark">
      <body style={{ background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 320, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Lexari needs a reload</h1>
          <p style={{ opacity: 0.7, fontSize: 14 }}>Nothing was lost.</p>
          <button onClick={() => location.reload()} style={{ marginTop: 12, background: "#5b2bff", color: "#fff", border: 0, borderRadius: 999, padding: "12px 22px", fontWeight: 700 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
