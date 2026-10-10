/** The marketplace roster the phone shows. Hiring still goes through the server. */
export type Specialist = { slug: string; name: string; job: string; quip: string; color: string; free?: boolean };

export const ROSTER: Specialist[] = [
  { slug: "scout", name: "Scout", job: "Web research", quip: "I read so you do not have to.", color: "#3b82f6" },
  { slug: "quill", name: "Quill", job: "Writing and edits", quip: "Give me a rough idea. I will give it back sharp.", color: "#f9a8d4" },
  { slug: "tally", name: "Tally", job: "Numbers and sheets", quip: "Messy sheet? Send it over.", color: "#34d399" },
  { slug: "frame", name: "Frame", job: "Design", quip: "Tell me the vibe, I will draw it.", color: "#fcd34d" },
  { slug: "echo", name: "Echo", job: "Community", quip: "Your channels, answered while you sleep.", color: "#c9b8ff" },
  { slug: "relay", name: "Relay", job: "Onchain watch", quip: "I watch the chain so you can look away.", color: "#14F1D9" },
  { slug: "patch", name: "Patch", job: "Code help", quip: "Point me at the bug. Smallest fix wins.", color: "#8b5cf6" },
  { slug: "pulse", name: "Pulse", job: "Social posts", quip: "I know what gets a reply.", color: "#f45b5b" },
  { slug: "ore", name: "ORE Miner", job: "ORE mining", quip: "Your server, your ORE. I run the rig.", color: "#F5A524", free: true },
];

export const PLANS = [
  { id: "free", name: "Free", usd: 0, points: ["Your named agent", "A daily allowance"] },
  { id: "pro", name: "Pro", usd: 20, points: ["5 seats", "Pay in SKR, SOL, or USDC"] },
  { id: "plus", name: "Max", usd: 60, points: ["20 seats", "Heavier daily work"] },
];

export const COINS = [
  { id: "SKR", name: "Seeker", color: "#14F1D9" },
  { id: "USDC", name: "USD Coin", color: "#2775CA" },
  { id: "USDT", name: "Tether", color: "#26A17B" },
  { id: "SOL", name: "Solana", color: "#9945FF" },
  { id: "BONK", name: "Bonk", color: "#F8A21B" },
  { id: "JUP", name: "Jupiter", color: "#2BB8A2" },
];
