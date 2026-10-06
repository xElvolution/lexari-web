"use client";

import { useEffect, useSyncExternalStore } from "react";
import HubPhone, { HubLoading } from "./HubPhone";
import { refreshHub, useApp, useNow } from "@/lib/store";
import { questsView, TIERS, hubOf } from "@/lib/hub";
import { PageHead } from "@/components/ui";
import { CheckIn, FloatingBalance, Hero, MysteryBox } from "./top";
import Quests from "./quests";
import LevelUp from "./level";
import Referral from "./referral";
import { Achievements } from "./board";
import { useState } from "react";
import { StoreButton, StoreSheet } from "./store";

const JUMP = [["#checkin", "Check in"], ["#quests", "Quests"], ["#level", "Level up"], ["#invite", "Invite"]] as const;

/** The Hub: earn coins (check-in, quests, mystery box, referrals) and spend them levelling up your agents. */
export default function Hub() {
  const s = useApp()!;
  const tick = useNow(1000);
  const now = tick || Date.now();
  const h = hubOf(s);
  const [store, setStore] = useState(false);
  // Quest progress changes from other screens and the server (replies, jobs, friends joining): fetch it when the Hub
  // opens, when you come back to the tab, and every few seconds while it's on screen.
  useEffect(() => {
    const go = () => { if (document.visibilityState === "visible") void refreshHub(); };
    void refreshHub();
    const t = setInterval(go, 5000);
    window.addEventListener("focus", go);
    document.addEventListener("visibilitychange", go);
    return () => { clearInterval(t); window.removeEventListener("focus", go); document.removeEventListener("visibilitychange", go); };
  }, []);
  const phone = useSyncExternalStore((f) => { const m = window.matchMedia("(max-width: 430px)"); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, () => window.matchMedia("(max-width: 430px)").matches, () => false);
  if (phone) return <><HubPhone s={s} now={now} /><FloatingBalance s={s} /></>;
  if (!s.live) return <div className="mx-auto max-w-[520px] pt-6"><HubLoading /></div>;
  const ready = questsView(s, now).filter((q) => q.done && !q.claimed).length + TIERS.filter((t, i) => h.invited.length >= t.friends && !h.tiers.includes(i)).length;
  return (
    <div id="top" className="scroll-mt-24" onClickCapture={(e) => { if ((e.target as HTMLElement).closest?.("a[href='#store']")) { e.preventDefault(); setStore(true); } }}>
      <PageHead kicker="Hub" title="Earn. Level up." body="Quests and check-ins pay coins. Spend them to train your agents and unlock perks."
        right={<div className="flex items-center gap-2"><nav aria-label="Hub sections" className="no-bar flex gap-1.5 overflow-x-auto">{JUMP.map(([href, l]) => <a key={href} href={href} className="chip shrink-0">{l}</a>)}</nav><StoreButton onOpen={() => setStore(true)} /></div>} />
      {store && <StoreSheet s={s} onClose={() => setStore(false)} />}
      <div className="mt-7 space-y-5">
        <Hero s={s} now={now} ready={ready} />
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <CheckIn s={s} now={now} />
          <MysteryBox s={s} now={now} />
        </div>
        <Quests s={s} now={now} />
        <LevelUp s={s} />
        <Referral s={s} />
        <Achievements s={s} now={now} />
      </div>
      <FloatingBalance s={s} />
    </div>
  );
}
