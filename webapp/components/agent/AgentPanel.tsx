"use client";

import VoicePicker, { type AgentVoice } from "./VoicePicker";
import { voiceOf } from "@/lib/voices";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Face from "@shared/components/Face";
import { AGENT_SKILLS, TONES, agentIdNo, specialistBySlug, storeMeta, type ToneId } from "@/content/appData";
import { deleteCustom, release, setMeta, setPrefs, toast, updateAgent, updateCustom, useApp, type State } from "@/lib/store";
import Icon from "../Icon";
import { AgentTile } from "../faces";
import { kindOf, myAgents, nameOf } from "../agents";
import { closeAgent, useOverlays } from "../overlays";
import AgentIdCard, { type IdInfo } from "./AgentIdCard";
import { agentLevelOf } from "@/lib/store";
import { skillSlots } from "@/lib/perks";
import { Field, SkillPicker, Toggle, TonePicker, areaCls, inputCls, variant, type Look } from "./fields";
import FaceCreator from "./FaceCreator";
import OnchainCard from "./OnchainCard";
import AgentMoney from "../wallet/AgentMoney";
import AgentModelRow from "../billing/AgentModelRow";
import { lookVariant } from "@shared/components/avatar";
import type { AgentLook } from "@/lib/store";

const skillLabel = (id: string) => AGENT_SKILLS.find((k) => k.id === id)?.label ?? id;

export function idInfo(s: State, id: string): IdInfo {
  const k = kindOf(id); const sp = specialistBySlug(id); const c = s.custom.find((x) => x.id === id);
  const desk = Math.max(1, myAgents(s).findIndex((a) => a.id === id) + 1);
  const me = s.profile?.name || s.auth?.label || "You";
  const born = s.born[id] ?? c?.at ?? s.profile?.since ?? Date.now();
  if (k === "home") return { id, name: nameOf(s, id), role: "Personal agent", idNo: agentIdNo(id), desk, born, maker: me, kind: "Personal", look: s.agent?.look, bg: s.agent?.look && typeof s.agent.look === "object" ? s.agent.look.bg : undefined, memory: s.prefs.memory,
    chips: s.meta.home?.skills?.length ? s.meta.home.skills.map(skillLabel) : ["Own computer", "Lasting memory", "Can hire help"] };
  if (k === "custom") return { id, name: c?.name ?? "Agent", role: c?.role || "Custom agent", idNo: agentIdNo(id), desk, born, maker: me, kind: "Custom", look: null, bg: c?.bg, memory: c?.memory ?? true,
    chips: c?.skills.length ? c.skills.map(skillLabel) : ["Made by you"] };
  return { id, name: nameOf(s, id), role: sp?.job ?? "Specialist", idNo: agentIdNo(id), desk, born, maker: sp ? storeMeta(sp).maker : "Maker", kind: "Hired", look: null, memory: s.meta[id]?.memory ?? true, chips: sp?.tools ?? [] };
}

/** Agent info pane: the ID card, what it does, and edits you are allowed to make. */
export default function AgentPanel() {
  const { agent } = useOverlays();
  const s = useApp();
  if (!agent || !s) return null;
  const exists = agent === "home" || s.custom.some((c) => c.id === agent) || s.hired.includes(agent);
  if (!exists) return null;
  return <Panel key={agent} s={s} id={agent} />;
}

function Panel({ s, id }: { s: State; id: string }) {
  const router = useRouter();
  const k = kindOf(id);
  const sp = specialistBySlug(id);
  const c = s.custom.find((x) => x.id === id);
  const [tab, setTab] = useState<"about" | "edit">("about");
  const [flipped, setFlipped] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const info = idInfo(s, id);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wide = window.matchMedia("(min-width: 640px)").matches;
    gsap.fromTo(sheet.current, wide ? { x: 60, opacity: 0 } : { y: 60, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.4, ease: "power3.out" });
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeAgent(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  /* edit drafts */
  const [name, setName] = useState(k === "home" ? s.agent?.name ?? "" : c?.name ?? "");
  const [role, setRole] = useState(c?.role ?? "");
  const [about, setAbout] = useState(k === "home" ? s.meta.home?.about ?? s.prefs.instructions ?? "" : c?.about ?? "");
  const [tone, setTone] = useState<ToneId>(k === "home" ? s.agent?.tone ?? "short" : c?.tone ?? "warm");
  const [skills, setSkills] = useState<string[]>(k === "home" ? s.meta.home?.skills ?? ["web", "files", "code", "calendar"] : c?.skills ?? []);
  const [d0Skills] = useState(() => (k === "home" ? s.meta.home?.skills?.length ?? 4 : c?.skills.length ?? 0)); // agents that already had more keep them
  const [memory, setMemory] = useState(info.memory);
  const [lookHome, setLookHome] = useState<AgentLook>(s.agent?.look ?? null);
  const [look, setLook] = useState<Look>(c ? { shape: c.shape, color: c.color, eyes: c.eyes, mouth: c.mouth, extra: c.extra, blush: c.blush ?? (c.tone === "warm" || c.tone === "playful"), brows: c.brows, orbit: c.orbit, dots: c.dots, bg: c.bg } : { shape: "round", color: "purple", eyes: "oval", mouth: "smile" });
  const [nick, setNick] = useState(s.meta[id]?.nick ?? "");
  const [notes, setNotes] = useState(s.meta[id]?.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const [voice, setVoice] = useState<AgentVoice>(() => { const v = s.meta[id]?.voice ?? voiceOf(id); return { name: v.name || "", pitch: v.pitch ?? 1, rate: v.rate ?? 1, preset: (v as AgentVoice).preset }; });

  const save = () => {
    if (k === "home") {
      updateAgent({ name: name.trim() || s.agent?.name || "Juniper", look: lookHome, tone });
      setMeta("home", { about: about.trim(), skills });
      setPrefs({ memory });
    } else if (k === "custom") {
      updateCustom(id, { name: name.trim() || c!.name, role: role.trim(), about: about.trim(), tone, skills, memory, ...look });
    } else setMeta(id, { nick: nick.trim(), notes: notes.trim(), memory });
    setMeta(id, { voice });
    toast({ text: `Saved. ${k === "hired" ? nick.trim() || sp?.name : name.trim() || info.name} is up to date.`, face: k === "home" ? "home" : sp?.seed, color: sp?.color });
  };
  const remove = () => {
    if (k === "custom") deleteCustom(id); else release(id);
    toast({ text: k === "custom" ? `${info.name} was deleted` : `${info.name} left seat ${String(info.desk).padStart(2, "0")}`, face: "home" });
    closeAgent();
    if (window.location.pathname === `/agents/${encodeURIComponent(id)}`) router.replace("/agents");
  };
  const chat = () => { closeAgent(); router.push(`/agents/${id}`); };

  // what the card shows while you edit
  const preview: IdInfo = tab === "edit" && k !== "hired" ? { ...info, name: name.trim() || info.name, role: k === "custom" ? role.trim() || "Custom agent" : info.role, look: k === "home" ? lookHome : info.look, bg: k === "home" ? (lookHome && typeof lookHome === "object" ? lookHome.bg : undefined) : look.bg, memory, chips: skills.length ? skills.map(skillLabel) : info.chips }
    : tab === "edit" && k === "hired" ? { ...info, name: nick.trim() || sp?.name || info.name, memory } : info;
  const faceEl = tab === "edit" && k === "custom" ? <Face variant={variant(look)} size={96} animated /> : undefined;

  const tabBtn = (t: "about" | "edit", label: string) => <button role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 flex-1 rounded-full text-[14px] font-bold transition ${tab === t ? "bg-card text-ink shadow-[0_1px_0_var(--line),0_0_0_1px_var(--line)]" : "text-ink/60 hover:text-ink"}`}>{label}</button>;

  return (
    <div className="fixed inset-0 z-[78] flex items-end justify-end bg-black/45 backdrop-blur-[2px] sm:items-stretch" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAgent(); }}>
      <aside ref={sheet} role="dialog" aria-modal="true" aria-label={`${info.name}'s profile`} data-tour="agent-panel" className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-alt ring-1 ring-line sm:h-full sm:max-w-[460px] sm:rounded-none sm:rounded-l-[30px]">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <AgentTile id={id} look={s.agent?.look} size={36} radius={12} />
          <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-bold leading-tight text-ink">{info.name}</p><p className="truncate text-[12.5px] text-ink/55">{info.kind === "Personal" ? "Your personal agent" : info.kind === "Custom" ? "Made by you" : `Hired · by ${info.maker}`}</p></div>
          <button onClick={chat} className="flex h-9 items-center gap-1.5 rounded-full bg-grape px-3.5 text-[13.5px] font-bold text-white transition hover:bg-grape-deep"><Icon name="chat" size={15} />Chat</button>
          <button onClick={closeAgent} aria-label="Close" data-tour="panel-close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button>
        </header>
        <div className="no-bar min-h-0 flex-1 overflow-y-auto">
          <div className="carpet relative overflow-hidden px-4 pb-5 pt-1">
            <div className="pointer-events-none absolute left-1/2 top-24 h-56 w-56 -translate-x-1/2 rounded-full bg-[var(--glow)] blur-[70px]" />
            <div className={`relative origin-top transition-[transform,margin] duration-300 ${tab === "edit" ? "-mb-[78px] scale-[.8]" : ""}`}><AgentIdCard info={preview} flipped={flipped} onFlip={setFlipped} faceEl={faceEl} /></div>
            <div className="relative mt-3 flex items-center justify-center gap-2">
              <button onClick={() => setFlipped(!flipped)} className="flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-[12.5px] font-bold text-ink ring-1 ring-line transition hover:text-brand-ink"><Icon name="flip" size={14} />Flip card</button>
              {tab !== "edit" && <button onClick={chat} className="flex h-8 items-center gap-1.5 rounded-full bg-grape px-3 text-[12.5px] font-bold text-white transition hover:bg-grape-deep"><Icon name="chat" size={14} />Open chat</button>}
              <span className="text-[12px] text-ink/50">{tab === "edit" ? "Live preview" : "or tap the card"}</span>
            </div>
          </div>

          <div className="px-4 pb-8 sm:px-5">
            <div role="tablist" className="flex gap-1 rounded-full bg-tint p-1">{tabBtn("about", "About")}{tabBtn("edit", k === "hired" ? "Your notes" : "Edit")}</div>

            {tab === "about" ? (
              <div className="mt-4 space-y-4">
                <section className="rounded-[22px] bg-card p-4 ring-1 ring-line">
                  <h3 className="label text-[9.5px] text-ink/55">What it does</h3>
                  <p className="mt-1.5 text-[14.5px] leading-snug text-ink/85">{k === "home" ? s.meta.home?.about || `${info.name} is yours: it has its own computer, remembers what you tell it and can hire help.` : k === "custom" ? c?.about || "No instructions yet. Add some in Edit." : sp?.back}</p>
                  {s.meta[id]?.notes && <p className="mt-3 rounded-2xl bg-tint p-3 text-[13.5px] text-ink/75"><b className="text-ink">Your note:</b> {s.meta[id]!.notes}</p>}
                </section>
                <section className="grid grid-cols-2 gap-2">
                  {[["ID number", info.idNo], ["Desk", String(info.desk).padStart(2, "0")], ["Born", new Date(info.born).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })], ["Personality", TONES.find((t) => t.id === (k === "home" ? s.agent?.tone : c?.tone))?.label ?? (sp ? "Set by maker" : "-")], [info.kind === "Hired" ? "Maker" : "Owner", info.maker], ["Memory", info.memory ? "On" : "Off"]].map(([a, b]) => (
                    <div key={a} className="rounded-2xl bg-card p-3 ring-1 ring-line"><div className="label text-[8.5px] text-ink/50">{a}</div><div className="mt-0.5 truncate text-[14px] font-bold text-ink">{b}</div></div>
                  ))}
                </section>
                <section className="rounded-[22px] bg-card p-4 ring-1 ring-line">
                  <h3 className="label text-[9.5px] text-ink/55">{k === "hired" ? "Skills" : "Can do"}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">{(k === "hired" ? sp?.skills.map((x) => x[0]) ?? [] : info.chips).map((x) => <span key={x} className="rounded-full bg-tint px-3 py-1.5 text-[13px] font-semibold text-ink/80">{x}</span>)}</div>
                </section>
                <AgentModelRow agent={id} name={info.name} />
                <AgentMoney s={s} id={id} name={info.name} />
                {k !== "hired" && <OnchainCard s={s} id={id} name={info.name} role={info.role} bg={info.bg}
                  v={k === "home" ? lookVariant(s.agent?.look) : variant({ shape: c!.shape, color: c!.color, eyes: c!.eyes, mouth: c!.mouth, extra: c!.extra, blush: c!.blush ?? (c!.tone === "warm" || c!.tone === "playful"), brows: c!.brows, orbit: c!.orbit, dots: c!.dots, bg: c!.bg })} />}
                <button onClick={() => setTab("edit")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tint py-3 text-[14px] font-bold text-brand-ink transition hover:bg-grape hover:text-white"><Icon name="edit" size={15} />{k === "hired" ? "Add a nickname or notes" : `Edit ${info.name}`}</button>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {k === "hired" && <p className="flex gap-2.5 rounded-2xl bg-tint p-3.5 text-[13.5px] leading-snug text-ink/75"><Icon name="info" size={17} className="mt-0.5 shrink-0 text-brand-ink" /><span>{sp?.name} is made by <b className="text-ink">{info.maker}</b>. The maker controls its name, look, skills and instructions. You can add a nickname and private notes.</span></p>}
                {k === "hired" ? (
                  <>
                    <Field label="Nickname" hint="Only you see it"><input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 16))} placeholder={sp?.name} className={inputCls} /></Field>
                    <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} placeholder="Prefers short briefs. Ask for sources." className={areaCls} /></Field>
                  </>
                ) : (
                  <>
                    <div className={k === "custom" ? "grid gap-4 sm:grid-cols-2" : ""}>
                      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 16))} className={inputCls} /></Field>
                      {k === "custom" && <Field label="Role"><input value={role} onChange={(e) => setRole(e.target.value.slice(0, 28))} placeholder="Custom agent" className={inputCls} /></Field>}
                    </div>
                    <div><span className="label text-[9.5px] text-ink/60">Face</span><div className="mt-1.5">{k === "home" ? <FaceCreator value={lookVariant(lookHome)} onChange={setLookHome} name={name.trim() || info.name} /> : <FaceCreator value={variant(look)} onChange={(f) => setLook(f as Look)} name={name.trim() || info.name} />}</div></div>
                    <Field label="Instructions" hint="What it should always do"><textarea value={about} onChange={(e) => setAbout(e.target.value.slice(0, 400))} placeholder="Keep answers short. Always link sources." className={areaCls} /></Field>
                    <Field label="Personality"><TonePicker tone={tone} onChange={setTone} /></Field>
                    <div><span className="label text-[9.5px] text-ink/60">Skills</span><div className="mt-1.5"><SkillPicker skills={skills} onChange={setSkills} max={Math.max(skillSlots(agentLevelOf(s, id)), d0Skills)} /></div></div>
                  </>
                )}
                <VoicePicker value={voice} onChange={setVoice} name={k === "hired" ? nick.trim() || sp?.name || info.name : name.trim() || info.name} />
                <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-line">
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold text-ink">Memory</span><span className="block text-[12.5px] text-ink/60">{memory ? "Remembers what you tell it." : "Starts fresh every chat."}</span></span>
                  <Toggle on={memory} onChange={setMemory} label="Memory" />
                </div>
                <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-alt px-4 py-3 sm:-mx-5 sm:px-5">
                  <button onClick={() => setTab("about")} className="btn btn-line btn-sm text-ink">Cancel</button>
                  <button onClick={save} className="btn btn-brand btn-sm flex-1"><Icon name="check" size={16} stroke={2.6} />Save changes</button>
                </div>
                {k !== "home" && (
                  <div className="rounded-2xl p-3.5 ring-1 ring-[#f45b5b]/35">
                    {confirm ? (
                      <div>
                        <p className="text-[14px] font-bold text-ink">{k === "custom" ? `Delete ${info.name}?` : `Release ${info.name}?`}</p>
                        <p className="mt-0.5 text-[13px] text-ink/60">{k === "custom" ? "Its chat, wallet and card go too. This can't be undone." : "It leaves its seat. You can hire it again from the marketplace."}</p>
                        <div className="mt-3 flex gap-2"><button onClick={() => setConfirm(false)} className="btn btn-line btn-sm text-ink">Keep</button><button onClick={remove} className="btn btn-sm flex-1 bg-[#e5484d] text-white hover:bg-[#c93a3f]">{k === "custom" ? "Delete agent" : "Release seat"}</button></div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirm(true)} className="flex w-full items-center gap-2 text-left text-[14px] font-bold text-[#e5484d]"><Icon name="trash" size={16} />{k === "custom" ? "Delete agent" : "Release from seat"}</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
