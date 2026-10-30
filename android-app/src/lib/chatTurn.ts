/**
 * The body of POST /api/chat, the same shape the web chat sends (webapp/lib/store.ts, server/validate.ts chatBody).
 * The server validates it strictly: history turns are { from, text }, an attachment goes in meta.file, text is never empty.
 */
type Turn = { id: string; from: string; text?: string };
type File = { name: string; size?: number | string; id?: string };

/** The last 12 turns before this message: no greeting bubble, no system lines, no empty bubbles. */
export function chatHistory(msgs: Turn[]): { from: string; text: string }[] {
  return msgs
    .filter((m) => m.id !== "hello" && m.from !== "system" && !!m.text)
    .slice(-12)
    .map((m) => ({ from: m.from.slice(0, 80), text: String(m.text).slice(0, 2000) }));
}

export function chatTurnBody(o: { convo: string; speaker: string; text: string; file?: File; history: Turn[]; userMsgId: string; replyMsgId: string; tz?: string }) {
  const file = o.file ? { name: o.file.name.slice(0, 120), size: String(o.file.size ?? "").slice(0, 20), ...(o.file.id ? { id: o.file.id } : {}) } : undefined;
  const text = (o.text.trim() || (file ? `Attachment: ${file.name}` : "")).slice(0, 4000);
  return {
    convo: o.convo, text, speaker: o.speaker, history: chatHistory(o.history), recall: [],
    userMsgId: o.userMsgId, replyMsgId: o.replyMsgId, meta: file ? { file } : {},
    ...(o.tz && /^[A-Za-z0-9_+\-/]{1,64}$/.test(o.tz) ? { tz: o.tz } : {}),
  };
}
