"use client";

import { PrivyProvider } from "@privy-io/react-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

/** Google / email sign-in through Privy. Solana wallets stay on the existing adapter. */
export default function PrivyGate({ children }: { children: React.ReactNode }) {
  if (!appId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        // No loginMethods here: the modal shows what the Privy dashboard enables (Google, email).
        appearance: { theme: "light", accentColor: "#5b2bff", walletChainType: "solana-only" },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
