/** Store cosmetics: chat backgrounds and your bubble style. Prices match server/hub/offchain.ts (the server charges). */
export type Cosmetic = { id: string; kind: "bg" | "bubble"; name: string; price: number };
/**
 * Store sections, in the order they show. To add a category: add its kind to Cosmetic["kind"], a row here,
 * its items to STORE_ITEMS, a preview in components/hub/store.tsx, and (server) its prices in server/hub/offchain.ts STORE.
 */
export const STORE_CATEGORIES: { kind: Cosmetic["kind"]; title: string; sub: string }[] = [
  { kind: "bg", title: "Chat background", sub: "Shows behind every chat." },
  { kind: "bubble", title: "Bubble style", sub: "Your own messages wear it." },
];
export const STORE_ITEMS: Cosmetic[] = [
  { id: "bg-aurora", kind: "bg", name: "Aurora", price: 120 },
  { id: "bg-grid", kind: "bg", name: "Blueprint", price: 80 },
  { id: "bg-sunset", kind: "bg", name: "Sunset", price: 150 },
  { id: "bg-stars", kind: "bg", name: "Starfield", price: 200 },
  { id: "bubble-glass", kind: "bubble", name: "Glass", price: 90 },
  { id: "bubble-neon", kind: "bubble", name: "Neon", price: 140 },
  { id: "bubble-candy", kind: "bubble", name: "Candy", price: 110 },
];
/** The chat background (CSS background) for an applied item. */
export const CHAT_BG: Record<string, React.CSSProperties> = {
  "bg-aurora": { backgroundImage: "radial-gradient(60% 45% at 15% 10%, rgba(91,43,255,.38), transparent 70%), radial-gradient(55% 40% at 90% 30%, rgba(45,212,191,.22), transparent 70%), radial-gradient(70% 50% at 50% 100%, rgba(143,107,255,.28), transparent 70%)" },
  "bg-grid": { backgroundImage: "linear-gradient(rgba(143,107,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(143,107,255,.16) 1px, transparent 1px)", backgroundSize: "26px 26px" },
  "bg-sunset": { backgroundImage: "linear-gradient(180deg, rgba(255,122,89,.22) 0%, rgba(255,77,148,.18) 45%, rgba(91,43,255,.22) 100%)" },
  "bg-stars": { backgroundImage: "radial-gradient(1.5px 1.5px at 20px 30px, rgba(255,255,255,.75), transparent), radial-gradient(1px 1px at 80px 120px, rgba(255,255,255,.6), transparent), radial-gradient(1.5px 1.5px at 150px 60px, rgba(201,184,255,.85), transparent), radial-gradient(1px 1px at 200px 170px, rgba(255,255,255,.5), transparent), radial-gradient(120% 80% at 50% 0%, rgba(53,20,176,.35), transparent 70%)", backgroundSize: "230px 200px, 230px 200px, 230px 200px, 230px 200px, 100% 100%" },
};
/** Classes for your own bubbles with an applied style. */
export const MY_BUBBLE: Record<string, string> = {
  "bubble-glass": "bg-white/10 text-ink ring-1 ring-white/30 backdrop-blur-md [background-image:linear-gradient(135deg,rgba(255,255,255,.18),rgba(143,107,255,.18))]",
  "bubble-neon": "bg-[#0a0a0a] text-[#d9ccff] ring-2 ring-[#8f6bff] shadow-[0_0_16px_rgba(143,107,255,.55)]",
  "bubble-candy": "text-white [background-image:linear-gradient(135deg,#ff6fb5,#8f6bff)]",
};
