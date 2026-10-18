# Contracts

Lexari on-chain programs live in two folders:

- [`solana/`](./solana/) — Anchor program (agent registry, memory records, Hub PDAs).
- [`evm/`](./evm/) — Foundry project (agent registry, spend-policy vault, skills registry). Source, tests and checked-in deployments only; it is not built or deployed by `/opt/lexari-web/deploy.sh`.
