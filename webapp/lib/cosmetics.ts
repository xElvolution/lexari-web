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
  { id: "bg-lavender", kind: "bg", name: "Lavender", price: 60 },
  { id: "bg-dots", kind: "bg", name: "Polka", price: 70 },
  { id: "bg-pinstripe", kind: "bg", name: "Pinstripe", price: 100 },
  { id: "bg-ripple", kind: "bg", name: "Ripple", price: 130 },
  { id: "bg-deepsea", kind: "bg", name: "Deep sea", price: 170 },
  { id: "bg-velvet", kind: "bg", name: "Velvet", price: 240 },
  { id: "bubble-glass", kind: "bubble", name: "Glass", price: 90 },
  { id: "bubble-neon", kind: "bubble", name: "Neon", price: 140 },
  { id: "bubble-candy", kind: "bubble", name: "Candy", price: 110 },
  { id: "bubble-outline", kind: "bubble", name: "Outline", price: 60 },
  { id: "bubble-midnight", kind: "bubble", name: "Midnight", price: 70 },
  { id: "bubble-lilac", kind: "bubble", name: "Lilac", price: 100 },
  { id: "bubble-mint", kind: "bubble", name: "Mint", price: 120 },
  { id: "bubble-sunset", kind: "bubble", name: "Sunset", price: 160 },
  { id: "bubble-gold", kind: "bubble", name: "Gold", price: 220 },
];
/** The chat background (CSS background) for an applied item. */
export const CHAT_BG: Record<string, React.CSSProperties> = {
  "bg-aurora": { backgroundImage: "radial-gradient(60% 45% at 15% 10%, rgba(91,43,255,.38), transparent 70%), radial-gradient(55% 40% at 90% 30%, rgba(45,212,191,.22), transparent 70%), radial-gradient(70% 50% at 50% 100%, rgba(143,107,255,.28), transparent 70%)" },
  "bg-grid": { backgroundImage: "linear-gradient(rgba(143,107,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(143,107,255,.16) 1px, transparent 1px)", backgroundSize: "26px 26px" },
  "bg-sunset": { backgroundImage: "linear-gradient(180deg, rgba(255,122,89,.22) 0%, rgba(255,77,148,.18) 45%, rgba(91,43,255,.22) 100%)" },
  "bg-stars": { backgroundImage: "radial-gradient(1.5px 1.5px at 20px 30px, rgba(255,255,255,.75), transparent), radial-gradient(1px 1px at 80px 120px, rgba(255,255,255,.6), transparent), radial-gradient(1.5px 1.5px at 150px 60px, rgba(201,184,255,.85), transparent), radial-gradient(1px 1px at 200px 170px, rgba(255,255,255,.5), transparent), radial-gradient(120% 80% at 50% 0%, rgba(53,20,176,.35), transparent 70%)", backgroundSize: "230px 200px, 230px 200px, 230px 200px, 230px 200px, 100% 100%" },
  "bg-lavender": { backgroundImage: "linear-gradient(180deg, rgba(201,184,255,.26) 0%, rgba(143,107,255,.12) 55%, rgba(201,184,255,.22) 100%)" },
  "bg-dots": { backgroundImage: "radial-gradient(rgba(143,107,255,.32) 1.6px, transparent 1.8px)", backgroundSize: "18px 18px" },
  "bg-pinstripe": { backgroundImage: "repeating-linear-gradient(135deg, rgba(143,107,255,.13) 0 2px, transparent 2px 16px)" },
  "bg-ripple": { backgroundImage: "repeating-radial-gradient(circle at 50% 110%, rgba(143,107,255,.16) 0 2px, transparent 2px 28px)" },
  "bg-deepsea": { backgroundImage: "radial-gradient(60% 40% at 80% 0%, rgba(54,197,255,.22), transparent 70%), linear-gradient(180deg, rgba(20,110,140,.22) 0%, rgba(53,20,176,.30) 100%)" },
  "bg-velvet": { backgroundImage: "radial-gradient(50% 35% at 0% 0%, rgba(255,107,154,.26), transparent 70%), radial-gradient(60% 45% at 100% 50%, rgba(91,43,255,.36), transparent 70%), radial-gradient(70% 45% at 20% 100%, rgba(176,38,255,.28), transparent 70%)" },
};
/** Classes for your own bubbles with an applied style. */
export const MY_BUBBLE: Record<string, string> = {
  "bubble-glass": "bg-white/10 text-ink ring-1 ring-white/30 backdrop-blur-md [background-image:linear-gradient(135deg,rgba(255,255,255,.18),rgba(143,107,255,.18))]",
  "bubble-neon": "bg-[#0a0a0a] text-[#d9ccff] ring-2 ring-[#8f6bff] shadow-[0_0_16px_rgba(143,107,255,.55)]",
  "bubble-candy": "text-white [background-image:linear-gradient(135deg,#ff6fb5,#8f6bff)]",
  "bubble-outline": "bg-transparent text-brand-ink ring-2 ring-grape",
  "bubble-midnight": "bg-[#1b1340] text-white ring-1 ring-[#8f6bff]/50",
  "bubble-lilac": "bg-[#e9e1ff] text-[#2a0f8f] ring-1 ring-[#c9b8ff]",
  "bubble-mint": "text-white [background-image:linear-gradient(135deg,#2dd4bf,#5b2bff)]",
  "bubble-sunset": "text-white [background-image:linear-gradient(135deg,#ff9a5a,#ff4d94_55%,#8f6bff)]",
  "bubble-gold": "text-[#3b2600] ring-1 ring-[#e9b73a] [background-image:linear-gradient(135deg,#f7d774,#e3a52a)]",
};
