"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";
import { downloadUrl, fileUrl, sizeLabel, typeLabel, type FileKind } from "@/lib/files";

type CardFile = { id: string; name: string; size: number | string; mime?: string; kind?: FileKind };
const ICON: Record<FileKind, string> = { image: "camera", text: "list", code: "terminal", pdf: "file", other: "box" };

/** First lines of a text or code file, fetched once when the card shows. */
function Peek({ id }: { id: string }) {
  const [txt, setTxt] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(`${fileUrl(id)}?peek=1`, { signal: c.signal }).then((r) => (r.ok ? r.text() : "")).then((t) => setTxt(t.slice(0, 4096)), () => {});
    return () => c.abort();
  }, [id]);
  if (txt === null) return <div className="h-[84px] animate-pulse bg-ink/[0.04]" />;
  if (!txt.trim()) return null;
  const lines = txt.split("\n").slice(0, 10).join("\n");
  return <pre data-file-peek className="max-h-[164px] overflow-hidden whitespace-pre px-3 py-2.5 font-mono text-[11.5px] leading-[1.45] text-ink/80 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]">{lines}</pre>;
}

/** A file in a chat bubble: preview (images inline, text and code as their first lines), name, size, type and Download. */
export default function FileCard({ f, mine = false }: { f: CardFile; mine?: boolean }) {
  const kind: FileKind = f.kind || (f.mime?.startsWith("image/") ? "image" : "other");
  const [big, setBig] = useState(false);
  const [broken, setBroken] = useState(false);
  const size = typeof f.size === "number" ? sizeLabel(f.size) : f.size;
  const dot = f.name.lastIndexOf(".");
  const [stem, ext] = dot > 0 && f.name.length - dot <= 6 ? [f.name.slice(0, dot), f.name.slice(dot)] : [f.name, ""];
  return (
    <div data-file-card data-kind={kind} className={`w-[min(100%,340px)] max-w-full overflow-hidden rounded-[16px] ${mine ? "bg-white/15" : "bg-card ring-1 ring-line"}`}>
      {kind === "image" && !broken && (
        <button type="button" onClick={() => setBig(true)} aria-label={`Open ${f.name}`} className="block w-full bg-ink/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-file-preview src={fileUrl(f.id)} alt={f.name} onError={() => setBroken(true)} className="block max-h-[320px] w-full object-contain" loading="lazy" />
        </button>
      )}
      {(kind === "text" || kind === "code") && <div className={mine ? "bg-black/10" : "border-b border-line bg-tint/60"}><Peek id={f.id} /></div>}
      <div className="flex items-center gap-2.5 p-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${mine ? "bg-white text-grape" : "bg-grape text-white"}`}><Icon name={ICON[kind]} size={17} /></span>
        <span className="min-w-0 flex-1">
          <span data-file-name title={f.name} className="sr-only">{f.name}</span>
          {/* long names lose the middle, never the extension */}
          <span aria-hidden className="flex min-w-0 text-[14px] font-semibold"><span className="truncate">{stem}</span><span className="shrink-0">{ext}</span></span>
          <span className={`block text-[11.5px] ${mine ? "text-white/75" : "text-ink/55"}`}>{typeLabel(f)} · {size}</span>
        </span>
        <a data-file-download href={downloadUrl(f.id)} download={f.name} aria-label={`Download ${f.name}`} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${mine ? "bg-white text-grape" : "bg-tint text-brand-ink hover:bg-line"}`}>
          <Icon name="download" size={15} /><span className="max-[360px]:sr-only">Download</span>
        </a>
      </div>
      {big && (
        <div role="dialog" aria-label={f.name} onClick={() => setBig(false)} className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(f.id)} alt={f.name} className="max-h-full max-w-full rounded-[12px]" />
          <a href={downloadUrl(f.id)} download={f.name} onClick={(e) => e.stopPropagation()} className="btn btn-sm absolute bottom-6 right-4 bg-card text-ink">Download</a>
        </div>
      )}
    </div>
  );
}

/** Every file an agent attached to a reply. */
export function FileCards({ files }: { files: CardFile[] }) {
  if (!files.length) return null;
  return <div data-files className="mt-1.5 flex w-[min(100%,340px)] max-w-full flex-col gap-1.5">{files.map((f) => <FileCard key={f.id} f={f} />)}</div>;
}
