/**
 * More integration tools: agent payments (x402 services and hiring other agents, inside the agent's budget), Tempo
 * testnet (wallet, faucet, sends, top-ups), the ORE Miner's servers, and Panta prediction markets.
 * Same contract as registry.ts. Tools with `auto` run on their own inside the agent's budget; over it, a Confirm card.
 */
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { and, desc, eq } from "drizzle-orm";
import { SPECIALISTS, specialistBySlug } from "@/content/appData";
import { railById } from "@/content/topup";
import { appOrigin } from "../config";
import { db } from "../db";
import { agents } from "../db/schema";
import { integrationActions } from "../db/integrationsSchema";
import { rateLimit } from "../http";
import { solanaKeypair } from "../agentWallets";
import { complete } from "../engram/cortex";
import { budgetOf, agentSpentToday } from "../agentpay/budgets";
import { SERVICES, serviceById } from "../agentpay/services";
import { X402Error, payAndFetch, quote } from "../agentpay/x402";
import { checkDeposit, depositInfo } from "../topup/deposits";
import { describeHosts, hostByRef, listHosts, queueCommand } from "../miner/hosts";
import { evmAddress, evmKey } from "./evm";
import { TEMPO, TEMPO_TOKENS, TempoError, tempoBalances, tempoFund, tempoToken, tempoTransfer } from "./tempo";
import { PantaError, pantaMarket, pantaMarkets, pantaQuote, pantaReady } from "./panta";
import { balances, network, parseAddress, transfer, txExplorer } from "./solana";
import { Reject } from "./reject";
import type { AgentRef, ToolDef } from "./registry";

const num = z.union([z.number(), z.string().regex(/^\s*\$?\d+(\.\d+)?\s*$/).transform((s) => Number(s.replace(/[$\s]/g, "")))]);
const money = (usd: number) => `$${usd.toFixed(usd < 1 ? 3 : 2).replace(/(\.\d\d)\d*?0+$/, "$1")}`;
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
/** What one task for another agent costs (devnet USDC, agent wallet to agent wallet). */
export const AGENT_TASK_USD = Number(process.env.AGENT_TASK_USD || 0.05);

async function usdcOf(agent: AgentRef) {
  const b = await balances(agent.keypair().publicKey);
  return b.usdcMicros;
}
async function needUsdc(agent: AgentRef, micros: number) {
  const have = await usdcOf(agent);
  if (have < micros) throw new Reject(`My wallet holds ${(have / 1e6).toFixed(2)} test USDC and this costs ${money(micros / 1e6)}. Fund me from your balance first (my wallet, Fund).`);
}

/* ---------- Agent payments: x402 services ---------- */
const svcUrl = (id: string, q: URLSearchParams) => `${appOrigin()?.uri || "https://app.lexari.ai"}/api/x402/${id}${q.toString() ? `?${q}` : ""}`;
const svcInput = z.object({ service: z.string().max(40), symbol: z.string().max(12).optional() }).passthrough();
const payServices: ToolDef = {
  name: "pay.services", connector: "payments", risk: "read", input: z.object({}).passthrough(),
  hint: `pay.services {} : the paid x402 services you can buy, your budget and what you've spent today.`,
  run: async (_i: never, agent) => {
    const [b, spent, usdc] = await Promise.all([budgetOf(agent.userId, agent.slug), agentSpentToday(agent.userId, agent.slug), usdcOf(agent).catch(() => 0)]);
    return { summary: "Checked its budget and services", text: `x402 services (paid per request in devnet USDC from your wallet): ${SERVICES.map((s) => `${s.id}: ${s.description}, ${money(s.priceAtoms / 1e6)}`).join("; ")}. Hiring another agent for one task costs ${money(AGENT_TASK_USD)}. Your budget: ${money(b.perTaskMicros / 1e6)} per task, ${money(b.dailyMicros / 1e6)} a day; ${money(spent / 1e6)} spent today. Your wallet holds ${(usdc / 1e6).toFixed(2)} test USDC.` };
  },
};
const payService: ToolDef = {
  name: "pay.service", connector: "payments", risk: "sign", auto: true, input: svcInput,
  hint: `pay.service {"service":"market-brief"} or {"service":"token-price","symbol":"BTC"} : buy one x402 service request from your wallet; inside your budget it's paid right away and the data comes back to you.`,
  prepare: async (i: z.output<typeof svcInput>, agent) => {
    const s = serviceById(i.service.trim().toLowerCase());
    if (!s) throw new Reject(`There's no x402 service called ${i.service.slice(0, 30)}. Available: ${SERVICES.map((x) => x.id).join(", ")}.`);
    await needUsdc(agent, s.priceAtoms);
    const q = new URLSearchParams(i.symbol ? { symbol: i.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") } : {});
    return {
      title: `Pay for ${s.name}`, chain: "solana", usdMicros: s.priceAtoms, summary: `Paid for ${s.name}`,
      rows: [["Service", s.name], ["Price", `${money(s.priceAtoms / 1e6)} test USDC`], ["Protocol", "x402 (exact, Solana devnet)"], ["From", `${agent.name}'s wallet`], ["Network", network()]],
      plan: { kind: "x402", url: svcUrl(s.id, q), service: s.id, name: s.name, atoms: s.priceAtoms },
    };
  },
  execute: async (p: { url: string; name: string; atoms: number }, agent) => {
    try {
      const { req, free } = await quote(p.url);
      if (free) return { sig: "", confirmed: true, text: `${p.name} answered for free: ${JSON.stringify(free).slice(0, 1500)}` };
      if (Number(req.maxAmountRequired) > p.atoms) throw new Reject("The service raised its price, so I didn't pay.");
      const { body, sig } = await payAndFetch(p.url, req, agent.keypair());
      return { sig, confirmed: !!sig, rows: [["Paid", `${money(p.atoms / 1e6)} test USDC`]], text: `Paid ${money(p.atoms / 1e6)} for ${p.name} (x402, devnet USDC, tx ${sig ? short(sig) : "pending"}). The data: ${JSON.stringify((body as { data?: unknown })?.data ?? body).slice(0, 1800)}`,
        receipt: { amount: `${money(p.atoms / 1e6)} USDC`, label: p.name, url: sig ? txExplorer(sig) : undefined } };
    } catch (e) {
      if (e instanceof X402Error) throw new Reject(e.message);
      throw e;
    }
  },
};

/* ---------- Agent payments: hire another agent per task ---------- */
type Target = { slug: string; kind: string; name: string; role: string; about: string };
async function targetOf(userId: string, ref: string, self: string): Promise<Target> {
  const r = ref.trim().toLowerCase();
  const team = await db().select({ slug: agents.slug, kind: agents.kind, name: agents.name, role: agents.role, meta: agents.meta }).from(agents).where(eq(agents.userId, userId));
  const t = team.find((a) => a.slug === r || a.name.toLowerCase() === r || ((a.meta as { nick?: string } | null)?.nick || "").toLowerCase() === r);
  if (t) { if (t.slug === self) throw new Reject("I can't hire myself."); const sp = specialistBySlug(t.slug); return { slug: t.slug, kind: t.kind, name: t.name, role: sp?.job || t.role || "Agent", about: sp?.back || "" }; }
  const sp = SPECIALISTS.find((x) => x.slug === r || x.name.toLowerCase() === r);
  if (sp) { if (sp.slug === self) throw new Reject("I can't hire myself."); return { slug: sp.slug, kind: "hired", name: sp.name, role: sp.job, about: sp.back }; }
  throw new Reject(`There's no agent called ${ref.slice(0, 30)} on your team or in the marketplace.`);
}
const hireInput = z.object({ agent: z.string().min(1).max(40), task: z.string().min(3).max(600) }).passthrough();
const payAgent: ToolDef = {
  name: "pay.agent", connector: "payments", risk: "sign", auto: true, input: hireInput,
  hint: `pay.agent {"agent":"scout","task":"three facts about ORE mining, with links"} : hire another agent (on your team or in the marketplace) for one task, ${money(AGENT_TASK_USD)} in test USDC from your wallet; its answer comes back to you.`,
  prepare: async (i: z.output<typeof hireInput>, agent) => {
    const t = await targetOf(agent.userId, i.agent, agent.slug);
    const micros = Math.round(AGENT_TASK_USD * 1e6);
    await needUsdc(agent, micros);
    const to = solanaKeypair(agent.userId, t.slug, t.kind).publicKey.toBase58();
    return {
      title: `Hire ${t.name} for a task`, chain: "solana", usdMicros: micros, summary: `Hired ${t.name} for a task`,
      rows: [["Agent", `${t.name} · ${t.role}`], ["Task", i.task.slice(0, 80)], ["Price", `${money(AGENT_TASK_USD)} test USDC`], ["To", `${t.name}'s wallet ${short(to)}`], ["From", `${agent.name}'s wallet`], ["Network", network()]],
      plan: { kind: "hire", to, slug: t.slug, name: t.name, role: t.role, about: t.about, task: i.task, usd: AGENT_TASK_USD },
    };
  },
  execute: async (p: { to: string; name: string; role: string; about: string; task: string; usd: number }, agent) => {
    const to = parseAddress(p.to);
    if (!to) throw new Reject("That agent's wallet isn't valid.");
    const tx = await transfer(agent.keypair(), new PublicKey(to), "USDC", p.usd);
    let answer = "";
    try {
      answer = await complete([
        { role: "system", content: `You are ${p.name}, a ${p.role} agent on Lexari. ${p.about} Another agent (${agent.name}) paid you ${money(p.usd)} for one task. Answer it directly in under 150 words. Never invent links or numbers you don't know.` },
        { role: "user", content: p.task },
      ], AbortSignal.timeout(45000));
    } catch { answer = ""; }
    return { sig: tx.sig, confirmed: tx.confirmed, rows: [["Paid", `${money(p.usd)} test USDC`]],
      text: `Paid ${p.name} ${money(p.usd)} (devnet USDC, tx ${short(tx.sig)}). ${answer ? `${p.name}'s answer: ${answer.slice(0, 1500)}` : `${p.name} didn't answer in time; the payment went through.`}`,
      receipt: { amount: `${money(p.usd)} USDC`, label: `${p.name} (task)`, url: txExplorer(tx.sig) } };
  },
};

/* ---------- Tempo (Moderato testnet) ---------- */
const tempoAddr = (agent: AgentRef) => evmAddress(agent.userId, agent.slug);
const fmtTok = (n: number) => (+n.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });
const tempoWallet: ToolDef = {
  name: "tempo.wallet", connector: "tempo", risk: "read", input: z.object({}).passthrough(),
  hint: `tempo.wallet {} : your Tempo testnet address and its stablecoin balances (${TEMPO_TOKENS.map((t) => t.symbol).join(", ")}).`,
  run: async (_i: never, agent) => {
    const a = tempoAddr(agent);
    const b = await tempoBalances(a);
    return { summary: "Checked its Tempo wallet", text: `Your Tempo address (${TEMPO.network}): ${a} (your EVM address). It holds ${b.map((t) => `${fmtTok(t.amount)} ${t.symbol}`).join(", ")}. Tempo has no gas coin: fees are paid in the stablecoin you send. These are test stablecoins.` };
  },
};
const tempoFaucet: ToolDef = {
  name: "tempo.fund", connector: "tempo", risk: "read", input: z.object({}).passthrough(),
  hint: `tempo.fund {} : get free test stablecoins from the Tempo testnet faucet into your Tempo wallet (once a day).`,
  run: async (_i: never, agent) => {
    if (!(await rateLimit(`tempo:fund:${agent.userId}:${agent.slug}`, 1, 86_400_000))) throw new Reject("I already used the Tempo faucet today. Try again tomorrow.");
    const a = tempoAddr(agent);
    await tempoFund(a);
    await new Promise((s) => setTimeout(s, 1500));
    const b = await tempoBalances(a).catch(() => []);
    return { summary: "Got test stablecoins on Tempo", text: `The Tempo testnet faucet funded ${a}. It now holds ${b.map((t) => `${fmtTok(t.amount)} ${t.symbol}`).join(", ") || "the faucet amount (balances update in a few seconds)"}. Test funds only.` };
  },
};
const tokenIn = z.string().max(12).default("pathUSD");
const tempoSendIn = z.object({ to: z.string().regex(/^0x[0-9a-fA-F]{40}$/), token: tokenIn, amount: num }).passthrough();
const tempoSend: ToolDef = {
  name: "tempo.transfer", connector: "tempo", risk: "sign", input: tempoSendIn,
  hint: `tempo.transfer {"to":"0x…","token":"pathUSD","amount":5} : prepare a stablecoin send from your Tempo wallet; the person confirms it.`,
  prepare: async (i: z.output<typeof tempoSendIn>, agent, limits) => {
    const t = tempoToken(i.token);
    if (!t) throw new Reject(`Tempo tokens I can send: ${TEMPO_TOKENS.map((x) => x.symbol).join(", ")}.`);
    if (!(i.amount > 0)) throw new Reject("The amount has to be more than 0.");
    if (i.amount > limits.perTxUsd) throw new Reject(`That's ${money(i.amount)}, over your $${limits.perTxUsd} per trade limit for Tempo.`);
    const from = tempoAddr(agent);
    if (i.to.toLowerCase() === from.toLowerCase()) throw new Reject("That's my own Tempo address.");
    const bal = (await tempoBalances(from)).find((x) => x.address === t.address);
    if (!bal || bal.amount < i.amount + 0.01) throw new Reject(`My Tempo wallet holds ${fmtTok(bal?.amount || 0)} ${t.symbol}, and the fee is paid in it too (about 0.001). Ask me to use the Tempo faucet first.`);
    const amount = Math.round(i.amount * 1e6) / 1e6;
    return {
      title: `Send ${fmtTok(amount)} ${t.symbol} on Tempo`, chain: "tempo", usdMicros: Math.round(amount * 1e6), summary: `Send ${fmtTok(amount)} ${t.symbol} on Tempo`,
      rows: [["Send", `${fmtTok(amount)} ${t.symbol} (test)`], ["To", short(i.to)], ["From", `${agent.name}'s Tempo wallet`], ["Network", TEMPO.network], ["Fee", `About 0.001 ${t.symbol}, paid in ${t.symbol}`]],
      plan: { kind: "tempo", to: i.to, token: t.address, symbol: t.symbol, atoms: String(Math.round(amount * 10 ** t.decimals)), amount },
    };
  },
  execute: async (p: { to: string; token: string; symbol: string; atoms: string; amount: number }, agent) => {
    try {
      const r = await tempoTransfer(evmKey(agent.userId, agent.slug), tempoAddr(agent), p.token, p.to, BigInt(p.atoms));
      return { sig: r.hash, confirmed: r.confirmed, receipt: { amount: `${fmtTok(p.amount)} ${p.symbol}`, label: short(p.to), net: TEMPO.network, url: TEMPO.explorerTx(r.hash) } };
    } catch (e) { if (e instanceof TempoError) throw new Reject(e.message); throw e; }
  },
};
const tempoTopIn = z.object({ token: tokenIn, amount: num }).passthrough();
const railOf = (symbol: string) => railById(`${symbol.toUpperCase()}:tempo`);
const tempoTopup: ToolDef = {
  name: "tempo.topup", connector: "tempo", risk: "sign", input: tempoTopIn,
  hint: `tempo.topup {"token":"pathUSD","amount":5} : prepare a top-up of the person's Lexari balance from YOUR Tempo wallet (1 test stablecoin = $1); the person confirms it.`,
  prepare: async (i: z.output<typeof tempoTopIn>, agent, limits) => {
    const t = tempoToken(i.token);
    const rail = t ? railOf(t.symbol) : null;
    if (!t || !rail) throw new Reject(`Top-ups from Tempo take ${TEMPO_TOKENS.map((x) => x.symbol).join(" or ")}.`);
    if (!(i.amount >= rail.min)) throw new Reject(`The minimum top-up on Tempo is ${rail.min} ${t.symbol}.`);
    if (i.amount > limits.perTxUsd) throw new Reject(`That's ${money(i.amount)}, over your $${limits.perTxUsd} per trade limit for Tempo.`);
    const from = tempoAddr(agent);
    const bal = (await tempoBalances(from)).find((x) => x.address === t.address);
    if (!bal || bal.amount < i.amount + 0.01) throw new Reject(`My Tempo wallet holds ${fmtTok(bal?.amount || 0)} ${t.symbol}. Ask me to use the Tempo faucet first.`);
    const dep = await depositInfo(agent.userId, `${rail.coin}:tempo`);
    const amount = Math.round(i.amount * 1e6) / 1e6;
    return {
      title: `Top up $${amount.toFixed(2)} from Tempo`, chain: "tempo", usdMicros: Math.round(amount * 1e6), summary: `Top up from Tempo`,
      rows: [["Send", `${fmtTok(amount)} ${t.symbol} (test)`], ["Adds", `≈ $${amount.toFixed(2)} to your balance`], ["To", `Your Lexari deposit address ${short(dep.address)}`], ["From", `${agent.name}'s Tempo wallet`], ["Network", TEMPO.network]],
      plan: { kind: "tempo-topup", to: dep.address, token: t.address, symbol: t.symbol, rail: `${rail.coin}:tempo`, atoms: String(Math.round(amount * 10 ** t.decimals)), amount },
    };
  },
  execute: async (p: { to: string; token: string; symbol: string; rail: string; atoms: string; amount: number }, agent) => {
    let r;
    try { r = await tempoTransfer(evmKey(agent.userId, agent.slug), tempoAddr(agent), p.token, p.to, BigInt(p.atoms)); }
    catch (e) { if (e instanceof TempoError) throw new Reject(e.message); throw e; }
    const v = await checkDeposit(agent.userId, p.rail).catch(() => null);
    const credited = v?.credited ? `$${v.credited.usd.toFixed(2)} added to your balance` : "Crediting in a moment";
    return { sig: r.hash, confirmed: r.confirmed, rows: [["Balance", credited]], receipt: { amount: `${fmtTok(p.amount)} ${p.symbol}`, label: "your Lexari balance", net: TEMPO.network, url: TEMPO.explorerTx(r.hash) } };
  },
};

/* ---------- ORE Miner: your own servers ---------- */
const oreServers: ToolDef = {
  name: "ore.servers", connector: "ore", risk: "read", input: z.object({}).passthrough(),
  hint: `ore.servers {} : the person's connected mining servers and how each miner is doing (live).`,
  run: async (_i: never, agent) => ({ summary: "Checked the mining servers", text: describeHosts(await listHosts(agent.userId)) }),
};
const oreIn = z.object({ action: z.enum(["install", "start", "stop", "status"]), server: z.string().max(40).optional(), threads: num.optional() }).passthrough();
const oreControl: ToolDef = {
  name: "ore.control", connector: "ore", risk: "read", input: oreIn,
  hint: `ore.control {"action":"start","threads":2} (or "install", "stop", "status"; add "server":"name" when there are several) : run it on the person's own server and get the result.`,
  run: async (i: z.output<typeof oreIn>, agent) => {
    let h;
    try { h = await hostByRef(agent.userId, i.server); } catch (e) { throw new Reject((e as Error).message + " Connect one in my profile: Mining > Connect a server."); }
    if (h.status !== "online") throw new Reject(`"${h.name}" is offline (its agent hasn't checked in). Check the server is on and the Lexari agent is running.`);
    const c = await queueCommand(agent.userId, h.id, i.action, { threads: i.threads }).catch((e: Error) => { throw new Reject(e.message); });
    for (let n = 0; n < 16; n++) {
      await new Promise((s) => setTimeout(s, 1000));
      const now = (await listHosts(agent.userId)).find((x) => x.id === h.id);
      const cmd = now?.commands.find((x) => x.id === c.id);
      if (cmd && (cmd.state === "done" || cmd.state === "failed")) {
        if (i.action === "start") await new Promise((s) => setTimeout(s, 6000));
        const fresh = (await listHosts(agent.userId)).filter((x) => x.id === h.id);
        return { summary: `${i.action[0].toUpperCase()}${i.action.slice(1)} on ${h.name}`, text: `${i.action} on "${h.name}": ${cmd.state === "done" ? cmd.output : `failed (${cmd.output})`}.\nNow: ${describeHosts(fresh)}` };
      }
    }
    return { summary: `Sent ${i.action} to ${h.name}`, text: `Sent "${i.action}" to "${h.name}". It hasn't answered yet; it checks in every few seconds.` };
  },
};

/* ---------- Panta (prediction markets) ---------- */
const pantaRe = (e: unknown) => { if (e instanceof PantaError) throw new Reject(e.message); throw e; };
const pmIn = z.object({ query: z.string().max(80).optional(), category: z.string().max(30).optional(), limit: num.optional() }).passthrough();
const pantaMarketsTool: ToolDef = {
  name: "panta.markets", connector: "panta", risk: "read", input: pmIn,
  hint: `panta.markets {"query":"bitcoin","limit":5} : open Panta prediction markets with live YES / NO prices (ids included).`,
  run: async (i: z.output<typeof pmIn>) => {
    const items = await pantaMarkets({ query: i.query, category: i.category, limit: Number(i.limit) || 6 }).catch(pantaRe);
    return { summary: i.query ? `Looked up "${i.query}" on Panta` : "Looked up Panta markets", text: items.length ? `Open Panta markets (YES price = implied chance):\n${items.map((m, n) => `${n + 1}. [${m.id}] ${m.title}: YES ${(m.yes * 100).toFixed(0)}¢, NO ${(m.no * 100).toFixed(0)}¢${m.volume ? `, volume $${Math.round(m.volume).toLocaleString("en-US")}` : ""}${m.ends ? `, ends ${m.ends.slice(0, 10)}` : ""}`).join("\n")}` : "No open Panta markets matched." };
  },
};
const posIn = z.object({ market: z.string().max(64), side: z.string().transform((s) => s.toLowerCase()).pipe(z.enum(["yes", "no"])), amount: num }).passthrough();
const pantaPosition: ToolDef = {
  name: "panta.position", connector: "panta", risk: "sign", input: posIn,
  hint: `panta.position {"market":"MARKET_ID","side":"yes","amount":5} : prepare a YES or NO position at Panta's live quote; the person confirms it (paper position on devnet).`,
  prepare: async (i: z.output<typeof posIn>, agent, limits) => {
    if (!pantaReady()) throw new Reject("Panta isn't connected on this server yet: it needs a Panta API key.");
    if (!(i.amount >= 1)) throw new Reject("The smallest position is $1.");
    if (i.amount > limits.perTxUsd) throw new Reject(`That's ${money(i.amount)}, over your $${limits.perTxUsd} per trade limit for Panta.`);
    const m = await pantaMarket(i.market).catch(pantaRe);
    const q = await pantaQuote(agent.keypair().publicKey.toBase58(), m.id, i.side, i.amount).catch(pantaRe);
    return {
      title: `${i.side.toUpperCase()} on "${m.title.slice(0, 60)}"`, chain: "panta", usdMicros: Math.round(i.amount * 1e6), summary: `${i.side.toUpperCase()} position on Panta`,
      rows: [["Market", m.title.slice(0, 80)], ["Side", i.side.toUpperCase()], ["Stake", `$${i.amount.toFixed(2)}`], ["Shares", `${+q.shares.toFixed(4)} at ${(q.avgPrice * 100).toFixed(1)}¢`], ["Fee", `$${q.feeUsdc.toFixed(2)}`], ["Pays if right", `$${q.shares.toFixed(2)}`], ["Mode", "Paper position (devnet): Panta settles in mainnet USDC"]],
      plan: { kind: "panta", market: m.id, title: m.title, side: i.side, amount: i.amount, shares: q.shares, avgPrice: q.avgPrice, quoteId: q.quoteId },
    };
  },
  execute: async (p: { shares: number; avgPrice: number }) => ({ sig: "", confirmed: true, rows: [["Recorded", `Paper position, ${+p.shares.toFixed(4)} shares at ${(p.avgPrice * 100).toFixed(1)}¢`]] }),
};
const pantaPositions: ToolDef = {
  name: "panta.positions", connector: "panta", risk: "read", input: z.object({}).passthrough(),
  hint: `panta.positions {} : your Panta positions (paper on devnet) with today's YES / NO prices.`,
  run: async (_i: never, agent) => {
    const rows = await db().select().from(integrationActions).where(and(eq(integrationActions.userId, agent.userId), eq(integrationActions.agentSlug, agent.slug), eq(integrationActions.tool, "panta.position"), eq(integrationActions.status, "confirmed"))).orderBy(desc(integrationActions.createdAt)).limit(10);
    if (!rows.length) return { summary: "Checked its Panta positions", text: "No Panta positions yet." };
    const out = await Promise.all(rows.map(async (r) => {
      const p = ((r.preview as { plan?: Record<string, unknown> } | null)?.plan || {}) as { market?: string; title?: string; side?: string; amount?: number; shares?: number; avgPrice?: number };
      const m = pantaReady() && p.market ? await pantaMarket(p.market).catch(() => null) : null;
      const now = m ? (p.side === "yes" ? m.yes : m.no) : null;
      return `${p.side?.toUpperCase()} "${p.title}": $${p.amount} for ${p.shares} shares at ${((p.avgPrice || 0) * 100).toFixed(1)}¢${now !== null ? `, now ${(now * 100).toFixed(1)}¢ (worth ≈ $${((p.shares || 0) * now).toFixed(2)})` : ""}`;
    }));
    return { summary: "Checked its Panta positions", text: `Your Panta positions (paper, devnet):\n${out.join("\n")}` };
  },
};

export const EXTRA_TOOLS: ToolDef[] = [payServices, payService, payAgent, tempoWallet, tempoFaucet, tempoSend, tempoTopup, oreServers, oreControl, pantaMarketsTool, pantaPosition, pantaPositions];
