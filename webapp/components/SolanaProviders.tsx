"use client";

import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import type { Adapter } from "@solana/wallet-adapter-base";
import { SOLANA_RPC } from "@/lib/nft";

if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;

/** Phantom, Solflare and Backpack. The app draws its own connect buttons. */
export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<Adapter[]>([]);
  useEffect(() => {
    setWallets([new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()]);
  }, []);
  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect localStorageKey="lexari-wallet">
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
