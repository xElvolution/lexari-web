"use client";

import BgArt from "@shared/components/BgArt";
import type { AgentLook } from "@/lib/store";
import { useState, type CSSProperties } from "react";
import { Barcode, Code } from "@shared/components/Badge";
import Logo from "@shared/components/Logo";
import { WhoFace } from "../faces";

const DARK_INK = { "--ink": "#0a0a0a", "--bg": "#ffffff" } as CSSProperties; // the card is always white
export type IdInfo = { id: string; name: string; role: string; idNo: string; desk: number; born: number; maker: string; kind: string; chips: string[]; memory: boolean; look: AgentLook | undefined; /** NFT-style background behind the face */ bg?: string };
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** An agent's ID badge on a short lanyard, in the landing page style. Tap, Enter or the flip button turns it over. */
export default function AgentIdCard({ info, flipped: controlled, onFlip, faceEl }: { info: IdInfo; flipped?: boolean; onFlip?: (v: boolean) => void; faceEl?: React.ReactNode }) {
  const [own, setOwn] = useState(false);
  const flipped = controlled ?? own;
  const flip = () => { onFlip ? onFlip(!flipped) : setOwn(!flipped); };
  const face = "rounded-[24px] bg-white p-3 text-[#0a0a0a] shadow-[0_26px_50px_-20px_rgba(20,0,80,.55),0_2px_0_#fff_inset] ring-1 ring-black/10 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";
  const desk = `Desk ${String(info.desk).padStart(2, "0")}`;
  return (
    <div className="sway relative mx-auto flex w-fit flex-col items-center" style={{ transformOrigin: "50% 0%" }}>
      <div className="strap h-[42px] w-[26px] rounded-b-sm shadow-[4px_0_0_rgba(0,0,0,.12)]"><div className="flex h-full items-center justify-center overflow-hidden"><span className="label rotate-90 whitespace-nowrap text-[7px] font-bold text-white/85">lexari</span></div></div>
      <div className="relative z-10 -mt-1 h-6 w-11 rounded-md bg-gradient-to-b from-[#f2f2f2] to-[#a3a3a3] shadow-[inset_0_-2px_0_rgba(0,0,0,.2)]"><span className="absolute left-1/2 top-1/2 h-2 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" /></div>
      <div
        role="button" tabIndex={0} aria-pressed={flipped} data-tour="id-card"
        aria-label={flipped ? `${info.name}'s ID card, back. Press to see the front.` : `${info.name}'s ID card. Press to flip.`}
        onClick={flip} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } }}
        className="relative -mt-2 w-[268px] cursor-pointer select-none rounded-[24px] outline-none transition-transform duration-700 [transition-timing-function:cubic-bezier(.3,1.35,.5,1)] focus-visible:ring-4 focus-visible:ring-grape/60"
        style={{ transformStyle: "preserve-3d", transform: `perspective(1000px) rotateY(${flipped ? 180 : 0}deg)` }}
      >
        {/* FRONT */}
        <div className={`relative ${face}`} aria-hidden={flipped}>
          <div className="mx-auto mb-2 h-2 w-14 rounded-full bg-black/10" />
          <div className="rounded-[16px] bg-grape px-4 py-2 text-center">
            <div className="display text-[22px] leading-none text-white">HELLO</div>
            <div className="label mt-1 text-[8.5px] text-white/80">my name is</div>
          </div>
          <div className="carpet-w relative mt-2.5 grid h-[128px] place-items-center overflow-hidden rounded-[16px] bg-[#0a0a0a]">
            <BgArt id={info.bg} />
            <span key={info.id + (info.look && typeof info.look === "object" ? "f" : String(info.look))} className="pop relative">{faceEl ?? <WhoFace who={info.id} look={info.look} size={96} animated />}</span>
            <span className="label absolute left-3 top-3 text-[8.5px] text-white/70">LEXARI</span>
            <span className="label absolute right-3 top-3 rounded-full bg-grape px-2 py-0.5 text-[8.5px] text-white">● online</span>
            <span className="label absolute bottom-2.5 left-3 text-[8px] text-white/55">{info.idNo}</span>
          </div>
          <div className="px-1 pt-2.5">
            <div className="display truncate text-[38px] leading-[0.95]">{info.name}</div>
            <div className="label mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1 text-[8.5px] text-black/60"><span>{info.role}</span><span>·</span><span>{desk}</span><span>·</span><span>Born {fmtDate(info.born)}</span></div>
            <div className="mt-2.5 flex flex-wrap gap-1">{info.chips.slice(0, 3).map((c) => <span key={c} className="rounded-full bg-[#0a0a0a] px-2 py-0.5 text-[10.5px] font-semibold text-white">{c}</span>)}</div>
            <div className="mt-2.5"><Barcode text={`${info.name}${info.idNo}`} /></div>
          </div>
        </div>
        {/* BACK */}
        <div className={`absolute inset-0 flex flex-col overflow-hidden !p-0 ${face}`} style={{ transform: "rotateY(180deg)" }} aria-hidden={!flipped}>
          <div className="mx-auto mt-3 h-2 w-14 rounded-full bg-black/10" />
          <div className="mt-2.5 h-10 bg-[#0a0a0a]" />
          <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3">
            <div className="flex items-center justify-between">
              <span style={DARK_INK} className="origin-left scale-[.78]"><Logo /></span>
              <span className="label rounded-full bg-grape px-2 py-0.5 text-[8px] text-white">Agent ID</span>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <div className="col-span-2"><dt className="label text-[8px] text-black/50">Card holder</dt><dd className="display truncate text-[26px] leading-none">{info.name}</dd></div>
              <div><dt className="label text-[8px] text-black/50">ID number</dt><dd className="font-mono text-[11.5px] font-semibold leading-tight">{info.idNo}</dd></div>
              <div><dt className="label text-[8px] text-black/50">Desk</dt><dd className="font-semibold leading-tight">{desk}</dd></div>
              <div><dt className="label text-[8px] text-black/50">Role</dt><dd className="truncate font-semibold leading-tight">{info.role}</dd></div>
              <div><dt className="label text-[8px] text-black/50">Born</dt><dd className="font-semibold leading-tight">{fmtDate(info.born)}</dd></div>
              <div><dt className="label text-[8px] text-black/50">{info.kind === "Hired" ? "Maker" : "Owner"}</dt><dd className="truncate font-semibold leading-tight">{info.maker}</dd></div>
              <div><dt className="label text-[8px] text-black/50">Memory</dt><dd className="font-semibold leading-tight">{info.memory ? "On" : "Off"}</dd></div>
            </dl>
            <div className="mt-auto flex items-end gap-3 pt-3">
              <div className="h-[62px] w-[62px] shrink-0 rounded-md p-1 ring-1 ring-black/10"><Code text={`${info.id}${info.idNo}`} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate border-b-2 border-black/70 pb-0.5 font-display text-[18px] italic leading-none text-grape">{info.name}</div>
                <div className="label mt-1 text-[7.5px] text-black/50">Agent signature</div>
              </div>
            </div>
            <p className="mt-2.5 text-[9px] leading-snug text-black/55">{info.kind} agent · Property of Lexari. If found, please return to Lexari. Not valid for real doors.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
