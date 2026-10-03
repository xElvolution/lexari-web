// pm2 config for Lexari. Started by root's pm2 daemon, processes run as user "lexariweb".
// Runs whatever release /opt/lexari-web/current points to (see deploy.sh).
const ROOT = "/opt/lexari-web/current";
const app = (name, dir, port, mem) => ({
  name,
  cwd: `${ROOT}/${dir}`,
  script: `${ROOT}/node_modules/next/dist/bin/next`,
  args: `start -H 127.0.0.1 -p ${port}`,
  uid: "lexariweb",
  gid: "lexariweb",
  env: { NODE_ENV: "production", HOME: "/home/lexariweb" },
  max_memory_restart: mem,
  kill_timeout: 5000,
});
module.exports = { apps: [app("lexari-landing", "landing", 3210, "700M"), app("lexari-webapp", "webapp", 3211, "900M")] };
