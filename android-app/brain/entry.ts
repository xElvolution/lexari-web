/**
 * The page inside the Brain tab's WebView (or iframe on web): the web app's own three.js brain scene
 * (brain/scene.ts, a copy of webapp/components/brain/scene.ts) with its HTML area chips, so the sphere, rings,
 * dust, signal orbs and labels are pixel for pixel the web's. The app drives it with window.__brain(state)
 * and hears chip taps back as { open: i }.
 */
import { BrainScene, CATS } from "./scene";

type State = { dark?: boolean; counts?: number[]; focus?: number; write?: number; reduce?: boolean };
const post = (m: unknown) => {
  const s = JSON.stringify(m);
  const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
  if (rn) rn.postMessage(s); else window.parent?.postMessage({ lexariBrain: m }, "*");
};

const host = document.getElementById("host")!;
let dark = true, focus = -1, counts = CATS.map(() => 0);
const chips = CATS.map((c, i) => {
  const b = document.createElement("button");
  b.className = "chip"; b.style.opacity = "0"; b.setAttribute("aria-label", `${c.id}, ${counts[i]}`);
  b.innerHTML = `<i></i><b></b><span>0</span>`;
  (b.querySelector("b") as HTMLElement).textContent = c.id;
  b.addEventListener("click", () => post({ open: i }));
  host.appendChild(b);
  return b;
});
const paint = () => {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  chips.forEach((b, i) => {
    const col = dark ? CATS[i].dark : CATS[i].light;
    const on = focus === i;
    b.classList.toggle("on", on);
    const dot = b.querySelector("i") as HTMLElement; dot.style.background = on ? "#fff" : col; dot.style.boxShadow = `0 0 10px ${col}`;
    (b.querySelector("span") as HTMLElement).textContent = String(counts[i] ?? 0);
    b.setAttribute("aria-pressed", String(on));
  });
};

let scene: BrainScene | null = null;
const start = (reduce: boolean) => {
  if (scene) return;
  try {
    scene = new BrainScene(host, chips, { dark, reduce });
    // the web pops a chip with gsap elastic.out(1, .4) when a signal arrives; the same curve by keyframes
    scene.onArrive = (i) => chips[i]?.animate([{ scale: 1.35 }, { scale: 0.93, offset: 0.3 }, { scale: 1.03, offset: 0.55 }, { scale: 0.99, offset: 0.78 }, { scale: 1 }], { duration: 600 });
  } catch { post({ failed: true }); }
};

(window as unknown as { __brain: (s: State) => void }).__brain = (s: State) => {
  if (typeof s.dark === "boolean" && s.dark !== dark) { dark = s.dark; scene?.setTheme(dark); }
  if (s.counts) counts = s.counts;
  if (typeof s.focus === "number" && s.focus !== focus) { focus = s.focus; scene?.setFocus(focus, { panel: focus >= 0 }); }
  paint();
  start(!!s.reduce);
  if (typeof s.write === "number") scene?.write(s.write);
};
window.addEventListener("message", (e) => { const d = (e.data && (e.data as { lexariBrainIn?: State }).lexariBrainIn); if (d) (window as unknown as { __brain: (s: State) => void }).__brain(d); });
paint();
post({ ready: true });
