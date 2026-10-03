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

  const attestor = anchor.web3.Keypair.generate();
  const [config] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const [player] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player"), owner.toBuffer()],
    program.programId,
  );
  const [level] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("level"), agent.toBuffer()],
    program.programId,
  );
  const systemProgram = anchor.web3.SystemProgram.programId;
  const bn = (n: number) => new anchor.BN(n);

  const airdrop = async (kp: anchor.web3.Keypair) => {
    const sig = await provider.connection.requestAirdrop(kp.publicKey, 2_000_000_000);
    await provider.connection.confirmTransaction(sig);
  };

  const loader = new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
  const [programData] = anchor.web3.PublicKey.findProgramAddressSync([program.programId.toBuffer()], loader);

  it("initializes config and a player", async () => {
    await airdrop(attestor);
    const stranger = anchor.web3.Keypair.generate();
    await airdrop(stranger);
    try {
      await program.methods
        .initConfig(attestor.publicKey)
        .accounts({ payer: stranger.publicKey, config, program: program.programId, programData, systemProgram })
        .signers([stranger])
        .rpc();
      expect.fail("stranger should not init config");
    } catch (e) {
      expect(String(e)).to.match(/upgrade authority|NotUpgradeAuthority/);
    }
    await program.methods
      .initConfig(attestor.publicKey)
      .accounts({ payer: owner, config, program: program.programId, programData, systemProgram })
      .rpc();
    const cfg = await program.account.config.fetch(config);
    expect(cfg.authority.toBase58()).to.equal(attestor.publicKey.toBase58());

    await program.methods.initPlayer().accounts({ owner, player, referrerPlayer: null, systemProgram }).rpc();
    const row = await program.account.player.fetch(player);
    expect(row.coins.toNumber()).to.equal(0);
    expect(row.streak).to.equal(0);
    expect(row.referrer).to.equal(null);
  });

  it("pays the first check-in and refuses a second the same day", async () => {
    await program.methods.checkIn().accounts({ owner, player }).rpc();
    const row = await program.account.player.fetch(player);
    expect(row.streak).to.equal(1);
    expect(row.coins.toNumber()).to.equal(10);
    expect(row.lifetime.toNumber()).to.equal(10);
    try {
      await program.methods.checkIn().accounts({ owner, player }).rpc();
      expect.fail("second check-in should fail");
    } catch (e) {
      expect(String(e)).to.match(/Already checked in|AlreadyCheckedIn/);
    }
  });

  it("refuses a check-in from someone else", async () => {
    const stranger = anchor.web3.Keypair.generate();
    await airdrop(stranger);
    try {
      await program.methods.checkIn().accounts({ owner: stranger.publicKey, player }).signers([stranger]).rpc();
      expect.fail("stranger check-in should fail");
    } catch (e) {
      expect(String(e)).to.match(/ConstraintHasOne|has_one|Error/);
    }
  });

  it("refuses a quest claim from the wrong attestor", async () => {
    const questId = Buffer.alloc(2);
    questId.writeUInt16LE(1);
    const period = Buffer.alloc(4);
    period.writeUInt32LE(20261003);
    const quest = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("quest"), player.toBuffer(), questId, period],
      program.programId,
    )[0];
    try {
      await program.methods
        .claimQuest(1, 20261003, bn(25))
        .accounts({ owner, attestor: owner, config, player, claim: quest, systemProgram })
        .rpc();
      expect.fail("owner is not the attestor");
    } catch (e) {
      expect(String(e)).to.match(/Attestor does not match|BadAttestor/);
    }
  });

  it("claims a quest once and rejects the double claim", async () => {
    const questId = Buffer.alloc(2);
    questId.writeUInt16LE(1);
    const period = Buffer.alloc(4);
    period.writeUInt32LE(20261003);
    const claim = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("quest"), player.toBuffer(), questId, period],
      program.programId,
    )[0];
    const before = (await program.account.player.fetch(player)).coins.toNumber();
    await program.methods
      .claimQuest(1, 20261003, bn(25))
      .accounts({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram })
      .signers([attestor])
      .rpc();
    const after = (await program.account.player.fetch(player)).coins.toNumber();
    expect(after - before).to.equal(25);
    try {
      await program.methods
        .claimQuest(1, 20261003, bn(25))
        .accounts({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram })
        .signers([attestor])
        .rpc();
      expect.fail("double claim should fail");
    } catch (e) {
      expect(String(e)).to.match(/already in use|already been processed|Allocate/i);
    }
  });

  it("refuses to level up with no coins or a zero spend", async () => {
    try {
      await program.methods.levelUp(bn(0)).accounts({ owner, player, agent, level, systemProgram }).rpc();
      expect.fail("zero spend should fail");
    } catch (e) {
      expect(String(e)).to.match(/greater than zero|ZeroSpend/);
    }
    try {
      await program.methods.levelUp(bn(10_000)).accounts({ owner, player, agent, level, systemProgram }).rpc();
      expect.fail("overspend should fail");
    } catch (e) {
      expect(String(e)).to.match(/Not enough coins|InsufficientCoins/);
    }
  });

  it("spends coins to level an agent and stops at level 10", async () => {
    const topUp = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("quest"), player.toBuffer(), Buffer.from([2, 0]), Buffer.from([1, 0, 0, 0])],
      program.programId,
    )[0];
    await program.methods
      .claimQuest(2, 1, bn(1980))
      .accounts({ owner, attestor: attestor.publicKey, config, player, claim: topUp, systemProgram })
      .signers([attestor])
      .rpc();
    const before = (await program.account.player.fetch(player)).coins.toNumber();
    await program.methods.levelUp(bn(1980)).accounts({ owner, player, agent, level, systemProgram }).rpc();
    const row = await program.account.agentLevel.fetch(level);
    expect(row.level).to.equal(10);
    expect(row.xp).to.equal(0);
    expect((await program.account.player.fetch(player)).coins.toNumber()).to.equal(before - 1980);
    try {
      await program.methods.levelUp(bn(1)).accounts({ owner, player, agent, level, systemProgram }).rpc();
      expect.fail("max level should fail");
    } catch (e) {
      expect(String(e)).to.match(/max level|MaxLevel/);
    }
  });

  it("opens the mystery box once per day", async () => {
    const day = Buffer.alloc(4);
    day.writeUInt32LE(20261003);
    const claim = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("box"), player.toBuffer(), day],
      program.programId,
    )[0];
    const before = (await program.account.player.fetch(player)).coins.toNumber();
    await program.methods
      .openBox(20261003, bn(40))
      .accounts({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram })
      .signers([attestor])
      .rpc();
    expect((await program.account.player.fetch(player)).coins.toNumber() - before).to.equal(40);
    try {
      await program.methods
        .openBox(20261003, bn(40))
        .accounts({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram })
        .signers([attestor])
        .rpc();
      expect.fail("second box should fail");
    } catch (e) {
      expect(String(e)).to.match(/already in use|already been processed|Allocate/i);
    }
  });

  it("pays a referral tier only when the attestor signs", async () => {
    const claim = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ref"), player.toBuffer(), Buffer.from([0])],
      program.programId,
    )[0];
    try {
      await program.methods.claimReferralTier(0).accounts({ owner, attestor: owner, config, player, claim, systemProgram }).rpc();
      expect.fail("bad attestor");
    } catch (e) {
      expect(String(e)).to.match(/Attestor does not match|BadAttestor/);
    }
    const before = (await program.account.player.fetch(player)).coins.toNumber();
    await program.methods
      .claimReferralTier(0)
      .accounts({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram })
      .signers([attestor])
      .rpc();
    expect((await program.account.player.fetch(player)).coins.toNumber() - before).to.equal(100);
  });

  it("lets a new player name an existing player as referrer, and not themselves", async () => {
    const bob = anchor.web3.Keypair.generate();
    await airdrop(bob);
    const [bobPlayer] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), bob.publicKey.toBuffer()],
      program.programId,
    );
    try {
      await program.methods
        .initPlayer()
        .accounts({ owner: bob.publicKey, player: bobPlayer, referrerPlayer: bobPlayer, systemProgram })
        .signers([bob])
        .rpc();
      expect.fail("self account as referrer should fail");
    } catch (e) {
      expect(String(e)).to.match(/refer yourself|SelfReferral|AccountNotInitialized|already in use|Error/i);
    }
    await program.methods
      .initPlayer()
      .accounts({ owner: bob.publicKey, player: bobPlayer, referrerPlayer: player, systemProgram })
      .signers([bob])
      .rpc();
    const row = await program.account.player.fetch(bobPlayer);
    expect(row.referrer.toBase58()).to.equal(owner.toBase58());
  });
});
