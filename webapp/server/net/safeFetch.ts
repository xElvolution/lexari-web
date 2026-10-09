/**
 * fetch() for addresses a person typed (a custom model base URL): the address is checked at CONNECT time, not just
 * before, so a hostname that resolves to a public IP for the check and to 127.0.0.1 / 10.x / 169.254.169.254 a moment
 * later (DNS rebinding) is still refused. https only, no redirects, a size-limited body.
 */
import https from "node:https";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

/** Loopback, private, link-local, CGNAT, multicast, reserved, and IPv6 forms that map onto them. */
export function privateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x) || /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return privateIp(mapped[1]);
    if (x.startsWith("2002:")) return true; // 6to4 can wrap any IPv4 address
    return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff") || x.startsWith("64:ff9b:") || x.startsWith("2001:db8:") || x.startsWith("::ffff:");
  }
  return true;
}

export class BlockedAddress extends Error {}

const guardedLookup: LookupFunction = (host, opts, cb) => {
  dns.lookup(host, { ...opts, all: true }, (err, addrs) => {
    if (err) return (cb as (e: Error | null, a: string, f?: number) => void)(err, "", 4);
    const list = addrs as dns.LookupAddress[];
    const bad = !list.length || list.some((a) => privateIp(a.address));
    if (bad) return (cb as (e: Error | null, a: string, f?: number) => void)(new BlockedAddress(`private address for ${host}`), "", 4);
    if ((opts as { all?: boolean }).all) return (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    return (cb as (e: null, a: string, f: number) => void)(null, list[0].address, list[0].family);
  });
};

export async function safeFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal; maxBytes?: number } = {}): Promise<Response> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new BlockedAddress("https only");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && privateIp(host)) throw new BlockedAddress(`private address ${host}`);
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new BlockedAddress(`private host ${host}`);
  return new Promise((resolve, reject) => {
    const req = https.request(u, { method: init.method || "GET", headers: init.headers, lookup: guardedLookup, signal: init.signal, timeout: 120_000 }, (res) => {
      const max = init.maxBytes ?? 20 * 1024 * 1024;
      let seen = 0;
      res.on("data", (c: Buffer) => { seen += c.length; if (seen > max) res.destroy(new Error("response too large")); });
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
      const status = res.statusCode || 502;
      // no redirects: a 3xx is returned as is (callers treat it as an error)
      const body = status === 204 || status === 304 || init.method === "HEAD" ? null : (Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>);
      resolve(new Response(body, { status: status < 200 || status > 599 ? 502 : status, headers }));
    });
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}
