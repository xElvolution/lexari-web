/**
 * DEMO DATA for the Lexari web app. Everything here is clearly fake and illustrative:
 * the specialists, ratings, reviews, job history and memory notes are samples so the
 * product can be shown moving. Nothing talks to a server yet.
 * House rules: plain words, no em dashes, no prices or payment talk.
 */
import type { FaceDNA } from "@/lib/glyph/face";
import type { ColorKey, Eyes, Mouth, Shape, Variant } from "@/components/avatar";

export const DEMO_LABEL = "Demo data";

/* ---------- sign in ---------- */
export const WALLETS = [
  { id: "okx", name: "OKX Wallet", note: "Placeholder. One of the wallet options.", tag: "placeholder" },
  { id: "browser", name: "Browser wallet", note: "Any wallet extension already in this browser.", tag: "" },
  { id: "phone", name: "Wallet on your phone", note: "Scan a code with a mobile wallet.", tag: "" },
] as const;
export type WalletId = (typeof WALLETS)[number]["id"];
export const DEMO_GOOGLE = { name: "Ada Obi", email: "ada.demo@example.com" };
export const DEMO_ADDRESS = "0x7a3F9e21b4C0d8a5E6f1203B9c4D7e8F5a6bc91E";
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/* ---------- onboarding ---------- */
/** Seeds for the faces you can pick in onboarding. null is the house face from the landing badge. */
export const LOOKS: (number | null)[] = [null, 3, 14, 27, 41, 52, 66, 78, 90, 105, 117, 131];
export const ROLES = ["Founder", "Designer", "Developer", "Marketer", "Researcher", "Student", "Community lead", "Trader"];
export const TONES = [
  { id: "short", label: "Short and direct" },
  { id: "warm", label: "Warm and chatty" },
  { id: "formal", label: "Formal" },
  { id: "playful", label: "Playful" },
] as const;
export type ToneId = (typeof TONES)[number]["id"];
export const KNOW_SUGGESTIONS = [
  "Keep summaries to one page",
  "I like tables more than long text",
  "My weekly report goes out on Friday",
  "Always link your sources",
  "Call me by my first name",
  "No jargon, short sentences",
];

/* ---------- plans: seats only ---------- */
export const PLANS = [
  { id: "free", name: "Free", seats: 1, for: "Your own agent with its computer and memory.", points: ["Your named agent", "Its own computer", "A memory that lasts"] },
  { id: "pro", name: "Pro", seats: 5, for: "A small crew: your agent plus four specialists.", points: ["5 seats", "Hire from the marketplace", "Mention a specialist in chat"] },
  { id: "plus", name: "Pro Plus", seats: 20, for: "A full team working on several jobs at once.", points: ["20 seats", "Team chats between agents", "Hire and build your own"] },
  { id: "max", name: "Max", seats: 100, for: "A whole floor for big, parallel work.", points: ["100 seats", "Many team chats at once", "Same agent at desk one"] },
] as const;
export type PlanId = (typeof PLANS)[number]["id"];

/* ---------- the marketplace roster ---------- */
export const CATEGORIES = ["All", "Research", "Writing", "Data", "Design", "Community", "Onchain", "Video", "Planning", "Code", "Social"] as const;
export type Category = Exclude<(typeof CATEGORIES)[number], "All">;

export type Specialist = {
  slug: string; name: string; job: string; cat: Category; quip: string; back: string;
  rating: number; jobs: number; reviews: number; seed: number; color: ColorKey; speed: string;
  skills: [string, number][]; tools: string[]; examples: string[];
  words: string[]; // chat keywords that route a job to this specialist
  glyph?: FaceDNA; // agents you made with the Glyph creator
  review: { who: string; seed: number; text: string; stars: number }[];
  face?: Partial<Variant>; // custom agents pick their own shape, eyes and mouth
  custom?: boolean; // made by you in Create an agent
};

const ROSTER_COLORS: ColorKey[] = ["orange", "blue", "green", "yellow", "red", "teal", "pink", "sky"];
/** Same seeds and colors as the landing roster, so an agent looks the same everywhere. */
const EXTRA_COLORS: ColorKey[] = ["purple", "lilac", "red", "green"];
const face = (i: number) => ({ seed: i * 11 + 5, color: i < 8 ? ROSTER_COLORS[i] : EXTRA_COLORS[(i - 8) % 4] });

export const SPECIALISTS: Specialist[] = [
  { slug: "scout", name: "Scout", job: "Web research", cat: "Research", quip: "I read so you do not have to.", back: "Reads dozens of pages and returns the three facts that matter, with links.", rating: 4.9, jobs: 1840, reviews: 312, ...face(0), speed: "Usually done in 10 min",
    skills: [["Deep web reading", 96], ["Source checking", 92], ["Short summaries", 88], ["Comparison tables", 81]], tools: ["Browser", "Terminal", "Notes"],
    examples: ["Compare three budgeting apps on one page", "Find every grant open to student builders", "Check what people say about a product launch"],
    words: ["research", "find", "compare", "look up", "sources", "read"],
    review: [{ who: "Tomi", seed: 201, stars: 5, text: "Came back with links for every claim. Saved me an afternoon." }, { who: "Rae", seed: 202, stars: 5, text: "The one-page summary was exactly one page. Rare." }] },
  { slug: "quill", name: "Quill", job: "Writing and edits", cat: "Writing", quip: "Give me a rough idea. I will give it back sharp.", back: "Drafts posts, emails and briefs in your voice, then tightens them.", rating: 4.8, jobs: 1322, reviews: 240, ...face(1), speed: "Usually done in 6 min",
    skills: [["Your voice", 94], ["Tight edits", 91], ["Headlines", 86], ["Long form", 78]], tools: ["Docs", "Notes"],
    examples: ["Turn meeting notes into a crisp update email", "Write three versions of a launch post", "Edit a pitch down to 150 words"],
    words: ["write", "draft", "email", "post", "edit", "copy", "blog"],
    review: [{ who: "Ify", seed: 203, stars: 5, text: "Sounded like me on a good day." }, { who: "Dan", seed: 204, stars: 4, text: "Great drafts, I still tweak the jokes." }] },
  { slug: "tally", name: "Tally", job: "Numbers and sheets", cat: "Data", quip: "Messy sheet? Send it over.", back: "Cleans spreadsheets, builds tables and explains what changed.", rating: 4.8, jobs: 976, reviews: 188, ...face(2), speed: "Usually done in 8 min",
    skills: [["Sheet cleanup", 95], ["Pivot tables", 89], ["Charts", 84], ["Plain explanations", 87]], tools: ["Sheets", "Terminal"],
    examples: ["Clean a 4,000 row contact list", "Build a monthly summary tab", "Explain why the totals do not match"],
    words: ["sheet", "spreadsheet", "csv", "numbers", "table", "data", "chart"],
    review: [{ who: "Kemi", seed: 205, stars: 5, text: "Found the duplicate rows I had missed for months." }, { who: "Leo", seed: 206, stars: 5, text: "Clear notes on every change." }] },
  { slug: "frame", name: "Frame", job: "Design", cat: "Design", quip: "Tell me the vibe, I will draw it.", back: "Turns a rough idea into layouts, social cards and simple brand kits.", rating: 4.7, jobs: 811, reviews: 150, ...face(3), speed: "Usually done in 15 min",
    skills: [["Layouts", 90], ["Social cards", 93], ["Brand kits", 82], ["Icons", 76]], tools: ["Canvas", "Browser"],
    examples: ["Make five social cards for an event", "Sketch a landing page layout", "Pick a color set from a mood"],
    words: ["design", "logo", "card", "layout", "banner", "poster", "brand"],
    review: [{ who: "Sade", seed: 207, stars: 5, text: "Five options, two were perfect." }, { who: "Max", seed: 208, stars: 4, text: "Fast and tidy. Loved the color picks." }] },
  { slug: "echo", name: "Echo", job: "Community", cat: "Community", quip: "Your channels, answered while you sleep.", back: "Answers questions in your channels and flags the ones that need you.", rating: 4.6, jobs: 604, reviews: 97, ...face(4), speed: "Always on",
    skills: [["Friendly replies", 92], ["Spotting urgent asks", 88], ["FAQ upkeep", 85], ["Tone matching", 83]], tools: ["Chat", "Notes"],
    examples: ["Draft replies to this week's questions", "Keep the FAQ up to date", "Flag anything that sounds like a bug"],
    words: ["community", "reply", "discord", "telegram", "faq", "members"],
    review: [{ who: "Obi", seed: 209, stars: 5, text: "Our members think we hired three people." }] },
  { slug: "relay", name: "Relay", job: "Onchain watch", cat: "Onchain", quip: "I watch the chain so you can look away.", back: "Keeps an eye on wallets and tokens you care about and sends plain alerts.", rating: 4.7, jobs: 533, reviews: 88, ...face(5), speed: "Always on",
    skills: [["Wallet watching", 94], ["Plain alerts", 90], ["Activity digests", 86], ["Contract reading", 74]], tools: ["Explorer", "Terminal"],
    examples: ["Tell me when this wallet moves", "Send a daily digest of a token's activity", "Explain what this contract call did"],
    words: ["wallet", "token", "onchain", "chain", "contract", "alert"],
    review: [{ who: "Zee", seed: 210, stars: 5, text: "Alerts in plain English. Finally." }] },
  { slug: "cut", name: "Cut", job: "Video", cat: "Video", quip: "Two hours of footage, ten great seconds.", back: "Finds the best moments in long footage and cuts them into shorts.", rating: 4.6, jobs: 402, reviews: 71, ...face(6), speed: "Usually done in 25 min",
    skills: [["Finding highlights", 91], ["Short cuts", 88], ["Captions", 86], ["Thumbnails", 72]], tools: ["Editor", "Files"],
    examples: ["Cut a talk into three 30 second clips", "Add captions to a demo video", "Pick a thumbnail frame"],
    words: ["video", "clip", "footage", "shorts", "caption", "edit video"],
    review: [{ who: "Nana", seed: 211, stars: 4, text: "The clips were great. Captions needed one fix." }] },
  { slug: "atlas", name: "Atlas", job: "Planning", cat: "Planning", quip: "Big goal in, clear plan out.", back: "Breaks a big goal into steps, owners and dates, then tracks them.", rating: 4.8, jobs: 367, reviews: 64, ...face(7), speed: "Usually done in 12 min",
    skills: [["Breaking down goals", 95], ["Timelines", 90], ["Owner lists", 86], ["Weekly check ins", 84]], tools: ["Board", "Calendar"],
    examples: ["Plan a two week launch", "Turn a goal into weekly steps", "Make a checklist for a hackathon"],
    words: ["plan", "roadmap", "timeline", "schedule", "steps", "launch"],
    review: [{ who: "Ayo", seed: 212, stars: 5, text: "Turned chaos into a checklist." }] },
  { slug: "patch", name: "Patch", job: "Code help", cat: "Code", quip: "Point me at the bug. Smallest fix wins.", back: "Reads code, names the bug and suggests the smallest change that fixes it.", rating: 4.8, jobs: 1105, reviews: 204, ...face(8), speed: "Usually done in 9 min",
    skills: [["Bug hunting", 93], ["Code review", 90], ["Small fixes", 92], ["Tests", 80]], tools: ["Terminal", "Editor"],
    examples: ["Review this pull request", "Write a TypeScript debounce hook", "Explain a stack trace in plain words"],
    words: ["code", "bug", "fix", "typescript", "review", "script", "function"],
    review: [{ who: "Chi", seed: 213, stars: 5, text: "One line fix, clear reason why." }, { who: "Rob", seed: 214, stars: 5, text: "Better reviews than most humans I know." }] },
  { slug: "pulse", name: "Pulse", job: "Social posts", cat: "Social", quip: "I know what gets a reply.", back: "Plans and drafts a week of posts, then learns what your audience likes.", rating: 4.5, jobs: 689, reviews: 110, ...face(9), speed: "Usually done in 7 min",
    skills: [["Post calendars", 90], ["Hooks", 88], ["Threads", 85], ["Trend spotting", 79]], tools: ["Browser", "Notes"],
    examples: ["Draft a week of posts", "Turn a blog into a thread", "Find this week's talking points"],
    words: ["social", "tweet", "thread", "x post", "instagram", "linkedin"],
    review: [{ who: "Bisi", seed: 215, stars: 4, text: "Solid hooks. Replies went up." }] },
  { slug: "ledger", name: "Ledger", job: "Docs and reports", cat: "Writing", quip: "Your weekly report, done by Friday.", back: "Collects updates from your team and turns them into a clean weekly report.", rating: 4.7, jobs: 455, reviews: 80, ...face(10), speed: "Usually done in 10 min",
    skills: [["Weekly reports", 94], ["Meeting notes", 89], ["Status updates", 90], ["Formatting", 86]], tools: ["Docs", "Sheets"],
    examples: ["Write this week's team report", "Summarize three meetings", "Turn notes into a status update"],
    words: ["report", "weekly", "notes", "summary", "update", "meeting"],
    review: [{ who: "Femi", seed: 216, stars: 5, text: "Friday reports are no longer my problem." }] },
  { slug: "sonar", name: "Sonar", job: "Market scan", cat: "Research", quip: "I hear about it before it trends.", back: "Scans news, forums and launches each morning and sends a short brief.", rating: 4.6, jobs: 298, reviews: 52, ...face(11), speed: "Every morning",
    skills: [["Daily briefs", 92], ["Competitor watch", 88], ["Trend notes", 85], ["Link lists", 83]], tools: ["Browser", "Notes"],
    examples: ["Brief me on my space every morning", "Watch three competitors", "List new launches this week"],
    words: ["news", "competitor", "brief", "trend", "market", "scan"],
    review: [{ who: "Uche", seed: 217, stars: 5, text: "My morning read, done for me." }] },
];
/* ---------- agents you create (demo: saved in this browser only) ---------- */
export type CustomAgent = {
  id: string; name: string; role: string; about: string; template: string | null;
  shape: Shape; color: ColorKey; eyes: Eyes; mouth: Mouth; tone: ToneId; skills: string[]; memory: boolean; at: number;
  /** Glyph face DNA from the character creator (older agents only have shape/colour/eyes/mouth) */
  face?: FaceDNA;
};
export const AGENT_SKILLS = [
  { id: "web", label: "Browse the web", desc: "Open pages, read and compare them." },
  { id: "files", label: "Read and write files", desc: "Work with docs and save results to Files." },
  { id: "code", label: "Run code", desc: "Use the terminal on its computer." },
  { id: "sheets", label: "Spreadsheets", desc: "Clean, sum and chart tables." },
  { id: "images", label: "Make images", desc: "Draft simple graphics and cards." },
  { id: "email", label: "Draft emails", desc: "Write emails for you to send." },
  { id: "calendar", label: "Plans and reminders", desc: "Keep dates, steps and check ins." },
  { id: "wallet", label: "Use its wallet", desc: "Pay for tools inside a limit (demo)." },
] as const;
export type SkillId = (typeof AGENT_SKILLS)[number]["id"];
export const AGENT_TEMPLATES: { id: string; label: string; icon: string; role: string; about: string; cat: Category; skills: SkillId[]; shape: Shape; color: ColorKey; examples: string[]; words: string[] }[] = [
  { id: "research", label: "Researcher", icon: "search", role: "Research", about: "Reads the web for me, checks every source and sends back a short summary with links.", cat: "Research", skills: ["web", "files"], shape: "round", color: "orange", examples: ["Compare three note apps on one page", "Find the latest numbers on my market"], words: ["research", "find", "compare"] },
  { id: "writer", label: "Writer", icon: "edit", role: "Writing", about: "Drafts posts, emails and briefs in my voice, then cuts them down to what matters.", cat: "Writing", skills: ["files", "email"], shape: "blob", color: "blue", examples: ["Draft a short update email", "Tighten this intro"], words: ["write", "draft", "edit"] },
  { id: "analyst", label: "Analyst", icon: "jobs", role: "Numbers", about: "Cleans my sheets, builds summary tables and explains what changed in plain words.", cat: "Data", skills: ["sheets", "files"], shape: "square", color: "green", examples: ["Clean this contact list", "Explain last month's totals"], words: ["sheet", "numbers", "table"] },
  { id: "designer", label: "Designer", icon: "spark", role: "Design", about: "Turns rough ideas into layouts, social cards and simple visuals.", cat: "Design", skills: ["images", "web"], shape: "hex", color: "pink", examples: ["Make three social cards", "Pick colors for a launch"], words: ["design", "card", "layout"] },
  { id: "dev", label: "Developer", icon: "terminal", role: "Code", about: "Reads code, finds the bug and suggests the smallest fix, with tests.", cat: "Code", skills: ["code", "files"], shape: "robot", color: "teal", examples: ["Review this function", "Write a small script"], words: ["code", "bug", "fix"] },
  { id: "marketer", label: "Marketer", icon: "chat", role: "Marketing", about: "Plans a week of posts, writes the hooks and keeps an eye on what gets replies.", cat: "Social", skills: ["web", "images"], shape: "tall", color: "yellow", examples: ["Draft a week of posts", "Find this week's talking points"], words: ["post", "social", "launch"] },
  { id: "planner", label: "Planner", icon: "list", role: "Planning", about: "Breaks big goals into steps, owners and dates, then checks in every week.", cat: "Planning", skills: ["calendar", "files"], shape: "egg", color: "sky", examples: ["Plan my next two weeks", "Make a launch checklist"], words: ["plan", "steps", "schedule"] },
];
const hashId = (id: string) => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
/** A friendly ID number for any agent, stable per id. Printed on its ID card. */
export const agentIdNo = (id: string) => { const h = hashId(`id-${id}`); return `LX-${String(h % 10000).padStart(4, "0")}-${String((h >>> 14) % 1000).padStart(3, "0")}`; };
/** Turns a custom agent into the same shape as a marketplace specialist, so chats, faces and desktops just work. */
export function customToSpecialist(c: CustomAgent): Specialist {
  const t = AGENT_TEMPLATES.find((x) => x.id === c.template);
  const first = c.about.split(/(?<=[.!?])\s/)[0] || "Built by you.";
  return {
    slug: c.id, name: c.name, job: c.role || t?.role || "Custom agent", cat: t?.cat ?? "Planning", quip: first, back: c.about || "An agent you made. Tell it what to do.",
    rating: 5, jobs: 0, reviews: 0, seed: hashId(c.id) % 997, color: c.color, speed: "Made by you", glyph: c.face,
    skills: c.skills.map((id, i) => [AGENT_SKILLS.find((k) => k.id === id)?.label ?? id, 92 - i * 4] as [string, number]),
    tools: ["Browser", "Files", "Terminal"].slice(0, Math.max(1, Math.min(3, c.skills.length))),
    examples: t?.examples ?? ["Tell me what you can do", "Plan my week with me"], words: t?.words ?? [], review: [],
    face: { shape: c.shape, color: c.color, eyes: c.eyes, mouth: c.mouth, extra: c.shape === "robot" ? "antenna" : "none", blush: c.tone === "warm" || c.tone === "playful" },
    custom: true,
  };
}
let CUSTOM: Specialist[] = [];
/** Called by the store whenever your custom agents change. */
export function registerCustom(list: CustomAgent[]) { CUSTOM = list.map(customToSpecialist); }
export const specialistBySlug = (slug: string) => SPECIALISTS.find((s) => s.slug === slug) ?? CUSTOM.find((s) => s.slug === slug);

/* ---------- memory ---------- */
export const MEMORY_TAGS = ["About you", "Preferences", "People", "Tools", "Habits"] as const;
export type MemoryTag = (typeof MEMORY_TAGS)[number];
export const SEED_MEMORY: { tag: MemoryTag; text: string; source: string; ago: number }[] = [
  { tag: "Preferences", text: "Keeps summaries to one page", source: "Job #004", ago: 3 * 864e5 },
  { tag: "Tools", text: "Prefers tables over long text", source: "Job #004", ago: 3 * 864e5 },
  { tag: "People", text: "Maya signs off on design", source: "Job #003", ago: 2 * 864e5 },
  { tag: "Habits", text: "Weekly report goes out on Friday", source: "Job #002", ago: 5 * 864e5 },
  { tag: "Tools", text: "Exports tables as spreadsheets", source: "Job #003", ago: 2 * 864e5 },
  { tag: "People", text: "Sam owns the community replies", source: "Job #001", ago: 6 * 864e5 },
  { tag: "Habits", text: "Checks sources before quoting", source: "Job #001", ago: 6 * 864e5 },
];

/* ---------- jobs ---------- */
export type JobFile = { name: string; size: string; body: string };
export type JobStatus = "running" | "done" | "needs-you";
export type Job = {
  id: number; title: string; prompt: string; assignee: string; // "home" or a specialist slug
  status: JobStatus; startedAt: number; duration: number;
  steps: string[]; terminal: string[]; url: string; files: JobFile[]; learned?: string;
};

export const JOB_STEPS = ["Reads the brief", "Opens the browser", "Works in the terminal", "Saves the files"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).slice(0, 3).join("-") || "job";

/** Builds a believable, deterministic job script from a plain request. */
export function scriptFor(prompt: string, assignee: string, agentName: string): Omit<Job, "id" | "status" | "startedAt"> {
  const p = prompt.toLowerCase();
  const base = slugify(prompt);
  const table = /compare|table|sheet|csv|numbers|list/.test(p);
  const code = /code|bug|script|typescript|function|hook/.test(p);
  const files: JobFile[] = [
    { name: `${base}.md`, size: `${3 + (prompt.length % 5)} KB`, body: `# ${prompt}\n\nPrepared by ${agentName} on its Lexari computer (demo output).\n\n## Summary\n- The request was read and broken into steps.\n- Sources were opened in the browser and checked.\n- The result was written here, kept short.\n\n## Next steps\n- Reply in chat to change anything.\n` },
    table ? { name: `${base}.csv`, size: "2 KB", body: "item,note,score\nOption A,Clear and simple,8\nOption B,More features,7\nOption C,Best for teams,9\n" }
      : code ? { name: `${base}.ts`, size: "1 KB", body: `// ${prompt}\n// demo output from ${agentName}\nexport function run() {\n  return "done";\n}\n` }
      : { name: "sources.txt", size: "1 KB", body: "https://example.com/one\nhttps://example.com/two\nhttps://example.com/three\n" },
  ];
  const terminal = [
    `$ read brief --job "${prompt.slice(0, 34)}${prompt.length > 34 ? "…" : ""}"`,
    "  brief parsed, 4 steps planned",
    `$ open browser --pages ${3 + (prompt.length % 4)}`,
    `  ${3 + (prompt.length % 4)} pages read, notes saved`,
    `$ write ${files[0].name}`,
    `  ${files[0].name} saved`,
    `$ save ${files[1].name}`,
    `  ${files[1].name} saved · job done`,
  ];
  return {
    title: prompt.length > 60 ? prompt.slice(0, 58) + "…" : prompt, prompt, assignee,
    duration: 16000 + (prompt.length % 6) * 1000, steps: JOB_STEPS, terminal,
    url: `${base}.example`, files,
    learned: table ? "Likes results as a table" : code ? "Works in TypeScript" : undefined,
  };
}

export const SEED_JOBS: { prompt: string; assignee: string; status: JobStatus; ago: number }[] = [
  { prompt: "Compare three budgeting tools and keep it to one page", assignee: "home", status: "done", ago: 3 * 864e5 },
  { prompt: "Write this week's team report from my notes", assignee: "home", status: "done", ago: 5 * 864e5 },
  { prompt: "Draft replies to the community questions from Monday", assignee: "home", status: "needs-you", ago: 1 * 864e5 },
  { prompt: "Find every grant open to student builders this month", assignee: "home", status: "done", ago: 6 * 864e5 },
];

export const CHAT_SUGGESTIONS = [
  "Compare three note-taking apps in a table",
  "Draft a short update email for my team",
  "Plan my week around two deadlines",
  "Find five events for builders this month",
];

/** The little idle routine the computer shows between jobs. */
export const IDLE_LINES = [
  "$ tidy notes --since yesterday",
  "  3 notes merged, 0 forgotten",
  "$ check folder ~/output",
  "  all files saved",
  "$ wait --for next job",
];

/* ---------- demo chat replies ---------- */
const TASKY = /\b(compare|find|write|draft|plan|make|build|research|summari[sz]e|check|list|clean|design|cut|review|fix|watch)\b/;
const gist = (t: string) => t.replace(/[?.!]+$/, "").split(/\s+/).slice(0, 7).join(" ").toLowerCase();

/** Canned example replies so the chat feels alive. Clearly demo: nothing is generated. */
export function cannedReply(o: { id: string; text: string; n: number; agentName: string; you: string; tone: ToneId }) {
  const t = o.text.toLowerCase();
  const hi = /^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t);
  if (o.id === "home") {
    if (hi) return { short: `Hi${o.you ? ` ${o.you}` : ""}. What should I work on?`, warm: `Hey${o.you ? ` ${o.you}` : ""}! Good to see you. What are we doing today?`, formal: `Hello${o.you ? ` ${o.you}` : ""}. How can I help today?`, playful: `Hiya${o.you ? ` ${o.you}` : ""}! Point me at something.` }[o.tone];
    if (/what do you (know|remember)/.test(t)) return "Quite a bit already. Open my brain to see every memory, grouped by area. You can edit or forget any of them.";
    const lines = [
      `On it. I'll open my computer, work through "${gist(o.text)}" and post a short summary right here.`,
      `Good one. Based on what I remember about you, I'll keep it to one page with the sources linked. Want a table too?`,
      `Noted. If it needs a specialist I'll pass it to someone on your team and tell you who.`,
      `Done with a first pass. The file is in my output folder. Tell me what to change and I'll redo it.`,
    ];
    if (TASKY.test(t)) return lines[0];
    return lines[1 + (o.n % 3)];
  }
  const sp = specialistBySlug(o.id);
  if (!sp) return "Got it.";
  if (hi) return `Hi! ${sp.name} here, your ${sp.job.toLowerCase()} specialist. ${sp.quip}`;
  const lines = [
    `${sp.name} here. That's right in my lane. I'll handle "${gist(o.text)}" and post the result in this chat.`,
    `On it. ${sp.back} I'll send it back here when it's ready.`,
    `Quick check before I start: short and punchy, or thorough? I'll assume short unless you say otherwise.`,
    `First draft is done and saved to Files. Want me to tighten anything?`,
  ];
  if (TASKY.test(t)) return lines[o.n % 2];
  return lines[2 + (o.n % 2)];
}

/** Demo replies inside a group chat. The first to answer coordinates, the next one picks up a part. */
export function groupReply(o: { who: string; text: string; turn: number; n: number; agentName: string; you: string; others: string[] }) {
  const t = o.text.toLowerCase();
  const hi = /^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t);
  const nameOf = (id: string) => (id === "home" ? o.agentName : specialistBySlug(id)?.name ?? "the team");
  const other = o.others[0] ? nameOf(o.others[0]) : "";
  if (hi) return o.who === "home" ? `Hi${o.you ? ` ${o.you}` : ""}! Everyone's here. What are we working on?` : `Hey! ${specialistBySlug(o.who)?.name ?? "I"} here, ready when you are.`;
  if (o.who === "home") {
    const lines = [
      `Got it. I'll keep track of this${other ? ` and ask ${other} to take a part` : ""}. Summary here when it's done.`,
      `Noted. I'll split it up and check back in this chat.`,
      `On it. I'll pull together what everyone sends and keep it to one page.`,
    ];
    return lines[o.n % lines.length];
  }
  const sp = specialistBySlug(o.who);
  if (!sp) return "On it.";
  const lines = o.turn === 0
    ? [`${sp.name} here. "${gist(o.text)}" is right in my lane. I'll take it.`, `On it. ${sp.back}`, `I can take this. Short version first, details after.`]
    : [`I'll take the ${sp.job.toLowerCase()} part and post it here.`, `Adding my part: ${sp.back.charAt(0).toLowerCase()}${sp.back.slice(1)}`, `Sounds good. I'll back ${other || "that"} up on this.`];
  return lines[o.n % lines.length];
}

/* ---------- each agent's computer (demo desktop pane) ---------- */
export type DesktopScript = { url: string; title: string; kind: "browser" | "doc" | "sheet"; steps: string[]; terminal: string[]; files: { name: string; size: string }[] };
export function desktopFor(id: string, agentName: string): DesktopScript {
  const sp = specialistBySlug(id);
  const tag = (sp?.slug ?? "home");
  const byCat: Record<string, Omit<DesktopScript, "terminal">> = {
    home: { url: "notes.example.com/this-week", title: "This week", kind: "doc", steps: ["Read your new messages", "Opened this week's notes", "Checked two deadlines", "Updated the plan", "Saved notes to Files"], files: [{ name: "week-plan.md", size: "2 KB" }, { name: "team-report.md", size: "3 KB" }] },
    Research: { url: "compare.example.com/pricing", title: "Pricing pages", kind: "browser", steps: ["Opened 3 product sites", "Reading pricing page 1 of 3", "Reading pricing page 2 of 3", "Checking every source", "Building the table"], files: [{ name: "comparison.md", size: "4 KB" }, { name: "sources.txt", size: "1 KB" }] },
    Writing: { url: "docs.example.com/launch-post", title: "Launch post", kind: "doc", steps: ["Opened the draft", "Reading it in your voice", "Cutting the intro", "Trying two headlines", "Saved draft v3"], files: [{ name: "launch-post-v3.md", size: "3 KB" }] },
    Data: { url: "sheets.example.com/q3-numbers", title: "Q3 numbers", kind: "sheet", steps: ["Opened the sheet", "Found 14 duplicate rows", "Fixed date formats", "Added a totals row", "Wrote what changed"], files: [{ name: "q3-clean.csv", size: "12 KB" }, { name: "changes.md", size: "1 KB" }] },
  };
  const base = byCat[tag === "home" ? "home" : sp!.cat] ?? { url: `${tag}.example.com/workspace`, title: sp?.job ?? "Workspace", kind: "browser" as const, steps: ["Opened the brief", "Gathering what it needs", "Working through it", "Checking the result", "Saved to Files"], files: [{ name: `${tag}-output.md`, size: "2 KB" }] };
  const host = (sp?.name ?? agentName).toLowerCase();
  return { ...base, terminal: [`$ open ${base.url}`, "  page loaded", `$ notes add "${base.title.toLowerCase()}"`, "  saved", "$ files ls ~/output", ...base.files.map((f) => `  ${f.name}  ${f.size}`), `$ wait --for ${host === "you" ? "you" : "next message"}`] };
}

/* ---------- agent wallets (demo) ---------- */
export type WalletLine = { label: string; amount: number; ago: string };
/** A made-up address and balance per agent. Clearly demo: nothing here is on a real chain. */
export function walletFor(id: string) {
  let h = 2166136261; for (const ch of `lexari-${id}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const hex = (n: number) => { let out = "", x = n; for (let i = 0; i < 40; i++) { x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0; out += (x & 15).toString(16); } return out; };
  const address = `0x${hex(h)}`;
  const balance = Math.round(((h % 40000) / 100 + 25) * 100) / 100;
  const lines: WalletLine[] = [
    { label: "Added by you", amount: 50, ago: "3 days ago" },
    { label: "Tools used", amount: -Math.round((h % 500) / 10) / 10 - 0.4, ago: "yesterday" },
    { label: "File storage", amount: -0.4, ago: "today" },
  ];
  const spark = Array.from({ length: 12 }, (_, i) => 30 + (((h >>> (i % 24)) & 31) + i * 2));
  return { address, balance, lines, spark };
}

/* ---------- agent cards (demo) ---------- */
/** Placeholder card fee. No real payment: the confirm step only pretends. Units are left neutral on purpose. */
export const CARD_FEE = "5.00";
export const CARD_LIMITS = [100, 250, 500, 1000];
export function cardTxns(id: string) {
  const who = specialistBySlug(id);
  return who ? [
    { label: `${who.tools[0] ?? "Tool"} add-on`, amount: 4.99, ago: "today" },
    { label: "Cloud compute", amount: 12.4, ago: "yesterday" },
    { label: "API credits", amount: 20, ago: "3 days ago" },
  ] : [
    { label: "Domain renewal", amount: 11.99, ago: "today" },
    { label: "Cloud compute", amount: 8.2, ago: "yesterday" },
    { label: "Notes app, monthly", amount: 4, ago: "4 days ago" },
  ];
}

/* ---------- marketplace store listing (demo) ---------- */
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
  const i = SPECIALISTS.indexOf(sp);
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
