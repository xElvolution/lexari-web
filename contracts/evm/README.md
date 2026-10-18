# Lexari EVM contracts

Foundry project with OpenZeppelin 5.4. Deployable to Monad testnet (10143) today and to Monad mainnet (143), Base,
Arbitrum, Ethereum or any EVM chain later with the same bytecode (solc 0.8.28, `evm_version = cancun`, no metadata
hash). Deployed and verified on Monad testnet (see below). Before the deploy, a full simulation of `script/Deploy.s.sol` against the live Monad testnet
RPC (no broadcast, no key) succeeds and uses 9,884,418 gas for all three contracts plus configuration.

## Why these three contracts

Lexari agents already have an identity (an ID card on Solana, `contracts/solana`), wallets the server signs for, a
spend limit on every Confirm card, and a skills catalog. The EVM side needs the same three things to be verifiable on
chain, and nothing more:

| Contract | What it is for | Why it is needed |
| --- | --- | --- |
| `LexariAgentRegistry` | ERC-721 identity per agent: owner, the agent's operating wallet, metadata URI, personality hash, Engram memory root | One public answer to "which wallet is this agent, and who owns it". Other contracts (the vault, the skills registry, third-party SDK apps) check it. Only commitments go on chain: never memory text, personality text or keys. |
| `LexariSpendVault` | Holds funds per agent; the agent's wallet can spend only within per-transaction and daily limits per token, an optional recipient allowlist and a freeze switch, all set by the owner | Today the limits live in Lexari's database and are enforced by the server. The vault makes them enforced by the chain, so even a compromised server key cannot move more than the owner allowed in a day. The owner can always withdraw, even while paused. |
| `LexariSkillRegistry` | Skills marketplace for the SDK: creators publish versioned skills (content hash and URI), set a price and a revenue split among up to 8 payees; agents install by paying; a protocol fee (capped at 30% in code) goes to the treasury | Creator revenue share has to be trustless for third-party creators. Pull payments mean one payee that cannot receive never blocks an install. |

Left out on purpose: an onchain memory store (memory is private and large, so only the root is committed), a Lexari
token (no product need yet), and upgradeable proxies (simpler to audit; a new version is a new deployment, and the
registry is the stable point other contracts read).


## Deployments

### Monad testnet (chain 10143)

Deployed 2026-10-18 with `script/Deploy.s.sol`. Full record: [`deployments/monad-testnet.json`](deployments/monad-testnet.json).

| Contract | Address | Deploy tx | Verification |
| --- | --- | --- | --- |
| `LexariAgentRegistry` | [`0xaC1B6ac569EE1FDF7337AF14f6456E4cC1c6A100`](https://testnet.monadexplorer.com/address/0xaC1B6ac569EE1FDF7337AF14f6456E4cC1c6A100) | [tx](https://testnet.monadexplorer.com/tx/0xa3c5b653fd7304b9c9382fd5e9aa6b8f714d1065e0ccc07c7b73ca884100bd5c) | Sourcify: match |
| `LexariSpendVault` | [`0x2F56499a336151B5dfa797a9B3936057a415bbe5`](https://testnet.monadexplorer.com/address/0x2F56499a336151B5dfa797a9B3936057a415bbe5) | [tx](https://testnet.monadexplorer.com/tx/0xfc8788e06a28c7e7030233c3dfe93f38c7b499c1ce92cdd7d161d312fc6c0a73) | Sourcify: match |
| `LexariSkillRegistry` | [`0x60f6a4E89946f52A88e745991B2D93DCF8ac3Fc1`](https://testnet.monadexplorer.com/address/0x60f6a4E89946f52A88e745991B2D93DCF8ac3Fc1) | [tx](https://testnet.monadexplorer.com/tx/0x4e867e0a9bb8e3a0330f8de70506c2f2926b8587f0e5f1b42e21d2e67f8ed4a6) | Sourcify: match |

Smoke tests (all succeeded and were read back): register agent #1
([tx](https://testnet.monadexplorer.com/tx/0x3fa9f58b3e2cfddceaa6d0090b4efdc348278f3cf9d8c0f3400691b01c2ea38f)), set a native vault policy for agent #1
([tx](https://testnet.monadexplorer.com/tx/0x6fbdd42716f3ecee04d1e1a13d43da78b9844945def13b36f44e7d7db7df6dd5)), publish skill #1
([tx](https://testnet.monadexplorer.com/tx/0x52cb01facf5aa9a9a2dc3ec38b2267e209537c81b87ec7454c66af3ec7351489)).

**Testnet roles:** `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `REGISTRAR_ROLE`, `CURATOR_ROLE` and the treasury all sit on the
deployer `0x4df6f4B18558D583Ef4a3652305AEA57dFE723C2`. There is no Safe yet and nothing was renounced, so the contracts stay manageable. The
"deployer keeps no power" handover applies only when `LEXARI_ADMIN` is a different address, which is required for mainnet.

## Security model

- **Access control**: OpenZeppelin `AccessControl`. Roles: `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE` (all three),
  `REGISTRAR_ROLE` (registry: register on someone's behalf for the sponsored mint), `CURATOR_ROLE` (skills: delist).
  Owners of agents act through the registry, not through roles.
- **Pausable**: pausing stops registration, updates, transfers, deposits, spends, publishing and installs. Withdrawals
  from the vault and revenue claims keep working, so a pause never traps funds.
- **Reentrancy**: `nonReentrant` on every function that moves value; state is written before external calls.
- **Tokens**: `SafeERC20`. The vault credits what actually arrived (fee-on-transfer safe). The skills registry only
  accepts payment tokens the admin allowlisted.
- **Non-transferable agents by default**: an agent's wallet and memory are personal. The admin can enable transfers;
  when enabled, the new owner controls the agent and its vault balance.
- **Retiring** unbinds the wallet (it can never spend again) but keeps the token, so the owner can still withdraw.
- **Deployer keeps no power**: the deploy script grants every role to `LEXARI_ADMIN` and the deployer renounces its own.

## Layout

```
src/LexariAgentRegistry.sol    src/LexariSpendVault.sol    src/LexariSkillRegistry.sol
src/interfaces/ILexariAgentRegistry.sol
test/*.t.sol                   unit, fuzz (1 024 runs; 10 000 with FOUNDRY_PROFILE=ci) and an invariant suite
script/Deploy.s.sol            one script, configured per network
deployments/config/<network>.json   chain id, protocol fee, payment tokens per network
gas-report.txt  slither-report.txt
```

## Build and test

```
cd contracts/evm
npm ci                 # OpenZeppelin 5.4.0 and forge-std 1.10.0 (no git submodules)
forge build
forge test             # 51 tests: unit, fuzz, invariant, deploy script
forge test --gas-report
FOUNDRY_PROFILE=ci forge test   # heavier fuzzing
```

Invariants checked under random call sequences (128 000 calls per run): the vault always holds exactly what it owes
agents, and the vault's daily counter always matches what was actually spent that UTC day.

Slither 0.11 (`slither . --filter-paths "node_modules|test|script"`): no high or medium findings. Remaining notes are
expected by design and listed in `slither-report.txt`: native sends to the owner or recipient chosen by the owner
(`arbitrary-send-eth`, guarded by ownership and limits), UTC-day comparisons on `block.timestamp` (day granularity, so
validator drift is irrelevant), and the existence check `registry.agentOwner(id)` whose return value is ignored on
purpose.

## Deploy (not done yet)

No private key is read from env or stored anywhere. The broadcaster comes from the forge CLI: an encrypted keystore
(`cast wallet import lexari-deployer --interactive`), `--ledger` or `--trezor`.

```
export NETWORK=monad-testnet            # a file in deployments/config/
export LEXARI_ADMIN=0x...               # multisig on mainnet; receives every role
export LEXARI_TREASURY=0x...            # receives protocol fees
export MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz

# dry run (simulation only)
forge script script/Deploy.s.sol --rpc-url monad_testnet --sender 0xYourDeployer
# real deploy, later, once approved
forge script script/Deploy.s.sol --rpc-url monad_testnet --account lexari-deployer --broadcast --verify
```

The script stops if the RPC's chain id differs from the config file, so a mainnet config cannot land on a testnet (or
the reverse). Networks with a config today: `monad-testnet`, `monad`, `base-sepolia`, `base`, `arbitrum`,
`ethereum`. A new chain is one JSON file plus an `[rpc_endpoints]` line in `foundry.toml`.

## Open decisions

1. **Admin**: which multisig (Safe) holds `DEFAULT_ADMIN_ROLE` and `PAUSER_ROLE` on each mainnet.
2. **Protocol fee**: configs start at 10% (`protocolFeeBps: 1000`); the code caps it at 30%.
3. **Agent transfers**: off by default. Turn on only if agents become tradeable.
4. **Vault adoption**: moving agent funds into the vault changes how the server signs payments (it would call
   `spend` instead of a plain transfer). That is a custody change and is written up as a proposal in
   `docs/MAINNET.md`, not implemented here.
5. **Audit** before any mainnet deployment.
