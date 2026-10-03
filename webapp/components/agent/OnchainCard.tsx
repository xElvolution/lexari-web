"use client";

import { useEffect, useRef, useState } from "react";
import { PublicKey, type Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import Face from "@shared/components/Face";
import type { Variant } from "@shared/components/avatar";
import Icon from "../Icon";
import { setMeta, toast, type State } from "@/lib/store";
import { CHAIN_NAME, cleanName, cleanRole, faceDna, faceFragment, faceSvg, tokenUrl, txUrl, type NftRecord } from "@/lib/nft";
import { mintCard, programIsLive, updateCard } from "@/lib/chain";
import { WALLETS } from "@/content/appData";

type Phase = "idle" | "connecting" | "signing" | "pending" | "error";
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const isSig = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(s);
function solAsset(id?: string) {
  if (!id || /^\d+$/.test(id)) return false;
  try { new PublicKey(id); return true; } catch { return false; }
}

/** Mint this agent's ID card as a Metaplex Core NFT, and push face and name edits to it later. */
export default function OnchainCard({ s, id, name, role, v, bg, cta = "Mint ID card as NFT", prominent = false, onMinted }: { s: State; id: string; name: string; role: string; v: Variant; bg?: string; cta?: string; prominent?: boolean; onMinted?: () => void }) {
  const saved = s.meta[id]?.nft;
  const rec = saved && solAsset(saved.tokenId) ? saved : undefined;
  const holder = useRef<HTMLSpanElement>(null);
  const { connection } = useConnection();
  const { publicKey, wallets, wallet, signTransaction } = useWallet();
  const [live, setLive] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");

  const dna = faceDna(v, bg); const nm = cleanName(name); const rl = cleanRole(role);
  const faceChanged = !!rec && rec.dna !== dna;
  const cardChanged = !!rec && (rec.name !== nm || rec.role !== rl);
  const registryOpen = !!rec && rec.registered === false;

  useEffect(() => {
    let on = true;
    programIsLive(connection).then((v) => { if (on) setLive(v); }).catch(() => { if (on) setLive(false); });
    return () => { on = false; };
  }, [connection]);

  const fail = (e: unknown) => {
    const m = (e as Error)?.message || "Something went wrong";
    setErr(/reject|denied|cancel/i.test(m) ? "You cancelled it in your wallet." : m.split("\n")[0].slice(0, 180));
    setPhase("error");
  };

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  const preferred = WALLETS.find((w) => w.id === s.auth?.wallet)?.name;
  const pick = installed.find((w) => w.adapter.name === preferred) ?? installed[0];

  const connect = async () => {
    if (!pick) return;
    setPhase("connecting"); setErr("");
    try {
      if (!pick.adapter.connected) await pick.adapter.connect();
      setPhase("idle");
    } catch (e) { fail(e); }
  };

  const send = async (kind: "mint" | "update") => {
    const adapter = wallet?.adapter ?? pick?.adapter;
    if (!publicKey || !signTransaction || !adapter) return;
    const face = faceFragment(holder.current?.querySelector("svg") ?? null);
    if (!face) { setErr("This face can't be stored with the card."); setPhase("error"); return; }
    setErr(""); setTx(""); setPhase("signing");
    try {
      const bal = await connection.getBalance(publicKey);
      if (bal === 0) {
        setErr(`This wallet has no SOL on ${CHAIN_NAME}. Add a little, then try again.`);
        setPhase("error");
        return;
      }
      const payer = { publicKey, signTransaction: (tx: Transaction) => signTransaction(tx) };
      setPhase("pending");
      if (kind === "mint") {
        const next = await mintCard({ connection, adapter, payer, name: nm, role: rl, dna, svg: faceSvg(face) });
        setMeta(id, { nft: next });
        setTx(next.tx);
        setPhase("idle");
        onMinted?.();
        toast({
          text: next.registered ? `${nm}'s ID card is on Solana.` : `${nm}'s card was minted. Press Update to finish the registry.`,
          face: "home",
        });
      } else {
        const res = await updateCard({ connection, adapter, payer, asset: rec!.tokenId, name: nm, role: rl, dna, svg: faceSvg(face) });
        const next: NftRecord = { ...rec!, tx: res.tx, dna, name: nm, role: rl, owner: publicKey.toBase58(), at: Date.now(), uri: res.uri, registered: true };
        setMeta(id, { nft: next });
        setTx(res.tx);
        setPhase("idle");
        toast({ text: `${nm}'s card is updated on Solana.`, face: "home" });
      }
    } catch (e) { fail(e); }
  };

  const busy = phase === "connecting" || phase === "signing" || phase === "pending";
  const needsUpdate = faceChanged || cardChanged || registryOpen;
  let status: { tone: "muted" | "ok" | "warn"; text: string };
  if (live === null) status = { tone: "muted", text: "Checking the Lexari program…" };
  else if (live === false) status = { tone: "warn", text: `The Lexari program is not on ${CHAIN_NAME} yet.` };
  else if (!installed.length && !publicKey) status = { tone: "muted", text: "No Solana wallet found. Install Phantom, Solflare or Backpack to mint." };
  else if (!publicKey) status = { tone: "muted", text: "Connect a wallet to mint this card." };
  else if (phase === "signing" || phase === "pending") status = { tone: "muted", text: phase === "signing" ? "Confirm in your wallet…" : "Waiting for Solana…" };
  else if (registryOpen) status = { tone: "warn", text: "The card is minted. The registry write did not finish. Update it to try again." };
  else if (rec && (faceChanged || cardChanged)) status = { tone: "warn", text: `You changed ${faceChanged && cardChanged ? "the face and the name" : faceChanged ? "the face" : "the name or role"} since minting. Update the card to match.` };
  else if (rec) status = { tone: "ok", text: `Minted on ${CHAIN_NAME}. Up to date.` };
  else status = { tone: "muted", text: `Connected ${short(publicKey.toBase58())}. Minting uses a little SOL on ${CHAIN_NAME}.` };

  const btn = (prominent ? "h-12 text-[15.5px] shadow-[0_5px_0_#3514b0] " : "h-10 text-[13.5px] ") + "flex flex-1 items-center justify-center gap-1.5 rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-45";
  const lastTx = tx || rec?.tx || "";
  return (
    <section data-tour="onchain-card" className="rounded-[22px] bg-card p-4 ring-1 ring-line">
      <span ref={holder} className="hidden" aria-hidden><Face variant={{ ...v, plain: false }} size={100} /></span>
      <div className="flex items-center justify-between gap-2">
        <h3 className="label text-[9.5px] text-ink/55">Onchain ID card</h3>
        <span className="label rounded-full bg-tint px-2 py-0.5 text-[8.5px] text-ink/60">{CHAIN_NAME}</span>
      </div>
      <p className={`mt-1.5 leading-snug text-ink/75 ${prominent ? "text-[13px]" : "text-[13.5px]"}`}>Mint this card as an NFT you own. The picture is stored on Arweave. Solana keeps the name, role and face recipe, and you can update them later.</p>
      <p role="status" className={`mt-3 flex gap-2 rounded-2xl p-3 text-[13px] leading-snug ${status.tone === "ok" ? "bg-[#1f9d55]/12 text-ink" : status.tone === "warn" ? "bg-[#f5a524]/15 text-ink" : "bg-tint text-ink/70"}`}>
        <Icon name={status.tone === "ok" ? "check" : "info"} size={16} className="mt-0.5 shrink-0" />{status.text}
      </p>
      {phase === "error" && err && <p className="mt-2 rounded-2xl bg-[#e5484d]/12 p-3 text-[13px] leading-snug text-[#e5484d]">{err}</p>}
      <div className="mt-3 flex gap-2">
        {live === false ? <button disabled className={`${btn} !shadow-none bg-tint text-ink`}><Icon name="idcard" size={15} />{cta}</button>
          : !publicKey && !installed.length ? <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className={`${btn} bg-tint text-ink hover:bg-grape hover:text-white`}><Icon name="wallet" size={15} />Get Phantom</a>
          : !publicKey ? <button onClick={connect} disabled={busy || !pick} className={`${btn} bg-grape text-white hover:bg-grape-deep`}><Icon name="wallet" size={15} />{phase === "connecting" ? "Connecting…" : `Connect ${pick?.adapter.name ?? "wallet"}`}</button>
          : !rec ? <button onClick={() => send("mint")} disabled={busy || live !== true} className={`${btn} bg-grape text-white hover:bg-grape-deep`}><Icon name="idcard" size={15} />{phase === "signing" ? "Confirm in wallet…" : phase === "pending" ? "Minting…" : cta}</button>
          : <button onClick={() => send("update")} disabled={busy || !needsUpdate} className={`${btn} bg-grape text-white hover:bg-grape-deep`}><Icon name="undo" size={15} />{phase === "signing" ? "Confirm in wallet…" : phase === "pending" ? "Updating…" : "Update NFT"}</button>}
      </div>
      {(rec || isSig(lastTx)) && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
          {rec && <a href={tokenUrl(rec.tokenId)} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">View card {short(rec.tokenId)} ↗</a>}
          {isSig(lastTx) && <a href={txUrl(lastTx)} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">Last transaction ↗</a>}
        </div>
      )}
    </section>
  );
}
