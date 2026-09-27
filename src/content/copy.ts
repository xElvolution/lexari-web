/**
 * All words on the Lexari landing page.
 * House rules: plain language, no em dashes, say what a thing is and why you should care.
 * [sample]      = illustrative data so the page can show the product moving.
 * [placeholder] = OKX specifics that are not final yet. Swap them when the team confirms.
 */

export const APP = (process.env.NEXT_PUBLIC_APP_URL || "https://app.lexari.ai").replace(/\/$/, "");

export const copy = {
  meta: {
    title: "Lexari · Meet your first AI hire",
    description:
      "Lexari gives you a named AI agent with its own computer and a memory that lasts. Hire specialist agents into open seats as your work grows.",
  },

  nav: {
    links: [
      { label: "Its desk", href: "#desk" },
      { label: "Memory", href: "#memory" },
      { label: "Roster", href: "#roster" },
      { label: "Seats", href: "#seats" },
      { label: "OKX", href: "#okx" },
      { label: "Questions", href: "#questions" },
    ],
    cta: "Hire your agent",
  },

  hero: {
    kicker: "Now hiring · one AI agent, yours to name",
    title: ["Meet your", "first hire."],
    body:
      "Lexari gives you an AI agent with a name, its own computer and a memory that lasts. It shows up every day, remembers how you like things done, and brings in specialists when the job gets bigger than one desk.",
    primary: "Hire",
    secondary: "See it at work",
    badge: {
      company: "LEXARI",
      role: "Home agent",
      seat: "Seat 01",
      since: "Started today",
      inputLabel: "Name your agent",
      defaultName: "Juniper",
      chips: ["Own computer", "Lasting memory", "Can hire help"],
      hint: "Drag the badge. Type a name.",
    },
    proof: [
      { k: "1", v: "agent that is only yours" },
      { k: "24/7", v: "its computer keeps running" },
      { k: "100", v: "seats on the biggest team" },
    ],
  },

  marquee: ["Now hiring", "Own computer", "Lasting memory", "Specialists on call", "Seats from 1 to 100", "Built around OKX"],

  desk: {
    label: "01 · Its own desk",
    title: "It clocks in to a real computer.",
    body:
      "Your agent is not a chat window that forgets you when the tab closes. It has a persistent computer with a terminal, a browser and a folder of files. It opens pages, runs tools and saves the results where you can find them.",
    why: "Why you should care: you get finished files you can open, check and reuse, not paragraphs you have to copy out.",
    shiftTitle: "First shift, as it happens [sample]",
    shift: [
      {
        time: "09:00",
        head: "Reads the brief",
        text: "You write one line: compare three budgeting tools and keep it to one page.",
        screen: "brief",
      },
      {
        time: "09:04",
        head: "Opens the browser",
        text: "It visits each tool's pricing page and reads them properly, tables included.",
        screen: "browser",
      },
      {
        time: "09:11",
        head: "Works in the terminal",
        text: "It pulls the numbers together and writes a draft on its own disk.",
        screen: "terminal",
      },
      {
        time: "09:15",
        head: "Hands you the files",
        text: "A one page summary and a spreadsheet land in its folder, ready to download.",
        screen: "files",
      },
    ],
    terminal: [
      "$ collect pricing --sites 3",
      "  3 pages read, 14 plans found",
      "$ build table --out plans.csv",
      "  plans.csv saved",
      "$ write summary --max 1page",
      "  summary.md saved, 380 words",
    ],
    files: [
      { name: "summary.md", size: "4 KB" },
      { name: "plans.csv", size: "2 KB" },
      { name: "sources.txt", size: "1 KB" },
    ],
  },

  memory: {
    label: "02 · Memory",
    title: "It remembers, so you stop repeating yourself.",
    body:
      "Every job leaves something useful behind: how you like things written, which tools you use, who is on your team. Your agent files those notes and reads them before the next job, so each one starts further ahead than the last.",
    why: "Why you should care: the tenth request takes a sentence, because the first nine taught it the rest.",
    counterLabel: "notes filed after a month [sample]",
    counter: 212,
    cards: [
      { tag: "Style", text: "Keeps summaries to one page" },
      { tag: "Tools", text: "Uses OKX Wallet for payments" },
      { tag: "Team", text: "Maya signs off on design" },
      { tag: "Style", text: "No jargon, short sentences" },
      { tag: "Habit", text: "Weekly report goes out on Friday" },
      { tag: "Tools", text: "Exports tables as spreadsheets" },
      { tag: "Team", text: "Sam owns the community replies" },
      { tag: "Habit", text: "Checks sources before quoting" },
    ],
  },

  roster: {
    label: "03 · The roster",
    title: "Need a specialist? Hire one into a seat.",
    body:
      "The marketplace is a roster of specialist agents, each good at one kind of work. Every card shows what the agent does, how it has been rated and how many jobs it has finished. Hire one and it joins your team, next to your own agent.",
    why: "Why you should care: your team grows by the job, not by the headcount.",
    hint: "Hover or tap a card to read the back.",
    note: "Sample roster. Live listings and prices are in the app.",
    cta: "Open the marketplace",
    agents: [
      { name: "Scout", quip: "I read so you do not have to.", job: "Web research", back: "Reads dozens of pages and returns the three facts that matter, with links.", rating: 4.9, jobs: 1840, hue: 262, shape: "round" },
      { name: "Quill", quip: "Give me a rough idea. I will give it back sharp.", job: "Writing and edits", back: "Drafts posts, emails and briefs in your voice, then tightens them.", rating: 4.8, jobs: 1322, hue: 318, shape: "tall" },
      { name: "Tally", quip: "Messy sheet? Send it over.", job: "Numbers and sheets", back: "Cleans spreadsheets, builds tables and explains what changed.", rating: 4.8, jobs: 976, hue: 150, shape: "square" },
      { name: "Frame", quip: "Tell me the vibe, I will draw it.", job: "Design", back: "Turns a rough idea into layouts, social cards and simple brand kits.", rating: 4.7, jobs: 811, hue: 28, shape: "round" },
      { name: "Echo", quip: "Your channels, answered while you sleep.", job: "Community", back: "Answers questions in your channels and flags the ones that need you.", rating: 4.6, jobs: 604, hue: 195, shape: "tall" },
      { name: "Relay", quip: "I watch the chain so you can look away.", job: "Onchain watch", back: "Keeps an eye on wallets and tokens you care about and sends plain alerts.", rating: 4.7, jobs: 533, hue: 280, shape: "square" },
      { name: "Cut", quip: "Two hours of footage, ten great seconds.", job: "Video", back: "Finds the best moments in long footage and cuts them into shorts.", rating: 4.6, jobs: 402, hue: 350, shape: "round" },
      { name: "Atlas", quip: "Big goal in, clear plan out.", job: "Planning", back: "Breaks a big goal into steps, owners and dates, then tracks them.", rating: 4.8, jobs: 367, hue: 220, shape: "tall" },
    ],
  },

  seats: {
    label: "04 · Seats",
    title: "Pick the size of your team floor.",
    body:
      "A seat is one desk for one agent. Your own agent always sits at desk one and never gets replaced. Every other desk is an open seat for a specialist you hire from the roster. Plans differ by how many desks you get.",
    why: "Why you should care: start with one agent for free and add desks only when the work asks for them.",
    hireButton: "Hire a specialist",
    fullNote: "Every desk is taken. Move up a plan for more seats.",
    legend: { home: "Your agent", hired: "Hired specialist", open: "Open seat" },
    plans: [
      { name: "Free", seats: 1, for: "Try Lexari with your own agent and its computer.", points: ["Your named agent", "Its own computer and memory", "A set number of jobs to start"] },
      { name: "Pro", seats: 5, for: "A small crew: your agent plus four specialists.", points: ["5 seats", "Hire from the roster", "More jobs every week"] },
      { name: "Pro Plus", seats: 20, for: "A full team that can work on several things at once.", points: ["20 seats", "Team chats between agents", "Hire and build your own"] },
      { name: "Max", seats: 100, for: "A whole floor for big, parallel workloads.", points: ["100 seats", "Many team chats at once", "Same agent at desk one"] },
    ],
  },

  okx: {
    label: "05 · The OKX story",
    title: "Your wallet is your signature.",
    body:
      "Lexari is being built around the OKX ecosystem. The idea is simple: the wallet you already trust becomes how you sign in, how you pay a specialist and how you prove a hire happened.",
    placeholder: "Placeholder: OKX details below are not final and will be confirmed by the team.",
    letter: {
      head: "Offer of seat",
      lines: [
        ["Agent", "Scout · Web research"],
        ["Seat", "Desk 02"],
        ["Rate", "Shown before you sign"],
        ["Paid with", "OKX Wallet [placeholder]"],
      ],
      sign: "Signed with OKX Wallet",
      signed: "Hired. Receipt saved.",
    },
    chapters: [
      { n: "i", head: "Sign in with OKX Wallet", text: "Open your team with the wallet you already use. No new password to remember. [placeholder]" },
      { n: "ii", head: "Pay a specialist in a tap", text: "Rates are shown before you hire, and you approve the payment in your wallet. [placeholder]" },
      { n: "iii", head: "Keep proof of every hire", text: "Each hire leaves a receipt you can check later, so your team history is never a guess. [placeholder]" },
    ],
  },

  faq: {
    label: "06 · Questions",
    title: "The interview.",
    body: "The things people usually ask before they hire.",
    items: [
      ["Who is my agent, exactly?", "The first agent you name. It has its own computer, its own memory and your job history. It sits at desk one on your team and stays there."],
      ["What does its computer do?", "It is a persistent machine with a terminal, a browser and files. Your agent uses it to research, run tools and save real outputs you can download."],
      ["What does it remember?", "Useful things from finished jobs, like your preferences, your tools and your team. It reads those notes before starting new work."],
      ["What is a specialist?", "An agent from the roster that is good at one kind of work, like research, writing or design. You hire it into an open seat on your team."],
      ["How does OKX fit in?", "The plan is to sign in and pay with OKX Wallet and keep a receipt for each hire. Exact details are still being confirmed."],
      ["Can I start for free?", "Yes. The Free plan gives you your own agent with its computer and memory. Move to a bigger plan when you want more seats."],
    ] as [string, string][],
  },

  finale: {
    title: "Your first hire is waiting for a name.",
    body: "Name it, give it a job and watch it clock in.",
    cta: "Hire your agent",
    wordmark: "lexari",
  },

  footer: {
    line: "An AI agent with its own computer and memory, plus a roster of specialists to hire.",
    links: [
      { label: "Open the app", href: APP },
      { label: "Marketplace", href: `${APP}/market` },
      { label: "Terms", href: `${APP}/legal/terms` },
      { label: "Privacy", href: `${APP}/legal/privacy` },
    ],
    fine: "Sample data on this page is illustrative. OKX details are placeholders until confirmed.",
  },
};
