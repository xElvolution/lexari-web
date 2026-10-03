import { z } from "zod";
import { currentSession } from "@/server/auth/session";
import { llmConfig, streamCompletion } from "@/server/engram/cortex";
import { splitRemember } from "@/server/engram/hippocampus";
import { buildPrompt } from "@/server/engram/spinal";
import { recordEvent } from "@/server/events";
import { db } from "@/server/db";
import { chats, messages } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { clientIp, jsonError, rateLimit, readJson } from "@/server/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  convo: z.string().min(1).max(80),
  text: z.string().min(1).max(4000),
  agentName: z.string().min(1).max(40),
  role: z.string().max(80).default(""),
  tone: z.string().max(40).default("short"),
  speaker: z.string().min(1).max(40),
  history: z.array(z.object({ from: z.string().max(40), text: z.string().max(2000) })).max(16).default([]),
  recall: z.array(z.object({ tag: z.string().max(40), text: z.string().max(240) })).max(8).default([]),
}).strict();

export async function POST(req: Request) {
  if (!rateLimit(`chat:${clientIp(req)}`, 20)) return jsonError(429, "Too many messages. Wait a minute.");
  const body = await readJson(req, bodySchema);
  if (body instanceof Response) return body;
  if (!llmConfig().key) return jsonError(503, "OPENAI_API_KEY is not set");

  const prompt = buildPrompt({
    ...body,
    role: body.role || "",
    tone: body.tone || "short",
    history: body.history || [],
    recall: body.recall || [],
  });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      let full = "";
      try {
        for await (const token of streamCompletion(prompt)) {
          full += token;
          send({ token });
        }
        const split = splitRemember(full);
        if (split.remember) send({ remember: split.remember });
        let persisted = false;
        try {
          const session = await currentSession();
          if (session) {
            persisted = await saveTurn(session.userId, body.convo, body.speaker, body.text, split.reply);
            await recordEvent(session.userId, "message");
          }
        } catch {
          persisted = false;
        }
        send({ done: true, persisted });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The model failed.";
        send({ error: message.slice(0, 180) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no" },
  });
}

async function saveTurn(userId: string, slug: string, speaker: string, userText: string, reply: string) {
  const database = db();
  const existing = await database.select().from(chats).where(and(eq(chats.userId, userId), eq(chats.slug, slug))).limit(1);
  let chatId = existing[0]?.id;
  if (!chatId) {
    const inserted = await database.insert(chats).values({ userId, kind: slug.startsWith("g-") ? "group" : "dm", slug, title: speaker }).returning({ id: chats.id });
    chatId = inserted[0]?.id;
  }
  if (!chatId) return false;
  await database.insert(messages).values([
    { chatId, fromId: "you", text: userText },
    { chatId, fromId: speaker, text: reply },
  ]);
  return true;
}
