"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, friendly } from "@/lib/api";
import { PageHead } from "@/components/ui";
import Icon from "@/components/Icon";
import { Section, input, primary, secondary } from "@/components/developer/parts";

/** lexari login: approve the code your terminal shows. Approving makes a key for that CLI (after you confirm it's you). */
export default function DevicePage() {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<{ label: string } | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "approved" | "denied">("idle");
  const [err, setErr] = useState("");
  useEffect(() => { const c = new URLSearchParams(window.location.search).get("code"); if (c) setCode(c.toUpperCase()); }, []);
  useEffect(() => {
    setInfo(null); setErr("");
    if (code.replace(/[^A-Z0-9]/gi, "").length !== 8) return;
    api<{ label: string }>(`/api/developer/device/approve?code=${encodeURIComponent(code)}`).then(setInfo, (e) => setErr(friendly(e, "That code isn't valid.")));
  }, [code]);
  const decide = async (approve: boolean) => {
    setState("busy"); setErr("");
    try { await api("/api/developer/device/approve", { body: { code, approve } }); setState(approve ? "approved" : "denied"); }
    catch (e) { setErr(friendly(e, "That didn't work.")); setState("idle"); }
  };
  return (
    <>
      <PageHead kicker="Developer" title="Sign in the CLI." body="Check that this code matches the one in your terminal, then approve. The CLI gets its own key that you can revoke on the Developer page." />
      <div className="max-w-[560px]">
        <Section title="Code from your terminal">
          {state === "approved" ? (
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#34d399]/20 text-[#047857]"><Icon name="check" size={20} /></span><div><p className="text-[15px] font-bold text-ink">Approved. You can go back to your terminal.</p><Link href="/developer" className="text-[13.5px] font-semibold text-brand-ink hover:underline">Developer page</Link></div></div>
          ) : state === "denied" ? (
            <p className="text-[15px] font-bold text-ink">Denied. The CLI won&apos;t get a key.</p>
          ) : (
            <>
              <input data-device-code className={`${input} text-center font-mono text-[20px] tracking-[0.2em]`} placeholder="ABCD-EFGH" maxLength={9} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Code" />
              {info && <p className="mt-3 text-[14px] text-ink/70">Signing in <span className="font-bold text-ink">{info.label || "the Lexari CLI"}</span>. It will be able to publish versions for review and read your listings.</p>}
              {err && <p className="mt-3 text-[13px] text-[#e5484d]">{err}</p>}
              <div className="mt-4 flex gap-2">
                <button data-device-approve disabled={!info || state === "busy"} onClick={() => void decide(true)} className={primary}>{state === "busy" ? "Approving…" : "Approve"}</button>
                <button disabled={!info || state === "busy"} onClick={() => void decide(false)} className={secondary}>Deny</button>
              </div>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
