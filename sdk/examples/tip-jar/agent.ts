import { defineAgent, defineTool, intents } from "@lexari/sdk";

/**
 * Tip Jar: looks up a creator and proposes a small USDC tip. It never holds or sees a key: the tip tool returns a
 * transfer intent, Lexari shows a Confirm card labelled "Proposed by Tip Jar by <you>", checks the person's limits
 * and the third-party caps ($5 each, $20 a day), and only the person's tap sends it (testnet).
 */
const CREATORS: Record<string, { name: string; wallet: string; about: string }> = {
  ada: { name: "Ada Paints", wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", about: "a painter who streams on Sundays" },
  tobi: { name: "Tobi Beats", wallet: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin", about: "a producer sharing free loops" },
};
const MAX_TIP_USD = 5;
const find = (q: unknown) => CREATORS[String(q ?? "").trim().toLowerCase().split(/\s+/)[0]];

export default defineAgent({
  id: "tip-jar",
  name: "Tip Jar",
  version: "0.1.0",
  category: "Onchain",
  face: { seed: 42, color: "teal" },
  persona: {
    job: "Tips creators",
    quip: "Small thanks, sent fast.",
    description: "Finds a creator's tip address and prepares a small test USDC tip for you to confirm.",
    examples: ["Tip Ada 1 USDC", "Who is Tobi?"],
    system: "Help people thank creators. Look a creator up first if unsure. Tips are small (up to 5 USDC) and always need the person's Confirm.",
  },
  pricing: { type: "free", usd: 0 },
  url: process.env.LEXARI_TOOL_URL || "https://tips.example.com/lexari",
  tools: [
    defineTool({
      name: "lookup",
      description: "Looks up a creator by name.",
      input: { type: "object", properties: { creator: { type: "string" } }, required: ["creator"] },
      run: ({ input }) => {
        const c = find(input.creator);
        return c ? `${c.name} is ${c.about}.` : "I don't know that creator yet.";
      },
    }),
    defineTool({
      name: "tip",
      description: "Proposes a USDC tip to a creator (up to 5).",
      input: { type: "object", properties: { creator: { type: "string" }, usd: { type: "number" } }, required: ["creator", "usd"] },
      intents: ["transfer"],
      run: ({ input }) => {
        const c = find(input.creator);
        if (!c) return "I don't know that creator yet.";
        const usd = Math.round(Number(input.usd) * 100) / 100;
        if (!(usd > 0) || usd > MAX_TIP_USD) return `Tips are between 0.01 and ${MAX_TIP_USD} USDC.`;
        return { text: `A ${usd} USDC tip for ${c.name} is ready for you to confirm.`, intent: intents.transfer({ to: c.wallet, asset: "USDC", amount: usd, note: `Tip for ${c.name}` }) };
      },
    }),
  ],
});
