#!/usr/bin/env bash
# Deploys the Lexari program to Solana MAINNET-BETA, sets the Hub attestor, then hands the upgrade authority to the
# owner's multisig. REAL SOL, IRREVERSIBLE PROGRAM ID USE. Prepared, never run by an agent: the owner runs it.
#
#   SOLANA_DEPLOYER_KEY      funded mainnet deployer secret key (JSON array or base58); temporary upgrade authority
#   LEXARI_ATTESTOR_PUBKEY   the NEW mainnet attestor public key (or LEXARI_ATTESTOR_KEY); never the testnet one
#   UPGRADE_AUTHORITY        the multisig (Squads vault) that owns upgrades after the deploy
#   PROGRAM_KEYPAIR          program id keypair (default ~/.lexari-keys/program-keypair.json) for BbnD28...M6Po
#   SOLANA_RPC               a mainnet RPC (Helius recommended); default the public endpoint
#   CONFIRM_MAINNET=yes      required; anything else stops before spending
#
# Cost (measured 30 Oct 2026): the program data account is 413,165 bytes = 2.0995 SOL rent (kept while the program
# exists), plus about 0.01 SOL of fees. The script requires 2.5 SOL on the deployer. Rent comes back only if the
# program is closed.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH
RPC=${SOLANA_RPC:-https://api.mainnet-beta.solana.com}
PROGRAM_KEYPAIR=${PROGRAM_KEYPAIR:-$HOME/.lexari-keys/program-keypair.json}
SO=target/deploy/lexari.so
[ "${CONFIRM_MAINNET:-}" = "yes" ] || { echo "Set CONFIRM_MAINNET=yes to deploy to MAINNET with real SOL."; exit 1; }
[ -f "$SO" ] || { echo "build first: anchor build --verifiable (missing $SO)"; exit 1; }
[ -n "${SOLANA_DEPLOYER_KEY:-}" ] || { echo "SOLANA_DEPLOYER_KEY is not set"; exit 1; }
[ -n "${UPGRADE_AUTHORITY:-}" ] || { echo "UPGRADE_AUTHORITY (multisig) is not set"; exit 1; }
genesis=$(curl -s "$RPC" -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getGenesisHash"}' | sed -E 's/.*"result":"([^"]+)".*/\1/')
[ "$genesis" = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d" ] || { echo "RPC is not mainnet-beta"; exit 1; }
TMP=$(mktemp -d); chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
node -e '
const bs58 = require("bs58"); const r = process.env.SOLANA_DEPLOYER_KEY.trim();
let b; try { b = r.startsWith("[") ? Uint8Array.from(JSON.parse(r)) : (bs58.default || bs58).decode(r); } catch { console.error("SOLANA_DEPLOYER_KEY is not a JSON array or base58 key"); process.exit(1); }
if (b.length !== 64) { console.error("SOLANA_DEPLOYER_KEY must be a 64-byte secret key"); process.exit(1); }
require("fs").writeFileSync(process.argv[1], JSON.stringify(Array.from(b)), { mode: 0o600 });' "$TMP/deployer.json"
DEPLOYER=$(solana-keygen pubkey "$TMP/deployer.json")
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "deployer  $DEPLOYER"; echo "program   $PROGRAM_ID"; echo "authority $UPGRADE_AUTHORITY (after deploy)"
BAL=$(solana balance -u "$RPC" "$DEPLOYER" | awk '{print $1}')
echo "balance   $BAL SOL"
awk -v b="$BAL" 'BEGIN{exit !(b >= 2.5)}' || { echo "needs at least 2.5 SOL on mainnet"; exit 1; }
solana program deploy -u "$RPC" --keypair "$TMP/deployer.json" --program-id "$PROGRAM_KEYPAIR" --upgrade-authority "$TMP/deployer.json" --with-compute-unit-price 50000 "$SO"
ANCHOR_PROVIDER_URL=$RPC ANCHOR_WALLET=$TMP/deployer.json node scripts/init-config.mjs
solana program set-upgrade-authority -u "$RPC" --keypair "$TMP/deployer.json" --upgrade-authority "$TMP/deployer.json" --new-upgrade-authority "$UPGRADE_AUTHORITY" --skip-new-upgrade-authority-signer-check "$PROGRAM_ID"
echo "done. Set NEXT_PUBLIC_LEXARI_PROGRAM_ID=$PROGRAM_ID and the mainnet LEXARI_ATTESTOR_KEY in /opt/lexari-mainnet/shared/webapp.env, redeploy, then check https://mainnet.lexari.ai/api/health (program and attestor true)."
