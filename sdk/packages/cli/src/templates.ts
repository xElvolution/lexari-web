/** Files `lexari init` writes. */
export const TEMPLATES: Record<string, Record<string, string>> = {
  hello: {
    "agent.ts": `import { defineAgent, defineTool } from "@lexari/sdk";

export default defineAgent({
  id: "__ID__",
  name: "__NAME__",
  version: "0.1.0",
  category: "Planning",
  face: { seed: 7, color: "purple" },
  persona: {
    job: "Says hello",
    quip: "Hi, nice to meet you.",
    description: "A friendly starter agent that greets people and tells them the time anywhere.",
    examples: ["Say hi", "What time is it in Lagos?"],
    system: "Be warm and brief. Use the time tool when someone asks about the time.",
  },
  pricing: { type: "free", usd: 0 },
  url: process.env.LEXARI_TOOL_URL || "https://example.com/lexari",
  tools: [
    defineTool({
      name: "time_in",
      description: "The current time in an IANA time zone, like Africa/Lagos.",
      input: { type: "object", properties: { zone: { type: "string", description: "IANA time zone" } }, required: ["zone"] },
      run: ({ input }) => {
        try { return \`It's \${new Date().toLocaleTimeString("en-GB", { timeZone: String(input.zone), hour: "2-digit", minute: "2-digit" })} in \${input.zone}.\`; }
        catch { return "I don't know that time zone."; }
      },
    }),
  ],
});
`,
    "server.ts": `import { serve } from "@lexari/sdk";
import agent from "./agent.ts";

const secret = process.env.LEXARI_WEBHOOK_SECRET || "";
if (!secret) console.warn("Set LEXARI_WEBHOOK_SECRET (lexari publish shows it once).");
const port = Number(process.env.PORT || 8787);
serve(agent, { secret, port, host: "0.0.0.0" });
console.log(\`\${agent.spec.name} listening on :\${port}\`);
`,
    ".gitignore": "node_modules\n.env\n",
    "package.json": JSON.stringify({ name: "__ID__", private: true, type: "module", scripts: { start: "tsx server.ts", dev: "lexari dev", test: "lexari test" }, dependencies: { "@lexari/sdk": "0.1.0" }, devDependencies: { lexari: "0.1.0", tsx: "^4.19.0" } }, null, 2) + "\n",
    "README.md": "# __NAME__\n\nRun `lexari dev` to talk to it, `lexari test` before you publish, then `lexari publish`.\nPut server.ts behind HTTPS and set LEXARI_TOOL_URL to that address.\n",
  },
};
