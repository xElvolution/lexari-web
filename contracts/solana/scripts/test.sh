#!/bin/bash
# Builds SBPF v0 (--arch v0), the bytecode every cluster accepts today.
#
# Tests mint and transfer real Metaplex Core assets, so the validator clones
# the mpl-core program from devnet (needs network).
#
# `anchor test` loads the program with --bpf-program, which sets the upgrade
# authority to the zero pubkey. init_config requires the real upgrade
# authority, so this script builds, then boots an upgradeable local validator.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
solana_bin="${HOME}/.local/share/solana/install/active_release/bin"
real="${solana_bin}/cargo-build-sbf"
wrap="$(mktemp -d)"
ledger="$(mktemp -d)"
cat > "${wrap}/cargo-build-sbf" << EOF
#!/bin/bash
if [ "\${1:-}" = "build-sbf" ]; then shift; fi
exec "${real}" --arch v0 "\$@"
EOF
chmod +x "${wrap}/cargo-build-sbf"
export PATH="${wrap}:${solana_bin}:${HOME}/.cargo/bin:${PATH}"

validator_pid=""
cleanup() {
  if [ -n "${validator_pid}" ]; then
    kill "${validator_pid}" 2>/dev/null || true
    wait "${validator_pid}" 2>/dev/null || true
  fi
  rm -rf "${wrap}" "${ledger}"
}
trap cleanup EXIT

cd "${root}"
anchor build

wallet="${ANCHOR_WALLET:-${HOME}/.config/solana/id.json}"
mint="$(solana-keygen pubkey "${wallet}")"
program_id="BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po"
so="${root}/target/deploy/lexari.so"

solana-test-validator \
  --reset \
  --quiet \
  --ledger "${ledger}" \
  --mint "${mint}" \
  --upgradeable-program "${program_id}" "${so}" "${wallet}" \
  --url "${CLONE_RPC:-https://api.devnet.solana.com}" \
  --clone-upgradeable-program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d \
  >"${ledger}/validator.log" 2>&1 &
validator_pid=$!

ready=0
for _ in $(seq 1 60); do
  if solana cluster-version -u localhost >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "${validator_pid}" 2>/dev/null; then
    echo "validator exited before RPC was ready" >&2
    tail -40 "${ledger}/validator.log" >&2
    exit 1
  fi
  sleep 0.5
done
if [ "${ready}" -ne 1 ]; then
  echo "validator RPC did not come up" >&2
  tail -40 "${ledger}/validator.log" >&2
  exit 1
fi

export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
export ANCHOR_WALLET="${wallet}"
npx ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
