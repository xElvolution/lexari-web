"use client";

import { modernUrl } from "@/lib/routes";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { ago } from "./ui";
import { enablePush, markRead, pushOnHere, pushPermission, startNotices, useNotices, type Notice } from "@/lib/notifications";
import { toast } from "@/lib/store";

const KIND_ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = { quest: "star", box: "box", hire: "team", payment: "check", card: "wallet", reply: "chat", faucet: "wallet" };

/** Header bell with an unread badge, and the notification center that drops down from it. */
export default function NotifyBell({ className = "" }: { className?: string }) {
  const n = useNotices();
  const [open, setOpen] = useState(false);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => { startNotices(); }, []);
  useEffect(() => {
    if (!open) return;
    void pushOnHere().then(setPushOn);
    const close = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const go = (it: Notice) => { setOpen(false); if (!it.read) void markRead([it.id]); router.push(modernUrl(it.url || "/agents")); };
  const now = Date.now();
  return (
    <div ref={box} className={`relative ${className}`}>
      <button data-bell onClick={() => setOpen((v) => !v)} aria-label={n.unread ? `Notifications, ${n.unread} new` : "Notifications"} aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-full border-2 border-line text-ink transition hover:border-grape hover:text-brand-ink">
        <Icon name="bell" size={19} />
        {n.unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-grape px-1 text-[10.5px] font-bold text-white ring-2 ring-[var(--bg)]">{n.unread > 9 ? "9+" : n.unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" data-notify-center
          className="pop fixed inset-x-3 top-[68px] z-50 flex max-h-[min(560px,calc(100dvh-160px))] flex-col overflow-hidden rounded-[22px] bg-card shadow-2xl ring-1 ring-line lg:absolute lg:inset-x-auto lg:bottom-0 lg:left-[60px] lg:top-auto lg:w-[360px]">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h2 className="text-[16px] font-bold text-ink">Notifications</h2>
            {n.unread > 0 && <button onClick={() => void markRead()} className="text-[12.5px] font-semibold text-brand-ink">Mark all read</button>}
          </div>
          {pushOn === false && pushPermission() !== "unsupported" && (
            <button onClick={async () => { const r = await enablePush(true); toast({ text: r.ok ? "Notifications are on for this device" : r.why || "Couldn't turn on notifications" }); setPushOn(r.ok); }}
              className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-tint px-3 py-2.5 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grape text-white"><Icon name="bell" size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink">Get notified on this device</span><span className="block text-[11.5px] text-ink/60">Replies, rewards and payments, even when Lexari is closed.</span></span>
              <span className="text-[12px] font-bold text-brand-ink">Turn on</span>
            </button>
          )}
          <div className="no-bar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {!n.items.length && <p className="px-3 py-10 text-center text-[13px] text-ink/55">{n.loaded ? "Nothing yet. Quests, boxes, hires and payments show up here." : "Loading…"}</p>}
            {n.items.map((it) => (
              <button key={it.id} data-notice={it.kind} onClick={() => go(it)} className={`flex w-full items-start gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-tint ${it.read ? "" : "bg-tint/60"}`}>
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${it.read ? "bg-alt text-ink/60" : "bg-grape text-white"}`}><Icon name={KIND_ICON[it.kind] || "bell"} size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2"><span className="truncate text-[13.5px] font-semibold text-ink">{it.title}</span><span className="shrink-0 text-[11px] text-ink/45">{ago(it.at, now)}</span></span>
                  {it.body && <span className="line-clamp-2 block text-[12.5px] leading-snug text-ink/65">{it.body}</span>}
                </span>
                {!it.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-grape" aria-label="New" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
