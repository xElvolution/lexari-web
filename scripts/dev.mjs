import { spawn } from "node:child_process";

const script = process.argv[2] || "dev";
const kids = ["landing", "webapp"].map((name) =>
  spawn("npm", ["run", script, "-w", name], { stdio: "inherit" }),
);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const kid of kids) kid.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

let pending = kids.length;
for (const kid of kids) {
  kid.on("exit", (code) => {
    if (!stopping && code) stop();
    if (--pending === 0) process.exit(code && !stopping ? code : 0);
  });
}
