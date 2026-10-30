/** Ported from webapp/lib/secretScan.ts. Seed phrases and private keys are blocked. API keys can be saved to the vault. */
/**
 * Spots secrets in text people type or paste into chat, and in command output before it reaches a model.
 * Shared by the browser (paste protection in the composer) and the server (the chat route refuses such a message,
 * and agent command output is scrubbed). Patterns are kept specific so ordinary messages never trip them.
 *
 * kind "key": an API key, token or password. It can be moved into the vault ("Save securely").
 * kind "seed" / "private": a wallet recovery phrase or private key. Never accepted anywhere: blocked outright.
 */
import { ed25519 } from "@noble/curves/ed25519";
import { BIP39_WORDS } from "./bip39.ts";

export type SecretKind = "key" | "seed" | "private";
export type Finding = { kind: SecretKind; label: string; service: string; name: string; start: number; end: number; value: string };

type Rule = { re: RegExp; label: string; service: string; name: string; kind?: SecretKind; group?: number };
const RULES: Rule[] = [
  { re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g, label: "a private key", service: "", name: "PRIVATE_KEY", kind: "private" },
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, label: "an Anthropic API key", service: "Anthropic", name: "ANTHROPIC_API_KEY" },
  { re: /\bsk-or-v1-[A-Za-z0-9]{32,}/g, label: "an OpenRouter API key", service: "OpenRouter", name: "OPENROUTER_API_KEY" },
  { re: /\bsk-(?=[A-Za-z0-9_-]*\d)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g, label: "an OpenAI API key", service: "OpenAI", name: "OPENAI_API_KEY" },
  { re: /\bxai-[A-Za-z0-9]{20,}/g, label: "an xAI API key", service: "xAI", name: "XAI_API_KEY" },
  { re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g, label: "a GitHub token", service: "GitHub", name: "GITHUB_TOKEN" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}/g, label: "a GitHub token", service: "GitHub", name: "GITHUB_TOKEN" },
  { re: /\bglpat-[A-Za-z0-9_-]{20,}/g, label: "a GitLab token", service: "GitLab", name: "GITLAB_TOKEN" },
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, label: "an AWS access key", service: "AWS", name: "AWS_ACCESS_KEY_ID" },
  { re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/g, label: "a Resend API key", service: "Resend", name: "RESEND_API_KEY" },
  { re: /\bwhsec_[A-Za-z0-9+/=]{20,}/g, label: "a webhook secret", service: "", name: "WEBHOOK_SECRET" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, label: "a Google API key", service: "Google", name: "GOOGLE_API_KEY" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, label: "a Slack token", service: "Slack", name: "SLACK_TOKEN" },
  { re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g, label: "a Stripe secret key", service: "Stripe", name: "STRIPE_SECRET_KEY" },
  { re: /\bhf_[A-Za-z0-9]{30,}/g, label: "a Hugging Face token", service: "Hugging Face", name: "HF_TOKEN" },
  { re: /\bnpm_[A-Za-z0-9]{36}\b/g, label: "an npm token", service: "npm", name: "NPM_TOKEN" },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, label: "an access token", service: "", name: "ACCESS_TOKEN" },
  { re: /\b(?:password|passwd|pwd|passcode|pass)\s*(?:is|:|=)\s*["']?((?=[^\s"']*[\d!@#$%^&*?_~+=])[^\s"']{6,})/gi, label: "a password", service: "", name: "PASSWORD", group: 1 },
  // A Solana keypair file: a JSON array of 64 bytes.
  { re: /\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/g, label: "a wallet private key", service: "", name: "PRIVATE_KEY", kind: "private" },
  // 64 hex characters right after the words "private key" or "secret" (a bare hash is a transaction id, so context is required).
  { re: /\b(?:private\s*key|priv(?:ate)?key|secret(?:\s*key)?|pk)\b[^\n]{0,24}?\b((?:0x)?[a-fA-F0-9]{64})\b/gi, label: "a wallet private key", service: "", name: "PRIVATE_KEY", kind: "private", group: 1 },
];

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) return null;
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 255; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 255); carry >>= 8; }
  }
  for (const ch of s) { if (ch !== "1") break; bytes.push(0); }
  return Uint8Array.from(bytes.reverse());
}

/** Recovery phrases: 12, 15, 18, 21 or 24 BIP39 words in a row (numbering like "1." or commas allowed between them). */
function seedRuns(text: string): Finding[] {
  const out: Finding[] = [];
  const tokens = [...text.matchAll(/[A-Za-z]+|\d+[.)]?|[^\sA-Za-z\d]+/g)];
  let run: RegExpMatchArray[] = [];
  const flush = () => {
    if (run.length >= 12) {
      const start = run[0].index!, last = run[run.length - 1];
      out.push({ kind: "seed", label: "a wallet recovery phrase", service: "", name: "", start, end: last.index! + last[0].length, value: text.slice(start, last.index! + last[0].length) });
    }
    run = [];
  };
  for (const t of tokens) {
    const w = t[0];
    if (/^[A-Za-z]+$/.test(w)) { if (BIP39_WORDS.has(w.toLowerCase())) run.push(t); else flush(); }
    else if (!/^(\d+[.)]?|[,;:\-–.]+)$/.test(w)) flush();
  }
  flush();
  return out;
}

/** Every secret found in the text, in order (overlaps dropped). Base58 private keys need the async check below. */
export function scanSecrets(text: string): Finding[] {
  if (!text || text.length < 8) return [];
  const found: Finding[] = [];
  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) {
      const value = r.group ? m[r.group] : m[0];
      if (!value) continue;
      const start = m.index! + (r.group ? m[0].indexOf(value) : 0);
      found.push({ kind: r.kind || "key", label: r.label, service: r.service, name: r.name, start, end: start + value.length, value });
    }
  }
  found.push(...seedRuns(text));
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Finding[] = [];
  for (const f of found) if (!out.length || f.start >= out[out.length - 1].end) out.push(f);
  return out;
}

/**
 * scanSecrets plus base58 Solana private keys: an 86-88 character base58 string is a 64-byte secret key only when its
 * second half is the public key of its first half (transaction signatures are the same length, so this is checked).
 */
export async function findSecrets(text: string): Promise<Finding[]> {
  const out = scanSecrets(text);
  const cands = [...text.matchAll(/\b[1-9A-HJ-NP-Za-km-z]{85,90}\b/g)].filter((m) => !out.some((f) => m.index! < f.end && m.index! + m[0].length > f.start));
  if (cands.length) {
    for (const m of cands) {
      const b = b58decode(m[0]);
      if (!b || b.length !== 64) continue;
      let ok = false;
      try { const pub = ed25519.getPublicKey(b.slice(0, 32)); ok = pub.every((x, i) => x === b[32 + i]); } catch {}
      if (ok) out.push({ kind: "private", label: "a wallet private key", service: "", name: "PRIVATE_KEY", start: m.index!, end: m.index! + m[0].length, value: m[0] });
    }
    out.sort((a, b) => a.start - b.start);
  }
  return out;
}

export const isBlockedKind = (k: SecretKind) => k === "seed" || k === "private";

/** The text with each finding replaced (by default with a short marker). */
export function cutSecrets(text: string, found: Finding[], put: (f: Finding) => string = (f) => (isBlockedKind(f.kind) ? "[removed]" : "[key removed]")) {
  let out = "", at = 0;
  for (const f of [...found].sort((a, b) => a.start - b.start)) { out += text.slice(at, f.start) + put(f); at = f.end; }
  return out + text.slice(at);
}

/** Pattern-based scrub for text headed to a model or a log (command output, tool results). */
export function redactPatterns(text: string) {
  const f = scanSecrets(text);
  return f.length ? cutSecrets(text, f, (x) => `[redacted ${x.kind === "seed" ? "recovery phrase" : x.kind === "private" ? "private key" : x.service ? `${x.service} key` : "secret"}]`) : text;
}

/** A vault name: UPPER_SNAKE_CASE, 2-64 characters, starts with a letter. */
export const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
export const toSecretName = (v: string) => v.toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^[^A-Z]+/, "").replace(/_+/g, "_").slice(0, 64);
