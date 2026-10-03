"use client";

import { useEffect, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { publishMemory, registryAsset } from "@/lib/chain";
import { editNote, get, toast, useApp } from "@/lib/store";

/** Writes notes the user just asked to remember, once a card exists and a wallet is connected. */
export default function MemoryChain() {
  const s = useApp();
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const busy = useRef(false);
  const failed = useRef(new Set<string>());

  useEffect(() => {
    if (!s || busy.current || !wallet.publicKey) return;
    const asset = registryAsset(s.meta);
    if (!asset) return;
    const keyOf = (id: string, text: string) => `${id}:${text}`;
    if (!s.memory.some((n) => n.pendingChain && !n.chainHash && !failed.current.has(keyOf(n.id, n.text)))) return;
    busy.current = true;
    (async () => {
      try {
        for (;;) {
          const cur = get();
          const card = registryAsset(cur.meta);
          const w = walletRef.current;
          if (!card || !w.publicKey || !w.signMessage || !w.signTransaction || !w.wallet) return;
          const next = cur.memory.find((n) => n.pendingChain && !n.chainHash && !failed.current.has(keyOf(n.id, n.text)));
          if (!next) return;
          try {
            const pub = await publishMemory({
              connection,
              adapter: w.wallet.adapter,
              payer: { publicKey: w.publicKey, signTransaction: (tx) => w.signTransaction!(tx) },
              signMessage: (msg) => w.signMessage!(msg),
              asset: card,
              text: next.text,
            });
            editNote(next.id, { chainHash: pub.hash, chainAsset: card, pendingChain: false });
            toast({ text: "Saved on Solana.", face: "home" });
          } catch (e) {
            failed.current.add(keyOf(next.id, next.text));
            editNote(next.id, { pendingChain: false });
            const m = (e as Error)?.message || "Could not write it onchain.";
            toast({
              text: /reject|denied|cancel/i.test(m) ? "Kept on this device. The wallet cancelled the onchain save." : `Kept on this device. ${m.split("\n")[0].slice(0, 140)}`,
              face: "home",
            });
          }
        }
      } finally {
        busy.current = false;
      }
    })();
  }, [s, connection, wallet.publicKey]);

  return null;
}
