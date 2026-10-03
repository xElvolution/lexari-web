#!/bin/bash
# End-to-end API tests: a real Next server (built into .next-test), Postgres (PGlite),
# and a local Solana validator running the Lexari program with mpl-core cloned from devnet.
# Needs: the Solana CLI, contracts/solana/target/deploy/lexari.so (run `npm test` in contracts/solana once),
# and network access to clone mpl-core. Usage: npm run test:api [-- --skip-build]
set -euo pipefail
app="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "${app}/.." && pwd)"
solana_bin="${HOME}/.local/share/solana/install/active_release/bin"
export PATH="${solana_bin}:${PATH}"
work="$(mktemp -d)"
pids=()
cleanup() {
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "${work}"
}
trap cleanup EXIT

db_port=$((20000 + RANDOM % 20000)); rpc_port=$((db_port + 1)); app_port=$((db_port + 3))
program_id="BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po"
so="${root}/contracts/solana/target/deploy/lexari.so"
[ -f "${so}" ] || { echo "missing ${so}; build the program first (cd contracts/solana && npm test)" >&2; exit 1; }

# Keys for this run only.
solana-keygen new --no-bip39-passphrase --silent -o "${work}/authority.json" >/dev/null
solana-keygen new --no-bip39-passphrase --silent -o "${work}/attestor.json" >/dev/null
treasury="$(solana-keygen new --no-bip39-passphrase --silent -o "${work}/treasury.json" >/dev/null && solana-keygen pubkey "${work}/treasury.json")"

node "${root}/node_modules/@electric-sql/pglite-socket/dist/scripts/server.js" -p "${db_port}" -m 4 >"${work}/db.log" 2>&1 & pids+=($!)
solana-test-validator --reset --quiet --ledger "${work}/ledger" --rpc-port "${rpc_port}" --faucet-port $((rpc_port + 1000)) \
  --mint "$(solana-keygen pubkey "${work}/authority.json")" \
  --upgradeable-program "${program_id}" "${so}" "${work}/authority.json" \
  --url "${CLONE_RPC:-https://api.devnet.solana.com}" --clone-upgradeable-program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d \
  >"${work}/validator.log" 2>&1 & pids+=($!)

export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${db_port}/postgres"
export SOLANA_RPC="http://127.0.0.1:${rpc_port}"
for _ in $(seq 1 120); do solana cluster-version -u "${SOLANA_RPC}" >/dev/null 2>&1 && break; sleep 0.5; done
solana cluster-version -u "${SOLANA_RPC}" >/dev/null || { tail -30 "${work}/validator.log" >&2; exit 1; }
for _ in $(seq 1 60); do (echo > "/dev/tcp/127.0.0.1/${db_port}") 2>/dev/null && break; sleep 0.5; done
(echo > "/dev/tcp/127.0.0.1/${db_port}") 2>/dev/null || { cat "${work}/db.log" >&2; exit 1; }
(cd "${app}" && node server/db/migrate.mjs)

(cd "${root}/contracts/solana" && ANCHOR_PROVIDER_URL="${SOLANA_RPC}" ANCHOR_WALLET="${work}/authority.json" \
  LEXARI_ATTESTOR_KEY="$(cat "${work}/attestor.json")" node scripts/init-config.mjs)

# Fake model: the grok CLI's stream format, deterministic text.
mkdir -p "${work}/grok/.grok" && echo '{}' > "${work}/grok/.grok/auth.json"
cat > "${work}/fake-grok" <<'G'
#!/bin/sh
echo '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi from "}}}'
echo '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"the test model."}}}'
echo '{"type":"result","is_error":false}'
G
chmod +x "${work}/fake-grok"

cd "${app}"
if [ "${1:-}" != "--skip-build" ]; then
  NEXT_DIST_DIR=.next-test NEXT_PUBLIC_SOLANA_CLUSTER=devnet NEXT_PUBLIC_HIRE_LAMPORTS=10000000 npx next build >"${work}/build.log" 2>&1 || { tail -40 "${work}/build.log" >&2; exit 1; }
fi
NEXT_DIST_DIR=.next-test SESSION_SECRET="$(head -c 32 /dev/urandom | base64)" LEXARI_APP_ORIGIN="http://127.0.0.1:${app_port}" \
  LEXARI_ATTESTOR_KEY="$(cat "${work}/attestor.json")" LEXARI_TREASURY="${treasury}" \
  LLM_PROVIDER=grok-cli GROK_CLI_BIN="${work}/fake-grok" GROK_CLI_HOME="${work}/grok" CHAT_PER_MINUTE=6 \
  npx next start -p "${app_port}" -H 127.0.0.1 >"${work}/next.log" 2>&1 & pids+=($!)
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:${app_port}/api/health" >/dev/null && break; sleep 0.5; done

status=0
API_BASE="http://127.0.0.1:${app_port}" SOLANA_RPC="${SOLANA_RPC}" LEXARI_TREASURY="${treasury}" \
  npx tsx --test --test-concurrency=1 tests/api.e2e.test.ts || status=$?
if [ "${status}" -ne 0 ]; then echo "--- server log ---" >&2; tail -60 "${work}/next.log" >&2; fi
exit "${status}"
