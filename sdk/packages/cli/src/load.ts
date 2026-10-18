/** Loads your agent (agent.ts by default) and builds its manifest. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Agent } from "@lexari/sdk";

export async function loadAgent(file = "agent.ts"): Promise<Agent> {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) { console.error(`No ${file} here. Run \`lexari init\` or pass --agent <file>.`); process.exit(1); }
  const mod = await import(pathToFileURL(path).href);
  const agent = (mod.default?.default ?? mod.default ?? mod.agent) as Agent | undefined;
  if (!agent || typeof agent.manifest !== "function") { console.error(`${file} must export default defineAgent({...}).`); process.exit(1); }
  return agent;
}
