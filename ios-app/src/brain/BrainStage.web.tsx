/** Expo Web: the same brain page (src/brain/html.ts) in an iframe, talking over postMessage. */
import { createElement, useEffect, useRef } from "react";
import { BRAIN_HTML } from "./html";
import type { StageProps } from "./BrainStage";

export default function BrainStage({ dark, counts, focus, reduce, write, onOpen, onFailed }: StageProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const send = (s: object) => { if (ready.current) ref.current?.contentWindow?.postMessage({ lexariBrainIn: s }, "*"); };
  const state = () => ({ dark, counts, focus, reduce });
  const live = useRef({ onOpen, onFailed, state }); live.current = { onOpen, onFailed, state };
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const m = (e.data as { lexariBrain?: { ready?: boolean; open?: number; failed?: boolean } })?.lexariBrain; if (!m) return;
      if (m.ready) { ready.current = true; send(live.current.state()); }
      if (typeof m.open === "number") live.current.onOpen(m.open);
      if (m.failed) live.current.onFailed();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { send(state()); }, [dark, counts.join(","), focus, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (write) send({ write: write.cat }); }, [write?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  return createElement("iframe", { ref, srcDoc: BRAIN_HTML, title: "Brain", style: { border: 0, width: "100%", height: "100%", display: "block", background: "transparent" } });
}
