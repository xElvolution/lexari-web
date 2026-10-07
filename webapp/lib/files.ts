"use client";
/**
 * Files in chat (client side). Agents attach files from their computer to a reply ({files} on the reply stream, saved
 * in the message as files); you attach one to a message by uploading it first (POST /api/files), then sending its id.
 */
export type FileKind = "image" | "text" | "code" | "pdf" | "other";
export type FileView = { id: string; name: string; size: number; mime: string; kind: FileKind };
/** What a message carries for the file you attached. */
export type SentFile = { name: string; size: string; id?: string; mime?: string; kind?: FileKind };

export const FILE_MAX = 10 * 1024 * 1024;
export const fileUrl = (id: string) => `/api/files/${encodeURIComponent(id)}`;
export const downloadUrl = (id: string) => `${fileUrl(id)}?dl=1`;
export const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

/** A short type label for the card ("PY", "CSV", "PNG"). */
export function typeLabel(f: { name: string; mime?: string }) {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(f.name)?.[1];
  if (ext) return ext.toUpperCase();
  if (f.mime?.startsWith("image/")) return f.mime.slice(6).toUpperCase();
  return f.mime === "application/pdf" ? "PDF" : "FILE";
}

/** Uploads a file for this chat. Resolves with what to put on the message, or throws with a message to show. */
export async function uploadFile(file: File, convo: string): Promise<SentFile & { id: string }> {
  if (file.size > FILE_MAX) throw new Error("Files can be up to 10 MB.");
  if (!file.size) throw new Error("That file is empty.");
  const res = await fetch("/api/files", { method: "POST", body: file, headers: { "x-file-name": encodeURIComponent(file.name.slice(0, 200)), "x-convo": convo, "content-type": "application/octet-stream" } });
  const data = await res.json().catch(() => ({})) as { file?: FileView; error?: string };
  if (!res.ok || !data.file) throw new Error(data.error || "That file couldn't be uploaded. Try again.");
  const f = data.file;
  return { id: f.id, name: f.name, size: sizeLabel(f.size), mime: f.mime, kind: f.kind };
}
