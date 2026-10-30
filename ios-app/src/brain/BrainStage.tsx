/** The web app's three.js brain (src/brain/html.ts) in a WebView; see brain/entry.ts for the page side. */
import { useEffect, useRef } from "react";
import { WebView } from "react-native-webview";
import { BRAIN_HTML } from "./html";

export type StageProps = { dark: boolean; counts: number[]; focus: number; reduce: boolean; write: { cat: number; n: number } | null; onOpen: (i: number) => void; onFailed: () => void };

export default function BrainStage({ dark, counts, focus, reduce, write, onOpen, onFailed }: StageProps) {
  const ref = useRef<WebView>(null);
  const ready = useRef(false);
  const send = (s: object) => { if (ready.current) ref.current?.injectJavaScript(`window.__brain&&window.__brain(${JSON.stringify(s)});true;`); };
  const state = () => ({ dark, counts, focus, reduce });
  useEffect(() => { send(state()); }, [dark, counts.join(","), focus, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (write) send({ write: write.cat }); }, [write?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <WebView
      ref={ref}
      source={{ html: BRAIN_HTML }}
      originWhitelist={["*"]}
      style={{ flex: 1, backgroundColor: "transparent" }}
      containerStyle={{ backgroundColor: "transparent" }}
      scrollEnabled={false}
      overScrollMode="never"
      bounces={false}
      javaScriptEnabled
      domStorageEnabled={false}
      setBuiltInZoomControls={false}
      androidLayerType="hardware"
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data) as { ready?: boolean; open?: number; failed?: boolean };
          if (m.ready) { ready.current = true; send(state()); }
          if (typeof m.open === "number") onOpen(m.open);
          if (m.failed) onFailed();
        } catch { /* not ours */ }
      }}
      onError={onFailed}
    />
  );
}
