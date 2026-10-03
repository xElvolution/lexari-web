/** Devnet hire prices. SOL is the default. USDC is used when NEXT_PUBLIC_USDC_MINT is set. */
export const HIRE_LAMPORTS = 10_000_000;
export const HIRE_USDC = 1_000_000;

export function hireMint(): "SOL" | "USDC" {
  return process.env.NEXT_PUBLIC_USDC_MINT ? "USDC" : "SOL";
}

export function hirePriceLabel() {
  return hireMint() === "USDC" ? "1 USDC" : "0.01 SOL";
}

export const TREASURY = process.env.NEXT_PUBLIC_LEXARI_TREASURY || "EbYuw4JQyG8iTwcEnhQLqPaTounTBDV5i3ApKuyjZDb";
