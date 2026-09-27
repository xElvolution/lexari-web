"use client";

import { useApp } from "@/lib/store";
import AgentList from "./AgentList";
import Thread from "./Thread";
import Icon from "../Icon";

/** Chat app layout: agent list on the left, the conversation on the right. On phones the list and the thread are separate screens. */
export default function ChatLayout({ id }: { id?: string }) {
  const s = useApp()!;
  return (
    <div className={`flex ${id ? "h-[100dvh]" : "min-h-[calc(100dvh-132px)]"} lg:h-[100dvh] lg:min-h-0`}>
      <AgentList s={s} activeId={id} className={`w-full border-line bg-alt lg:flex lg:w-[320px] lg:shrink-0 lg:border-r ${id ? "hidden" : "flex"}`} />
      <div className={`min-w-0 flex-1 ${id ? "block" : "hidden lg:block"}`}>
        {id ? <Thread key={id} s={s} id={id} /> : (
          <div className="carpet grid h-full place-items-center p-8 text-center">
            <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-tint text-brand-ink"><Icon name="chat" size={28} /></span><h2 className="display mt-5 text-[36px] text-ink">Pick someone to talk to.</h2><p className="mt-2 text-[15px] text-ink/70">Choose an agent on the left to open your chat.</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
