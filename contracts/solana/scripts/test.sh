#!/bin/bash
# Anchor 0.30's default platform tools (v1.41) cannot read current crates.
# The on-chain build uses platform tools v1.52.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
real="${HOME}/.local/share/solana/install/active_release/bin/cargo-build-sbf"
wrap="$(mktemp -d)"
cat > "${wrap}/cargo-build-sbf" << EOF
#!/bin/bash
if [ "\${1:-}" = "build-sbf" ]; then shift; fi
exec "${real}" --tools-version v1.52 "\$@"
EOF
chmod +x "${wrap}/cargo-build-sbf"
export PATH="${wrap}:${HOME}/.local/share/solana/install/active_release/bin:${HOME}/.cargo/bin:${PATH}"
trap 'rm -rf "${wrap}"' EXIT
cd "${root}"
anchor test
