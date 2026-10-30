/** The developer playground: one reply from Lamina with the same persona framing hired copies get. No tools run here. */
import type { Manifest } from "@lexari/manifest";
import { buildPrompt } from "../engram/spinal";
import { complete } from "../engram/cortex";
import { devHint, thirdPartyPersona, type DevAgent } from "./devtools";
import { toolTags, stripToolTags } from "../integrations/chat";

export async function playgroundReply(m: Manifest, developer: string, history: { from: "you" | "agent"; text: string }[], text: string) {
  const a: DevAgent = { listingId: "playground", slug: m.id, manifest: m, developer, label: `${m.name} by ${developer}`, secret: null };
  const prompt = buildPrompt({
    agentName: "Nova", role: m.persona.job, tone: m.persona.tone || "short", speaker: m.name, about: m.persona.description,
    recall: [], history: history.map((h) => ({ from: h.from === "you" ? "you" : m.id, text: h.text })), text,
  });
  prompt[0] = { ...prompt[0], content: `${prompt[0].content}\n${thirdPartyPersona(a)}\n${m.tools.length ? devHint(a) : ""}` };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const full = await complete(prompt, ctl.signal);
    return { reply: stripToolTags(full), tools: toolTags(full), model: "lamina" };
  } finally { clearTimeout(t); }
}
