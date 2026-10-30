"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Chain = { assetId: string; chain: string; chainName: string; decimals: number; direct?: boolean; network?: string; note?: string };
type Coin = { symbol: string; name: string; price: number; logo: string | null; chains: Chain[] };
type Addr = { ready: boolean; coin: string; chain: string; address?: string; memo?: string | null; receive?: string; deadline?: string | null; qr?: string; direct?: boolean; note?: string };

function CoinLogo({ c, size = 32 }: { c: Coin; size?: number }) {
  const [bad, setBad] = useState(false);
  if (c.logo && !bad) return <img src={c.logo} alt="" width={size} height={size} onError={() => setBad(true)} className="rounded-full bg-white" />;
  return <span style={{ width: size, height: size }} className="grid place-items-center rounded-full bg-tint text-[11px] font-extrabold text-brand-ink">{c.symbol.slice(0, 3)}</span>;
}

/** Deposit any coin Aurora Intents takes. It lands as USDC in the agent's one balance. */
export default function DepositPicker({ agent, name, onClose }: { agent: string; name: string; onClose: () => void }) {
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [coin, setCoin] = useState<Coin | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [amount, setAmount] = useState("");
  const [addr, setAddr] = useState<Addr | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<{ ready: boolean; coins: Coin[] }>("/api/agents/deposit").then((r) => { setCoins(r.coins); setReady(r.ready); }).catch(() => setErr("Couldn't load coins from Aurora Intents.")); }, []);
  const list = useMemo(() => (coins || []).filter((c) => !q || `${c.symbol} ${c.name}`.toLowerCase().includes(q.toLowerCase())), [coins, q]);
  const go = async () => {
    if (!chain) return;
    setBusy(true); setErr("");
    try { setAddr(await api<Addr>("/api/agents/deposit", { body: { agent, assetId: chain.assetId, amount: Number(amount) } })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't get an address."); }
    setBusy(false);
  };
  return (
    <div data-deposit-picker className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-[460px] overflow-y-auto rounded-[26px] bg-card p-5 ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-extrabold text-ink">{coin ? `Deposit ${coin.symbol}` : `Deposit to ${name}`}</h2>
          <button onClick={coin ? () => { setCoin(null); setChain(null); setAddr(null); } : onClose} className="rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-ink/70">{coin ? "Back" : "Close"}</button>
        </div>
        <p className="mt-1 text-[12.5px] text-ink/60">Send any of {coins?.length ?? "these"} coins. Aurora Intents converts it to USDC in {name}&apos;s balance.</p>
        {!coin ? (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coins" className="mt-3 w-full rounded-2xl bg-tint px-4 py-3 text-[14px] text-ink outline-none" />
            {!coins && !err && <p className="mt-4 text-[13px] text-ink/60">Loading coins…</p>}
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {list.map((c) => (
                <li key={c.symbol}><button onClick={() => { setCoin(c); setChain(c.chains[0]); }} className="flex w-full items-center gap-2.5 rounded-2xl bg-tint/60 p-2.5 text-left hover:bg-tint">
                  <CoinLogo c={c} /><span className="min-w-0"><span className="block text-[14px] font-bold text-ink">{c.symbol}</span><span className="block truncate text-[11.5px] text-ink/55">{c.name}</span></span>
                </button></li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3"><CoinLogo c={coin} size={40} /><div><div className="font-bold text-ink">{coin.name}</div><div className="text-[12px] text-ink/55">About ${coin.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}</div></div></div>
            <label className="block text-[12px] font-semibold text-ink/60">Sending from
              <select value={chain?.assetId} onChange={(e) => { setChain(coin.chains.find((x) => x.assetId === e.target.value) || null); setAddr(null); }} className="mt-1 w-full rounded-2xl bg-tint px-3 py-2.5 text-[14px] text-ink">
                {coin.chains.map((x) => <option key={x.assetId} value={x.assetId}>{x.direct ? `${x.network} (direct to ${name}'s wallet)` : `${x.chainName} (converts via Aurora Intents)`}</option>)}
              </select>
            </label>
            {chain?.direct ? <p className="rounded-2xl bg-tint p-3 text-[12.5px] text-ink/70"><b>{chain.network}.</b> {chain.note}</p> : <label className="block text-[12px] font-semibold text-ink/60">Amount of {coin.symbol}
              <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setAddr(null); }} inputMode="decimal" placeholder="0.00" className="mt-1 w-full rounded-2xl bg-tint px-3 py-2.5 text-[14px] text-ink outline-none" />
            </label>}
            {!ready && !chain?.direct && <p className="rounded-2xl bg-tint p-3 text-[12.5px] text-ink/70">Deposits from other chains aren&apos;t available right now.</p>}
            <button disabled={busy || (!chain?.direct && (!ready || !(Number(amount) > 0)))} onClick={go} className="w-full rounded-2xl bg-grape py-3 text-[14px] font-bold text-white disabled:opacity-40">{busy ? "Getting address…" : chain?.direct ? `Show ${name}'s ${chain.network} address` : "Get deposit address"}</button>
            {addr?.address && (
              <div className="rounded-2xl bg-tint p-4 text-center">
                <div className="mx-auto w-[180px] rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: addr.qr || "" }} />
                <button onClick={() => navigator.clipboard?.writeText(addr.address!)} className="mt-2 break-all font-mono text-[12px] text-ink/80">{addr.address}</button>
                {addr.memo && <p className="mt-1 text-[12px] font-bold text-ink">Memo (required): {addr.memo}</p>}
                {addr.direct ? <p className="mt-2 text-[12px] text-ink/60"><b>Network: {addr.chain}.</b> {addr.note}</p> : <p className="mt-2 text-[12px] text-ink/60">Send exactly {amount} {coin.symbol} on {addr.chain}. {name} gets about {addr.receive} USDC. This address is for this deposit only.</p>}
              </div>
            )}
          </div>
        )}
        {err && <p className="mt-3 text-[12.5px] text-red-600">{err}</p>}
      </div>
    </div>
  );
}
