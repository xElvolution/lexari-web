// Lexari desktop relay: one locked-down Docker container per user, reached only through this service.
// Listens on 127.0.0.1 only. Browsers attach over a websocket with a short-lived ticket signed by the webapp;
// the webapp runs agent commands and lists files with a shared secret. Runs as a dedicated user in the docker group.
import http from "node:http";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const PORT = Number(process.env.PORT || 3295);
const SECRET = process.env.DESKTOP_SECRET || "";
const IMAGE = process.env.DESKTOP_IMAGE || "lexari-desktop:1";
const IDLE_MS = Number(process.env.DESKTOP_IDLE_MS || 15 * 60_000);
if (SECRET.length < 32) { console.error("DESKTOP_SECRET missing"); process.exit(1); }

const LIMITS = ["--cpus", "0.5", "--memory", "512m", "--memory-swap", "512m", "--pids-limit", "256"];
const HARDEN = ["--network", "none", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--read-only",
  "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "1000:1000", "--ulimit", "nofile=1024:1024"];

const last = new Map(); // container -> last activity
const sockets = new Map(); // user -> Set<ws>

const name = (user) => `lx-${user}`;
const okUser = (u) => typeof u === "string" && /^[a-f0-9]{32}$/.test(u);
const sh = (args, opts = {}) => new Promise((resolve) => {
  execFile("docker", args, { timeout: opts.timeout ?? 30_000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, out: String(stdout), err: String(stderr), killed: !!err?.killed }));
});

async function ensure(user) {
  const c = name(user);
  last.set(c, Date.now());
  const st = await sh(["inspect", "-f", "{{.State.Running}}", c]);
  if (st.code === 0 && st.out.trim() === "true") return c;
  if (st.code === 0) { await sh(["start", c]); return c; }
  const r = await sh(["run", "-d", "--name", c, "--hostname", "lexari", "--label", "lexari.desktop=1", ...LIMITS, ...HARDEN,
    "--restart", "no", "-v", `lxvol-${user}:/home/agent`, "-w", "/home/agent", IMAGE, "sleep", "infinity"], { timeout: 60_000 });
  if (r.code !== 0) throw new Error("container start failed: " + r.err.slice(0, 200));
  return c;
}

function verifyTicket(t) {
  const [body, mac] = String(t || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return okUser(p.u) && p.exp > Date.now() ? p.u : null; } catch { return null; }
}

function broadcast(user, msg) {
  for (const ws of sockets.get(user) || []) { try { ws.send(JSON.stringify(msg)); } catch {} }
}

async function execCmd(user, cmd) {
  const c = await ensure(user);
  broadcast(user, { t: "agent", cmd });
  const r = await sh(["exec", "-w", "/home/agent", c, "bash", "-lc", `timeout 20 bash -c ${JSON.stringify(cmd)}`], { timeout: 25_000 });
  const out = (r.out + r.err).slice(0, 8000);
  broadcast(user, { t: "agentOut", cmd, out, code: r.code });
  last.set(c, Date.now());
  return { code: r.code, out };
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

async function readBody(req) {
  let raw = ""; for await (const ch of req) { raw += ch; if (raw.length > 20_000) break; }
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
    const key = String(req.headers["x-desktop-secret"] || "");
    if (key.length !== SECRET.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(SECRET))) return send(401, { error: "unauthorized" });
    const body = await readBody(req);
    if (!okUser(body.user)) return send(400, { error: "bad user" });
    if (req.url === "/exec" && req.method === "POST") return send(200, await execCmd(body.user, String(body.cmd || "").slice(0, 2000)));
    if (req.url === "/files" && req.method === "POST") return send(200, await listFiles(body.user, body.path));
    if (req.url === "/read" && req.method === "POST") {
      const c = await ensure(body.user); const p = String(body.path || "");
      if (!p.startsWith("/home/agent/") || p.includes("..")) return send(400, { error: "bad path" });
      const r = await sh(["exec", c, "head", "-c", "65536", p]); return send(200, { text: r.out, code: r.code });
    }
    send(404, { error: "not found" });
  } catch (e) { send(500, { error: String(e.message || e).slice(0, 200) }); }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/desktop/ws") { socket.destroy(); return; }
  const user = verifyTicket(url.searchParams.get("t"));
  if (!user) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => attach(ws, user, Number(url.searchParams.get("c")) || 80, Number(url.searchParams.get("r")) || 24));
});

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
    if ((sockets.get(user)?.size || 0) > 0) continue;
    if (Date.now() - (last.get(c) || 0) > IDLE_MS) { await sh(["stop", "-t", "3", c]); last.delete(c); console.log("idle stop", c); }
  }
}, 60_000);

server.listen(PORT, "127.0.0.1", () => console.log(`desktop relay on 127.0.0.1:${PORT}`));
