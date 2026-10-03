/**
 * All words on the Lexari landing page.
 * House rules: plain language, no em dashes, say what a thing is and why you should care.
 * [sample]      = illustrative data so the page can show the product moving.
 * Wallet sign-in is Phantom, Solflare or Backpack. Google sign-in is still a preview.
 */
import { badgeCopy } from "@shared/content/badge";
import { WEBAPP_URL } from "@shared/sites";

/** The product is a separate Next.js app. These open that origin. */
export const APP = `${WEBAPP_URL}/app`;
export const SIGNIN = `${WEBAPP_URL}/signin`;

export const copy = {
  meta: {
    title: "Lexari · Meet your first personalized AI agent",
    description:
      "Lexari gives you a personalized AI agent with its own computer and a memory that lasts. Sign in with Google or a crypto wallet, meet your agent, and hire more as your work grows.",
  },

  nav: {
    links: [
      { label: "Its desk", href: "#desk" },
      { label: "Memory", href: "#memory" },
      { label: "Roster", href: "#roster" },
      { label: "Seats", href: "#seats" },
      { label: "Sign in", href: SIGNIN },
      { label: "Questions", href: "#questions" },
    ],
    cta: "Hire your agent",
  },

  hero: {
    title: ["Meet your first", "personalized AI agent."],
    subtitle: "And hire more.",
    body:
      "Lexari gives you a personalized AI agent with a name, its own computer and a memory that lasts. It shows up every day, remembers how you like things done, and brings in specialists when the job gets bigger than one desk.",
    primary: "Hire",
    secondary: "See it at work",
    badge: badgeCopy,
    proof: [
      { k: "1", v: "agent that is only yours" },
      { k: "24/7", v: "its computer keeps running" },
      { k: "100", v: "seats on the biggest team" },
    ],
  },


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
        text: "It visits each tool's feature page and reads them properly, tables included.",
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
      "$ collect features --sites 3",
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
      { tag: "Tools", text: "Prefers tables over long text" },
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
    hint: "Tap a card to flip it. Tap again to flip back.",
    note: "Sample roster. Live listings are in the app.",
    cta: "Open the marketplace",
    agents: [
      { name: "Scout", quip: "I read so you do not have to.", job: "Web research", back: "Reads dozens of pages and returns the three facts that matter, with links.", rating: 4.9, jobs: 1840 },
      { name: "Quill", quip: "Give me a rough idea. I will give it back sharp.", job: "Writing and edits", back: "Drafts posts, emails and briefs in your voice, then tightens them.", rating: 4.8, jobs: 1322 },
      { name: "Tally", quip: "Messy sheet? Send it over.", job: "Numbers and sheets", back: "Cleans spreadsheets, builds tables and explains what changed.", rating: 4.8, jobs: 976 },
      { name: "Frame", quip: "Tell me the vibe, I will draw it.", job: "Design", back: "Turns a rough idea into layouts, social cards and simple brand kits.", rating: 4.7, jobs: 811 },
      { name: "Echo", quip: "Your channels, answered while you sleep.", job: "Community", back: "Answers questions in your channels and flags the ones that need you.", rating: 4.6, jobs: 604 },
      { name: "Relay", quip: "I watch the chain so you can look away.", job: "Onchain watch", back: "Keeps an eye on wallets and tokens you care about and sends plain alerts.", rating: 4.7, jobs: 533 },
      { name: "Cut", quip: "Two hours of footage, ten great seconds.", job: "Video", back: "Finds the best moments in long footage and cuts them into shorts.", rating: 4.6, jobs: 402 },
      { name: "Atlas", quip: "Big goal in, clear plan out.", job: "Planning", back: "Breaks a big goal into steps, owners and dates, then tracks them.", rating: 4.8, jobs: 367 },
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

  access: {
    label: "05 · Getting in",
    title: "Sign in. Meet your agent. Hire more.",
    body:
      "Getting started takes about a minute. Sign in with Phantom, Solflare or Backpack, name your agent and it clocks in on its own computer. Google sign-in is a preview. When the work grows, hire more agents from the roster.",
    placeholder: "Wallets on Solana: Phantom, Solflare and Backpack. Google sign-in is still a preview.",
    letter: {
      head: "Welcome letter",
      lines: [
        ["Signed in with", "Google or a crypto wallet"],
        ["Wallet options", "Phantom, Solflare, Backpack"],
        ["Your agent", "Juniper · Desk 01"],
        ["Next step", "Hire more when you are ready"],
      ],
      sign: "Signed, the Lexari team",
      signed: "Welcome aboard. Your agent is ready.",
    },
    chapters: [
      { n: "i", head: "Sign in with Google", text: "Google sign-in is a preview in this build. It does not contact Google yet." },
      { n: "ii", head: "Or use a Solana wallet", text: "Connect Phantom, Solflare or Backpack and sign one message. That proves the wallet is yours." },
      { n: "iii", head: "Meet your agent, then hire more", text: "Name your personalized agent on day one. Add specialists from the roster whenever the work asks for it." },
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
      ["How do I sign in?", "With Phantom, Solflare or Backpack on Solana. Google sign-in is a preview for now."],
      ["Can I start for free?", "Yes. The Free plan gives you your own agent with its computer and memory. Move to a bigger plan when you want more seats."],
    ] as [string, string][],
  },

  finale: {
    title: "Your personalized agent is waiting for a name.",
    body: "Name it, give it a job and watch it clock in.",
    cta: "Hire your agent",
    wordmark: "lexari",
  },

  footer: {
    line: "An AI agent with its own computer and memory, plus a roster of specialists to hire.",
    groups: [
      {
        title: "On the page",
        links: [
          { label: "Its desk", href: "#desk" },
          { label: "Memory", href: "#memory" },
          { label: "Roster", href: "#roster" },
          { label: "Seats", href: "#seats" },
          { label: "Questions", href: "#questions" },
        ],
      },
      {
        title: "The product",
        links: [
          { label: "Open the app", href: APP },
          { label: "Marketplace", href: `${APP}/marketplace` },
          { label: "Sign in", href: SIGNIN },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Terms", href: "/legal/terms" },
          { label: "Privacy", href: "/legal/privacy" },
        ],
      },
    ],
    fine: "Sample data on this page is illustrative.",
    wallets: "Wallet sign-in uses Phantom, Solflare or Backpack.",
  },
};
