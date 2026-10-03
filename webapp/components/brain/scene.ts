import * as THREE from "three";

/**
 * Lexari brain scene. A particle and fibre brain inside three tilted orbit rings.
 * Dust flows along the rings, signal orbs carry memory writes and recalls, and
 * camera-facing HTML chips ride the rings with thin leader lines into the brain.
 * Everything is written for smoothness: capped particles, capped DPR, paused when hidden.
 */

export type Cat = { id: string; ring: number; anchor: [number, number, number]; dark: string; light: string };

export const CATS: Cat[] = [
  { id: "About you", ring: 0, anchor: [0, 0.6, 0.72], dark: "#d9ccff", light: "#5b2bff" },
  { id: "Preferences", ring: 1, anchor: [-0.55, 0.22, 0.55], dark: "#a78bfa", light: "#6d28d9" },
  { id: "People", ring: 0, anchor: [0.64, -0.08, 0.12], dark: "#93c5fd", light: "#1d4ed8" },
  { id: "Tools", ring: 2, anchor: [-0.46, 0.62, -0.22], dark: "#818cf8", light: "#4338ca" },
  { id: "Habits", ring: 1, anchor: [0.05, 0.32, -0.96], dark: "#e9d5ff", light: "#7e22ce" },
  { id: "Files", ring: 0, anchor: [-0.64, -0.16, -0.08], dark: "#ffffff", light: "#0a0a0a" },
  { id: "Hired agents", ring: 2, anchor: [0, -0.46, -0.72], dark: "#c084fc", light: "#a21caf" },
];

const RINGS = [
  { r: 2.35, rot: [1.33, 0.12, 0.05], spin: 0.1 },
  { r: 2.0, rot: [0.95, -0.62, 0.32], spin: -0.14 },
  { r: 1.72, rot: [0.3, 0.95, -0.2], spin: 0.18 },
] as const;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const fold = (x: number, y: number, z: number) => 0.5 * Math.sin(10 * z + 3 * Math.sin(6 * y)) + 0.5 * Math.sin(9 * y + 3 * Math.sin(7 * x + 4 * z));

function brainGeometry(n: number) {
  const pos = new Float32Array(n * 3), region = new Float32Array(n), seed = new Float32Array(n), size = new Float32Array(n);
  const anchors = CATS.map((c) => new THREE.Vector3(...c.anchor));
  const v = new THREE.Vector3();
  let i = 0;
  while (i < n) {
    const u = Math.random();
    let x: number, y: number, z: number;
    if (u < 0.84) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
      const f = fold(dx, dy, dz);
      if (f < -0.15 && Math.random() < 0.88) continue; // sulci: leave the folds a little darker
      const side = dx >= 0 ? 1 : -1, r = 1 + 0.1 * f;
      x = side * 0.07 + dx * 0.56 * r; y = dy * 0.7 * r; z = dz * 1.12 * r;
      if (z > 0.2) y *= 1 - (z - 0.2) * 0.18; // the front slopes down a touch
      if (y < -0.32) y = -0.32 + (y + 0.32) * 0.45;
      if (Math.abs(x) < 0.1) x = side * rnd(0.1, 0.13);
      if (Math.random() < 0.1) { const k = rnd(0.5, 0.92); x *= k; y *= k; z *= k; }
    } else if (u < 0.95) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      x = Math.sin(ph) * Math.cos(th) * 0.5; y = -0.44 + Math.cos(ph) * 0.22; z = -0.7 + Math.sin(ph) * Math.sin(th) * 0.3;
      if (Math.sin(y * 70) < -0.3 && Math.random() < 0.7) continue;
    } else {
      const t = Math.random(), a = Math.random() * Math.PI * 2, rr = 0.11 - t * 0.03;
      x = Math.cos(a) * rr; y = -0.3 - t * 0.78; z = -0.32 - t * 0.2 + Math.sin(a) * rr;
    }
    pos.set([x, y, z], i * 3);
    v.set(x, y, z);
    let best = 0, bd = Infinity;
    anchors.forEach((a, k) => { const d = a.distanceToSquared(v); if (d < bd) { bd = d; best = k; } });
    region[i] = best; seed[i] = Math.random(); size[i] = rnd(0.6, 1.5);
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aRegion", new THREE.BufferAttribute(region, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  return g;
}

function fibreGeometry(src: Float32Array, count: number) {
  const n = src.length / 3, out: number[] = [];
  const p = (k: number) => [src[k * 3], src[k * 3 + 1], src[k * 3 + 2]];
  for (let s = 0; s < count; s++) {
    const a = Math.floor(Math.random() * n), pa = p(a);
    let best = -1, bd = 0.06;
    for (let t = 0; t < 70; t++) {
      const b = Math.floor(Math.random() * n), pb = p(b);
      const d = (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2;
      if (d < bd && d > 0.002) { bd = d; best = b; }
    }
    if (best >= 0) out.push(...pa, ...p(best));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
}

const pointVert = /* glsl */ `
attribute float aRegion; attribute float aSeed; attribute float aSize;
uniform float uTime, uFocus, uFocusAmt, uHover, uPulse, uPx;
uniform vec3 uBase, uHot, uFocusCol, uHoverCol;
varying vec3 vCol; varying float vA;
void main() {
  vec3 p = position;
  float tw = 0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 6.2831);
  float isF = (1.0 - step(0.1, abs(aRegion - uFocus))) * uFocusAmt;
  float isH = (1.0 - step(0.1, abs(aRegion - uHover))) * (1.0 - isF);
  p *= 1.0 + uPulse * (0.045 + 0.03 * sin(aSeed * 40.0 + uTime * 9.0));
  float wave = smoothstep(0.9, 1.0, 0.5 + 0.5 * sin(p.z * 3.2 - uTime * 1.5 + p.y * 2.2));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPx * (1.0 + isF * 0.9 + isH * 0.5 + uPulse * 0.7) * (6.5 / -mv.z);
  vCol = mix(uBase, uHot, wave * 0.75 + tw * 0.12 + uPulse * 0.3);
  vCol = mix(vCol, uHoverCol, isH * 0.8);
  vCol = mix(vCol, uFocusCol, isF);
  float dim = 1.0 - uFocusAmt * 0.6 * (1.0 - isF / max(uFocusAmt, 0.001));
  vA = (0.32 + 0.4 * tw + wave * 0.45 + isF * 0.6 + isH * 0.4) * dim;
}`;
const pointFrag = /* glsl */ `
uniform float uAlpha; varying vec3 vCol; varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vCol, a * vA * uAlpha);
}`;
const dustVert = /* glsl */ `
attribute float aSize; attribute float aA;
uniform float uPx; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPx * (5.0 / -mv.z);
  vA = aA;
}`;
const dustFrag = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(uColor, a * vA * uAlpha);
}`;

type Orb = { ring: number; a: number; speed: number; target?: number; cat?: number; life: number; color: THREE.Color };

export class BrainScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private brain = new THREE.Group();
  private brainMat: THREE.ShaderMaterial;
  private glowMat!: THREE.SpriteMaterial;
  private fibreMat: THREE.LineBasicMaterial;
  private rings: { tilt: THREE.Group; spin: THREE.Group; loops: THREE.LineBasicMaterial[]; band: THREE.MeshBasicMaterial; dustMat: THREE.ShaderMaterial }[] = [];
  private leader: THREE.LineSegments;
  private leaderMat: THREE.LineBasicMaterial;
  private orbGeo: THREE.BufferGeometry; private orbMat: THREE.ShaderMaterial; private orbs: Orb[] = [];
  private stars: THREE.Points; private starMat: THREE.ShaderMaterial;
  private chipAngle: number[] = []; private chipOff: number[] = CATS.map(() => 0); private chipW: number[] = CATS.map(() => 120); private chipH: number[] = CATS.map(() => 32); private measured = -1;
  private raf = 0; private running = false; private last = 0; private t = 0;
  private yaw = 0.5; private pitch = 0.18; private vyaw = 0; private vpitch = 0; private drag: { x: number; y: number } | null = null;
  private dist = 6; private zoom = 1; private zoomT = 0; private film = 0; private filmTarget = 0;
  private pulse = 0; private focus = -1; private focusAmt = 0; private hover = -1;
  private dark = true; private reduce = false; private nextAmbient = 3;
  private w = 1; private h = 1;
  private tmp = new THREE.Vector3(); private tmp2 = new THREE.Vector3();
  private io: IntersectionObserver; private ro: ResizeObserver; private visible = true;
  onArrive?: (cat: number) => void;

  constructor(private host: HTMLElement, private chips: (HTMLElement | null)[], opts: { dark: boolean; reduce: boolean }) {
    this.dark = opts.dark; this.reduce = opts.reduce;
    const small = host.clientWidth < 640;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab";
    host.prepend(this.renderer.domElement);
    const px = this.renderer.getPixelRatio();

    // brain
    const g = brainGeometry(small ? 4200 : 8200);
    this.brainMat = new THREE.ShaderMaterial({
      vertexShader: pointVert, fragmentShader: pointFrag, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uFocus: { value: -1 }, uFocusAmt: { value: 0 }, uHover: { value: -1 }, uPulse: { value: 0 }, uPx: { value: px * 2.6 }, uAlpha: { value: 1 },
        uBase: { value: new THREE.Color() }, uHot: { value: new THREE.Color() }, uFocusCol: { value: new THREE.Color() }, uHoverCol: { value: new THREE.Color() } },
    });
    this.brain.add(new THREE.Points(g, this.brainMat));
    this.fibreMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
    this.brain.add(new THREE.LineSegments(fibreGeometry(g.getAttribute("position").array as Float32Array, small ? 600 : 1100), this.fibreMat));
    // soft core glow, always facing the camera
    const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!; const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    this.glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false });
    const glow = new THREE.Sprite(this.glowMat); glow.scale.set(3.6, 3.2, 1); this.scene.add(glow);
    this.brain.scale.setScalar(1.28); this.scene.add(this.brain);

    // rings
    RINGS.forEach((R, ri) => {
      const tilt = new THREE.Group(); tilt.rotation.set(R.rot[0], R.rot[1], R.rot[2]);
      const spin = new THREE.Group(); tilt.add(spin);
      const loops: THREE.LineBasicMaterial[] = [];
      [0, 0.035, -0.045, 0.07].forEach((o, k) => {
        const pts = Array.from({ length: 180 }, (_, i) => { const a = (i / 180) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * (R.r + o), Math.sin(a) * (R.r + o), k % 2 ? 0.01 : -0.01); });
        const m = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
        loops.push(m); tilt.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m));
      });
      const band = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      tilt.add(new THREE.Mesh(new THREE.RingGeometry(R.r - 0.06, R.r + 0.09, 160, 1), band));
      const n = small ? 160 : 300, dp = new Float32Array(n * 3), ds = new Float32Array(n), da = new Float32Array(n);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = R.r + rnd(-0.06, 0.09); dp.set([Math.cos(a) * rr, Math.sin(a) * rr, rnd(-0.03, 0.03)], i * 3); ds[i] = rnd(0.5, 1.6); da[i] = rnd(0.3, 1); }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute("position", new THREE.BufferAttribute(dp, 3)); dg.setAttribute("aSize", new THREE.BufferAttribute(ds, 1)); dg.setAttribute("aA", new THREE.BufferAttribute(da, 1));
      const dustMat = new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, uniforms: { uPx: { value: px * 2.4 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } } });
      spin.add(new THREE.Points(dg, dustMat));
      this.scene.add(tilt);
      this.rings.push({ tilt, spin, loops, band, dustMat });
      void ri;
    });

    // chips ride the rings, spaced evenly per ring
    const perRing = [0, 1, 2].map((r) => CATS.map((c, i) => (c.ring === r ? i : -1)).filter((i) => i >= 0));
    CATS.forEach((c, i) => { const list = perRing[c.ring]; this.chipAngle[i] = (list.indexOf(i) / list.length) * Math.PI * 2 + c.ring * 0.9 + 0.4; });

    // leader lines
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CATS.length * 6), 3));
    lg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(CATS.length * 6), 3));
    this.leaderMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    this.leader = new THREE.LineSegments(lg, this.leaderMat); this.leader.frustumCulled = false;
    this.scene.add(this.leader);

    // signal orbs with trails
    const TR = 18, CAP = 6;
    this.orbGeo = new THREE.BufferGeometry();
    this.orbGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CAP * TR * 3), 3));
    this.orbGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(CAP * TR), 1));
    this.orbGeo.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(CAP * TR), 1));
    this.orbMat = new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, uniforms: { uPx: { value: px * 2.4 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } } });
    const orbPts = new THREE.Points(this.orbGeo, this.orbMat); orbPts.frustumCulled = false; this.scene.add(orbPts);

    // faint far dust for depth
    const sn = small ? 220 : 420, sp = new Float32Array(sn * 3), ss = new Float32Array(sn), sa = new Float32Array(sn);
    for (let i = 0; i < sn; i++) { const r = rnd(6, 14), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3); ss[i] = rnd(0.6, 1.4); sa[i] = rnd(0.15, 0.6); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("aSize", new THREE.BufferAttribute(ss, 1)); sg.setAttribute("aA", new THREE.BufferAttribute(sa, 1));
    this.starMat = new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, uniforms: { uPx: { value: px * 3 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 1 } } });
    this.stars = new THREE.Points(sg, this.starMat); this.scene.add(this.stars);

    this.applyTheme();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }); this.io.observe(host);
    document.addEventListener("visibilitychange", this.sync);
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", this.down); window.addEventListener("pointermove", this.move); window.addEventListener("pointerup", this.up);
    this.sync();
  }

  private sync = () => {
    const should = this.visible && !document.hidden;
    if (should && !this.running) { this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); }
    else if (!should && this.running) { this.running = false; cancelAnimationFrame(this.raf); }
  };
  private down = (e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY }; this.renderer.domElement.style.cursor = "grabbing"; };
  private move = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag = { x: e.clientX, y: e.clientY };
    this.vyaw = -dx * 0.006; this.vpitch = dy * 0.004;
    this.yaw += this.vyaw; this.pitch = Math.max(-0.7, Math.min(0.9, this.pitch + this.vpitch));
  };
  private up = () => { this.drag = null; this.renderer.domElement.style.cursor = "grab"; };

  private resize() {
    this.w = this.host.clientWidth || 1; this.h = this.host.clientHeight || 1;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    const aspect = this.w / this.h;
    this.dist = aspect < 0.75 ? 8.6 : aspect < 1.1 ? 7.0 : 5.7;
  }

  setTheme(dark: boolean) { this.dark = dark; this.applyTheme(); }
  private applyTheme() {
    const d = this.dark, add = d ? THREE.AdditiveBlending : THREE.NormalBlending;
    const u = this.brainMat.uniforms;
    u.uBase.value.set(d ? "#8a6cff" : "#4a1fe0"); u.uHot.value.set(d ? "#f3eeff" : "#1a0866"); u.uAlpha.value = d ? 0.9 : 0.85;
    this.brainMat.blending = add;
    this.fibreMat.color.set(d ? "#a58bff" : "#5b2bff"); this.fibreMat.opacity = d ? 0.13 : 0.12;
    this.glowMat.color.set(d ? "#6d4dff" : "#c9b8ff"); this.glowMat.opacity = d ? 0.32 : 0.55; this.glowMat.blending = add; this.fibreMat.blending = add;
    this.rings.forEach((r) => {
      r.loops.forEach((m, k) => { m.color.set(d ? "#c9b8ff" : "#5b2bff"); m.opacity = (d ? 0.32 : 0.28) * (k === 0 ? 1 : 0.55); m.blending = add; });
      r.band.color.set(d ? "#8f6bff" : "#8f6bff"); r.band.opacity = d ? 0.085 : 0.08; r.band.blending = add;
      r.dustMat.uniforms.uColor.value.set(d ? "#e4dbff" : "#4a1fe0"); r.dustMat.uniforms.uAlpha.value = d ? 0.9 : 0.7; r.dustMat.blending = add;
    });
    this.leaderMat.blending = add; this.leaderMat.opacity = d ? 0.55 : 0.5;
    this.orbMat.uniforms.uColor.value.set(d ? "#ffffff" : "#3514b0"); this.orbMat.blending = add;
    this.starMat.uniforms.uColor.value.set(d ? "#c9b8ff" : "#5b2bff"); this.starMat.uniforms.uAlpha.value = d ? 0.8 : 0.35; this.starMat.blending = add;
    [this.brainMat, this.glowMat, this.fibreMat, this.leaderMat, this.orbMat, this.starMat, ...this.rings.flatMap((r) => [...r.loops, r.band, r.dustMat])].forEach((m) => (m.needsUpdate = true));
    this.setFocusColors();
  }
  private catColor(i: number) { const c = CATS[i]; return c ? (this.dark ? c.dark : c.light) : "#ffffff"; }
  private setFocusColors() {
    this.brainMat.uniforms.uFocusCol.value.set(this.catColor(this.focus));
    this.brainMat.uniforms.uHoverCol.value.set(this.catColor(this.hover));
  }

  setHover(i: number) { this.hover = i; this.brainMat.uniforms.uHover.value = i; this.setFocusColors(); }
  setFocus(i: number, opts: { panel?: boolean } = {}) {
    const was = this.focus;
    this.focus = i; this.brainMat.uniforms.uFocus.value = i >= 0 ? i : was; this.setFocusColors();
    this.filmTarget = i >= 0 && opts.panel ? (this.w > 900 ? 5 : 0) : 0;
    if (i >= 0) { this.kick(0.8); this.launch(CATS[i].ring, i, "recall"); }
  }
  /** A memory was written to this category: an orb flies to its chip, then the brain pulses and the camera dives in. */
  write(i: number) { this.launch(CATS[i]?.ring ?? 0, i, "write"); }
  private kick(amount = 1) {
    this.pulse = Math.max(this.pulse, amount);
    if (!this.reduce) this.zoomT = 1;
  }
  private launch(ring: number, cat: number, kind: "write" | "recall" | "ambient") {
    if (this.reduce && kind !== "write") return;
    if (this.orbs.length >= 6) this.orbs.shift();
    const target = this.chipAngle[cat] ?? 0;
    if (kind === "write") this.orbs.push({ ring, a: target - 2.6, speed: 2.6, target, cat, life: 1, color: new THREE.Color() });
    else if (kind === "recall") this.orbs.push({ ring, a: target, speed: 2.2, life: 1.8, color: new THREE.Color() });
    else this.orbs.push({ ring, a: Math.random() * Math.PI * 2, speed: rnd(1.2, 2.0), life: rnd(1.6, 2.6), color: new THREE.Color() });
  }

  private ringPoint(ring: number, a: number, out: THREE.Vector3) {
    const R = RINGS[ring].r; out.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    return this.rings[ring].tilt.localToWorld(out);
  }

  private loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    const motion = this.reduce ? 0 : 1;

    // camera: slow orbit, drag with inertia, zoom dive on key events
    if (!this.drag) { this.yaw += this.vyaw; this.pitch = Math.max(-0.7, Math.min(0.9, this.pitch + this.vpitch)); this.vyaw *= 0.93; this.vpitch *= 0.9; this.yaw += dt * 0.07 * motion; this.pitch += (0.18 - this.pitch) * dt * 0.4; }
    if (this.zoomT > 0) { this.zoomT = Math.max(0, this.zoomT - dt * 0.75); }
    const z = this.zoomT > 0 ? Math.sin((1 - this.zoomT) * Math.PI) : 0; // in and back out
    this.zoom += ((1 - 0.36 * z) - this.zoom) * Math.min(1, dt * 9);
    this.film += (this.filmTarget - this.film) * Math.min(1, dt * 4);
    const D = this.dist * this.zoom;
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * D, Math.sin(this.pitch) * D, Math.cos(this.yaw) * Math.cos(this.pitch) * D);
    this.camera.lookAt(0, this.w / this.h < 0.75 ? 0.4 : 0, 0);
    this.camera.filmOffset = this.film; this.camera.updateProjectionMatrix();

    // brain
    this.brain.rotation.y += dt * 0.12 * motion;
    this.pulse = Math.max(0, this.pulse - dt * 1.4);
    this.focusAmt += ((this.focus >= 0 ? 1 : 0) - this.focusAmt) * Math.min(1, dt * 5);
    const u = this.brainMat.uniforms;
    u.uTime.value = this.t; u.uPulse.value = this.pulse; u.uFocusAmt.value = this.focusAmt;
    this.brain.scale.setScalar(1.28 * (1 + this.pulse * 0.05));

    // rings flow
    this.rings.forEach((r, i) => { r.spin.rotation.z += dt * RINGS[i].spin * motion; });
    this.chipAngle = this.chipAngle.map((a, i) => a + dt * 0.035 * (CATS[i].ring === 1 ? -1 : 1) * motion);

    // chips and leader lines
    const lp = this.leader.geometry.getAttribute("position") as THREE.BufferAttribute;
    const lc = this.leader.geometry.getAttribute("color") as THREE.BufferAttribute;
    const camD = this.camera.position.length();
    const col = new THREE.Color();
    const screen: { x: number; y: number; behind: boolean }[] = [];
    CATS.forEach((c, i) => {
      const p = this.ringPoint(c.ring, this.chipAngle[i], this.tmp);
      const a = this.brain.localToWorld(this.tmp2.set(...c.anchor).multiplyScalar(1 + this.pulse * 0.05));
      lp.setXYZ(i * 2, p.x, p.y, p.z); lp.setXYZ(i * 2 + 1, a.x, a.y, a.z);
      const lit = i === this.focus ? 1 : i === this.hover ? 0.8 : this.focus >= 0 ? 0.12 : 0.38;
      col.set(this.catColor(i)).multiplyScalar(this.dark ? lit : 1);
      if (!this.dark) col.lerp(new THREE.Color("#f5f2ff"), 1 - lit);
      lc.setXYZ(i * 2, col.r, col.g, col.b); lc.setXYZ(i * 2 + 1, col.r * 0.4, col.g * 0.4, col.b * 0.4);
      const behind = p.distanceTo(this.camera.position) > camD;
      const sc = p.clone().project(this.camera);
      screen[i] = { x: (sc.x * 0.5 + 0.5) * this.w, y: (-sc.y * 0.5 + 0.5) * this.h, behind };
    });
    // keep chips readable: nudge overlapping labels apart and keep them on screen
    if (Math.floor(this.t) !== this.measured) { this.measured = Math.floor(this.t); this.chips.forEach((el, i) => { if (el) { this.chipW[i] = el.offsetWidth; this.chipH[i] = el.offsetHeight; } }); }
    const push = CATS.map(() => 0);
    for (let i = 0; i < CATS.length; i++) for (let j = i + 1; j < CATS.length; j++) {
      const a = screen[i], b = screen[j];
      const wx = (this.chipW[i] + this.chipW[j]) / 2 + 6, hy = (this.chipH[i] + this.chipH[j]) / 2 + 4;
      const dx = Math.abs(a.x - b.x), dy = (a.y + this.chipOff[i]) - (b.y + this.chipOff[j]);
      if (dx < wx && Math.abs(dy) < hy) { const need = (hy - Math.abs(dy)) / 2 + 1, sgn = dy >= 0 ? 1 : -1; push[i] += need * sgn; push[j] -= need * sgn; }
    }
    CATS.forEach((c, i) => {
      this.chipOff[i] += (push[i] * 1.2 - this.chipOff[i] * 0.04) * Math.min(1, dt * 10);
      const el = this.chips[i]; if (!el) return;
      const { behind } = screen[i]; const half = this.chipW[i] / 2 + 8;
      const x = Math.max(half, Math.min(this.w - half, screen[i].x)), y = Math.max(24, Math.min(this.h - 24, screen[i].y + this.chipOff[i]));
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${behind ? 0.88 : 1})`;
      el.style.opacity = this.focus >= 0 && i !== this.focus ? (behind ? "0.35" : "0.55") : behind ? "0.62" : "1";
      el.style.zIndex = behind ? "1" : "3";
    });
    lp.needsUpdate = true; lc.needsUpdate = true;

    // orbs
    if (!this.reduce) { this.nextAmbient -= dt; if (this.nextAmbient <= 0) { this.launch(Math.floor(Math.random() * 3), 0, "ambient"); this.nextAmbient = rnd(2.5, 5); } }
    const op = this.orbGeo.getAttribute("position") as THREE.BufferAttribute, os = this.orbGeo.getAttribute("aSize") as THREE.BufferAttribute, oa = this.orbGeo.getAttribute("aA") as THREE.BufferAttribute;
    const TR = 18;
    for (let k = 0; k < 6; k++) for (let j = 0; j < TR; j++) oa.setX(k * TR + j, 0);
    this.orbs = this.orbs.filter((o) => {
      if (o.cat !== undefined && o.target !== undefined) {
        const target = this.chipAngle[o.cat];
        o.a += o.speed * dt;
        if (o.a >= target) { this.kick(1); this.onArrive?.(o.cat); return false; }
      } else { o.a += o.speed * dt * (o.ring === 1 ? -1 : 1); o.life -= dt; if (o.life <= 0) return false; }
      return true;
    });
    this.orbs.forEach((o, k) => {
      const fade = o.cat !== undefined ? 1 : Math.min(1, o.life * 1.5);
      const dir = o.cat !== undefined ? 1 : o.ring === 1 ? -1 : 1;
      for (let j = 0; j < TR; j++) {
        const p = this.ringPoint(o.ring, o.a - dir * j * 0.028, this.tmp);
        op.setXYZ(k * TR + j, p.x, p.y, p.z);
        os.setX(k * TR + j, (j === 0 ? 5.5 : 3.2) * (1 - j / TR));
        oa.setX(k * TR + j, fade * (1 - j / TR) * (j === 0 ? 1 : 0.8));
      }
    });
    op.needsUpdate = true; os.needsUpdate = true; oa.needsUpdate = true;
    this.stars.rotation.y += dt * 0.01 * motion;

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  destroy() {
    this.running = false; cancelAnimationFrame(this.raf);
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.sync);
    window.removeEventListener("pointermove", this.move); window.removeEventListener("pointerup", this.up);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
