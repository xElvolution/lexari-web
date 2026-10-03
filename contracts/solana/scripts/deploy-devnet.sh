#!/usr/bin/env bash
# Deploys the Lexari program to devnet and sets the Hub attestor.
#   SOLANA_DEPLOYER_KEY  deployer secret key (JSON array or base58). Becomes the upgrade authority. Needs ~2.2 SOL.
#   LEXARI_ATTESTOR_PUBKEY or LEXARI_ATTESTOR_KEY  the attestor the server signs with.
#   PROGRAM_KEYPAIR      program id keypair (default ~/.lexari-keys/program-keypair.json)
# Keys are written to a private temp dir and removed on exit. Nothing is printed except public keys.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH
RPC=${SOLANA_RPC:-https://api.devnet.solana.com}
PROGRAM_KEYPAIR=${PROGRAM_KEYPAIR:-$HOME/.lexari-keys/program-keypair.json}
SO=target/deploy/lexari.so
[ -f "$SO" ] || { echo "build first: anchor build (missing $SO)"; exit 1; }
[ -n "${SOLANA_DEPLOYER_KEY:-}" ] || { echo "SOLANA_DEPLOYER_KEY is not set"; exit 1; }
TMP=$(mktemp -d); chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
node -e '
const bs58 = require("bs58"); const r = process.env.SOLANA_DEPLOYER_KEY.trim();
let b; try { b = r.startsWith("[") ? Uint8Array.from(JSON.parse(r)) : (bs58.default || bs58).decode(r); } catch { console.error("SOLANA_DEPLOYER_KEY is not a JSON array or base58 key"); process.exit(1); }
if (b.length !== 64) { console.error("SOLANA_DEPLOYER_KEY must be a 64-byte secret key"); process.exit(1); }
require("fs").writeFileSync(process.argv[1], JSON.stringify(Array.from(b)), { mode: 0o600 });' "$TMP/deployer.json"
DEPLOYER=$(solana-keygen pubkey "$TMP/deployer.json")
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "deployer $DEPLOYER"; echo "program  $PROGRAM_ID"
BAL=$(solana balance -u "$RPC" "$DEPLOYER" | awk '{print $1}')
echo "balance  $BAL SOL"
awk -v b="$BAL" 'BEGIN{exit !(b >= 2.2)}' || { echo "needs at least 2.2 devnet SOL (faucet.solana.com)"; exit 1; }
solana program deploy -u "$RPC" --keypair "$TMP/deployer.json" --program-id "$PROGRAM_KEYPAIR" --upgrade-authority "$TMP/deployer.json" "$SO"
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=$TMP/deployer.json node scripts/init-config.mjs
echo "done. Check https://app.lexari.ai/api/health: program and attestor should be true."
