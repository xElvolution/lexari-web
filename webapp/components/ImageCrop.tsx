"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * Crop and fit a picture before it is saved: drag to move, slider to zoom. Output is a JPEG at a fixed size
 * (avatar 512×512, cover 1500×500), so the server only stores small, already-cropped images.
 */
export default function ImageCrop({ file, aspect, out, round = false, title, onCancel, onDone }: {
  file: File; aspect: number; out: [number, number]; round?: boolean; title: string; onCancel: () => void; onDone: (dataUrl: string) => Promise<void> | void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of the image centre from the frame centre, in frame px
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setErr("That file couldn't be opened as a picture.");
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const fw = () => frame.current?.clientWidth || 300;
  const fh = () => fw() / aspect;
  // "cover" scale: the image always fills the frame
  const base = () => (img ? Math.max(fw() / img.width, fh() / img.height) : 1);
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    if (!img) return p;
    const w = img.width * base() * z, h = img.height * base() * z;
    const mx = Math.max(0, (w - fw()) / 2), my = Math.max(0, (h - fh()) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };

  const save = async () => {
    if (!img) return;
    setBusy(true); setErr("");
    try {
      const c = document.createElement("canvas"); c.width = out[0]; c.height = out[1];
      const k = out[0] / fw();
      const s = base() * zoom * k;
      const g = c.getContext("2d")!;
      g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, c.width / 2 + pos.x * k - (img.width * s) / 2, c.height / 2 + pos.y * k - (img.height * s) / 2, img.width * s, img.height * s);
      let q = 0.86, url = c.toDataURL("image/jpeg", q);
      while (url.length > 1_100_000 && q > 0.5) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
      await onDone(url);
    } catch (e) { setErr((e as Error).message || "Couldn't save the picture."); setBusy(false); }
  };

  const w = img ? img.width * base() * zoom : 0, h = img ? img.height * base() * zoom : 0;
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5">
      <div role="dialog" aria-modal="true" aria-label={title} data-crop className="pop pb-safe-dlg w-full max-w-[460px] rounded-t-[26px] bg-card p-5 ring-1 ring-line sm:rounded-[26px]">
        <div className="flex items-center justify-between"><h2 className="display text-[24px] text-ink">{title}</h2><button onClick={onCancel} disabled={busy} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 hover:bg-tint"><Icon name="x" size={19} /></button></div>
        <div ref={frame} className={`relative mt-3 w-full touch-none select-none overflow-hidden bg-black ${round ? "rounded-full" : "rounded-2xl"}`} style={{ aspectRatio: String(aspect) }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {img && <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none" style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }} />}
          {!img && !err && <span className="absolute inset-0 grid place-items-center text-[13px] text-white/70">Opening…</span>}
        </div>
        <label className="mt-4 flex items-center gap-3 text-[13px] text-ink/65"><Icon name="search" size={15} />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); setPos((p) => clamp(p, z)); }} aria-label="Zoom" className="flex-1 accent-[var(--color-grape)]" />
        </label>
        <p className="mt-1 text-[12px] text-ink/50">Drag to move. Slide to zoom.</p>
        {err && <p role="alert" className="mt-2 text-[13px] text-[#e5484d]">{err}</p>}
        <div className="mt-4 flex gap-2"><button onClick={onCancel} disabled={busy} className="btn btn-line btn-sm text-ink">Cancel</button><button data-crop-save onClick={save} disabled={!img || busy} className="btn btn-brand btn-sm flex-1 disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </div>
  );
}
