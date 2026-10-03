import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lexari } from "../target/types/lexari";
import { expect } from "chai";

describe("lexari", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Lexari as Program<Lexari>;
  const owner = provider.wallet.publicKey;
  const asset = anchor.web3.Keypair.generate().publicKey;
  const [agent] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.toBuffer(), asset.toBuffer()],
    program.programId,
  );

  const hashOf = (n: number) => {
    const h = Buffer.alloc(32);
    h[0] = n;
    return Array.from(h);
  };
  const memoryPda = (hash: number[]) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("memory"), agent.toBuffer(), Buffer.from(hash)],
      program.programId,
    )[0];

  it("registers an agent against a Core asset", async () => {
    await program.methods
      .registerAgent(asset, "Juniper", "Personal agent", "shape=round;color=purple")
      .accounts({ owner, agent, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
    const row = await program.account.agent.fetch(agent);
    expect(row.name).to.equal("Juniper");
    expect(row.role).to.equal("Personal agent");
    expect(row.asset.toBase58()).to.equal(asset.toBase58());
    expect(row.owner.toBase58()).to.equal(owner.toBase58());
  });

  it("rejects an empty name", async () => {
    const other = anchor.web3.Keypair.generate().publicKey;
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), owner.toBuffer(), other.toBuffer()],
      program.programId,
    );
    try {
      await program.methods
        .registerAgent(other, "", "role", "dna")
        .accounts({ owner, agent: pda, systemProgram: anchor.web3.SystemProgram.programId })
        .rpc();
      expect.fail("empty name should fail");
    } catch (e) {
      expect(String(e)).to.match(/Name is empty|BadName|0x1770|Error/);
    }
  });

  it("lets the owner update the card fields", async () => {
    await program.methods
      .updateAgent("June", "Home agent", "shape=round;color=blue")
      .accounts({ owner, agent })
      .rpc();
    const row = await program.account.agent.fetch(agent);
    expect(row.name).to.equal("June");
    expect(row.dna).to.equal("shape=round;color=blue");
  });

  it("refuses an update from someone else", async () => {
    const stranger = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(stranger.publicKey, 1_000_000_000);
    await provider.connection.confirmTransaction(sig);
    try {
      await program.methods
        .updateAgent("Stolen", "Nope", "dna")
        .accounts({ owner: stranger.publicKey, agent })
        .signers([stranger])
        .rpc();
      expect.fail("stranger should not update");
    } catch (e) {
      expect(String(e)).to.match(/ConstraintHasOne|has_one|Error/);
    }
  });

  it("writes, revokes, and deletes a memory", async () => {
    const hash = hashOf(7);
    const memory = memoryPda(hash);
    await program.methods
      .writeMemory(hash, "https://arweave.net/example")
      .accounts({ owner, agent, memory, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
    let row = await program.account.memory.fetch(memory);
    expect(row.uri).to.equal("https://arweave.net/example");
    expect(row.revoked).to.equal(false);

    await program.methods.revokeMemory().accounts({ owner, memory }).rpc();
    row = await program.account.memory.fetch(memory);
    expect(row.revoked).to.equal(true);

    await program.methods.deleteMemory().accounts({ owner, memory }).rpc();
    const info = await provider.connection.getAccountInfo(memory);
    expect(info).to.equal(null);
  });

  it("can write the same hash again after a delete", async () => {
    const hash = hashOf(7);
    const memory = memoryPda(hash);
    await program.methods
      .writeMemory(hash, "")
      .accounts({ owner, agent, memory, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();
    const row = await program.account.memory.fetch(memory);
    expect(row.uri).to.equal("");
    await program.methods.deleteMemory().accounts({ owner, memory }).rpc();
  });
});
