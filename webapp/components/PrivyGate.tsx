"use client";

import { useEffect } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { defaultSolanaRpcsPlugin, useCreateWallet, useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { onSignOut, setWalletBridge } from "@/lib/walletBridge";
import { SOLANA_CLUSTER } from "@/lib/nft";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const CHAIN = SOLANA_CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";

function toBytes(tx: Transaction | VersionedTransaction) {
  return tx instanceof VersionedTransaction ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}
function fromBytes<T extends Transaction | VersionedTransaction>(like: T, bytes: Uint8Array): T {
  return (like instanceof VersionedTransaction ? VersionedTransaction.deserialize(bytes) : Transaction.from(bytes)) as T;
}

let creating = false;
const signArgs = (tx: Transaction | VersionedTransaction) => ({ transaction: toBytes(tx), chain: CHAIN, options: { uiOptions: { showWalletUIs: false } } }) as unknown as Parameters<ReturnType<typeof useWallets>["wallets"][number]["signTransaction"]>[0];

/** Exposes the Privy (Google / email) Solana wallet to the rest of the app. Creates one if the account has none. */
function PrivyBridge() {
  const { ready, authenticated, logout } = usePrivy();
  useEffect(() => { onSignOut("privy", authenticated ? logout : null); return () => onSignOut("privy", null); }, [authenticated, logout]);
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const wallet = wallets.find((w) => /privy/i.test(w.standardWallet?.name || "")) || wallets[0];

  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || wallet || creating) return;
    creating = true;
    createWallet().catch(() => {}).finally(() => { creating = false; });
  }, [ready, authenticated, walletsReady, wallet, createWallet]);

  useEffect(() => {
    if (!authenticated || !wallet) { setWalletBridge(null, "privy"); return; }
    setWalletBridge({
      source: "privy",
      name: "Lexari wallet",
      publicKey: new PublicKey(wallet.address),
      // Lexari shows its own payment sheet (price, balance, devnet SOL top-up), so Privy's wallet screens stay hidden:
      // its "insufficient funds / add funds" path sent phones to an on-ramp page that can't load on devnet.
      signMessage: async (message) => (await wallet.signMessage({ message, options: { uiOptions: { showWalletUIs: false } } } as Parameters<typeof wallet.signMessage>[0])).signature,
      signTransaction: async (tx) => fromBytes(tx, (await wallet.signTransaction(signArgs(tx))).signedTransaction),
      signAllTransactions: async (txs) => {
        const out = [];
        for (const tx of txs) out.push(fromBytes(tx, (await wallet.signTransaction(signArgs(tx))).signedTransaction));
        return out;
      },
    }, "privy");
    return () => setWalletBridge(null, "privy");
  }, [authenticated, wallet]);
  return null;
}

/** Google / email sign-in through Privy, with a Privy Solana wallet for people without one. */
export default function PrivyGate({ children }: { children: React.ReactNode }) {
  if (!appId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        // No loginMethods here: the modal shows what the Privy dashboard enables (Google, email).
        appearance: { theme: "light", accentColor: "#5b2bff", walletChainType: "solana-only" },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        // Devnet RPCs for the embedded wallet (Privy's own endpoints for this app id).
        plugins: [defaultSolanaRpcsPlugin()],
      }}
    >
      <PrivyBridge />
      {children}
    </PrivyProvider>
  );
}
