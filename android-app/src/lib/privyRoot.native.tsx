import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/expo";

/** Native Privy. Needs the app id and the Expo client id from the dashboard. */
export function PrivyRoot({ appId, clientId, children }: { appId: string; clientId?: string; children: ReactNode }) {
  if (!appId) return <>{children}</>;
  return <PrivyProvider appId={appId} clientId={clientId || undefined}>{children}</PrivyProvider>;
}
