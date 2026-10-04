import type { ChatMessage } from "./cortex";

export type RecallNote = { tag: string; text: string };
export type Turn = { from: string; text: string };

export function buildPrompt(input: {
  agentName: string;
  role: string;
  tone: string;
  speaker: string;
  /** what this agent is for (a specialist's brief, or the brief you gave an agent you made) */
  about?: string;
  /** what the agent calls the person */
  you?: string;
  recall: RecallNote[];
  /** how many notes it reads (Bigger memory perk reads more) */
  recallMax?: number;
  history: Turn[];
  text: string;
}): ChatMessage[] {
  const notes = input.recall.slice(0, input.recallMax ?? 8).map((n) => `- ${n.tag}: ${n.text}`).join("\n");
  const system = [
    `You are ${input.speaker}, a Lexari agent${input.role ? ` (${input.role})` : ""}.`,
    `The person's home agent is ${input.agentName}. Speak in a ${input.tone || "short"} tone.`,
    input.about ? `Your brief: ${input.about.slice(0, 1500)}` : "",
    input.you ? `Call the person ${input.you}.` : "",
    "Reply in plain sentences. Do not mention being a language model.",
    "Memories and skills are separate. Use a memory only when it helps this reply.",
    notes ? `What you already know about this person:\n${notes}` : "You have no saved memories for this person yet.",
    "If the person just stated a durable fact about themselves, end with one line: REMEMBER: <the fact in one short sentence>. Otherwise do not write REMEMBER.",
  ].filter(Boolean).join("\n");
  const history: ChatMessage[] = input.history.slice(-12).filter((t) => t.text.trim()).map((t) => ({
    role: t.from === "you" ? "user" : "assistant",
    content: t.text.slice(0, 2000),
  }));
  return [{ role: "system", content: system }, ...history, { role: "user", content: input.text.slice(0, 4000) }];
}
