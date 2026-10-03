# Contracts

The app mints on Solana. `solana/` is an Anchor program: an agent registry and memory records. The ID card itself is a Metaplex Core NFT, so the owner can update its metadata. Memories store a content hash and a link to the ciphertext. The owner can close a memory account.

```sh
bash contracts/solana/scripts/test.sh
```

That script builds the program with Solana platform tools v1.52. A plain `anchor test` on the Solana 1.18 CLI fails, because its older Cargo cannot read current crates.

The Foundry project below is the earlier Arbitrum Sepolia card. The web app no longer calls it.

## Earlier Arbitrum card

ERC-721 + ERC-4906 on Arbitrum Sepolia. Every card is stored and drawn onchain:
name, role, face DNA, the face SVG fragment (rendered by the web app's `Face` from the DNA) and a
background index into `LexariBackgrounds` (generated from `../shared/lib/backgrounds.json`).
`tokenURI` returns base64 JSON with a base64 SVG ID card. Owners can `updateFace` / `updateCard`;
both emit `MetadataUpdate` so marketplaces refresh.

```sh
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0   # deps (lib/ is git-ignored)
node script/gen-backgrounds.mjs                                     # regenerate backgrounds contract
forge test
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --private-key $DEPLOYER_KEY
```

After deploying, build the web app with `NEXT_PUBLIC_LXID_ADDRESS=<LexariAgentCard address>`.
