import { serve } from "@lexari/sdk";
import agent from "./agent.ts";

const secret = process.env.LEXARI_WEBHOOK_SECRET || "";
if (!secret) console.warn("Set LEXARI_WEBHOOK_SECRET (lexari publish shows it once).");
const port = Number(process.env.PORT || 8787);
serve(agent, { secret, port, host: "0.0.0.0" });
console.log(`${agent.spec.name} listening on :${port}. Put it behind HTTPS and set LEXARI_TOOL_URL.`);
