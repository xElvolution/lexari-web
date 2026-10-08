import type { ActionCard, ActionStatus, IntegrationId } from "@/content/integrations";
import type { integrationActions } from "../db/integrationsSchema";
import { network, txExplorer } from "./solana";

type Row = typeof integrationActions.$inferSelect;
export type Preview = { title: string; rows: [string, string][]; network: string; plan?: Record<string, unknown>; summary?: string; result?: [string, string][] };

const LABEL: Record<string, string> = {
  "solana.wallet": "Checked its Solana wallet", "solana.transfer": "Transfer on Solana", "orca.quote": "Orca quote", "orca.swap": "Swap on Orca",
  "jupiter.quote": "Jupiter quote", "polymarket.markets": "Polymarket markets", "base.wallet": "Checked its Base wallet",
  "ethereum.wallet": "Checked its Ethereum wallet", "prices.get": "Price check",
};
/** A readable title for an action that never got a preview (refused before it was prepared). */
export function toolLabel(tool: string, input: unknown): string {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const amt = typeof i.amount === "number" && i.amount > 0 ? +i.amount.toFixed(6) : null;
  const asset = String(i.sell || i.from || i.asset || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  if (tool === "orca.swap" && amt && asset) return `Swap ${amt} ${asset} on Orca`;
  if (tool === "solana.transfer" && amt && asset) return `Send ${amt} ${asset}`;
  return LABEL[tool] || "Integration action";
}

/** What the chat card and the activity list show for one action. */
export function cardOf(a: Row): ActionCard {
  const p = (a.preview || {}) as Partial<Preview>;
  return {
    id: a.id, connector: a.connector as IntegrationId, tool: a.tool, agent: a.agentSlug,
    title: p.title || p.summary || toolLabel(a.tool, a.input), rows: [...(p.rows || []), ...(p.result || [])], usd: a.usdMicros / 1e6, network: p.network || (a.chain === "solana" ? network() : ""),
    status: a.status as ActionStatus, ...(a.txSig ? { sig: a.txSig, explorer: txExplorer(a.txSig) } : {}), ...(a.error ? { error: a.error } : {}),
  };
}
