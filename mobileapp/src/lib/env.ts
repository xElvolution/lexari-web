import Constants from "expo-constants";
import { asCluster, PROGRAM_ID, type Cluster } from "./network";

type Extra = {
  apiUrl?: string;
  cluster?: string;
  programId?: string;
  privyAppId?: string;
  privyClientId?: string;
  skrMint?: string;
  usdcMint?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export const env = {
  get apiUrl(): string {
    return (process.env.EXPO_PUBLIC_API_URL || extra().apiUrl || "https://app.lexari.ai").replace(/\/$/, "");
  },
  get cluster(): Cluster {
    return asCluster(process.env.EXPO_PUBLIC_SOLANA_CLUSTER || extra().cluster);
  },
  get programId(): string {
    return process.env.EXPO_PUBLIC_LEXARI_PROGRAM_ID || extra().programId || PROGRAM_ID;
  },
  get privyAppId(): string {
    return process.env.EXPO_PUBLIC_PRIVY_APP_ID || extra().privyAppId || "";
  },
  get privyClientId(): string {
    return process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || extra().privyClientId || "";
  },
  get skrMint(): string {
    return process.env.EXPO_PUBLIC_SKR_MINT || extra().skrMint || "";
  },
  get usdcMint(): string {
    return process.env.EXPO_PUBLIC_USDC_MINT || extra().usdcMint || "";
  },
  get privyOn(): boolean {
    return this.privyAppId.length > 8;
  },
};
