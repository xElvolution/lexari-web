# Lexari Agent ID — onchain NFT

ERC-721 + ERC-4906 on Arbitrum Sepolia. Every card is stored and drawn onchain:
name, role, face DNA, the face SVG fragment (rendered by the web app's `Face` from the DNA) and a
background index into `LexariBackgrounds` (generated from `../src/lib/backgrounds.json`).
`tokenURI` returns base64 JSON with a base64 SVG ID card. Owners can `updateFace` / `updateCard`;
both emit `MetadataUpdate` so marketplaces refresh.

```sh
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0   # deps (lib/ is git-ignored)
node script/gen-backgrounds.mjs                                     # regenerate backgrounds contract
forge test
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --private-key $DEPLOYER_KEY
```

After deploying, build the web app with `NEXT_PUBLIC_LXID_ADDRESS=<LexariAgentCard address>`.
