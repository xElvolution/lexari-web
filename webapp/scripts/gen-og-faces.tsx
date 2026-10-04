import { renderToStaticMarkup } from "react-dom/server";
import Face from "@shared/components/Face";
import { SPECIALISTS } from "@/content/appData";
import { writeFileSync } from "fs";
const pick = ["scout", "quill", "atlas", "frame", "tally", "patch"];
const out: Record<string, string> = {};
out.home = renderToStaticMarkup(<Face size={200} />);
for (const slug of pick) { const s = SPECIALISTS.find((x) => x.slug === slug)!; out[slug] = renderToStaticMarkup(<Face seed={s.seed} variant={{ color: s.color, ...s.face }} size={200} />); }
const fix = (svg: string) => svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
writeFileSync("/workspace/lexari-landing-new/shared/og/faces.ts", `/** Agent faces as SVG data URIs for share images (generated from shared/components/Face.tsx). */\nexport const OG_FACES: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, "data:image/svg+xml;base64," + Buffer.from(fix(v)).toString("base64")])), null, 1)};\n`);
console.log(Object.keys(out), out.home.slice(0, 300));
