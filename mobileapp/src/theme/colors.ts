/** Colors from shared/styles/theme.css. Black, purple, white. */
export const grape = "#5b2bff";
export const grapeDeep = "#3514b0";
export const grapeSoft = "#8f6bff";
export const lilac = "#c9b8ff";

export type Palette = {
  bg: string;
  alt: string;
  card: string;
  tint: string;
  ink: string;
  muted: string;
  line: string;
  brand: string;
};

export const light: Palette = {
  bg: "#ffffff",
  alt: "#f5f2ff",
  card: "#ffffff",
  tint: "#ece6ff",
  ink: "#0a0a0a",
  muted: "rgba(10,10,10,0.55)",
  line: "rgba(10,10,10,0.11)",
  brand: "#5b2bff",
};

export const dark: Palette = {
  bg: "#000000",
  alt: "#0b0915",
  card: "#13101f",
  tint: "#1d1731",
  ink: "#ffffff",
  muted: "rgba(255,255,255,0.62)",
  line: "rgba(255,255,255,0.13)",
  brand: "#a58bff",
};
