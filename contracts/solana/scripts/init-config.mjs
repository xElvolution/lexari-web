import { readFileSync } from "node:fs";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

// One-time devnet setup. Uses ANCHOR_PROVIDER_URL, ANCHOR_WALLET, and LEXARI_ATTESTOR_KEY.
const raw = process.env.LEXARI_ATTESTOR_KEY;
if (!raw) {
  console.error("LEXARI_ATTESTOR_KEY is not set");
  process.exit(1);
}
const secret = raw.trim().startsWith("[")
  ? Uint8Array.from(JSON.parse(raw))
  : null;
if (!secret) {
  console.error("LEXARI_ATTESTOR_KEY must be a JSON byte array");
  process.exit(1);
}
const attestor = Keypair.fromSecretKey(secret);
const idl = JSON.parse(readFileSync(new URL("../target/idl/lexari.json", import.meta.url), "utf8"));
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
const loader = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const [programData] = PublicKey.findProgramAddressSync([program.programId.toBuffer()], loader);

const existing = await provider.connection.getAccountInfo(config);
if (existing) {
  const row = await program.account.config.fetch(config);
  console.log("config already set", row.authority.toBase58());
  process.exit(0);
}

const sig = await program.methods
  .initConfig(attestor.publicKey)
  .accounts({
    payer: provider.wallet.publicKey,
    config,
    program: program.programId,
    programData,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();
console.log("init_config", sig);
console.log("attestor", attestor.publicKey.toBase58());
