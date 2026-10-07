/** What can be bought, and for how much. Plans come from content/appData.ts, credit packs from content/billing.ts. */
import { PLANS, type PlanId } from "@/content/appData";
import { TOPUP_PACKS } from "@/content/billing";
import { HttpError } from "../http";

export type Product = "plan" | "credits";
export type Item = { product: Product; sku: string; usd: number; title: string; planId?: PlanId; seats?: number; creditsUsd?: number };

export function itemFor(product: Product, id: string): Item {
  if (product === "plan") {
    const p = PLANS.find((x) => x.id === id);
    if (!p || !p.usd) throw new HttpError(400, "Pick a paid plan.");
    if (p.later) throw new HttpError(400, `${p.name} opens later.`);
    return { product, sku: `plan-${p.id}`, usd: p.usd, title: `${p.name} plan, 30 days`, planId: p.id, seats: p.seats };
  }
  const usd = Number(id);
  if (!(TOPUP_PACKS as readonly number[]).includes(usd)) throw new HttpError(400, "Pick a credit pack.");
  return { product, sku: `credits-${usd}`, usd, title: `$${usd} of extra credits`, creditsUsd: usd };
}

export function itemFromSku(sku: string): Item {
  const [kind, id] = [sku.slice(0, sku.indexOf("-")), sku.slice(sku.indexOf("-") + 1)];
  return itemFor(kind === "plan" ? "plan" : "credits", id);
}
