/**
 * Privacy Policy and Terms of Service. Plain words, true to what the product does today (read from the code, Oct 2026).
 * Update these whenever data handling changes: a new model provider, chain, payment method or integration must be
 * listed here before it processes anyone's data. Not legal advice; have a lawyer review before mainnet or real payments.
 */
export const LEGAL_UPDATED = "6 October 2026";
export const LEGAL_CONTACT = "hello@lexari.ai";

export type Block =
  | { p: string }
  | { list: string[] }
  | { rows: { name: string; role: string; data: string }[] };
export type Section = { id: string; title: string; body: Block[] };
export type Doc = { slug: "privacy" | "terms"; title: string; eyebrow: string; intro: string; summary: string[]; sections: Section[] };

const C = LEGAL_CONTACT;

export const PRIVACY: Doc = {
  slug: "privacy",
  title: "Privacy Policy",
  eyebrow: "Legal · Privacy",
  intro: "This policy explains what Lexari collects when you use lexari.ai and app.lexari.ai, why, who helps us process it, and the choices you have. It describes the product as it works today.",
  summary: [
    "Your account is your Solana wallet address. If you sign in with Google or email, Privy handles that sign in and gives you a wallet.",
    "Chats are stored on our database in readable form so they sync across your devices and give your agent context.",
    "Memories are encrypted in your browser. We store only the encrypted version and cannot read it.",
    "To write a reply, your message, recent chat, relevant memory notes and (for computer tasks) screenshots are sent to our AI model provider.",
    "Anything you do on a blockchain is public and permanent. Deleting your account cannot remove it.",
    "Lexari runs on the Solana devnet test network today. Devnet tokens have no monetary value.",
    "You can export your data or delete your account at any time in Settings.",
  ],
  sections: [
    {
      id: "who",
      title: "Who we are",
      body: [
        { p: `Lexari is an app for personal AI agents. Each agent has its own memory, its own computer it can operate, and can use a Solana wallet with your confirmation. Lexari is responsible for the personal data described here. Questions or requests: ${C}.` },
      ],
    },
    {
      id: "collect",
      title: "What we collect",
      body: [
        { p: "We collect what you give us, what the app creates while you use it, and a small amount of technical data." },
        { list: [
          "Account. Your Solana wallet address, which is your Lexari account ID, and how you signed in. If you use Google or email, we receive your email address and your Privy user ID. Privy keeps your Google or email sign in details under its own policy.",
          "Linked social accounts (optional). If you link X, Discord or Telegram, we receive that account's user ID and username through Privy and record when you verified it. We never receive your passwords and never post on your behalf.",
          "Profile and settings. Your name, username, bio, profile picture and cover image if you add them, and your preferences such as theme, notifications and voice.",
          "Agents. The names, roles, tone, skills, briefs, looks, nicknames and voice choices you give your agents, their levels and the jobs they finish.",
          "Chats. Messages you send, your agents' replies, reactions, reply references, attachment names and the length of voice calls. These are stored in readable form.",
          "Memories. Notes your agents keep about you. They are encrypted in your browser with a key derived from a signature by your wallet, so our servers only hold the encrypted text and a keyed fingerprint used to avoid duplicates. See How AI processing works for when notes are opened to write a reply.",
          "Agent computer. Each account gets an isolated container on our server with a desktop and a web browser. It holds the files your agent creates, the commands it runs and the pages it opens. Screenshots attached to a reply are stored with your account.",
          "Wallet activity. Public wallet addresses, transaction signatures, amounts, balances and the receipts written into your chats when you confirm a transfer, payment, hire, plan, card or mint.",
          "Hub. Coins, XP, levels, quests, daily check ins, store items, mystery boxes, achievements and who invited you.",
          "Notifications. Your in app notifications and, if you allow push notifications, your browser's push subscription (an endpoint address and keys).",
          "App lock. If you set a PIN we store a hash of it. If you turn on biometric unlock we store your passkey's ID and public key. Fingerprint or face data never leaves your device.",
          "Technical data. IP address (for rate limits and abuse prevention), browser type, error reports when the app crashes (the error message, page and browser) and standard server logs.",
        ] },
        { p: "Voice. Voice notes and calls use your browser's built in speech recognition and speech synthesis. Lexari receives the transcribed text, not your audio. Depending on your browser, its speech service may process the audio on the browser maker's servers (for example Google for Chrome)." },
      ],
    },
    {
      id: "use",
      title: "How we use it",
      body: [
        { list: [
          "To run the service: sign you in, keep your agents, chats and settings in sync, generate replies, run your agent's computer and show your wallet activity.",
          "To process what you confirm: prepare transactions you approve, verify payments on chain, record hires, plans and cards, and write receipts into your chats.",
          "To run the Hub: track quests, coins and levels, and prevent the same person from farming rewards with many accounts.",
          "To keep Lexari safe: rate limits, abuse prevention, debugging and security monitoring.",
          "To contact you about your account or important changes, using the notifications and channels you enabled.",
        ] },
        { p: "We do not sell your personal data, we do not use it for third party advertising, and we do not train our own AI models on your chats or memories." },
        { p: "Legal bases, where laws such as the Nigeria Data Protection Act 2023 or the EU and UK GDPR apply: performing our contract with you (running the service you asked for), your consent (push notifications, linking social accounts, voice features, optional memory), our legitimate interests (security, fraud and abuse prevention, improving reliability) and legal obligations. You can withdraw consent at any time in Settings or by contacting us." },
      ],
    },
    {
      id: "ai",
      title: "How AI processing works",
      body: [
        { p: "Your agent's replies are written by a large language model run by a third party provider. Today that provider is xAI (Grok models). For each reply we send the provider:" },
        { list: [
          "your message and up to the last 12 turns of that conversation,",
          "your agent's name, role, tone and the brief you gave it,",
          "up to 20 memory notes your browser opened for this reply (memories stay encrypted at rest; your browser decrypts the relevant ones and sends them with the message, and we do not store them in readable form),",
          "a short summary of your recent wallet activity and balance, so your agent can answer questions about it,",
          "for tasks on your agent's computer, screenshots of that computer's screen and the output of commands it ran.",
        ] },
        { p: "The provider processes this to return the reply and handles it under its own terms and retention rules. Agent replies can be wrong. Lexari may add other model providers later, including through a model gateway that routes to several providers; we will name them here before they process your data." },
      ],
    },
    {
      id: "onchain",
      title: "Blockchain data is public",
      body: [
        { p: "Lexari uses the Solana blockchain. Today it runs on Solana devnet, a public test network. Anything recorded on a blockchain is visible to anyone and cannot be changed or deleted, by you or by us. That includes:" },
        { list: [
          "your wallet address, its balance and every transaction it signs, including transfers, payments, hires and Hub actions;",
          "your agent's ID card, a Metaplex Core NFT whose name, role and face image are uploaded to Irys, a permanent public storage network;",
          "records written by the Lexari program, such as the agent registry and memory records. Memory records hold a fingerprint and a pointer, never the text of your memories.",
        ] },
        { p: "Deleting your Lexari account removes our copies but cannot remove anything already on chain or on Irys." },
      ],
    },
    {
      id: "processors",
      title: "Who processes data for us",
      body: [
        { p: "We share data only with services that help run Lexari, each for the purpose listed, or when the law requires it." },
        { rows: [
          { name: "Privy", role: "Google and email sign in, embedded Solana wallets, linking social accounts", data: "Email, Google profile, wallet address, Privy user ID, linked social account IDs and usernames" },
          { name: "Neon", role: "Managed Postgres database", data: "Account, profile, agents, chats, encrypted memories, receipts, Hub, notifications, push subscriptions" },
          { name: "Contabo", role: "Server hosting for the app, model relay and agent computers", data: "Everything the app processes, agent computer files and screenshots, server logs" },
          { name: "xAI", role: "Language and vision model (Grok)", data: "Messages, recent chat, opened memory notes, wallet summary, agent computer screenshots" },
          { name: "Solana RPC providers", role: "Reading the chain and sending signed transactions (the public Solana endpoints, or Helius when enabled)", data: "Wallet addresses, signed transactions, IP address of our server or your browser" },
          { name: "Irys", role: "Permanent storage for agent ID card images and metadata", data: "Agent name, role and face image (public)" },
          { name: "X, Discord, Telegram", role: "Only if you link an account, through Privy", data: "Account ID and username" },
          { name: "Push services", role: "Delivering push notifications (Google, Mozilla, Apple or Microsoft, depending on your browser)", data: "Push endpoint and notification text" },
          { name: "Your browser's speech service", role: "Speech to text and text to speech", data: "Microphone audio, processed by your browser" },
          { name: "Wallet apps", role: "Phantom, Solflare or Backpack, if you sign in with one", data: "Wallet address and the messages and transactions you sign" },
          { name: "Websites your agent visits", role: "Your agent's browser loads pages you ask it to", data: "Whatever that page receives, such as searches or forms your agent fills (never passwords or payment details)" },
        ] },
        { p: "Coming later. Lexari plans to support more chains (such as Base, Ethereum and Tempo), let you top up a Lexari balance with a card through a third party payment processor or with crypto on supported chains, offer plans with extra credits, add more AI model providers, and let agents use third party protocols you enable. None of these process your data today. Before any of them do, we will update this policy and list the providers involved. Card details will be handled by the payment processor; Lexari will not store full card numbers." },
      ],
    },
    {
      id: "transfers",
      title: "International transfers",
      body: [
        { p: "Our providers may process data in countries other than yours, including the United States and the European Union. Where the law requires it, we rely on safeguards such as standard contractual clauses or the provider's equivalent commitments." },
      ],
    },
    {
      id: "retention",
      title: "How long we keep data",
      body: [
        { list: [
          "Account, agents, profile and settings: until you delete your account.",
          "Chats: until you clear them in Settings or delete your account.",
          "Memories: until you delete them or your account.",
          "When you delete your account, its database records (agents, chats, memories, receipts, Hub progress, linked social accounts, notifications and push subscriptions) are removed right away. Copies in our database provider's backups expire on its backup schedule.",
          "Agent computer files: to have them erased together with your account, email us and we will remove them.",
          "Server logs and error reports: kept for a limited time for security and debugging, then rotated out.",
          "Blockchain and Irys records: permanent and outside our control.",
        ] },
      ],
    },
    {
      id: "rights",
      title: "Your choices and rights",
      body: [
        { list: [
          "Export: Settings, Data controls, Export data downloads a copy of what we hold for you.",
          "Delete: Settings, Data controls lets you clear your chats or delete your account.",
          "Memory: turn memory off for all agents or for one agent at any time.",
          "Social accounts: unlink X, Discord or Telegram in Settings whenever you like.",
          "Notifications: turn push notifications off in Settings or in your browser.",
        ] },
        { p: `Depending on where you live, you may also have the right to access, correct, restrict or object to processing of your data, and to complain to your data protection authority (in Nigeria, the Nigeria Data Protection Commission). To make a request, email ${C} from the email on your account, or tell us your wallet address and we will ask you to prove you control it.` },
      ],
    },
    {
      id: "storage",
      title: "Cookies and local storage",
      body: [
        { p: "Lexari uses a single sign in cookie (lexari_session), which is httpOnly and needed to keep you signed in. The app also stores your theme, active chat and similar preferences in your browser's local storage, and keeps your memory key in your browser's IndexedDB so you do not have to sign again on every visit. Privy and wallet apps set their own storage to keep you connected. We do not use advertising or cross site tracking cookies." },
      ],
    },
    {
      id: "security",
      title: "Security",
      body: [
        { p: "We use encryption in transit, client side encryption for memories, hashed session tokens, an optional app lock, isolated containers for agent computers, and a confirmation step you control for every transaction. No system is perfectly secure; if a breach affects you we will tell you as the law requires." },
      ],
    },
    {
      id: "children",
      title: "Children",
      body: [{ p: "Lexari is not for anyone under 18. We do not knowingly collect data from children. If you believe a child is using Lexari, contact us and we will delete the account." }],
    },
    {
      id: "changes",
      title: "Changes and contact",
      body: [
        { p: `We will update this page when our data handling changes and change the date at the top. For significant changes we will also tell you in the app. Questions, requests or complaints: ${C}.` },
      ],
    },
  ],
};

export const TERMS: Doc = {
  slug: "terms",
  title: "Terms of Service",
  eyebrow: "Legal · Terms",
  intro: "These terms are the agreement between you and Lexari for using lexari.ai, app.lexari.ai and your Lexari agents. By using Lexari you accept them. If you do not agree, please do not use Lexari.",
  summary: [
    "You must be 18 or older and allowed to use services like this where you live.",
    "Lexari runs on the Solana devnet test network today. Devnet tokens have no value.",
    "Your wallet is yours. Every transaction needs your confirmation and cannot be reversed by us.",
    "AI agents can be wrong. Nothing they say is financial, legal or professional advice.",
    "Coins, XP, levels and store items have no cash value.",
    "Use your agent and its computer lawfully and respectfully.",
  ],
  sections: [
    {
      id: "eligibility",
      title: "Who can use Lexari",
      body: [
        { p: "You must be at least 18, able to enter a binding contract, and not barred from using services like Lexari by the laws of where you live, including sanctions laws. Some features may not be available in every country." },
      ],
    },
    {
      id: "devnet",
      title: "Test network notice",
      body: [
        { p: "Lexari currently runs on Solana devnet, a public test network. SOL and tokens on devnet have no monetary value and cannot be exchanged for real money. Payments for plans, hires and agent cards are made in devnet SOL. Agent cards are test cards with test numbers and cannot be used to buy anything. Features, balances and test data may change or be reset while Lexari is in this stage." },
      ],
    },
    {
      id: "account",
      title: "Your account and wallet",
      body: [
        { list: [
          "Your account is tied to a Solana wallet. If you sign in with Google or email, Privy creates and secures an embedded wallet for you. If you sign in with Phantom, Solflare or Backpack, that wallet remains under your control.",
          "You are responsible for keeping your sign in methods, devices and wallet secure. Anyone who controls your wallet can control your account.",
          "Blockchain transactions are final. Lexari cannot cancel, reverse or refund a transaction once it is signed and sent.",
          "When you hire a specialist agent, Lexari holds a separate task wallet for it. You decide whether to fund it, and you can return what is left to your wallet at any time.",
        ] },
      ],
    },
    {
      id: "agents",
      title: "Your AI agents",
      body: [
        { list: [
          "Agents use AI models that can make mistakes, misunderstand you or produce wrong, outdated or offensive output. Check anything important before you rely on it.",
          "Nothing an agent says is financial, investment, legal, tax, medical or other professional advice.",
          "An agent can prepare a transfer or payment, but nothing moves until you review it and confirm it yourself. You are responsible for what you confirm.",
          "Agents never enter passwords, payment details or two factor codes for you. They ask you to do it.",
          "You are responsible for the instructions you give your agents and for how you use their output.",
        ] },
      ],
    },
    {
      id: "computer",
      title: "Agent computers",
      body: [
        { p: "Your agent's computer is an isolated container on our servers with limited resources and filtered internet access. It exists to do tasks for you. You must not use it, or ask your agent to use it, to break the law, attack or probe other systems, send spam, mine cryptocurrency, get around access controls or paywalls, collect other people's data without permission, or store illegal content. We may pause or reset an agent computer that is misused or harms the service." },
      ],
    },
    {
      id: "use",
      title: "Acceptable use",
      body: [
        { p: "When using Lexari you agree not to:" },
        { list: [
          "break any law or anyone else's rights, including privacy and intellectual property rights;",
          "create content that sexualises minors, promotes violence or terrorism, harasses people or defrauds anyone;",
          "try to get around rate limits, quotas, plan limits or the transaction confirmation step;",
          "create multiple accounts or link social accounts you do not own in order to farm rewards or referrals;",
          "reverse engineer, overload or disrupt Lexari or the systems it relies on;",
          "use Lexari to build a competing service from our models, prompts or data.",
        ] },
      ],
    },
    {
      id: "hub",
      title: "Coins, XP, levels and store items",
      body: [
        { p: "Coins, XP, levels, streaks, mystery box rewards, achievements and cosmetic store items are features of the Lexari game layer. They have no monetary value, are not money or a financial product, cannot be sold, transferred or exchanged for cash or crypto, and are not refundable. We may change how they are earned or used, and remove ones gained through bugs, abuse or rule breaking." },
      ],
    },
    {
      id: "payments",
      title: "Plans and payments",
      body: [
        { p: "Today, plans, hires and agent cards are paid in devnet SOL and verified on the Solana test network. Free plans have the limits shown in the app; paid plans unlock more agent seats for the period shown at checkout." },
        { p: "Later, Lexari plans to offer paid plans with extra credits and a Lexari balance you can top up with a card through a third party payment processor or with crypto on supported chains. When that launches, prices, what a credit buys, renewal and refund terms will be shown before you pay and will form part of these terms. Card payments will be handled by the payment processor under its own terms; Lexari will not store full card numbers." },
      ],
    },
    {
      id: "social",
      title: "Linked social accounts",
      body: [
        { p: "You can link X, Discord or Telegram to verify your profile. You must only link accounts you own. A social account can be linked to one Lexari account at a time. Verification shows that you control that account; it is not an endorsement by Lexari or by that platform. Rewards for linking are given once per platform and may be removed if an account is unlinked to farm them." },
      ],
    },
    {
      id: "content",
      title: "Your content",
      body: [
        { p: "You keep ownership of what you put into Lexari and of your agents' output for you, to the extent the law allows. You give Lexari a limited licence to store, process and transmit that content only to run and improve the service for you, including sending it to the providers described in our Privacy Policy. You confirm you have the rights to anything you upload. We may remove content that breaks these terms." },
      ],
    },
    {
      id: "third",
      title: "Third party services",
      body: [
        { p: "Lexari relies on services we do not control, including Privy, wallet apps, AI model providers, the Solana network and its RPC providers, Irys and the websites your agent visits. Their own terms apply to your use of them. We are not responsible for their availability, fees, security or conduct, or for losses caused by blockchain networks, smart contracts or wallets." },
      ],
    },
    {
      id: "disclaimer",
      title: "Disclaimers",
      body: [
        { p: "Lexari is provided as is and as available. To the fullest extent the law allows, we disclaim all warranties, express or implied, including fitness for a particular purpose, accuracy and uninterrupted or error free operation. Nothing in these terms limits rights you have under consumer protection law that cannot be excluded." },
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: [
        { p: "To the fullest extent the law allows, Lexari is not liable for indirect, incidental, special or consequential losses, lost profits, lost data, or losses from transactions you confirmed, from AI output, or from third party services. Our total liability for any claim relating to Lexari is limited to the greater of the amount you paid us in the 12 months before the claim or USD 50." },
      ],
    },
    {
      id: "indemnity",
      title: "Indemnity",
      body: [{ p: "You agree to cover Lexari's reasonable losses and costs from claims by others caused by your breach of these terms, your content or your misuse of Lexari." }],
    },
    {
      id: "ending",
      title: "Suspension and ending",
      body: [
        { p: "You can stop using Lexari and delete your account at any time in Settings. We may suspend or close an account that breaks these terms, puts others at risk or is required to be closed by law. Where reasonable we will tell you why. Sections that by their nature should continue, such as disclaimers and liability limits, survive after your account ends." },
      ],
    },
    {
      id: "changes",
      title: "Changes, law and contact",
      body: [
        { p: "We may update these terms as Lexari changes. We will change the date at the top and tell you in the app about significant changes. Continuing to use Lexari after a change means you accept it." },
        { p: `These terms are governed by the laws of the Federal Republic of Nigeria, and disputes go to the courts of Nigeria, unless the law where you live gives you the right to bring a claim there. Questions: ${C}.` },
      ],
    },
  ],
};

export const DOCS = { privacy: PRIVACY, terms: TERMS } as const;
