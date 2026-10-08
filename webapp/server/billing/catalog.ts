/** What can be bought, and for how much. Plans come from content/appData.ts, credit packs from content/billing.ts. */
import { PLANS, isPeriod, planPrice, type Period, type PlanId } from "@/content/appData";
import { TOPUP_MAX_USD, TOPUP_PACKS } from "@/content/billing";
import { HttpError } from "../http";

export type Product = "plan" | "credits";
export type Item = { product: Product; sku: string; usd: number; title: string; planId?: PlanId; seats?: number; period?: Period; creditsUsd?: number };

/** Plan skus: "plan-pro" (monthly, as before yearly existed) and "plan-pro-yearly". */
export const planSku = (id: string, period: Period) => (period === "yearly" ? `plan-${id}-yearly` : `plan-${id}`);
export const planTitle = (name: string, period: Period) => (period === "yearly" ? `${name} plan, yearly` : `${name} plan, monthly`);

/** Prices every purchase on the server from the catalog. The period is validated here; a price from the client is never used. */
export function itemFor(product: Product, id: string, period: unknown = "monthly"): Item {
  if (product === "plan") {
    if (!isPeriod(period)) throw new HttpError(400, "Pick monthly or yearly.");
    const p = PLANS.find((x) => x.id === id);
    if (!p || !p.usd) throw new HttpError(400, "Pick a paid plan.");
    if (p.later) throw new HttpError(400, `${p.name} opens later.`);
    return { product, sku: planSku(p.id, period), usd: planPrice(p, period), title: planTitle(p.name, period), planId: p.id, seats: p.seats, period };
  }
  // A pack, or (to cover a shortfall such as a yearly plan) any whole dollar amount up to TOPUP_MAX_USD.
  const usd = Number(id);
  if (!(TOPUP_PACKS as readonly number[]).includes(usd) && !(Number.isInteger(usd) && usd >= 1 && usd <= TOPUP_MAX_USD)) throw new HttpError(400, "Pick a top up amount.");
  return { product, sku: `credits-${usd}`, usd, title: `$${usd} of extra credits`, creditsUsd: usd };
}

export function itemFromSku(sku: string): Item {
  const [kind, ...rest] = sku.split("-");
  if (kind === "plan") {
    const yearly = rest[rest.length - 1] === "yearly";
    return itemFor("plan", (yearly ? rest.slice(0, -1) : rest).join("-"), yearly ? "yearly" : "monthly");
  }
  return itemFor("credits", rest.join("-"));
}
