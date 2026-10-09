// Lexari desktop relay: one locked-down Docker container per user, reached only through this service.
// Listens on 127.0.0.1 only. Browsers attach over a websocket with a short-lived ticket signed by the webapp
// (terminal: /desktop/ws, screen: /desktop/ws?k=vnc); the webapp runs agent commands and lists files with a shared secret.
// Runs as a dedicated user in the docker group.
//
// Containers run with --network none. Each gets a bind-mounted socket dir (/run/lexari inside):
//   proxy.sock  this relay's filtering web proxy (CONNECT + plain HTTP, ports 80/443 and TURN ports, public IPs only:
//               loopback, private, link-local, CGNAT and multicast are refused, and so is this host's own public address
//               on every port, so nothing host-local (other sites, app ports, databases) is reachable)
//   vnc.sock    the container's x11vnc, bridged by socat; the screen websocket is piped to it
// So the desktop browses the public web but can never reach host-local ports, and the host firewall is untouched.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import dns from "node:dns/promises";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const PORT = Number(process.env.PORT || 3295);
const SECRET = process.env.DESKTOP_SECRET || "";
const IMAGE = process.env.DESKTOP_IMAGE || "lexari-desktop:6";
const SOCKS = process.env.DESKTOP_SOCKS || "/opt/lexari-desktop/socks";
const IDLE_MS = Number(process.env.DESKTOP_IDLE_MS || 15 * 60_000);
if (SECRET.length < 32) { console.error("DESKTOP_SECRET missing"); process.exit(1); }

// Disk: writes to the host disk are rate capped (so nothing can fill it between quota checks), see DISK QUOTA below.
const HARDENING = "2"; // bump when LIMITS/HARDEN change, so stopped desktops are recreated with them
const DISK_DEV = process.env.DESKTOP_DISK_DEV ?? "/dev/sda";
const SECCOMP = process.env.DESKTOP_SECCOMP || "/opt/lexari-desktop/seccomp-desktop.json";
const WRITE_BPS = process.env.DESKTOP_WRITE_BPS || "60mb";
const LIMITS = ["--cpus", "1", "--memory", "1536m", "--memory-swap", "1536m", "--pids-limit", "768", "--shm-size", "256m",
  ...(DISK_DEV && fs.existsSync(DISK_DEV) ? ["--device-write-bps", `${DISK_DEV}:${WRITE_BPS}`] : [])];
const HARDEN = ["--network", "none", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--read-only", "--init",
  "--tmpfs", "/tmp:rw,nosuid,nodev,size=384m,mode=1777", "--user", "1000:1000", "--ulimit", "nofile=4096:4096",
  // Docker's default seccomp profile, except fallocate() returns EOPNOTSUPP: preallocating a huge file would skip the
  // write-rate cap and fill the disk instantly (glibc posix_fallocate falls back to normal writes).
  ...(fs.existsSync(SECCOMP) ? ["--security-opt", `seccomp=${SECCOMP}`] : [])];

const last = new Map(); // container -> last activity
const sockets = new Map(); // user -> Set<ws> (terminals)
const screens = new Map(); // user -> Set<ws> (VNC viewers)

const name = (user) => `lx-${user}`;
const okUser = (u) => typeof u === "string" && /^[a-f0-9]{32}$/.test(u);
const sh = (args, opts = {}) => new Promise((resolve) => {
  execFile("docker", args, { timeout: opts.timeout ?? 30_000, maxBuffer: 1 << 20, ...(opts.env ? { env: opts.env } : {}) }, (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, out: String(stdout), err: String(stderr), killed: !!err?.killed }));
});

// ---- filtering web proxy (one unix socket per user) ----
const blocked = new net.BlockList();
for (const [a, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]]) blocked.addSubnet(a, p, "ipv4");
for (const [a, p] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2001:db8::", 32]]) blocked.addSubnet(a, p, "ipv6");
// Web on 80/443, plus the TURN/ICE-TCP ports video meetings relay their audio over (3478 TURN, 5349 TURN-TLS,
// 4443/8443 bridge TCP): containers have no UDP, so meeting media can only flow as TCP through this proxy.
const OK_PORTS = new Set([80, 443, 3478, 5349, 4443, 8443]);
// This machine's own addresses (every interface, plus DESKTOP_HOST_IPS for a public IP that sits behind NAT) are refused
// on every port: other sites and services on this host must not be reachable from a desktop.
const SELF = new Set([...Object.values(os.networkInterfaces()).flat().filter(Boolean).map((i) => unmapIp(i.address)),
  ...String(process.env.DESKTOP_HOST_IPS || "5.189.170.85").split(",").map((x) => x.trim()).filter(Boolean)]);
function unmapIp(ip) { return /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip) ? ip.slice(7) : ip; }
const portOk = (port, ip) => OK_PORTS.has(port) && (port === 80 || port === 443 || !SELF.has(unmapIp(ip)));
const unmap = (ip) => (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip) ? ip.slice(7) : ip);
function isBlocked(ip) {
  ip = unmap(ip);
  const fam = net.isIP(ip); if (!fam) return true;
  // Loopback, private, link-local and CGNAT ranges (where host-local services live) are always refused, and so is this
  // host's own public address: it serves other sites, so desktops never reach it at all.
  return SELF.has(ip) || blocked.check(ip, fam === 4 ? "ipv4" : "ipv6");
}
/** Resolve a host for the proxy: every address must be public, or the request is refused (no DNS-rebinding way in). */
async function resolvePublic(host) {
  host = host.replace(/^\[|\]$/g, "");
  if (!host || host.length > 253 || /^localhost$/i.test(host) || /\.(local|internal|localhost)$/i.test(host)) return null;
  let addrs;
  if (net.isIP(host)) addrs = [host];
  else { try { addrs = (await dns.lookup(host, { all: true, verbatim: true })).map((a) => a.address); } catch { return null; } }
  if (!addrs.length || addrs.some(isBlocked)) return null;
  return addrs.find((a) => net.isIP(a) === 4) || addrs[0];
}
const HOP = ["connection", "keep-alive", "proxy-connection", "proxy-authorization", "proxy-authenticate", "te", "trailer", "upgrade"];
const hopless = (h) => { const o = { ...h }; for (const k of HOP) delete o[k]; return o; };
const proxies = new Map(); // user -> http.Server
const open = new Map(); // user -> live upstream connections
function startProxy(user, dir) {
  if (proxies.has(user)) return;
  const sock = `${dir}/proxy.sock`;
  try { fs.unlinkSync(sock); } catch {}
  const refuse = (res, code, why) => { try { res.writeHead(code, { "content-type": "text/plain" }); res.end(`Lexari proxy: ${why}\n`); } catch {} };
  const busy = () => (open.get(user) || 0) >= 96;
  const track = (s) => { open.set(user, (open.get(user) || 0) + 1); s.once("close", () => open.set(user, Math.max(0, (open.get(user) || 1) - 1))); last.set(name(user), Date.now()); };
  const srv = http.createServer(async (req, res) => {
    let u; try { u = new URL(req.url); } catch { return refuse(res, 400, "absolute http:// URL required"); }
    if (u.protocol !== "http:") return refuse(res, 400, "use CONNECT for https");
    const port = Number(u.port || 80);
    if (!OK_PORTS.has(port)) return refuse(res, 403, "only ports 80 and 443 are allowed");
    if (busy()) return refuse(res, 429, "too many connections");
    const ip = await resolvePublic(u.hostname);
    if (!ip) return refuse(res, 403, "that address is not on the public internet");
    if (!portOk(port, ip)) return refuse(res, 403, "that port is not allowed");
    const headers = hopless({ ...req.headers, host: u.host });
    const up = http.request({ host: ip, port, method: req.method, path: u.pathname + u.search, headers, setHost: false, timeout: 30_000 }, (r) => { res.writeHead(r.statusCode || 502, hopless(r.headers)); r.pipe(res); });
    up.on("socket", track);
    up.on("timeout", () => up.destroy()); up.on("error", () => refuse(res, 502, "upstream failed"));
    req.pipe(up);
  });
  srv.on("connect", async (req, client, head) => {
    client.on("error", () => {});
    const m = /^(\[[0-9a-f:.]+\]|[^:]+):(\d+)$/i.exec(req.url || "");
    const deny = (code, why) => { try { client.end(`HTTP/1.1 ${code} ${why}\r\ncontent-length: 0\r\n\r\n`); } catch {} };
    if (!m) return deny(400, "Bad Request");
    const port = Number(m[2]);
    if (!OK_PORTS.has(port)) return deny(403, "Port Not Allowed");
    if (busy()) return deny(429, "Too Many Connections");
    const ip = await resolvePublic(m[1]);
    // Meeting-media tunnels (non-web ports) are rare; log host:port only, so call audio problems can be traced.
    if (port !== 80 && port !== 443) console.log("proxy media", String(user).slice(0, 8), m[1], port, ip && portOk(port, ip) ? "ok" : "refused");
    if (!ip) return deny(403, "Not Public");
    if (!portOk(port, ip)) return deny(403, "Port Not Allowed");
    const up = net.connect({ host: ip, port, timeout: 30_000 }, () => {
      up.setTimeout(0);
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head?.length) up.write(head);
      up.pipe(client); client.pipe(up);
    });
    track(up);
    up.on("timeout", () => up.destroy());
    up.on("error", () => deny(502, "Bad Gateway"));
    client.on("close", () => up.destroy());
  });
  srv.on("clientError", (_e, s) => { try { s.destroy(); } catch {} });
  srv.listen(sock, () => { try { fs.chmodSync(sock, 0o666); } catch {} });
  srv.on("error", (e) => { console.error("proxy", user, e.message); proxies.delete(user); });
  proxies.set(user, srv);
}

async function ensure(user) {
  const c = name(user);
  last.set(c, Date.now());
  const dir = `${SOCKS}/${user}`;
  // Socket dirs: owner this relay, group = the container's gid (inherited from the setgid parent, which is
  // lexaridesk:1000 2750), mode 770, so only the relay and that container can reach proxy.sock / vnc.sock.
  fs.mkdirSync(dir, { recursive: true }); fs.chmodSync(dir, 0o770);
  startProxy(user, dir);
  const st = await sh(["inspect", "-f", '{{.State.Running}} {{.Config.Image}} {{index .Config.Labels "lexari.hardening"}}', c]);
  if (st.code === 0) {
    const [running, image, hard] = st.out.trim().split(" ");
    // Same image: keep it. A stopped one made before the current hardening (HARDENING) is recreated so it gets the
    // disk limits; a running one is left alone (a meeting or job may be on) and picks them up after its next stop.
    if (image === IMAGE && (running === "true" || hard === HARDENING)) { if (running !== "true") { allowCleanup(user); await sh(["start", c]); } return c; }
    await sh(["rm", "-f", c]); // an older image: recreate (the home volume and its files stay)
  }
  allowCleanup(user);
  const r = await sh(["run", "-d", "--name", c, "--hostname", "lexari", "--label", "lexari.desktop=1", "--label", `lexari.hardening=${HARDENING}`, ...LIMITS, ...HARDEN,
    "--restart", "no", "-v", `lxvol-${user}:/home/agent`, "-v", `${dir}:/run/lexari`, "-w", "/home/agent", IMAGE], { timeout: 60_000 });
  if (r.code !== 0) throw new Error("container start failed: " + r.err.slice(0, 200));
  return c;
}

// Tickets are single use: each one carries a nonce, remembered until it expires (30 s), so a copied ticket is worthless.
const usedTickets = new Map(); // nonce -> expiry
setInterval(() => { const now = Date.now(); for (const [n, exp] of usedTickets) if (exp < now) usedTickets.delete(n); }, 30_000).unref();
function verifyTicket(t) {
  const [body, mac] = String(t || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
  if (!okUser(p.u) || !(p.exp > Date.now()) || p.exp > Date.now() + 120_000 || typeof p.n !== "string" || p.n.length < 12) return null;
  if (usedTickets.has(p.n)) return null;
  usedTickets.set(p.n, p.exp);
  return p.u;
}
// Only the app's own pages may open a desktop websocket (a browser always sends Origin on websocket upgrades).
const ORIGINS = new Set((process.env.DESKTOP_ORIGINS || "https://app.lexari.ai").split(",").map((o) => o.trim()).filter(Boolean));
/** The ticket from the "lxt.<ticket>" subprotocol (the app's way, kept out of URLs and logs), else the old ?t= query. */
function ticketOf(req, url) {
  const offered = String(req.headers["sec-websocket-protocol"] || "").split(",").map((p) => p.trim());
  const sub = offered.find((p) => p.startsWith("lxt."));
  return sub ? sub.slice(4) : url.searchParams.get("t");
}

function broadcast(user, msg) {
  for (const ws of sockets.get(user) || []) { try { ws.send(JSON.stringify(msg)); } catch {} }
}

// Secrets from the person's vault for one command: passed to `docker exec -e NAME` through the docker client's own
// environment (never on a command line, never written to disk), and blocked out of the output as [secret:NAME].
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
function cleanEnv(env) {
  const out = {};
  if (!env || typeof env !== "object") return out;
  for (const [k, v] of Object.entries(env).slice(0, 12)) if (ENV_NAME.test(k) && !(k in process.env) && typeof v === "string" && v.length && v.length <= 8192 && !/^(PATH|HOME|DOCKER_.*|LD_.*|BASH_ENV|ENV)$/.test(k)) out[k] = v;
  return out;
}
function hideSecrets(text, env) {
  let out = text;
  for (const [k, v] of Object.entries(env).sort((a, b) => b[1].length - a[1].length)) {
    if (v.length < 4) continue;
    out = out.split(v).join(`[secret:${k}]`);
    const b64 = Buffer.from(v).toString("base64").replace(/=+$/, "");
    if (b64.length >= 8) out = out.split(b64).join(`[secret:${k}]`);
  }
  return out;
}

async function execCmd(user, cmd, quiet = false, rawEnv = null) {
  const c = await ensure(user);
  const env = cleanEnv(rawEnv);
  const names = Object.keys(env);
  if (!quiet) broadcast(user, { t: "agent", cmd });
  const r = await sh(["exec", ...names.flatMap((k) => ["-e", k]), "-w", "/home/agent", c, "timeout", "20", "bash", "-lc", cmd], { timeout: 25_000, ...(names.length ? { env: { ...process.env, ...env } } : {}) });
  const out = hideSecrets((r.out + r.err).slice(0, 8000), env);
  if (!quiet) broadcast(user, { t: "agentOut", cmd, out, code: r.code });
  last.set(c, Date.now());
  return { code: r.code, out };
}

// Screenshot of the agent's screen for its computer-use loop: python3 + libX11 (already in the image) read the root
// window with XGetImage and write a PNG, so no screenshot tool is needed in the container. Returns base64 PNG.
const XSHOT = String.raw`import ctypes, ctypes.util, zlib, struct, sys, base64
X = ctypes.cdll.LoadLibrary(ctypes.util.find_library("X11") or "libX11.so.6")
class XImage(ctypes.Structure):
    _fields_ = [("width", ctypes.c_int), ("height", ctypes.c_int), ("xoffset", ctypes.c_int), ("format", ctypes.c_int),
                ("data", ctypes.c_void_p), ("byte_order", ctypes.c_int), ("bitmap_unit", ctypes.c_int), ("bitmap_bit_order", ctypes.c_int),
                ("bitmap_pad", ctypes.c_int), ("depth", ctypes.c_int), ("bytes_per_line", ctypes.c_int), ("bits_per_pixel", ctypes.c_int)]
X.XOpenDisplay.restype = ctypes.c_void_p; X.XOpenDisplay.argtypes = [ctypes.c_char_p]
X.XDefaultRootWindow.restype = ctypes.c_ulong; X.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
X.XGetImage.restype = ctypes.POINTER(XImage)
X.XGetImage.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_ulong, ctypes.c_int]
X.XDisplayWidth.argtypes = X.XDisplayHeight.argtypes = [ctypes.c_void_p, ctypes.c_int]
d = X.XOpenDisplay(None)
if not d: sys.exit("no display")
w, h = X.XDisplayWidth(d, 0), X.XDisplayHeight(d, 0)
img = X.XGetImage(d, X.XDefaultRootWindow(d), 0, 0, w, h, 0xFFFFFFFF, 2).contents
bpl = img.bytes_per_line
raw = ctypes.string_at(img.data, bpl * h)
rows = []
for y in range(h):
    src = raw[y * bpl: y * bpl + w * 4]
    out = bytearray(w * 3)
    out[0::3] = src[2::4]; out[1::3] = src[1::4]; out[2::3] = src[0::4]
    rows.append(b"\x00" + bytes(out))
def chunk(t, b): return struct.pack(">I", len(b)) + t + b + struct.pack(">I", zlib.crc32(t + b) & 0xffffffff)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(rows), 3)) + chunk(b"IEND", b"")
sys.stdout.write(base64.b64encode(png).decode())
`;
const shooting = new Set();
async function screenshot(user) {
  const c = await ensure(user);
  if (shooting.has(user)) return { error: "busy" };
  shooting.add(user);
  try {
    return await new Promise((resolve) => {
      const p = spawn("docker", ["exec", "-i", c, "timeout", "10", "python3", "-"], { stdio: ["pipe", "pipe", "pipe"] });
      let out = "", err = "";
      const t = setTimeout(() => p.kill("SIGKILL"), 15_000);
      p.stdout.setEncoding("utf8"); p.stdout.on("data", (d) => { if (out.length < 12_000_000) out += d; });
      p.stderr.on("data", (d) => { if (err.length < 500) err += d; });
      p.on("close", (code) => { clearTimeout(t); last.set(c, Date.now()); resolve(code === 0 && out ? { png: out } : { error: (err || `exit ${code}`).slice(0, 200) }); });
      p.stdin.end(XSHOT);
    });
  } finally { shooting.delete(user); }
}

async function listFiles(user, path) {
  const c = await ensure(user);
  const p = String(path || "/home/agent");
  if (!p.startsWith("/home/agent") || p.includes("..")) return { entries: [] };
  const r = await sh(["exec", c, "find", p, "-mindepth", "1", "-maxdepth", "1", "-printf", "%y\t%s\t%T@\t%f\n"]);
  const entries = r.out.split("\n").filter(Boolean).map((l) => { const [y, s, t, f] = l.split("\t"); return { name: f, dir: y === "d", size: Number(s), mtime: Math.round(Number(t) * 1000) }; })
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  return { path: p, entries };
}

async function readBody(req, max = 20_000) {
  let raw = ""; for await (const ch of req) { raw += ch; if (raw.length > max) return {}; }
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

// Files in chat. Paths stay under /home/agent (no "..", no symlink games: realpath must stay inside too).
const FILE_MAX = Number(process.env.DESKTOP_FILE_MAX || 10 * 1024 * 1024);
const okPath = (p) => typeof p === "string" && p.startsWith("/home/agent/") && !p.includes("..") && !/[\0\n]/.test(p) && p.length < 400;
/** Reads one file the agent made (base64), at most FILE_MAX bytes. */
async function pullFile(user, p) {
  if (!okPath(p)) return { error: "bad path" };
  const c = await ensure(user);
  const st = await sh(["exec", c, "bash", "-c", 'r=$(realpath -e -- "$1") && case "$r" in /home/agent/*) [ -f "$r" ] && stat -c %s -- "$r";; *) exit 3;; esac', "_", p]);
  if (st.code !== 0) return { error: "not found" };
  const size = Number(st.out.trim());
  if (!(size >= 0)) return { error: "not found" };
  if (size > FILE_MAX) return { error: "too big", size };
  const r = await new Promise((resolve) => {
    // read the resolved path (checked again) so a symlink can't point the read outside /home/agent
    execFile("docker", ["exec", c, "bash", "-c", 'r=$(realpath -e -- "$1") && case "$r" in /home/agent/*) exec base64 -w0 -- "$r";; *) exit 3;; esac', "_", p], { timeout: 30_000, maxBuffer: Math.ceil(FILE_MAX * 1.4) + 1024 }, (err, stdout) => resolve(err ? null : String(stdout)));
  });
  last.set(c, Date.now());
  return r === null ? { error: "read failed" } : { b64: r, size };
}
/** Writes an upload into ~/Uploads (only there), creating the folder. */
async function pushFile(user, p, b64) {
  if (overQuota(user)) return { error: "storage full", ...quotaInfo(user) };
  if (!okPath(p) || !p.startsWith("/home/agent/Uploads/") || p.slice(20).includes("/")) return { error: "bad path" };
  const buf = Buffer.from(String(b64 || ""), "base64");
  if (!buf.length || buf.length > FILE_MAX) return { error: "bad size" };
  const c = await ensure(user);
  const r = await new Promise((resolve) => {
    const k = spawn("docker", ["exec", "-i", c, "bash", "-c", 'mkdir -p /home/agent/Uploads && cat > "$1"', "_", p], { stdio: ["pipe", "ignore", "pipe"] });
    const t = setTimeout(() => k.kill("SIGKILL"), 30_000);
    k.on("close", (code) => { clearTimeout(t); resolve(code); });
    k.stdin.end(buf);
  });
  last.set(c, Date.now());
  return r === 0 ? { ok: true, path: p, size: buf.length } : { error: "write failed" };
}

// Long jobs (meetings, renders, builds, scheduled work): the command is written to ~/.lexari/jobs/<id>/cmd and run
// detached with lx-job, so it outlives the 20 s /exec limit and the chat turn. A running job keeps the computer awake.
const okJob = (id) => typeof id === "string" && /^[a-z0-9-]{6,64}$/.test(id);
async function jobStart(user, id, cmd) {
  if (!okJob(id) || !cmd) return { error: "bad job" };
  if (overQuota(user)) return { error: "storage full", ...quotaInfo(user) };
  const c = await ensure(user);
  const running = (await sh(["exec", c, "lx-job", "list"])).out.split("\n").filter(Boolean);
  if (running.length >= JOBS_MAX) return { error: "busy", running };
  const w = await new Promise((resolve) => {
    const k = spawn("docker", ["exec", "-i", c, "bash", "-c", 'd="$HOME/.lexari/jobs/$1"; rm -rf "$d"; mkdir -p "$d" && cat > "$d/cmd"', "_", id], { stdio: ["pipe", "ignore", "pipe"] });
    const t = setTimeout(() => k.kill("SIGKILL"), 15_000);
    k.on("close", (code) => { clearTimeout(t); resolve(code); });
    k.stdin.end(String(cmd));
  });
  if (w !== 0) return { error: "could not write the job" };
  const r = await sh(["exec", "-d", "-w", "/home/agent", c, "lx-job", "run", id]);
  last.set(c, Date.now());
  return r.code === 0 ? { ok: true, id } : { error: "could not start the job" };
}
async function jobCmd(user, verb, id, soft = false) {
  if (!okJob(id)) return { error: "bad job" };
  const c = name(user);
  const st = await sh(["inspect", "-f", "{{.State.Running}}", c]);
  if (st.out.trim() !== "true") return verb === "status" ? { running: false, gone: true } : { ok: true };
  const r = await sh(["exec", c, "lx-job", verb, id, ...(soft ? ["soft"] : [])], { timeout: 15_000 });
  try { return JSON.parse(r.out.trim().split("\n").pop() || "{}"); } catch { return { error: (r.err || r.out).slice(0, 200) }; }
}
const JOBS_MAX = Number(process.env.DESKTOP_JOBS_MAX || 3);

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
    const key = String(req.headers["x-desktop-secret"] || "");
    if (key.length !== SECRET.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(SECRET))) return send(401, { error: "unauthorized" });
    const body = await readBody(req, req.url === "/push" ? Math.ceil(FILE_MAX * 1.4) + 4096 : 20_000);
    if (!okUser(body.user)) return send(400, { error: "bad user" });
    if (req.url === "/pull" && req.method === "POST") return send(200, await pullFile(body.user, String(body.path || "")));
    if (req.url === "/push" && req.method === "POST") return send(200, await pushFile(body.user, String(body.path || ""), body.b64));
    if (req.url === "/exec" && req.method === "POST") return send(200, await execCmd(body.user, String(body.cmd || "").slice(0, 2000), !!body.quiet, body.env));
    if (req.url === "/shot" && req.method === "POST") return send(200, await screenshot(body.user));
    if (req.url === "/job/start" && req.method === "POST") return send(200, await jobStart(body.user, body.id, String(body.cmd || "").slice(0, 8000)));
    if (req.url === "/job/status" && req.method === "POST") return send(200, await jobCmd(body.user, "status", body.id));
    if (req.url === "/job/stop" && req.method === "POST") return send(200, await jobCmd(body.user, "stop", body.id, body.soft === true));
    if (req.url === "/files" && req.method === "POST") return send(200, await listFiles(body.user, body.path));
    if (req.url === "/read" && req.method === "POST") {
      const c = await ensure(body.user); const p = String(body.path || "");
      if (!p.startsWith("/home/agent/") || p.includes("..")) return send(400, { error: "bad path" });
      const r = await sh(["exec", c, "head", "-c", "65536", p]); return send(200, { text: r.out, code: r.code });
    }
    send(404, { error: "not found" });
  } catch (e) { send(500, { error: String(e.message || e).slice(0, 200) }); }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, handleProtocols: (p) => (p.has("lx") ? "lx" : false) });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/desktop/ws") { socket.destroy(); return; }
  if (!ORIGINS.has(String(req.headers.origin || ""))) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
  const user = verifyTicket(ticketOf(req, url));
  if (!user) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
  if (url.searchParams.get("k") === "vnc") { vss.handleUpgrade(req, socket, head, (ws) => attachScreen(ws, user)); return; }
  wss.handleUpgrade(req, socket, head, (ws) => attach(ws, user, Number(url.searchParams.get("c")) || 80, Number(url.searchParams.get("r")) || 24));
});

// The screen: the browser's noVNC talks RFB over this websocket, piped byte for byte to the container's x11vnc.
const vss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20, handleProtocols: (p) => (p.has("binary") ? "binary" : false) });
async function attachScreen(ws, user) {
  let c;
  try { c = await ensure(user); } catch (e) { ws.close(1011, "start failed"); return; }
  const sock = `${SOCKS}/${user}/vnc.sock`;
  let tcp = null;
  for (let i = 0; i < 80 && ws.readyState === ws.OPEN; i++) {
    tcp = await new Promise((resolve) => { const s = net.connect(sock); s.once("connect", () => resolve(s)); s.once("error", () => resolve(null)); });
    if (tcp) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!tcp) { try { ws.close(1011, "screen not ready"); } catch {} return; }
  if (!screens.has(user)) screens.set(user, new Set());
  screens.get(user).add(ws);
  last.set(c, Date.now());
  tcp.on("data", (d) => { last.set(c, Date.now()); if (ws.readyState === ws.OPEN) ws.send(d); });
  tcp.on("close", () => { try { ws.close(); } catch {} });
  tcp.on("error", () => {});
  ws.on("message", (d) => { last.set(c, Date.now()); tcp.write(d); });
  const ping = setInterval(() => { try { ws.ping(); } catch {} }, 25_000);
  ws.on("close", () => { clearInterval(ping); screens.get(user)?.delete(ws); tcp.destroy(); });
}

async function attach(ws, user, cols, rows) {
  let term;
  try {
    const c = await ensure(user);
    term = pty.spawn("docker", ["exec", "-it", "-e", "TERM=xterm-256color", "-w", "/home/agent", c, "bash", "-l"], { name: "xterm-256color", cols: Math.min(300, cols), rows: Math.min(120, rows), env: { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_CONFIG: process.env.DOCKER_CONFIG } });
  } catch (e) { ws.send(JSON.stringify({ t: "out", d: `\r\nCould not start the computer: ${e.message}\r\n` })); ws.close(); return; }
  if (!sockets.has(user)) sockets.set(user, new Set());
  sockets.get(user).add(ws);
  const c = name(user);
  term.onData((d) => { last.set(c, Date.now()); try { ws.send(JSON.stringify({ t: "out", d })); } catch {} });
  term.onExit(() => { try { ws.close(); } catch {} });
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    last.set(c, Date.now());
    if (m.t === "in" && typeof m.d === "string") term.write(m.d.slice(0, 4096));
    else if (m.t === "resize") { try { term.resize(Math.max(20, Math.min(300, m.c | 0)), Math.max(5, Math.min(120, m.r | 0))); } catch {} }
  });
  ws.on("close", () => { sockets.get(user)?.delete(ws); try { term.kill(); } catch {} });
  const ping = setInterval(() => { try { ws.ping(); } catch {} }, 25_000);
  ws.on("close", () => clearInterval(ping));
}

// Idle auto-stop: running desktops with no activity (and nobody attached) for IDLE_MS are stopped. Files stay in the volume.
setInterval(async () => {
  const r = await sh(["ps", "--filter", "label=lexari.desktop=1", "--format", "{{.Names}}"]);
  for (const c of r.out.split("\n").filter(Boolean)) {
    const user = c.slice(3);
    if ((sockets.get(user)?.size || 0) > 0 || (screens.get(user)?.size || 0) > 0) continue;
    if (Date.now() - (last.get(c) || 0) > IDLE_MS) {
      const jobs = await sh(["exec", c, "lx-job", "list"], { timeout: 10_000 });
      if (jobs.code === 0 && jobs.out.trim()) { last.set(c, Date.now()); continue; } // a job is running: stay awake
      await sh(["stop", "-t", "3", c]); last.delete(c); console.log("idle stop", c);
    }
  }
}, 60_000);

// ---- DISK QUOTA ----
// The overlay storage driver on ext4 has no per-volume quota, so the relay enforces one: every QUOTA_CHECK_MS it
// measures each running desktop's home (du). Over the soft limit (DESKTOP_QUOTA_GB, default 5) uploads and new jobs
// are refused with "storage full"; over the hard limit (soft x 1.2) the computer is stopped. When it is started again
// the person gets QUOTA_GRACE_MS to delete files before the hard limit applies again. Write speed is capped
// (--device-write-bps) so the disk can't be filled between checks.
const QUOTA_KB = Math.round(Number(process.env.DESKTOP_QUOTA_GB || 5) * 1024 * 1024);
const HARD_KB = Math.round(QUOTA_KB * 1.2);
const QUOTA_CHECK_MS = Number(process.env.DESKTOP_QUOTA_CHECK_MS || 120_000);
const QUOTA_GRACE_MS = Number(process.env.DESKTOP_QUOTA_GRACE_MS || 15 * 60_000);
const usage = new Map(); // user -> KB used in /home/agent (last check)
const grace = new Map(); // user -> time until which the hard limit doesn't stop the computer
function allowCleanup(user) { if ((usage.get(user) || 0) > HARD_KB) grace.set(user, Date.now() + QUOTA_GRACE_MS); }
const overQuota = (user) => (usage.get(user) || 0) > QUOTA_KB;
const quotaInfo = (user) => ({ usedMb: Math.round((usage.get(user) || 0) / 1024), limitMb: Math.round(QUOTA_KB / 1024) });
async function measure(c) {
  const r = await sh(["exec", c, "du", "-sxk", "/home/agent"], { timeout: 90_000 });
  const kb = parseInt(r.out, 10); // du exits 1 on unreadable files but still prints the total
  return Number.isFinite(kb) ? kb : null;
}
let quotaBusy = false;
setInterval(async () => {
  if (quotaBusy) return; quotaBusy = true;
  try {
    const r = await sh(["ps", "--filter", "label=lexari.desktop=1", "--format", "{{.Names}}"]);
    for (const c of r.out.split("\n").filter(Boolean)) {
      const user = c.slice(3); if (!okUser(user)) continue;
      const kb = await measure(c); if (kb === null) continue;
      const was = usage.get(user) || 0; usage.set(user, kb);
      if (kb > QUOTA_KB && was <= QUOTA_KB) console.log("quota over", user.slice(0, 8), Math.round(kb / 1024), "MB");
      if (kb > HARD_KB && !((grace.get(user) || 0) > Date.now())) {
        await sh(["stop", "-t", "3", c]); last.delete(c); console.log("quota stop", user.slice(0, 8), Math.round(kb / 1024), "MB");
      }
    }
  } finally { quotaBusy = false; }
}, QUOTA_CHECK_MS).unref();

server.listen(PORT, "127.0.0.1", async () => {
  console.log(`desktop relay on 127.0.0.1:${PORT}`);
  // After a relay restart, computers that kept running (a meeting, a job) get their web proxy back right away.
  const r = await sh(["ps", "--filter", "label=lexari.desktop=1", "--format", "{{.Names}}"]);
  for (const c of r.out.split("\n").filter(Boolean)) { const user = c.slice(3); if (okUser(user)) { last.set(c, Date.now()); startProxy(user, `${SOCKS}/${user}`); } }
});
