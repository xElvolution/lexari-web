export type Cluster = "devnet" | "mainnet-beta";

export function asCluster(raw: string | undefined | null): Cluster {
  return raw === "mainnet-beta" || raw === "mainnet" ? "mainnet-beta" : "devnet";
}

export function chainId(c: Cluster): "solana:mainnet" | "solana:devnet" {
  return c === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

export function networkBadge(c: Cluster): { tone: "real" | "test"; label: string } {
  if (c === "mainnet-beta") return { tone: "real", label: "Real money · Solana mainnet" };
  return { tone: "test", label: "TESTNET, not real money" };
}

export function solscanTx(sig: string, c: Cluster): string {
  const q = c === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://solscan.io/tx/${sig}${q}`;
}

export const PROGRAM_ID = "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po";
