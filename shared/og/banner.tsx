/* Lexari share banner (1200x630) for next/og ImageResponse. Satori: flexbox only, inline styles. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_FACES } from "./faces";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TAGLINE = "Meet your first personalized AI agent";
export const OG_SUB = "An AI agent with its own computer and a memory that lasts. Free to start.";

async function font(name: string) {
  for (const base of [join(process.cwd(), "..", "shared", "og"), join(process.cwd(), "shared", "og")]) {
    try { return await readFile(join(base, name)); } catch { /* next */ }
  }
  throw new Error(`og font ${name} missing`);
}
export async function ogFonts() {
  const [b, f5, f7] = await Promise.all([font("Bricolage-800.ttf"), font("Figtree-500.ttf"), font("Figtree-700.ttf")]);
  return [
    { name: "Bricolage", data: b, weight: 800 as const, style: "normal" as const },
    { name: "Figtree", data: f5, weight: 500 as const, style: "normal" as const },
    { name: "Figtree", data: f7, weight: 700 as const, style: "normal" as const },
  ];
}

function Tile({ id, size, x, y, rot = 0, ring = false }: { id: string; size: number; x: number; y: number; rot?: number; ring?: boolean }) {
  const r = Math.round(size * 0.3);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: r, background: "#f1ecff",
      transform: `rotate(${rot}deg)`, boxShadow: ring ? "0 0 0 6px #ffd66b, 0 24px 48px rgba(20,6,80,0.45)" : "0 18px 40px rgba(20,6,80,0.35)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={OG_FACES[id]} width={Math.round(size * 0.82)} height={Math.round(size * 0.82)} alt="" />
    </div>
  );
}

/** inviter: a display name ("You're invited by …"), avatar: a png/jpeg data URL. */
export function OgBanner({ inviter, avatar }: { inviter?: string; avatar?: string }) {
  const name = inviter?.trim().slice(0, 22);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", fontFamily: "Figtree",
      background: "linear-gradient(135deg, #6a3bff 0%, #5b2bff 38%, #3514b0 100%)" }}>
      {/* glows */}
      <div style={{ position: "absolute", left: -180, top: -220, width: 620, height: 620, borderRadius: 620, background: "radial-gradient(circle, rgba(165,139,255,0.55) 0%, rgba(165,139,255,0) 70%)" }} />
      <div style={{ position: "absolute", right: -160, bottom: -260, width: 760, height: 760, borderRadius: 760, background: "radial-gradient(circle, rgba(255,214,107,0.22) 0%, rgba(255,214,107,0) 65%)" }} />
      <div style={{ position: "absolute", right: 70, top: 64, width: 470, height: 470, borderRadius: 470, border: "2px solid rgba(255,255,255,0.14)" }} />
      <div style={{ position: "absolute", right: 140, top: 134, width: 330, height: 330, borderRadius: 330, border: "2px dashed rgba(255,255,255,0.16)" }} />

      {/* left column */}
      <div style={{ position: "absolute", left: 72, top: 60, bottom: 58, width: 660, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 18, height: 18, borderRadius: 18, background: "#5b2bff" }} />
          </div>
          <div style={{ marginLeft: 16, fontFamily: "Bricolage", fontSize: 46, color: "#ffffff", letterSpacing: -1.5, lineHeight: 1 }}>lexari</div>
        </div>

        <div style={{ display: "flex", marginTop: name ? 50 : 72 }}>
          {name ? (
            <div style={{ display: "flex", alignItems: "center", padding: "10px 22px 10px 10px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.28)" }}>
              {avatar
                ? <img src={avatar} width={48} height={48} style={{ borderRadius: 48, objectFit: "cover" }} alt="" />
                : <div style={{ width: 48, height: 48, borderRadius: 48, background: "#ffd66b", color: "#2a0f8f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>{name.slice(0, 1).toUpperCase()}</div>}
              <div style={{ display: "flex", marginLeft: 14, fontSize: 27, color: "#ffffff", fontWeight: 500 }}>
                You&apos;re invited by<span style={{ fontWeight: 700, marginLeft: 8, color: "#ffe39a" }}>{name}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.28)", fontSize: 24, color: "#ffffff", fontWeight: 700 }}>
              <div style={{ width: 12, height: 12, borderRadius: 12, background: "#22c55e", marginRight: 12 }} />Your agent is ready to meet you
            </div>
          )}
        </div>

        <div style={{ display: "flex", marginTop: 30, fontFamily: "Bricolage", fontSize: 64, lineHeight: 1.02, letterSpacing: -2, color: "#ffffff", maxWidth: 660 }}>{OG_TAGLINE}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 25, lineHeight: 1.35, color: "rgba(255,255,255,0.82)", maxWidth: 560 }}>{OG_SUB}</div>

        <div style={{ display: "flex", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", padding: "14px 28px", borderRadius: 999, background: "#ffffff", color: "#3514b0", fontSize: 25, fontWeight: 700, boxShadow: "0 6px 0 #2a0f8f" }}>{name ? "Accept invite" : "Meet your agent"}</div>
          <div style={{ display: "flex", marginLeft: 22, fontSize: 23, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>app.lexari.ai</div>
        </div>
      </div>

      {/* agent faces */}
      <Tile id="scout" size={118} x={770} y={92} rot={-8} />
      <Tile id="quill" size={104} x={1032} y={110} rot={7} />
      <Tile id="atlas" size={96} x={738} y={392} rot={6} />
      <Tile id="frame" size={104} x={1056} y={262} rot={-6} />
      <Tile id="tally" size={84} x={1050} y={470} rot={-4} />
      <Tile id="patch" size={74} x={900} y={486} rot={8} />
      <Tile id="home" size={210} x={840} y={196} ring />
      <div style={{ position: "absolute", left: 980, top: 404, display: "flex", padding: "8px 16px", borderRadius: 999, background: "#ffffff", color: "#3514b0", fontSize: 20, fontWeight: 700, boxShadow: "0 10px 24px rgba(20,6,80,0.35)" }}>Hi, I&apos;m yours</div>
    </div>
  );
}
