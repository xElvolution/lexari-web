import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lexari } from "../target/types/lexari";
import { expect } from "chai";
import fs from "fs";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, publicKey as umiPk, type KeypairSigner, type Umi } from "@metaplex-foundation/umi";
import { mplCore, create, transferV1 } from "@metaplex-foundation/mpl-core";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
type Pk = anchor.web3.PublicKey;

describe("lexari", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Lexari as Program<Lexari>;
  const owner = provider.wallet.publicKey;
  const systemProgram = SystemProgram.programId;
  const bn = (n: number) => new anchor.BN(n);
  const pda = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const agentPda = (asset: Pk) => pda([Buffer.from("agent"), asset.toBuffer()]);
  const memoryPda = (agent: Pk, hash: number[]) => pda([Buffer.from("memory"), agent.toBuffer(), Buffer.from(hash)]);
  const playerPda = (who: Pk) => pda([Buffer.from("player"), who.toBuffer()]);
  const levelPda = (agent: Pk) => pda([Buffer.from("level"), agent.toBuffer()]);
  const config = pda([Buffer.from("config")]);
  const loader = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
  const [programData] = PublicKey.findProgramAddressSync([program.programId.toBuffer()], loader);
  const hashOf = (n: number) => { const h = Buffer.alloc(32); h[0] = n; return Array.from(h); };
  const fails = async (p: Promise<unknown>, re: RegExp) => {
    try { await p; } catch (e) { expect(String(e) + JSON.stringify((e as { logs?: string[] }).logs || [])).to.match(re); return; }
    expect.fail(`expected failure matching ${re}`);
  };
  const airdrop = async (to: Pk, sol = 2) => {
    const sig = await provider.connection.requestAirdrop(to, sol * 1e9);
    await provider.connection.confirmTransaction(sig, "confirmed");
  };

  // Real Metaplex Core assets, minted with the cloned mpl-core program.
  const walletFile = process.env.ANCHOR_WALLET as string;
  const umiFor = (secret: Uint8Array): Umi => {
    const umi = createUmi(provider.connection.rpcEndpoint, "confirmed").use(mplCore());
    return umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secret)));
  };
  const umi = umiFor(Uint8Array.from(JSON.parse(fs.readFileSync(walletFile, "utf8"))));
  const mintAsset = async (u: Umi = umi) => {
    const asset: KeypairSigner = generateSigner(u);
    await create(u, { asset, name: "Lexari ID", uri: "https://example.com/a.json" }).sendAndConfirm(u);
    return new PublicKey(asset.publicKey);
  };

  const bob = Keypair.generate();
  const attestor = Keypair.generate();
  let asset: Pk;
  let agent: Pk;

  before(async () => {
    await airdrop(bob.publicKey);
    await airdrop(attestor.publicKey);
    asset = await mintAsset();
    agent = agentPda(asset);
  });

  describe("agents", () => {
    it("registers an agent for a Core asset the signer owns", async () => {
      await program.methods.registerAgent("Juniper", "Personal agent", "shape=round;color=purple")
        .accountsPartial({ owner, asset, agent, systemProgram }).rpc();
      const row = await program.account.agent.fetch(agent);
      expect(row.owner.toBase58()).to.equal(owner.toBase58());
      expect(row.asset.toBase58()).to.equal(asset.toBase58());
      expect(row.name).to.equal("Juniper");
    });

    it("refuses an asset that is not a Core asset", async () => {
      const fake = Keypair.generate();
      await airdrop(fake.publicKey, 1); // a system-owned account
      await fails(program.methods.registerAgent("X", "", "d").accountsPartial({ owner, asset: fake.publicKey, agent: agentPda(fake.publicKey), systemProgram }).rpc(), /NotCoreAsset/);
    });

    it("refuses to register someone else's asset", async () => {
      const other = await mintAsset();
      await fails(program.methods.registerAgent("X", "", "d").accountsPartial({ owner: bob.publicKey, asset: other, agent: agentPda(other), systemProgram }).signers([bob]).rpc(), /NotAssetOwner/);
    });

    it("rejects an empty name", async () => {
      const other = await mintAsset();
      await fails(program.methods.registerAgent("", "Role", "d").accountsPartial({ owner, asset: other, agent: agentPda(other), systemProgram }).rpc(), /BadName/);
    });

    it("lets the owner update the card fields", async () => {
      await program.methods.updateAgent("Juniper II", "Chief of staff", "shape=square;color=blue").accountsPartial({ owner, agent, asset }).rpc();
      const row = await program.account.agent.fetch(agent);
      expect(row.name).to.equal("Juniper II");
    });

    it("refuses an update from someone else", async () => {
      await fails(program.methods.updateAgent("Hijack", "", "d").accountsPartial({ owner: bob.publicKey, agent, asset }).signers([bob]).rpc(), /has_one|ConstraintHasOne|2001/);
    });

    it("refuses an update that passes the wrong asset", async () => {
      const other = await mintAsset();
      await fails(program.methods.updateAgent("X", "", "d").accountsPartial({ owner, agent, asset: other }).rpc(), /AssetMismatch|ConstraintSeeds|2006/);
    });
  });

  describe("memories", () => {
    it("writes, revokes and deletes a memory", async () => {
      const hash = hashOf(1);
      const memory = memoryPda(agent, hash);
      await program.methods.writeMemory(hash, "ar://abc").accountsPartial({ owner, agent, asset, memory, systemProgram }).rpc();
      expect((await program.account.memory.fetch(memory)).uri).to.equal("ar://abc");
      await program.methods.revokeMemory().accountsPartial({ owner, memory }).rpc();
      expect((await program.account.memory.fetch(memory)).revoked).to.equal(true);
      await program.methods.deleteMemory().accountsPartial({ owner, memory }).rpc();
      expect(await provider.connection.getAccountInfo(memory)).to.equal(null);
    });

    it("can write the same hash again after a delete", async () => {
      const hash = hashOf(1);
      const memory = memoryPda(agent, hash);
      await program.methods.writeMemory(hash, "").accountsPartial({ owner, agent, asset, memory, systemProgram }).rpc();
      await program.methods.deleteMemory().accountsPartial({ owner, memory }).rpc();
    });

    it("refuses a memory write from someone who is not the owner", async () => {
      const hash = hashOf(2);
      await fails(program.methods.writeMemory(hash, "").accountsPartial({ owner: bob.publicKey, agent, asset, memory: memoryPda(agent, hash), systemProgram }).signers([bob]).rpc(), /has_one|ConstraintHasOne|2001/);
    });
  });

  describe("hub", () => {
    const player = playerPda(owner);
    let level: Pk;
    before(() => { level = levelPda(agent); });

    it("only the upgrade authority can init config", async () => {
      await fails(program.methods.initConfig(attestor.publicKey).accountsPartial({ payer: bob.publicKey, config, program: program.programId, programData, systemProgram }).signers([bob]).rpc(), /NotUpgradeAuthority/);
      await program.methods.initConfig(attestor.publicKey).accountsPartial({ payer: owner, config, program: program.programId, programData, systemProgram }).rpc();
      expect((await program.account.config.fetch(config)).authority.toBase58()).to.equal(attestor.publicKey.toBase58());
    });

    it("only the upgrade authority can rotate the attestor", async () => {
      const next = Keypair.generate();
      await fails(program.methods.updateConfig(next.publicKey).accountsPartial({ authority: bob.publicKey, config, program: program.programId, programData }).signers([bob]).rpc(), /NotUpgradeAuthority/);
      await program.methods.updateConfig(next.publicKey).accountsPartial({ authority: owner, config, program: program.programId, programData }).rpc();
      expect((await program.account.config.fetch(config)).authority.toBase58()).to.equal(next.publicKey.toBase58());
      await program.methods.updateConfig(attestor.publicKey).accountsPartial({ authority: owner, config, program: program.programId, programData }).rpc();
    });

    it("creates a player", async () => {
      await program.methods.initPlayer().accountsPartial({ owner, player, referrerPlayer: null, systemProgram }).rpc();
      const row = await program.account.player.fetch(player);
      expect(row.coins.toNumber()).to.equal(0);
      expect(row.referrer).to.equal(null);
    });

    it("pays the first check-in and refuses a second the same day", async () => {
      await program.methods.checkIn().accountsPartial({ owner, player }).rpc();
      const row = await program.account.player.fetch(player);
      expect(row.coins.toNumber()).to.equal(10);
      expect(row.streak).to.equal(1);
      await fails(program.methods.checkIn().accountsPartial({ owner, player }).rpc(), /AlreadyCheckedIn/);
    });

    it("refuses a check-in on someone else's player", async () => {
      await fails(program.methods.checkIn().accountsPartial({ owner: bob.publicKey, player }).signers([bob]).rpc(), /ConstraintSeeds|has_one|2006|2001/);
    });

    const questPda = (quest: number, period: number) => {
      const q = Buffer.alloc(2); q.writeUInt16LE(quest); const p = Buffer.alloc(4); p.writeUInt32LE(period);
      return pda([Buffer.from("quest"), player.toBuffer(), q, p]);
    };

    it("refuses a quest claim from the wrong attestor", async () => {
      const wrong = Keypair.generate();
      await fails(program.methods.claimQuest(1, 100, bn(50)).accountsPartial({ owner, attestor: wrong.publicKey, config, player, claim: questPda(1, 100), systemProgram }).signers([wrong]).rpc(), /BadAttestor/);
    });

    it("refuses a quest reward above the cap", async () => {
      await fails(program.methods.claimQuest(1, 100, bn(1_001)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim: questPda(1, 100), systemProgram }).signers([attestor]).rpc(), /RewardTooLarge/);
    });

    it("claims a quest once and rejects the double claim", async () => {
      const claim = questPda(1, 100);
      await program.methods.claimQuest(1, 100, bn(50)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc();
      expect((await program.account.player.fetch(player)).coins.toNumber()).to.equal(60);
      await fails(program.methods.claimQuest(1, 100, bn(50)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc(), /already in use|0x0/);
    });

    it("refuses to level up with a zero spend or not enough coins", async () => {
      await fails(program.methods.levelUp(bn(0)).accountsPartial({ owner, player, agent, asset, level, systemProgram }).rpc(), /ZeroSpend/);
      await fails(program.methods.levelUp(bn(500)).accountsPartial({ owner, player, agent, asset, level, systemProgram }).rpc(), /InsufficientCoins/);
    });

    it("spends coins as XP", async () => {
      await program.methods.levelUp(bn(60)).accountsPartial({ owner, player, agent, asset, level, systemProgram }).rpc();
      const row = await program.account.agentLevel.fetch(level);
      expect(row.level).to.equal(2);
      expect(row.xp).to.equal(0);
      expect((await program.account.player.fetch(player)).coins.toNumber()).to.equal(0);
    });

    it("spends only what it takes to reach the max level", async () => {
      // level 2 -> 10 needs 100+140+...+380 = 1920 xp
      for (let i = 0; i < 3; i++) {
        await program.methods.claimQuest(2, i, bn(1000)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim: questPda(2, i), systemProgram }).signers([attestor]).rpc();
      }
      expect((await program.account.player.fetch(player)).coins.toNumber()).to.equal(3000);
      await program.methods.levelUp(bn(3000)).accountsPartial({ owner, player, agent, asset, level, systemProgram }).rpc();
      const row = await program.account.agentLevel.fetch(level);
      expect(row.level).to.equal(10);
      expect(row.xp).to.equal(0);
      expect((await program.account.player.fetch(player)).coins.toNumber()).to.equal(3000 - 1920);
      await fails(program.methods.levelUp(bn(10)).accountsPartial({ owner, player, agent, asset, level, systemProgram }).rpc(), /MaxLevel/);
    });

    it("opens the mystery box once per day, within the cap", async () => {
      const day = Buffer.alloc(4); day.writeUInt32LE(20000);
      const claim = pda([Buffer.from("box"), player.toBuffer(), day]);
      await fails(program.methods.openBox(20000, bn(501)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc(), /RewardTooLarge/);
      await program.methods.openBox(20000, bn(40)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc();
      await fails(program.methods.openBox(20000, bn(40)).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc(), /already in use|0x0/);
    });

    it("pays a referral tier only with the attestor, once", async () => {
      const claim = pda([Buffer.from("ref"), player.toBuffer(), Buffer.from([0])]);
      const wrong = Keypair.generate();
      await fails(program.methods.claimReferralTier(0).accountsPartial({ owner, attestor: wrong.publicKey, config, player, claim, systemProgram }).signers([wrong]).rpc(), /BadAttestor/);
      const before = (await program.account.player.fetch(player)).coins.toNumber();
      await program.methods.claimReferralTier(0).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc();
      expect((await program.account.player.fetch(player)).coins.toNumber()).to.equal(before + 100);
      await fails(program.methods.claimReferralTier(0).accountsPartial({ owner, attestor: attestor.publicKey, config, player, claim, systemProgram }).signers([attestor]).rpc(), /already in use|0x0/);
    });

    it("lets a new player name a referrer, but not themselves", async () => {
      const bobPlayer = playerPda(bob.publicKey);
      await fails(program.methods.initPlayer().accountsPartial({ owner, player, referrerPlayer: player, systemProgram }).rpc(), /already in use|SelfReferral|0x0/);
      await program.methods.initPlayer().accountsPartial({ owner: bob.publicKey, player: bobPlayer, referrerPlayer: player, systemProgram }).signers([bob]).rpc();
      expect((await program.account.player.fetch(bobPlayer)).referrer.toBase58()).to.equal(owner.toBase58());
    });
  });

  describe("ID card transfer", () => {
    it("moves the agent to the new Core owner and locks out the old one", async () => {
      await transferV1(umi, { asset: umiPk(asset.toBase58()), newOwner: umiPk(bob.publicKey.toBase58()) }).sendAndConfirm(umi);
      // old owner can no longer write
      const hash = hashOf(9);
      await fails(program.methods.writeMemory(hash, "").accountsPartial({ owner, agent, asset, memory: memoryPda(agent, hash), systemProgram }).rpc(), /NotAssetOwner/);
      await fails(program.methods.updateAgent("Old", "", "d").accountsPartial({ owner, agent, asset }).rpc(), /NotAssetOwner/);
      // a stranger cannot take it
      const eve = Keypair.generate();
      await airdrop(eve.publicKey, 1);
      await fails(program.methods.syncAgentOwner().accountsPartial({ newOwner: eve.publicKey, agent, asset }).signers([eve]).rpc(), /NotAssetOwner/);
      // the new owner syncs and can write
      await program.methods.syncAgentOwner().accountsPartial({ newOwner: bob.publicKey, agent, asset }).signers([bob]).rpc();
      expect((await program.account.agent.fetch(agent)).owner.toBase58()).to.equal(bob.publicKey.toBase58());
      await fails(program.methods.syncAgentOwner().accountsPartial({ newOwner: bob.publicKey, agent, asset }).signers([bob]).rpc(), /OwnerUnchanged/);
      await program.methods.writeMemory(hash, "").accountsPartial({ owner: bob.publicKey, agent, asset, memory: memoryPda(agent, hash), systemProgram }).signers([bob]).rpc();
    });
  });
});
