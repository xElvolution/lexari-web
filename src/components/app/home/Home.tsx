"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { convoExists, setActive, useApp } from "@/lib/store";
import AgentStrip from "./AgentStrip";
import ConvoList from "./ConvoList";
import ChatPanel from "./ChatPanel";
import CallOverlay from "./CallOverlay";
import DesktopPane from "./DesktopPane";
import GroupDialog from "./GroupDialog";

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 1024px)"); const on = () => setWide(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  return wide;
}
let pushed = false; // did we open the current chat from the list (so Back can pop it)

/**
 * Home: every agent in a row at the top, conversations on the left, the open chat below the row.
 * Phones get the row and the list; a chat opens full screen.
 */
export default function Home() {
  const s = useApp()!;
  const params = useSearchParams();
  const wide = useWide();
  const q = params.get("c");
  const fromUrl = convoExists(s, q) ? q! : null;
  const active = fromUrl ?? (convoExists(s, s.active) ? s.active : "home");
  const [pane, setPane] = useState(false);
  const [call, setCall] = useState(false);
  const [group, setGroup] = useState<null | { edit?: string }>(null);

  useEffect(() => { if (fromUrl) setActive(fromUrl); }, [fromUrl]);
  useEffect(() => { if (params.get("pane") === "1") setPane(true); }, [params]);

  const open = (id: string) => {
    setActive(id);
    if (id === q) return;
    pushed = !q; // from the list on phones
    window.history.pushState(null, "", `/app?c=${id}`);
  };
  const back = () => { if (pushed) { pushed = false; window.history.back(); } else window.history.replaceState(null, "", "/app"); };
  const mobileChat = !wide && !!fromUrl;

  return (
    <>
      <div className="lg:flex lg:h-[100dvh]">
        {wide && (
          <ConvoList s={s} active={active} onPick={open} onNewGroup={() => setGroup({})} className="w-[300px] shrink-0 border-r border-line bg-alt" />
        )}
        <div className="flex min-w-0 flex-1 flex-col lg:h-full">
          <AgentStrip s={s} active={active} onPick={open} />
          {wide ? (
            <div className="relative flex min-h-0 flex-1">
              <ChatPanel key={active} s={s} id={active} onCall={() => setCall(true)} onDesktop={() => setPane((p) => !p)} desktopOpen={pane} onEditGroup={() => setGroup({ edit: active })} />
              {pane && <div className="absolute inset-y-0 right-0 z-20 w-[min(560px,100%)] shadow-[-30px_0_60px_-30px_rgba(0,0,0,.35)] xl:static xl:w-[min(46%,620px)] xl:shrink-0 xl:shadow-none"><DesktopPane s={s} id={active} onClose={() => setPane(false)} /></div>}
            </div>
          ) : (
            <ConvoList s={s} active={null} onPick={open} onNewGroup={() => setGroup({})} className="pb-28" />
          )}
        </div>
      </div>
      {mobileChat && (
        <div className="fixed inset-0 z-50 bg-base">
          <ChatPanel key={fromUrl} s={s} id={fromUrl!} onBack={back} onCall={() => setCall(true)} onDesktop={() => setPane((p) => !p)} desktopOpen={pane} onEditGroup={() => setGroup({ edit: fromUrl! })} />
        </div>
      )}
      {!wide && pane && fromUrl && <div className="fixed inset-0 z-[60] bg-alt"><DesktopPane s={s} id={fromUrl} onClose={() => setPane(false)} full /></div>}
      {call && <CallOverlay s={s} id={wide ? active : fromUrl ?? active} onClose={() => setCall(false)} />}
      {group && <GroupDialog s={s} editId={group.edit} onClose={() => setGroup(null)} onDone={(id) => { setGroup(null); if (id) open(id); else window.history.replaceState(null, "", "/app"); }} />}
    </>
  );
}
