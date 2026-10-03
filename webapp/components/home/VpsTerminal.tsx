"use client";

import { useEffect, useRef, useState } from "react";

export type Line = { k: "cmd" | "out" | "err" | "dim"; t: string };
export type Step = { cmd: string; out: string[] };

const PROMPT_USER = "root";
function Prompt({ host }: { host: string }) {
  return <><span className="font-bold text-[#c9b8ff]">{PROMPT_USER}@{host}</span><span className="text-white/60">:</span><span className="font-bold text-[#8f6bff]">~</span><span className="text-white/80"># </span></>;
}

/** Canned answers for commands typed by hand. Nothing runs anywhere. */
function answer(raw: string, o: { host: string; agent: string; files: string[]; ip: string; uptime: string }): Line[] | "clear" {
  const cmd = raw.trim(); const [c, ...rest] = cmd.split(/\s+/); const arg = rest.join(" ");
  const out = (...t: string[]): Line[] => t.map((x) => ({ k: "out", t: x }));
  switch (c) {
    case "": return [];
    case "help": return out("Demo shell. Try: ls, ls -la, whoami, hostname, uptime, pwd, date, uname -a, ip a, df -h, free -h, top, cat brief.md, echo <text>, history, clear");
    case "ls": return arg.includes("-l") ? out("total 20", "drwxr-xr-x 2 root root 4096 output", "-rw-r--r-- 1 root root 2210 brief.md", "-rwxr-xr-x 1 root root 1893 run.py", "drwxr-xr-x 2 root root 4096 logs") : out("brief.md  logs  output  run.py");
    case "whoami": return out("root");
    case "hostname": return out(o.host);
    case "pwd": return out("/root");
    case "date": return out(new Date().toString().replace(/\s\(.+\)$/, ""));
    case "uptime": return out(` ${new Date().toLocaleTimeString("en-GB")} up ${o.uptime},  1 user,  load average: 0.42, 0.37, 0.30`);
    case "uname": return out(`Linux ${o.host} 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux`);
    case "ip": return out("1: lo: <LOOPBACK,UP> inet 127.0.0.1/8", `2: eth0: <BROADCAST,UP> inet ${o.ip}/24`);
    case "df": return out("Filesystem  Size  Used Avail Use% Mounted on", "/dev/vda1    40G   15G   25G  38% /");
    case "free": return out("        total   used   free", "Mem:     4.0G   1.9G   2.1G", "Swap:    1.0G     0B   1.0G");
    case "top": case "htop": return out("CPU[||||||||        38.2%]  Mem[|||||      1.9G/4.0G]", "Tasks: 42, 1 running   Load average: 0.42 0.37 0.30", `  PID USER   %CPU %MEM COMMAND`, ` 1204 root   21.3  6.1 python3 run.py`, `  988 root    4.0  2.2 lexari-agent --name ${o.agent.toLowerCase()}`);
    case "cat": return arg === "brief.md" ? out("# Brief", `Owner: you. Agent: ${o.agent}.`, "Keep it to one page. Link every source.") : [{ k: "err", t: `cat: ${arg || "missing file"}: No such file or directory` }];
    case "echo": return out(arg);
    case "history": return "clear" === arg ? "clear" : out("  1  apt update", "  2  ls -la", "  3  python3 run.py");
    case "clear": return "clear";
    case "sudo": return out("You are already root. Careful.");
    case "exit": case "logout": return [{ k: "dim", t: "This is a demo session. It stays open." }];
    case "rm": return [{ k: "dim", t: "Demo shell: nothing to delete here." }];
    default: return [{ k: "err", t: `bash: ${c}: command not found (type help)` }];
  }
}

/** A server terminal. Plays a short script, then lets you type. */
export default function VpsTerminal({ host, agent, ip, uptime, script, files, compact = false }: { host: string; agent: string; ip: string; uptime: string; script: Step[]; files: string[]; compact?: boolean }) {
  const [lines, setLines] = useState<Line[]>([{ k: "dim", t: `Welcome to Ubuntu 24.04 LTS · ${host} · demo session` }, { k: "dim", t: `Last login from 198.51.100.7 · agent ${agent} connected` }]);
  const [typing, setTyping] = useState(""); // command being "typed" by the agent
  const [done, setDone] = useState(false);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // play the script
  useEffect(() => {
    let t = 500; const q = timers.current;
    const at = (ms: number, f: () => void) => { q.push(setTimeout(f, ms)); };
    script.forEach((st) => {
      for (let i = 1; i <= st.cmd.length; i++) at(t + i * 32, () => setTyping(st.cmd.slice(0, i)));
      t += st.cmd.length * 32 + 260;
      at(t, () => { setTyping(""); setLines((l) => [...l, { k: "cmd", t: st.cmd }]); });
      st.out.forEach((o, j) => at(t + 140 + j * 170, () => setLines((l) => [...l, { k: o.startsWith("!") ? "dim" : "out", t: o.replace(/^!/, "") }])));
      t += 140 + st.out.length * 170 + 520;
    });
    at(t, () => setDone(true));
    return () => { q.forEach(clearTimeout); timers.current = []; };
  }, [script]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines, typing, done]);

  const skip = () => {
    if (done) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    setTyping(""); setLines((l) => { const have = l.filter((x) => x.k === "cmd").length; const rest = script.slice(have).flatMap((st) => [{ k: "cmd" as const, t: st.cmd }, ...st.out.map((o) => ({ k: (o.startsWith("!") ? "dim" : "out") as Line["k"], t: o.replace(/^!/, "") }))]); return [...l, ...rest]; });
    setDone(true);
  };
  const run = () => {
    const r = answer(input, { host, agent, files, ip, uptime });
    if (input.trim()) setHist((h) => [...h, input]);
    setHi(-1);
    if (r === "clear") setLines([]); else setLines((l) => [...l, { k: "cmd", t: input }, ...r]);
    setInput("");
  };

  return (
    <div ref={box} onClick={() => { skip(); field.current?.focus(); }} className={`no-bar h-full cursor-text overflow-y-auto bg-[#07050e] font-mono leading-[1.7] text-white/85 ${compact ? "p-2 text-[9.5px]" : "p-3.5 text-[12px]"}`} role="log" aria-label="Server terminal (demo)">
      {lines.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap break-all">
          {l.k === "cmd" ? <><Prompt host={host} /><span className="text-white">{l.t}</span></> : <span className={l.k === "err" ? "text-[#ff8f8f]" : l.k === "dim" ? "text-white/45" : "text-white/80"}>{l.t}</span>}
        </div>
      ))}
      {!done ? (
        <div className="whitespace-pre-wrap break-all"><Prompt host={host} /><span className="text-white">{typing}</span><span className="term-caret" /></div>
      ) : !compact && (
        <div className="flex whitespace-pre"><Prompt host={host} />
          <span className="relative flex-1">
            <input ref={field} value={input} onChange={(e) => setInput(e.target.value.slice(0, 120))} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label="Type a command"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); run(); }
                else if (e.key === "ArrowUp" && hist.length) { e.preventDefault(); const n = hi < 0 ? hist.length - 1 : Math.max(0, hi - 1); setHi(n); setInput(hist[n]); }
                else if (e.key === "ArrowDown" && hi >= 0) { e.preventDefault(); const n = hi + 1; if (n >= hist.length) { setHi(-1); setInput(""); } else { setHi(n); setInput(hist[n]); } }
                else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
              }}
              className="absolute inset-0 w-full bg-transparent text-transparent caret-transparent outline-none" />
            <span className="text-white">{input}</span><span className="term-caret" />
          </span>
        </div>
      )}
      {!done && !compact && <button onClick={(e) => { e.stopPropagation(); skip(); field.current?.focus(); }} className="label sticky bottom-0 float-right rounded-full bg-white/10 px-2.5 py-1 text-[8.5px] text-white/70 hover:bg-white/20">Skip · type your own</button>}
    </div>
  );
}
