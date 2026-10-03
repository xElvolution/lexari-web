"use client";

import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { setWalletBridge } from "@/lib/walletBridge";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import type { Adapter } from "@solana/wallet-adapter-base";
import { SOLANA_RPC } from "@/lib/nft";

if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;

function Bridge() {
  const wallet = useWallet();
  useEffect(() => {
    if (!wallet.publicKey || !wallet.signTransaction) { setWalletBridge(null); return; }
    setWalletBridge({
      publicKey: wallet.publicKey,
      signTransaction: (tx) => wallet.signTransaction!(tx),
      signMessage: wallet.signMessage ? (msg) => wallet.signMessage!(msg) : undefined,
    });
    return () => setWalletBridge(null);
  }, [wallet]);
  return null;
}

/** Phantom, Solflare and Backpack. The app draws its own connect buttons. */
export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<Adapter[]>([]);
  useEffect(() => {
    setWallets([new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()]);
  }, []);
  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect localStorageKey="lexari-wallet">
        <Bridge />
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
