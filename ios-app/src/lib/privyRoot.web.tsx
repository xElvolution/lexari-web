import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

/** Browser Privy. The Expo SDK does not open Google inside a web page. The app id is enough here. */
export function PrivyRoot({ appId, children }: { appId: string; clientId?: string; children: ReactNode }) {
  if (!appId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { theme: "light", accentColor: "#5b2bff", walletChainType: "solana-only" },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
