"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO_ADDRESS, DEMO_GOOGLE, shortAddr } from "@/content/appData";
import { agentName, planOf, signOut, useApp } from "@/lib/store";
import Icon from "@/components/app/Icon";
import { AgentTile } from "@/components/app/faces";
import { DemoTag, PageHead } from "@/components/app/ui";
import { myAgents } from "@/components/app/agents";

export default function ProfilePage() {
  const s = useApp()!;
  const router = useRouter();
  const a = s.agent!;
  const name = s.auth?.method === "google" ? s.auth.label : a.you || "You";
  const about = s.memory.filter((m) => m.tag === "About you").slice(0, 5);
  const team = myAgents(s);
  const card = "rounded-[26px] bg-card p-5 ring-1 ring-line sm:p-6";

  return (
    <>
      <PageHead kicker="Profile" title={<>{name}.</>} body="Who you are to your agents, how you sign in and what they know about you." right={<DemoTag />} />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section data-rise className={card}>
          <div className="flex items-center gap-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-ink text-[28px] font-bold text-[var(--bg)]">{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            <div className="min-w-0">
              <h2 className="display truncate text-[34px] text-ink">{name}</h2>
              <p className="truncate text-[14.5px] text-ink/60">{a.role || "Member"} · {planOf(s).name} plan</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 text-[14.5px]">
            <div className="flex items-center gap-3 rounded-2xl bg-tint px-4 py-3"><Icon name="google" size={18} /><dt className="font-semibold text-ink">Google</dt><dd className="ml-auto truncate text-ink/60">{s.links.google ? DEMO_GOOGLE.email : "Not connected"}</dd></div>
            <div className="flex items-center gap-3 rounded-2xl bg-tint px-4 py-3"><Icon name="wallet" size={18} /><dt className="font-semibold text-ink">Wallet</dt><dd className="ml-auto truncate font-mono text-[13px] text-ink/60">{s.links.wallet ? shortAddr(DEMO_ADDRESS) : "Not connected"}</dd></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/app/settings" className="btn btn-ghost btn-sm"><Icon name="settings" size={16} />Settings</Link>
            <button onClick={() => { signOut(); router.push("/"); }} className="btn btn-line btn-sm text-ink"><Icon name="out" size={16} />Sign out</button>
          </div>
        </section>

        <section data-rise className={card}>
          <div className="flex items-center justify-between"><h2 className="display text-[28px] text-ink">What they know</h2><Link href="/app/memory" className="text-[13.5px] font-bold text-brand-ink hover:underline">Open brain</Link></div>
          <ul className="mt-4 space-y-2">
            {about.length ? about.map((m) => <li key={m.id} className="flex items-start gap-2.5 text-[14.5px] text-ink/80"><i className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-grape" />{m.text}</li>) : <li className="text-[14.5px] text-ink/60">Nothing yet. Tell {agentName(s)} something with “remember…”.</li>}
          </ul>
          <h3 className="label mt-7 text-[9.5px] text-ink/55">Your team</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {team.map((t) => (
              <Link key={t.id} href={`/app?c=${t.id}`} className="flex items-center gap-2 rounded-full bg-tint py-1 pl-1 pr-3.5 text-[13.5px] font-semibold text-ink transition hover:bg-grape hover:text-white">
                <AgentTile id={t.id} look={s.agent?.look} size={30} radius={15} />{t.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
