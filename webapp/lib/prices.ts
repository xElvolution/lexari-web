/** Prices in US dollars, paid from your Lexari balance. Old hires paid on chain stay valid. */
export const HIRE_USD = Number(process.env.NEXT_PUBLIC_HIRE_USD || 1);
export const CARD_USD = Number(process.env.NEXT_PUBLIC_CARD_USD || 2);

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
export const hirePriceLabel = () => money(HIRE_USD);
export const cardPriceLabel = () => money(CARD_USD);
export const usdLabel = (micros: number) => `$${(Math.max(0, micros) / 1e6).toFixed(2)}`;

/** Legacy on-chain prices, only used to read old receipts. */
export const HIRE_LAMPORTS = 10_000_000;
export const HIRE_USDC = 1_000_000;
export const TREASURY = process.env.NEXT_PUBLIC_LEXARI_TREASURY || "";
export const CARD_LAMPORTS = Number(process.env.NEXT_PUBLIC_CARD_LAMPORTS || 20_000_000);
