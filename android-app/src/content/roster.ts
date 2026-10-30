/** The marketplace roster the phone shows. Hiring still goes through the server. */
import type { ColorKey } from "@/components/avatar";

export type Specialist = { slug: string; name: string; job: string; cat: string; quip: string; back: string; rating: number; jobs: number; reviews: number; speed: string; skills: [string, number][]; tools: string[]; examples: string[]; color: string; seed: number; face: ColorKey; free?: boolean; review?: { who: string; seed: number; text: string; stars: number }[] };

/** Generated from webapp/content/appData.ts SPECIALISTS (same seed, colour and copy), so an agent looks the same everywhere. */
export const CATEGORIES = ["All", "Research", "Writing", "Data", "Design", "Community", "Onchain", "Video", "Planning", "Code", "Social"] as const;
export const ROSTER: Specialist[] = [
  {"slug": "scout", "name": "Scout", "job": "Web research", "cat": "Research", "quip": "I read so you do not have to.", "back": "Reads dozens of pages and returns the three facts that matter, with links.", "rating": 4.9, "jobs": 1840, "reviews": 312, "speed": "Usually done in 10 min", "skills": [["Deep web reading", 96], ["Source checking", 92], ["Short summaries", 88], ["Comparison tables", 81]], "tools": ["Browser", "Terminal", "Notes"], "examples": ["Compare three budgeting apps on one page", "Find every grant open to student builders", "Check what people say about a product launch"], "color": "#ff8a3d", "seed": 5, "face": "orange", "review": [{"who": "Tomi", "seed": 201, "stars": 5, "text": "Came back with links for every claim. Saved me an afternoon."}, {"who": "Rae", "seed": 202, "stars": 5, "text": "The one-page summary was exactly one page. Rare."}]},
  {"slug": "quill", "name": "Quill", "job": "Writing and edits", "cat": "Writing", "quip": "Give me a rough idea. I will give it back sharp.", "back": "Drafts posts, emails and briefs in your voice, then tightens them.", "rating": 4.8, "jobs": 1322, "reviews": 240, "speed": "Usually done in 6 min", "skills": [["Your voice", 94], ["Tight edits", 91], ["Headlines", 86], ["Long form", 78]], "tools": ["Docs", "Notes"], "examples": ["Turn meeting notes into a crisp update email", "Write three versions of a launch post", "Edit a pitch down to 150 words"], "color": "#3b82f6", "seed": 16, "face": "blue", "review": [{"who": "Ify", "seed": 203, "stars": 5, "text": "Sounded like me on a good day."}, {"who": "Dan", "seed": 204, "stars": 4, "text": "Great drafts, I still tweak the jokes."}]},
  {"slug": "tally", "name": "Tally", "job": "Numbers and sheets", "cat": "Data", "quip": "Messy sheet? Send it over.", "back": "Cleans spreadsheets, builds tables and explains what changed.", "rating": 4.8, "jobs": 976, "reviews": 188, "speed": "Usually done in 8 min", "skills": [["Sheet cleanup", 95], ["Pivot tables", 89], ["Charts", 84], ["Plain explanations", 87]], "tools": ["Sheets", "Terminal"], "examples": ["Clean a 4,000 row contact list", "Build a monthly summary tab", "Explain why the totals do not match"], "color": "#34d399", "seed": 27, "face": "green", "review": [{"who": "Kemi", "seed": 205, "stars": 5, "text": "Found the duplicate rows I had missed for months."}, {"who": "Leo", "seed": 206, "stars": 5, "text": "Clear notes on every change."}]},
  {"slug": "frame", "name": "Frame", "job": "Design", "cat": "Design", "quip": "Tell me the vibe, I will draw it.", "back": "Turns a rough idea into layouts, social cards and simple brand kits.", "rating": 4.7, "jobs": 811, "reviews": 150, "speed": "Usually done in 15 min", "skills": [["Layouts", 90], ["Social cards", 93], ["Brand kits", 82], ["Icons", 76]], "tools": ["Canvas", "Browser"], "examples": ["Make five social cards for an event", "Sketch a landing page layout", "Pick a color set from a mood"], "color": "#fcd34d", "seed": 38, "face": "yellow", "review": [{"who": "Sade", "seed": 207, "stars": 5, "text": "Five options, two were perfect."}, {"who": "Max", "seed": 208, "stars": 4, "text": "Fast and tidy. Loved the color picks."}]},
  {"slug": "echo", "name": "Echo", "job": "Community", "cat": "Community", "quip": "Your channels, answered while you sleep.", "back": "Answers questions in your channels and flags the ones that need you.", "rating": 4.6, "jobs": 604, "reviews": 97, "speed": "Always on", "skills": [["Friendly replies", 92], ["Spotting urgent asks", 88], ["FAQ upkeep", 85], ["Tone matching", 83]], "tools": ["Chat", "Notes"], "examples": ["Draft replies to this week's questions", "Keep the FAQ up to date", "Flag anything that sounds like a bug"], "color": "#f45b5b", "seed": 49, "face": "red", "review": [{"who": "Obi", "seed": 209, "stars": 5, "text": "Our members think we hired three people."}]},
  {"slug": "relay", "name": "Relay", "job": "Onchain watch", "cat": "Onchain", "quip": "I watch the chain so you can look away.", "back": "Keeps an eye on wallets and tokens you care about and sends plain alerts.", "rating": 4.7, "jobs": 533, "reviews": 88, "speed": "Always on", "skills": [["Wallet watching", 94], ["Plain alerts", 90], ["Activity digests", 86], ["Contract reading", 74]], "tools": ["Explorer", "Terminal"], "examples": ["Tell me when this wallet moves", "Send a daily digest of a token's activity", "Explain what this contract call did"], "color": "#14b8a6", "seed": 60, "face": "teal", "review": [{"who": "Zee", "seed": 210, "stars": 5, "text": "Alerts in plain English. Finally."}]},
  {"slug": "cut", "name": "Cut", "job": "Video", "cat": "Video", "quip": "Two hours of footage, ten great seconds.", "back": "Finds the best moments in long footage and cuts them into shorts.", "rating": 4.6, "jobs": 402, "reviews": 71, "speed": "Usually done in 25 min", "skills": [["Finding highlights", 91], ["Short cuts", 88], ["Captions", 86], ["Thumbnails", 72]], "tools": ["Editor", "Files"], "examples": ["Cut a talk into three 30 second clips", "Add captions to a demo video", "Pick a thumbnail frame"], "color": "#f9a8d4", "seed": 71, "face": "pink", "review": [{"who": "Nana", "seed": 211, "stars": 4, "text": "The clips were great. Captions needed one fix."}]},
  {"slug": "atlas", "name": "Atlas", "job": "Planning", "cat": "Planning", "quip": "Big goal in, clear plan out.", "back": "Breaks a big goal into steps, owners and dates, then tracks them.", "rating": 4.8, "jobs": 367, "reviews": 64, "speed": "Usually done in 12 min", "skills": [["Breaking down goals", 95], ["Timelines", 90], ["Owner lists", 86], ["Weekly check ins", 84]], "tools": ["Board", "Calendar"], "examples": ["Plan a two week launch", "Turn a goal into weekly steps", "Make a checklist for a hackathon"], "color": "#7dd3fc", "seed": 82, "face": "sky", "review": [{"who": "Ayo", "seed": 212, "stars": 5, "text": "Turned chaos into a checklist."}]},
  {"slug": "patch", "name": "Patch", "job": "Code help", "cat": "Code", "quip": "Point me at the bug. Smallest fix wins.", "back": "Reads code, names the bug and suggests the smallest change that fixes it.", "rating": 4.8, "jobs": 1105, "reviews": 204, "speed": "Usually done in 9 min", "skills": [["Bug hunting", 93], ["Code review", 90], ["Small fixes", 92], ["Tests", 80]], "tools": ["Terminal", "Editor"], "examples": ["Review this pull request", "Write a TypeScript debounce hook", "Explain a stack trace in plain words"], "color": "#8b5cf6", "seed": 93, "face": "purple", "review": [{"who": "Chi", "seed": 213, "stars": 5, "text": "One line fix, clear reason why."}, {"who": "Rob", "seed": 214, "stars": 5, "text": "Better reviews than most humans I know."}]},
  {"slug": "pulse", "name": "Pulse", "job": "Social posts", "cat": "Social", "quip": "I know what gets a reply.", "back": "Plans and drafts a week of posts, then learns what your audience likes.", "rating": 4.5, "jobs": 689, "reviews": 110, "speed": "Usually done in 7 min", "skills": [["Post calendars", 90], ["Hooks", 88], ["Threads", 85], ["Trend spotting", 79]], "tools": ["Browser", "Notes"], "examples": ["Draft a week of posts", "Turn a blog into a thread", "Find this week's talking points"], "color": "#c9b8ff", "seed": 104, "face": "lilac", "review": [{"who": "Bisi", "seed": 215, "stars": 4, "text": "Solid hooks. Replies went up."}]},
  {"slug": "ledger", "name": "Ledger", "job": "Docs and reports", "cat": "Writing", "quip": "Your weekly report, done by Friday.", "back": "Collects updates from your team and turns them into a clean weekly report.", "rating": 4.7, "jobs": 455, "reviews": 80, "speed": "Usually done in 10 min", "skills": [["Weekly reports", 94], ["Meeting notes", 89], ["Status updates", 90], ["Formatting", 86]], "tools": ["Docs", "Sheets"], "examples": ["Write this week's team report", "Summarize three meetings", "Turn notes into a status update"], "color": "#f45b5b", "seed": 115, "face": "red", "review": [{"who": "Femi", "seed": 216, "stars": 5, "text": "Friday reports are no longer my problem."}]},
  {"slug": "sonar", "name": "Sonar", "job": "Market scan", "cat": "Research", "quip": "I hear about it before it trends.", "back": "Scans news, forums and launches each morning and sends a short brief.", "rating": 4.6, "jobs": 298, "reviews": 52, "speed": "Every morning", "skills": [["Daily briefs", 92], ["Competitor watch", 88], ["Trend notes", 85], ["Link lists", 83]], "tools": ["Browser", "Notes"], "examples": ["Brief me on my space every morning", "Watch three competitors", "List new launches this week"], "color": "#34d399", "seed": 126, "face": "green", "review": [{"who": "Uche", "seed": 217, "stars": 5, "text": "My morning read, done for me."}]},
  {"slug": "ore", "name": "ORE Miner", "job": "ORE mining", "cat": "Onchain", "quip": "Your server, your ORE. I run the rig.", "back": "Explains ORE mining, connects to a server you own, installs and runs the miner there and reports what it earns. Free to hire.", "rating": 4.8, "jobs": 1, "reviews": 0, "speed": "Always on", "skills": [["ORE mining", 95], ["Server setup", 90], ["Miner monitoring", 92], ["Plain reports", 88]], "tools": ["Your server", "Terminal"], "examples": ["How does ORE mining work now?", "Connect my server and install the miner", "How is my miner doing?"], "color": "#c9b8ff", "seed": 148, "face": "lilac", "free": true, "review": []},
];

export const PLANS = [
  { id: "free", name: "Free", usd: 0, points: ["Your named agent", "A daily allowance"] },
  { id: "pro", name: "Pro", usd: 20, points: ["5 seats", "Pay in SKR, SOL, or USDC"] },
  { id: "plus", name: "Max", usd: 60, points: ["20 seats", "Heavier daily work"] },
];

export const COINS: { id: string; name: string; color: string; logo: number }[] = [
  { id: "SKR", name: "Seeker", color: "#14F1D9", logo: require("../../assets/coins/skr.png") },
  { id: "USDC", name: "USD Coin", color: "#2775CA", logo: require("../../assets/coins/usdc.png") },
  { id: "USDT", name: "Tether", color: "#26A17B", logo: require("../../assets/coins/usdt.png") },
  { id: "SOL", name: "Solana", color: "#9945FF", logo: require("../../assets/coins/sol.png") },
  { id: "BONK", name: "Bonk", color: "#F8A21B", logo: require("../../assets/coins/bonk.png") },
  { id: "JUP", name: "Jupiter", color: "#2BB8A2", logo: require("../../assets/coins/jup.png") },
];

export function specialist(slug: string | undefined): Specialist | undefined {
  return ROSTER.find((r) => r.slug === slug);
}

/* ---------- marketplace store listing, same as webapp/content/appData.ts storeMeta ---------- */
export const STORE_CATS = [
  { id: "Research", icon: "search", from: ["Research"] },
  { id: "Writing", icon: "edit", from: ["Writing"] },
  { id: "Finance", icon: "wallet", from: ["Data", "Onchain"] },
  { id: "Design", icon: "spark", from: ["Design"] },
  { id: "Dev", icon: "terminal", from: ["Code"] },
  { id: "Marketing", icon: "chat", from: ["Social", "Community"] },
  { id: "Video", icon: "play", from: ["Video"] },
  { id: "Planning", icon: "list", from: ["Planning"] },
] as const;
export type StoreCat = (typeof STORE_CATS)[number]["id"];
const MAKERS = ["Lexari Labs", "Northwind AI", "Kite & Co", "Mosaic Studio", "Basalt Works", "Oyo Digital"];
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));
export function storeMeta(sp: Specialist) {
  const i = ROSTER.indexOf(sp);
  const cat = (STORE_CATS.find((c) => (c.from as readonly string[]).includes(sp.cat))?.id ?? "Research") as StoreCat;
  const hires = sp.jobs * 7 + 400 + i * 131;
  const r = sp.rating;
  const five = Math.round(40 + (r - 4.5) * 90), four = Math.round((100 - five) * 0.62), three = Math.round((100 - five - four) * 0.55), two = Math.round((100 - five - four - three) * 0.6);
  return {
    maker: i < 4 ? "Lexari Labs" : MAKERS[i % MAKERS.length], cat, hires, free: i % 3 !== 1, isNew: i >= 8,
    age: sp.cat === "Onchain" || sp.cat === "Social" ? "12+" : "4+", rising: ((i * 7) % 12) + (sp.reviews / sp.jobs) * 10,
    dist: [five, four, three, two, Math.max(0, 100 - five - four - three - two)],
    updated: i % 6 ? `${1 + (i % 6)} days ago` : "yesterday", version: `2.${i + 1}.${(i * 3) % 10}`, languages: i % 2 ? "English, French" : "English",
  };
}

/** webapp/content/appData.ts cannedReply() for a specialist: the sample reply shown in a listing's chat previews. */
const TASKY = /\b(compare|find|write|draft|plan|make|build|research|summari[sz]e|check|list|clean|design|cut|review|fix|watch)\b/;
const gist = (t: string) => t.replace(/[?.!]+$/, "").split(/\s+/).slice(0, 7).join(" ").toLowerCase();
export function specialistReply(sp: Specialist, text: string, n: number) {
  const t = text.toLowerCase();
  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t)) return `Hi! ${sp.name} here, your ${sp.job.toLowerCase()} specialist. ${sp.quip}`;
  const lines = [
    `${sp.name} here. That's right in my lane. I'll handle "${gist(text)}" and post the result in this chat.`,
    `On it. ${sp.back} I'll send it back here when it's ready.`,
    `Quick check before I start: short and punchy, or thorough? I'll assume short unless you say otherwise.`,
    `First draft is done and saved to Files. Want me to tighten anything?`,
  ];
  return TASKY.test(t) ? lines[n % 2] : lines[2 + (n % 2)];
}
