import type { ActionCard, ActionStatus, IntegrationId } from "@/content/integrations";
import type { integrationActions } from "../db/integrationsSchema";
import { network, txExplorer } from "./solana";
import { TEMPO } from "./tempo";
import { EVM, isEvmChain } from "./evm";

type Row = typeof integrationActions.$inferSelect;
/** dev: proposed by a third-party agent (server/market/devtools.ts); its caps are checked again at Confirm */
export type Preview = { title: string; rows: [string, string][]; network: string; plan?: Record<string, unknown>; summary?: string; result?: [string, string][]; dev?: { listingId: string; label: string; perTxUsd: number; dailyUsd: number } };

const LABEL: Record<string, string> = {
  "solana.wallet": "Checked its Solana wallet", "solana.transfer": "Transfer on Solana", "orca.quote": "Orca quote", "orca.swap": "Swap on Orca",
  "jupiter.quote": "Jupiter quote", "polymarket.markets": "Polymarket markets", "base.wallet": "Checked its Base wallet",
  "ethereum.wallet": "Checked its Ethereum wallet", "prices.get": "Price check",
  "pay.services": "Checked its budget", "pay.service": "Paid an x402 service", "pay.agent": "Hired an agent for a task",
  "tempo.wallet": "Checked its Tempo wallet", "tempo.fund": "Tempo faucet", "tempo.transfer": "Send on Tempo", "tempo.topup": "Top up from Tempo",
  "ore.servers": "Checked the mining servers", "ore.control": "Miner command",
  "self.rename": "Rename", "self.setavatar": "New face", "self.setpersona": "New persona", "self.setmodel": "Switch model",
  "hyperliquid.account": "Checked its Hyperliquid account", "hyperliquid.price": "Hyperliquid prices", "hyperliquid.order": "Order on Hyperliquid",
  "monad.wallet": "Checked its Monad wallet", "nansen.wallet": "Nansen wallet read", "kuru.quote": "Kuru quote", "kuru.swap": "Swap on Kuru", "card.pay": "Tempo card payment", "nansen.smartmoney": "Nansen smart money", "intents.quote": "Aurora Intents quote", "intents.route": "Cross-chain route", "intents.status": "Aurora Intents status",
  "base.transfer": "Send on Base", "ethereum.transfer": "Send on Ethereum", "arbitrum.wallet": "Checked its Arbitrum wallet", "arbitrum.transfer": "Send on Arbitrum",
  "robinhood.wallet": "Checked its Robinhood Chain wallet", "robinhood.transfer": "Send on Robinhood Chain", "monad.transfer": "Send on Monad",
  "uniswap.quote": "Uniswap quote", "uniswap.swap": "Swap on Uniswap", "polymarket.market": "Polymarket market", "polymarket.order": "Order on Polymarket",
  "zcash.wallet": "Checked its Zcash wallet", "zcash.quote": "ZEC quote", "zcash.buy": "Buy ZEC",
  "panta.markets": "Panta markets", "panta.position": "Position on Panta", "panta.positions": "Panta positions", "panta.close": "Close a Panta position",
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
    title: p.title || p.summary || toolLabel(a.tool, a.input), rows: [...(p.rows || []), ...(p.result || [])], usd: a.usdMicros / 1e6, network: p.network || (a.chain === "solana" ? network() : a.chain === "tempo" ? TEMPO.network : ""),
    status: a.status as ActionStatus, ...(a.txSig ? { sig: a.txSig, explorer: a.chain === "tempo" ? TEMPO.explorerTx(a.txSig) : isEvmChain(a.chain) ? `${EVM[a.chain].txExplorer}${a.txSig}` : a.chain === "polygon" ? (a.txSig.startsWith("0x") && a.txSig.length === 66 ? `https://polygonscan.com/tx/${a.txSig}` : undefined) : a.chain === "intents" ? `https://solscan.io/tx/${a.txSig}` : a.chain === "hyperliquid" ? String((p.plan as { explorer?: string } | undefined)?.explorer || "") || undefined : txExplorer(a.txSig) } : {}), ...(a.error ? { error: a.error } : {}),
  };
}
