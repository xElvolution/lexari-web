/**
 * The protocols on Lexari, from integrations/ in the repo (built into integrations.generated.json by
 * integrations/scripts/validate.ts --write). A built-in entry takes its live status from the connector catalog, so a
 * connector waiting for a server key shows "Setup needed" here too.
 */
import data from "./integrations.generated.json";
import { INTEGRATIONS } from "./integrations";

export type ProtocolStatus = "live-devnet" | "live-testnet" | "live" | "market-data" | "setup-needed" | "coming-soon" | "in-review";
export type ProtocolCategory = "chains" | "trading" | "prediction" | "data" | "compute" | "payments";
export type Protocol = {
  slug: string; name: string; kind: "built-in" | "dapp"; connector?: string; category: ProtocolCategory; status: ProtocolStatus;
  description: string; website: string; docs: string; api?: string; chains: string[];
  contracts: { chain: string; address: string; label: string }[];
  contact: { name: string; github: string; email?: string; x?: string };
  logo: string; logoBackground?: "light" | "dark"; actions: { text: string; live: boolean }[];
  agent?: { id: string; tools: { name: string; intents?: string[] }[] };
};

export const APPLY_URL = "https://github.com/xElvolution/lexari/blob/main/integrations/README.md";
export const NEW_PR_URL = "https://github.com/xElvolution/lexari/compare";

export const PROTOCOL_STATUS: Record<ProtocolStatus, { label: string; tone: "live" | "data" | "wait" }> = {
  "live-devnet": { label: "Live on devnet", tone: "live" },
  "live-testnet": { label: "Live on testnet", tone: "live" },
  live: { label: "Live", tone: "live" },
  "market-data": { label: "Market data", tone: "data" },
  "setup-needed": { label: "Setup needed", tone: "wait" },
  "coming-soon": { label: "Coming soon", tone: "wait" },
  "in-review": { label: "In review", tone: "wait" },
};
export const PROTOCOL_CATS: { id: ProtocolCategory | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "chains", label: "Chains" }, { id: "trading", label: "Trading" },
  { id: "prediction", label: "Prediction" }, { id: "data", label: "Data" }, { id: "compute", label: "Compute" }, { id: "payments", label: "Payments" },
];

const FROM_CONNECTOR: Record<string, ProtocolStatus> = { devnet: "live-devnet", live: "live-testnet", testnet: "live-testnet", market: "market-data", needskey: "setup-needed", soon: "coming-soon" };

export const PROTOCOLS: Protocol[] = (data as Protocol[]).map((p) => {
  const c = p.connector ? INTEGRATIONS.find((i) => i.id === p.connector) : undefined;
  if (!c) return p;
  const status = FROM_CONNECTOR[c.status] ?? p.status;
  // live flags that depend on server setup (Polymarket orders, Zcash buys) follow the connector too
  const actions = p.actions.map((a) => { const m = c.can.find((x) => x.text === a.text); return m ? { ...a, live: m.live } : a; });
  return { ...p, status, actions };
});
export const protocolBySlug = (slug: string) => PROTOCOLS.find((p) => p.slug === slug);

/**
 * What the public page shows: only protocols agents can use right now, and only the actions that work today. Anything
 * waiting on server setup, coming later or in review stays off the page entirely.
 */
export const isAvailable = (p: Protocol) => PROTOCOL_STATUS[p.status].tone !== "wait";
export const publicProtocols = (list: Protocol[] = PROTOCOLS): Protocol[] =>
  list.filter(isAvailable).map((p) => ({ ...p, actions: p.actions.filter((a) => a.live) })).filter((p) => p.actions.length > 0);
export const PUBLIC_PROTOCOLS = publicProtocols();
