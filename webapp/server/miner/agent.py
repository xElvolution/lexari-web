#!/usr/bin/env python3
# Lexari ORE Miner host agent. Runs on YOUR server as the user who installed it, and only talks to Lexari over
# HTTPS: it asks for commands (install, start, stop, status, uninstall) and reports how the miner is doing.
# Nothing else is ever run. Remove it any time: python3 ~/.lexari-miner/agent.py --uninstall
import json, os, platform, signal, socket, subprocess, sys, time, urllib.request

D = os.path.dirname(os.path.abspath(__file__))
TOKEN = open(os.path.join(D, "token")).read().strip()
ORIGIN = open(os.path.join(D, "origin")).read().strip()
STATE = os.path.join(D, "state.json")
PIDF = os.path.join(D, "miner.pid")
MINER = os.path.join(D, "miner.py")
STARTED = time.time()

MINER_SRC = r'''
# Lexari practice miner (devnet). ORE mining itself is on Solana mainnet; this hashes keccak (sha3-256) proofs the
# way the classic ORE CPU miner did, so you can see your server's real hashrate and best difficulty.
import hashlib, json, multiprocessing as mp, os, sys, time
D = os.path.dirname(os.path.abspath(__file__))
def lz(b):
    n = 0
    for x in b:
        if x == 0: n += 8; continue
        n += 8 - x.bit_length(); break
    return n
def work(i, counter, best, stop):
    seed = os.urandom(16) + bytes([i])
    nonce = 0
    while not stop.is_set():
        local = 0
        for _ in range(20000):
            d = lz(hashlib.sha3_256(seed + nonce.to_bytes(8, "little")).digest())
            if d > best.value:
                with best.get_lock():
                    if d > best.value: best.value = d
            nonce += 1; local += 1
        with counter.get_lock(): counter.value += local
if __name__ == "__main__":
    threads = max(1, min(int(sys.argv[1]) if len(sys.argv) > 1 else 1, os.cpu_count() or 1))
    counter, best, stop = mp.Value("Q", 0), mp.Value("i", 0), mp.Event()
    ps = [mp.Process(target=work, args=(i, counter, best, stop), daemon=True) for i in range(threads)]
    for p in ps: p.start()
    t0 = time.time(); last, lt = 0, t0
    try:
        while True:
            time.sleep(5)
            now, c = time.time(), counter.value
            rate = (c - last) / (now - lt); last, lt = c, now
            tmp = os.path.join(D, "state.tmp")
            with open(tmp, "w") as f: json.dump({"threads": threads, "hashes": c, "hashrate": round(rate), "best": best.value, "since": t0, "at": now}, f)
            os.replace(tmp, os.path.join(D, "state.json"))
    except KeyboardInterrupt:
        stop.set()
'''

def pid():
    try:
        p = int(open(PIDF).read().strip())
        os.kill(p, 0)
        return p
    except Exception:
        return None

def report():
    st = {}
    try: st = json.load(open(STATE))
    except Exception: pass
    running = pid() is not None
    try: load = os.getloadavg()[0]
    except Exception: load = None
    return {"host": socket.gethostname()[:60], "os": (platform.system() + " " + platform.release())[:60], "arch": platform.machine(), "cpus": os.cpu_count(),
            "python": platform.python_version(), "installed": os.path.exists(MINER), "running": running, "load": load, "agentUptime": int(time.time() - STARTED),
            "threads": st.get("threads") if running else 0, "hashrate": st.get("hashrate", 0) if running else 0, "hashes": st.get("hashes", 0), "best": st.get("best", 0),
            "minerSince": st.get("since") if running else None, "mode": "practice"}

def stop():
    p = pid()
    if not p: return "The miner wasn't running."
    try: os.killpg(p, signal.SIGTERM)
    except Exception:
        try: os.kill(p, signal.SIGTERM)
        except Exception: pass
    for _ in range(20):
        if pid() is None: break
        time.sleep(0.2)
    try: os.remove(PIDF)
    except Exception: pass
    return "Stopped the miner."

def run(cmd, args):
    if cmd == "install":
        with open(MINER, "w") as f: f.write(MINER_SRC)
        return "Installed the miner (Python " + platform.python_version() + ", " + str(os.cpu_count()) + " CPUs)."
    if cmd == "start":
        if not os.path.exists(MINER): run("install", {})
        if pid(): return "The miner is already running."
        n = int(args.get("threads") or max(1, (os.cpu_count() or 2) // 2))
        n = max(1, min(n, os.cpu_count() or 1))
        try: os.remove(STATE)
        except Exception: pass
        log = open(os.path.join(D, "miner.log"), "a")
        p = subprocess.Popen([sys.executable, MINER, str(n)], cwd=D, stdout=log, stderr=log, start_new_session=True)
        open(PIDF, "w").write(str(p.pid))
        return "Started the miner on " + str(n) + " thread" + ("" if n == 1 else "s") + "."
    if cmd == "stop": return stop()
    if cmd == "status": return "OK"
    if cmd == "uninstall":
        stop()
        uninstall()
        return "Removed."
    return "Unknown command."

def uninstall():
    try:
        cur = subprocess.run(["crontab", "-l"], capture_output=True, text=True).stdout
        keep = "".join(l + "\n" for l in cur.splitlines() if "lexari-miner" not in l)
        subprocess.run(["crontab", "-"], input=keep, text=True)
    except Exception: pass
    import shutil
    shutil.rmtree(D, ignore_errors=True)

def post(body):
    req = urllib.request.Request(ORIGIN + "/api/miner/agent", data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + TOKEN, "user-agent": "lexari-miner/1"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode() or "{}")

def main():
    if "--uninstall" in sys.argv:
        stop(); uninstall(); print("Lexari miner removed."); return
    results, wait = [], 2
    while True:
        try:
            res = post({"results": results, "report": report()})
            results = []
            if res.get("revoked"):
                stop(); uninstall(); return
            for c in res.get("commands", []):
                try: out, ok = run(c.get("cmd"), c.get("args") or {}), True
                except Exception as e: out, ok = str(e)[:300], False
                results.append({"id": c.get("id"), "ok": ok, "output": out})
                if c.get("cmd") == "uninstall":
                    try: post({"results": results, "report": {"removed": True}})
                    except Exception: pass
                    return
            wait = 1 if results else int(res.get("interval") or 10)
        except Exception as e:
            sys.stderr.write(time.strftime("%H:%M:%S ") + "lexari: " + str(e)[:200] + "\n"); sys.stderr.flush()
            wait = min(60, wait * 2)
        time.sleep(wait)

if __name__ == "__main__":
    main()
