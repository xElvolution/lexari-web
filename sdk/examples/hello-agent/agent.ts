import { defineAgent, defineTool } from "@lexari/sdk";

/** The smallest useful agent: a persona and one read tool. No money, no keys. */
export default defineAgent({
  id: "hello-agent",
  name: "Hello Agent",
  version: "0.1.0",
  category: "Planning",
  face: { seed: 7, color: "purple" },
  persona: {
    job: "Says hello",
    quip: "Hi, nice to meet you.",
    description: "A friendly starter agent that greets people and tells them the time anywhere.",
    examples: ["Say hi", "What time is it in Lagos?"],
    system: "Be warm and brief. Use the time tool when someone asks about the time somewhere.",
  },
  pricing: { type: "free", usd: 0 },
  url: process.env.LEXARI_TOOL_URL || "https://hello.example.com/lexari",
  tools: [
    defineTool({
      name: "time_in",
      description: "The current time in an IANA time zone, like Africa/Lagos.",
      input: { type: "object", properties: { zone: { type: "string", description: "IANA time zone" } }, required: ["zone"] },
      run: ({ input }) => {
        try { return `It's ${new Date().toLocaleTimeString("en-GB", { timeZone: String(input.zone), hour: "2-digit", minute: "2-digit" })} in ${input.zone}.`; }
        catch { return "I don't know that time zone."; }
      },
    }),
  ],
});
