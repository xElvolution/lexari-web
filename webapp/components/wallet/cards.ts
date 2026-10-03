/**
 * Agent payment cards. Each agent buys its own card; none are free.
 * There is no card issuer connected yet, so no card can be bought and nothing is charged.
 * When an issuer is wired up, set NEXT_PUBLIC_CARDS_LIVE=1 and replace the disabled step in GetCardDialog.
 */
export const CARDS_LIVE = process.env.NEXT_PUBLIC_CARDS_LIVE === "1";
export const CARD_LIMITS = [100, 250, 500, 1000];
export const CARDS_SOON = "Card payments are not switched on yet. Nothing is charged and no card is made.";
