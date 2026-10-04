"use client";

import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { onSignOut, setWalletBridge, setWalletConnector } from "@/lib/walletBridge";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import type { Adapter } from "@solana/wallet-adapter-base";
import { SOLANA_RPC } from "@/lib/nft";

if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;

function Bridge() {
  const wallet = useWallet();
  useEffect(() => { onSignOut("adapter", wallet.connected ? () => wallet.disconnect() : null); }, [wallet]);
  useEffect(() => {
    setWalletConnector(async (preferred) => {
      // Installed only: a "loadable" wallet on a phone would leave Lexari for the wallet app mid-action.
      const ok = (w: (typeof wallet.wallets)[number]) => w.readyState === WalletReadyState.Installed && !/mobile wallet adapter|privy/i.test(w.adapter.name);
      const pick = wallet.wallets.find((w) => ok(w) && (!preferred || w.adapter.name.toLowerCase() === preferred.toLowerCase())) ?? wallet.wallets.find(ok);
      if (!pick) throw new Error("No Solana wallet in this browser. Open Lexari inside your wallet app.");
      if (wallet.wallet?.adapter.name !== pick.adapter.name) wallet.select(pick.adapter.name);
      if (!pick.adapter.connected) await pick.adapter.connect();
    });
    return () => setWalletConnector(null);
  }, [wallet]);
  useEffect(() => {
    const { publicKey, signTransaction, signAllTransactions, signMessage } = wallet;
    if (!publicKey || !signTransaction || !signMessage) { setWalletBridge(null, "adapter"); return; }
    setWalletBridge({
      source: "adapter",
      name: wallet.wallet?.adapter.name || "Wallet",
      publicKey,
      signTransaction: (tx) => signTransaction(tx),
      signAllTransactions: signAllTransactions ? (txs) => signAllTransactions(txs) : undefined,
      signMessage: (msg) => signMessage(msg),
    }, "adapter");
    return () => setWalletBridge(null, "adapter");
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
