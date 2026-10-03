"use client";

import { useEffect, useRef } from "react";
import { publishMemory, registryAsset } from "@/lib/chain";
import { friendly } from "@/lib/api";
import { editNote, get, toast, useApp } from "@/lib/store";
import { bridgeFor, useWalletBridge } from "@/lib/walletBridge";

/** Records the hash of memories you asked to keep onchain, once your agent has a card and your wallet can sign. */
export default function MemoryChain() {
  const s = useApp();
  const bridge = useWalletBridge();
  const busy = useRef(false);
  const failed = useRef(new Set<string>());

  useEffect(() => {
    if (!s || busy.current || !bridge) return;
    const ready = (n: (typeof s.memory)[number]) => n.pendingChain && !n.chainHash && n.serverId && n.hash && !failed.current.has(n.id);
    if (!registryAsset(s.meta) || !s.memory.some(ready)) return;
    busy.current = true;
    (async () => {
      try {
        for (;;) {
          const cur = get();
          const card = registryAsset(cur.meta);
          const signer = bridgeFor(cur.auth?.address);
          if (!card || !signer) return;
          const next = cur.memory.find(ready);
          if (!next) return;
          try {
            const r = await publishMemory({ bridge: signer, asset: card, hashHex: next.hash!, serverId: next.serverId! });
            editNote(next.id, { chainHash: next.hash, chainAsset: card, chainTx: r.sig || undefined, pendingChain: false });
            toast({ text: "Saved on Solana.", face: "home" });
          } catch (e) {
            failed.current.add(next.id);
            editNote(next.id, { pendingChain: false });
            toast({ text: `Kept in your account, not onchain. ${friendly(e)}`, face: "home" });
          }
        }
      } finally {
        busy.current = false;
      }
    })();
  }, [s, bridge]);

  return null;
}
