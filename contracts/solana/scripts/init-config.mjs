import { readFileSync } from "node:fs";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";

// Sets (or rotates) the hub attestor. Run by the program upgrade authority.
// Env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET, and LEXARI_ATTESTOR_PUBKEY or LEXARI_ATTESTOR_KEY (JSON bytes or base58).
function attestorPubkey() {
  const pub = process.env.LEXARI_ATTESTOR_PUBKEY?.trim();
  if (pub) return new PublicKey(pub);
  const raw = process.env.LEXARI_ATTESTOR_KEY?.trim();
  if (!raw) throw new Error("Set LEXARI_ATTESTOR_PUBKEY or LEXARI_ATTESTOR_KEY");
  const secret = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  return Keypair.fromSecretKey(secret).publicKey;
}

const attestor = attestorPubkey();
const idl = JSON.parse(readFileSync(new URL("../idl/lexari.json", import.meta.url), "utf8"));
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
const loader = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const [programData] = PublicKey.findProgramAddressSync([program.programId.toBuffer()], loader);

const existing = await provider.connection.getAccountInfo(config);
if (existing) {
  const row = await program.account.config.fetch(config);
  if (row.authority.equals(attestor)) {
    console.log("config already set to", attestor.toBase58());
    process.exit(0);
  }
  const sig = await program.methods
    .updateConfig(attestor)
    .accounts({ authority: provider.wallet.publicKey, config, program: program.programId, programData })
    .rpc();
  console.log("update_config", sig, "attestor", attestor.toBase58());
  process.exit(0);
}

const sig = await program.methods
  .initConfig(attestor)
  .accounts({ payer: provider.wallet.publicKey, config, program: program.programId, programData, systemProgram: anchor.web3.SystemProgram.programId })
  .rpc();
console.log("init_config", sig, "attestor", attestor.toBase58());
