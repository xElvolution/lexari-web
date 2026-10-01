"use client";

import { useEffect, useRef, useState } from "react";
import { createPublicClient, createWalletClient, custom, decodeEventLog, http, type EIP1193Provider } from "viem";
import { arbitrumSepolia } from "viem/chains";
import Face from "../../Face";
import type { Variant } from "../../avatar";
import Icon from "../Icon";
import { setMeta, toast, type State } from "@/lib/store";
import { NFT_ABI, NFT_CHAIN, bgIndex, cleanName, cleanRole, faceDna, faceFragment, nftAddress, tokenUrl, txUrl, type NftRecord } from "@/lib/nft";

type Phase = "idle" | "connecting" | "switching" | "signing" | "pending" | "error";
const eth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: EIP1193Provider }).ethereum : undefined);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Mint this agent's ID card as an NFT on Arbitrum Sepolia, and push face/name edits to it later. */
export default function OnchainCard({ s, id, name, role, v, bg }: { s: State; id: string; name: string; role: string; v: Variant; bg?: string }) {
  const rec = s.meta[id]?.nft;
  const holder = useRef<HTMLSpanElement>(null);
  const [addr, setAddr] = useState<`0x${string}` | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chain, setChain] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");

  const dna = faceDna(v, bg); const nm = cleanName(name); const rl = cleanRole(role);
  const faceChanged = !!rec && rec.dna !== dna; const cardChanged = !!rec && (rec.name !== nm || rec.role !== rl);

  useEffect(() => {
    setAddr(nftAddress());
    const p = eth(); setHasWallet(!!p); if (!p) return;
    p.request({ method: "eth_accounts" }).then((a) => setAccount(((a as string[])[0] as `0x${string}`) ?? null)).catch(() => {});
    p.request({ method: "eth_chainId" }).then((c) => setChain(parseInt(c as string, 16))).catch(() => {});
    const onAcc = (a: unknown) => setAccount(((a as string[])[0] as `0x${string}`) ?? null);
    const onChain = (c: unknown) => setChain(parseInt(c as string, 16));
    p.on?.("accountsChanged", onAcc); p.on?.("chainChanged", onChain);
    return () => { p.removeListener?.("accountsChanged", onAcc); p.removeListener?.("chainChanged", onChain); };
  }, []);

  const fail = (e: unknown) => {
    const m = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || "Something went wrong";
    setErr(/rejected|denied/i.test(m) ? "You cancelled it in your wallet." : m.split("\n")[0].slice(0, 160)); setPhase("error");
  };
  const connect = async () => {
    const p = eth(); if (!p) return; setPhase("connecting"); setErr("");
    try { const a = (await p.request({ method: "eth_requestAccounts" })) as string[]; setAccount(a[0] as `0x${string}`); setPhase("idle"); } catch (e) { fail(e); }
  };
  const switchNet = async () => {
    const p = eth(); if (!p) return; setPhase("switching"); setErr("");
    try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: NFT_CHAIN.hex }] }); }
    catch (e) {
      if ((e as { code?: number })?.code === 4902) {
        try { await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: NFT_CHAIN.hex, chainName: NFT_CHAIN.name, rpcUrls: [NFT_CHAIN.rpc], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, blockExplorerUrls: [NFT_CHAIN.explorer] }] }); }
        catch (e2) { fail(e2); return; }
      } else { fail(e); return; }
    }
    setChain(NFT_CHAIN.id); setPhase("idle");
  };

  const send = async (kind: "mint" | "update") => {
    const p = eth(); if (!p || !addr || !account) return;
    const face = faceFragment(holder.current?.querySelector("svg") ?? null);
    if (!face) { setErr("This face can't be stored onchain."); setPhase("error"); return; }
    setErr(""); setTx(""); setPhase("signing");
    const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: custom(p) });
    const pub = createPublicClient({ chain: arbitrumSepolia, transport: custom(p) });
    try {
      const bi = bgIndex(bg);
      const hashes: `0x${string}`[] = [];
      if (kind === "mint") {
        hashes.push(await wallet.writeContract({ address: addr, abi: NFT_ABI, functionName: "mint", args: [nm, rl, dna, face, bi] }));
      } else {
        const tid = BigInt(rec!.tokenId);
        const owner = (await pub.readContract({ address: addr, abi: NFT_ABI, functionName: "ownerOf", args: [tid] })) as string;
        if (owner.toLowerCase() !== account.toLowerCase()) { setErr(`Card #${rec!.tokenId} belongs to ${short(owner)}. Switch to that wallet to update it.`); setPhase("error"); return; }
        if (faceChanged) hashes.push(await wallet.writeContract({ address: addr, abi: NFT_ABI, functionName: "updateFace", args: [tid, dna, face, bi] }));
        if (cardChanged) hashes.push(await wallet.writeContract({ address: addr, abi: NFT_ABI, functionName: "updateCard", args: [tid, nm, rl] }));
      }
      setPhase("pending"); setTx(hashes[hashes.length - 1]);
      let tokenId = rec?.tokenId ?? "";
      for (const h of hashes) {
        const r = await pub.waitForTransactionReceipt({ hash: h });
        if (r.status !== "success") throw new Error("The transaction reverted.");
        if (kind === "mint") for (const l of r.logs) {
          try { const d = decodeEventLog({ abi: NFT_ABI, data: l.data, topics: l.topics }) as { eventName: string; args: { tokenId?: bigint } }; if (d.eventName === "Transfer" && d.args.tokenId !== undefined) tokenId = d.args.tokenId.toString(); } catch {}
        }
      }
      const next: NftRecord = { tokenId, tx: hashes[hashes.length - 1], dna, name: nm, role: rl, owner: account, at: Date.now() };
      setMeta(id, { nft: next }); setPhase("idle");
      toast({ text: kind === "mint" ? `${nm}'s ID card is onchain. Token #${tokenId}.` : `Card #${tokenId} updated onchain.`, face: "home" });
    } catch (e) { fail(e); }
  };

  const busy = phase === "connecting" || phase === "switching" || phase === "signing" || phase === "pending";
  const wrongNet = !!account && chain !== null && chain !== NFT_CHAIN.id;
  let status: { tone: "muted" | "ok" | "warn"; text: string };
  if (!addr) status = { tone: "muted", text: "Contract not deployed yet. Minting opens once it's live." };
  else if (!hasWallet) status = { tone: "muted", text: "No wallet found. Install a browser wallet like MetaMask or Rabby to mint." };
  else if (!account) status = { tone: "muted", text: "Connect a wallet to mint this card." };
  else if (wrongNet) status = { tone: "warn", text: `Your wallet is on another network. Switch to ${NFT_CHAIN.name}.` };
  else if (phase === "signing") status = { tone: "muted", text: "Confirm in your wallet…" };
  else if (phase === "pending") status = { tone: "muted", text: "Waiting for the network…" };
  else if (rec && (faceChanged || cardChanged)) status = { tone: "warn", text: `You changed ${faceChanged && cardChanged ? "the face and name" : faceChanged ? "the face" : "the name or role"} since minting. Update the NFT to match.` };
  else if (rec) status = { tone: "ok", text: `Minted as token #${rec.tokenId}. Up to date.` };
  else status = { tone: "muted", text: `Connected ${short(account)}. Minting is free apart from gas.` };

  const btn = "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45";
  return (
    <section data-tour="onchain-card" className="rounded-[22px] bg-card p-4 ring-1 ring-line">
      <span ref={holder} className="hidden" aria-hidden><Face variant={{ ...v, plain: false }} size={100} /></span>
      <div className="flex items-center justify-between gap-2">
        <h3 className="label text-[9.5px] text-ink/55">Onchain ID card</h3>
        <span className="label rounded-full bg-tint px-2 py-0.5 text-[8.5px] text-ink/60">{NFT_CHAIN.name}</span>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-snug text-ink/75">Mint this card as an NFT. The face, background, name and role are stored and drawn fully onchain, and you can update them later.</p>
      <p role="status" className={`mt-3 flex gap-2 rounded-2xl p-3 text-[13px] leading-snug ${status.tone === "ok" ? "bg-[#1f9d55]/12 text-ink" : status.tone === "warn" ? "bg-[#f5a524]/15 text-ink" : "bg-tint text-ink/70"}`}>
        <Icon name={status.tone === "ok" ? "check" : "info"} size={16} className="mt-0.5 shrink-0" />{status.text}
      </p>
      {phase === "error" && err && <p className="mt-2 rounded-2xl bg-[#e5484d]/12 p-3 text-[13px] leading-snug text-[#e5484d]">{err}</p>}
      <div className="mt-3 flex gap-2">
        {!addr ? <button disabled className={`${btn} bg-tint text-ink`}><Icon name="idcard" size={15} />Mint ID card as NFT</button>
          : !hasWallet ? <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className={`${btn} bg-tint text-ink hover:bg-grape hover:text-white`}><Icon name="wallet" size={15} />Get a wallet</a>
          : !account ? <button onClick={connect} disabled={busy} className={`${btn} bg-grape text-white hover:bg-grape-deep`}><Icon name="wallet" size={15} />{phase === "connecting" ? "Connecting…" : "Connect wallet"}</button>
          : wrongNet ? <button onClick={switchNet} disabled={busy} className={`${btn} bg-grape text-white hover:bg-grape-deep`}>{phase === "switching" ? "Switching…" : `Switch to ${NFT_CHAIN.name}`}</button>
          : !rec ? <button onClick={() => send("mint")} disabled={busy} className={`${btn} bg-grape text-white hover:bg-grape-deep`}><Icon name="idcard" size={15} />{phase === "signing" ? "Confirm in wallet…" : phase === "pending" ? "Minting…" : "Mint ID card as NFT"}</button>
          : <button onClick={() => send("update")} disabled={busy || !(faceChanged || cardChanged)} className={`${btn} bg-grape text-white hover:bg-grape-deep`}><Icon name="undo" size={15} />{phase === "signing" ? "Confirm in wallet…" : phase === "pending" ? "Updating…" : "Update NFT"}</button>}
      </div>
      {(rec || tx) && addr && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
          {rec && <a href={tokenUrl(addr, rec.tokenId)} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">View token #{rec.tokenId} ↗</a>}
          {(tx || rec?.tx) && <a href={txUrl(tx || rec!.tx)} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">Last transaction ↗</a>}
        </div>
      )}
    </section>
  );
}
