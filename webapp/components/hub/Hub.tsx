"use client";

import { useEffect } from "react";
import { refreshHub, useApp, useNow } from "@/lib/store";
import { questsView, TIERS, hubOf } from "@/lib/hub";
import { PageHead } from "@/components/ui";
import { CheckIn, FloatingBalance, Hero, MysteryBox } from "./top";
import Quests from "./quests";
import LevelUp from "./level";
import Referral from "./referral";
import { Achievements } from "./board";

const JUMP = [["#checkin", "Check in"], ["#quests", "Quests"], ["#level", "Level up"], ["#invite", "Invite"]] as const;

/** The Hub: earn coins (check-in, quests, mystery box, referrals) and spend them levelling up your agents. */
export default function Hub() {
  const s = useApp()!;
  const tick = useNow(1000);
  const now = tick || Date.now();
  const h = hubOf(s);
  useEffect(() => { void refreshHub(); }, []);
  const ready = questsView(s, now).filter((q) => q.done && !q.claimed).length + TIERS.filter((t, i) => h.invited.length >= t.friends && !h.tiers.includes(i)).length;
  return (
    <div id="top" className="scroll-mt-24">
      <PageHead kicker="Hub" title="Earn. Level up." body="Quests and check-ins pay coins. Spend them to train your agents and unlock perks."
        right={<nav aria-label="Hub sections" className="no-bar flex gap-1.5 overflow-x-auto">{JUMP.map(([href, l]) => <a key={href} href={href} className="chip shrink-0">{l}</a>)}</nav>} />
      <div className="mt-7 space-y-5">
        {s.live && !s.live.program.live && (
          <p role="status" className="rounded-[22px] bg-tint px-5 py-4 text-[14.5px] font-semibold text-ink/80 ring-1 ring-line">Rewards open soon. The Lexari program is not live on Solana yet, so check-ins, quests and level-ups can&apos;t be signed today. Your progress still counts.</p>
        )}
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
