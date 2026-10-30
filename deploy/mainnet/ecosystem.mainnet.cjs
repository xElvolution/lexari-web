// pm2 config for Lexari MAINNET (mainnet.lexari.ai). Started by root's pm2 daemon; runs as user "lexarimain".
// gid is "lexariweb" because pm2 drops supplementary groups, and the shared Grok relay socket /run/lexari-grok is group lexariweb.
// Separate from the testnet apps (lexari-webapp :3211, lexari-landing :3210), which this file never names.
module.exports = {
  apps: [
    {
      name: "lexari-mainnet-webapp",
      cwd: "/opt/lexari-mainnet/current/webapp",
      script: "/opt/lexari-mainnet/current/node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3212",
      uid: "lexarimain",
      gid: "lexariweb",
      env: { NODE_ENV: "production", HOME: "/home/lexarimain", LEXARI_NETWORK: "mainnet" },
      max_memory_restart: "900M",
    },
  ],
};
