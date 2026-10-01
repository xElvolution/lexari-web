import { clamp, noise1, smoothstep } from './rng';
import type { Rng } from './rng';
import type { Traits } from './traits';

export type AvatarState = 'idle' | 'thinking' | 'speaking' | 'happy';
export const STATES: AvatarState[] = ['idle', 'thinking', 'speaking', 'happy'];

/** Per-agent motion signature (seeded + personality) */
export interface Motion {
  speed: number; // 0.7..1.4 global tempo
  amp: number; // 0.6..1.4 amplitude
  blinkEvery: number; // seconds
  phase: number; // seconds offset so a grid of agents never blinks in sync
  lookSide: 1 | -1; // which way this agent glances when thinking
  voice: number; // seed for the speaking envelope
}

export function makeMotion(rng: Rng, traits: Traits): Motion {
  return {
    speed: 0.75 + traits.energy * 0.6 + rng.range(-0.05, 0.05),
    amp: 0.65 + traits.energy * 0.55 + traits.playfulness * 0.2,
    blinkEvery: rng.range(2.6, 4.6),
    phase: rng.range(0, 10),
    lookSide: rng.chance(0.5) ? 1 : -1,
    voice: rng.int(1, 9999),
  };
}

/**
 * Renderer-agnostic expression. Every direction reads only these numbers, so
 * state cross-fades are just `mixExpr(prev, next, k)`.
 */
export interface Expr {
  t: number;
  eyeOpen: number; // 0 closed .. 1 open
  smile: number; // 0 normal eyes .. 1 happy arcs
  lookX: number; // -1..1
  lookY: number; // -1..1 (negative = up)
  mouth: number; // 0 closed .. 1 wide open
  curve: number; // -1 frown .. 1 smile
  bob: number; // vertical offset (viewBox units, negative = up)
  squash: number; // 1 = none, >1 taller
  tilt: number; // degrees
  think: number; // state weights (0..1) for state-specific extras
  speak: number;
  happy: number;
}

function blink(t: number, every: number, phase: number): number {
  'worklet';
  const local = (t + phase) % every;
  const d = 0.17;
  if (local > d) return 1;
  return clamp(1 - Math.sin((local / d) * Math.PI), 0.06, 1);
}

export function exprFor(state: AvatarState, t: number, m: Motion): Expr {
  'worklet';
  const s = m.speed;
  const tt = t + m.phase;
  const base: Expr = {
    t,
    eyeOpen: blink(t, m.blinkEvery, m.phase),
    smile: 0,
    lookX: (noise1(tt * 0.35, m.voice) - 0.5) * 0.6,
    lookY: (noise1(tt * 0.3, m.voice + 7) - 0.5) * 0.4,
    mouth: 0,
    curve: 0.25,
    bob: Math.sin(tt * s * 1.6) * 1.1 * m.amp,
    squash: 1 + Math.sin(tt * s * 1.6 + 1.2) * 0.012 * m.amp,
    tilt: Math.sin(tt * s * 0.7) * 1.5 * m.amp,
    think: 0,
    speak: 0,
    happy: 0,
  };
  switch (state) {
    case 'idle':
      return base;
    case 'thinking':
      return {
        ...base,
        eyeOpen: Math.min(base.eyeOpen, 0.82) + (base.eyeOpen < 1 ? 0 : 0),
        lookX: 0.6 * m.lookSide + Math.sin(tt * 0.9) * 0.12,
        lookY: -0.65,
        curve: -0.05,
        mouth: 0.04,
        bob: Math.sin(tt * s * 0.9) * 0.8 * m.amp,
        tilt: 4 * m.lookSide + Math.sin(tt * s * 0.8) * 1.5,
        think: 1,
      };
    case 'speaking': {
      const syl = smoothstep(0.32, 0.78, noise1(tt * 7.5, m.voice));
      const phrase = 0.35 + 0.65 * smoothstep(0.25, 0.55, noise1(tt * 1.2, m.voice + 3));
      const mouth = 0.12 + 0.88 * syl * phrase;
      return {
        ...base,
        lookX: base.lookX * 0.5,
        lookY: base.lookY * 0.5,
        mouth,
        curve: 0.35,
        bob: base.bob * 0.6 - mouth * 0.8,
        squash: 1 + mouth * 0.025,
        speak: 1,
      };
    }
    case 'happy': {
      const hop = Math.abs(Math.sin(tt * s * 2.6));
      return {
        ...base,
        eyeOpen: 1,
        smile: 1,
        lookX: 0,
        lookY: -0.2,
        mouth: 0.45,
        curve: 1,
        bob: -hop * 4.2 * m.amp,
        squash: 1 + (hop - 0.35) * 0.06,
        tilt: Math.sin(tt * s * 1.3) * 5 * m.amp,
        happy: 1,
      };
    }
  }
}

export function mixExpr(a: Expr, b: Expr, k: number): Expr {
  'worklet';
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Expr)[]) {
    out[key] = a[key] + (b[key] - a[key]) * k;
  }
  return out;
}

/** A pleasant still frame for each state (used on static sheets / list thumbnails). */
export function posterExpr(state: AvatarState, m: Motion): Expr {
  let best = exprFor(state, 0, m);
  let bestScore = -Infinity;
  for (let i = 0; i < 60; i++) {
    const t = i * 0.05;
    const e = exprFor(state, t, m);
    const score =
      (e.eyeOpen > 0.95 || state === 'thinking' ? 1 : -5) +
      (state === 'speaking' ? -Math.abs(e.mouth - 0.7) * 3 : 0) +
      (state === 'happy' ? -e.bob * 0.4 : -Math.abs(e.bob) * 0.2);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}
