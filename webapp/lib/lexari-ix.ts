/**
 * Lexari program: PDAs, instruction builders, account decoders and an instruction parser.
 * No browser or server imports, so the client and the API routes share one source of truth.
 * Discriminators and layouts match contracts/solana/idl/lexari.json.
 */
import { Buffer } from "buffer";
import { PublicKey, SystemProgram, TransactionInstruction, type AccountMeta } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LEXARI_PROGRAM_ID || "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po");
export const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

export const IX = {
  register_agent: [135, 157, 66, 195, 2, 113, 175, 30],
  update_agent: [85, 2, 178, 9, 119, 139, 102, 164],
  sync_agent_owner: [50, 57, 89, 198, 215, 253, 169, 226],
  write_memory: [230, 48, 240, 225, 213, 184, 250, 80],
  revoke_memory: [43, 184, 66, 119, 163, 164, 140, 17],
  delete_memory: [197, 189, 203, 106, 20, 99, 209, 134],
  init_config: [23, 235, 115, 232, 168, 96, 1, 231],
  update_config: [29, 158, 252, 191, 10, 83, 219, 99],
  init_player: [114, 27, 219, 144, 50, 15, 228, 66],
  check_in: [209, 253, 4, 217, 250, 241, 207, 50],
  claim_quest: [38, 197, 33, 123, 0, 108, 206, 161],
  open_box: [225, 220, 10, 104, 173, 151, 214, 199],
  level_up: [128, 64, 197, 116, 226, 129, 119, 234],
  claim_referral_tier: [197, 164, 29, 180, 105, 249, 176, 130],
} as const;
export type IxName = keyof typeof IX;

export const ACCOUNT = {
  Agent: [47, 166, 112, 147, 155, 197, 86, 7],
  AgentLevel: [11, 252, 123, 44, 39, 165, 103, 40],
  Config: [155, 12, 170, 224, 30, 250, 204, 130],
  Memory: [14, 198, 85, 183, 235, 32, 242, 208],
  Player: [205, 222, 112, 7, 165, 155, 206, 218],
} as const;

/** Same limits as the program (state.rs). */
export const LIMITS = { name: 32, role: 32, dna: 180, uri: 200, maxLevel: 10, maxQuestCoins: 1000, maxBoxCoins: 500 };
export const STREAK_PAY = [10, 15, 20, 25, 30, 40, 75];
export const TIER_FRIENDS = [1, 3, 5, 10];
export const TIER_REWARD = [100, 300, 600, 1500];
export const xpFor = (level: number) => 60 + Math.max(0, level - 1) * 40;

/* ---------- encoding ---------- */
const enc = new TextEncoder();
const u8a = (n: readonly number[]) => Uint8Array.from(n);
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const le = (bytes: number, n: number | bigint) => {
  const b = new Uint8Array(bytes);
  const v = new DataView(b.buffer);
  if (bytes === 1) v.setUint8(0, Number(n));
  else if (bytes === 2) v.setUint16(0, Number(n), true);
  else if (bytes === 4) v.setUint32(0, Number(n), true);
  else v.setBigUint64(0, BigInt(n), true);
  return b;
};
const str = (s: string) => { const body = enc.encode(s); return concat(le(4, body.length), body); };
const ix = (name: IxName, args: Uint8Array, keys: AccountMeta[]) =>
  new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.from(concat(u8a(IX[name]), args)) });
const w = (pubkey: PublicKey, isSigner = false): AccountMeta => ({ pubkey, isSigner, isWritable: true });
const r = (pubkey: PublicKey, isSigner = false): AccountMeta => ({ pubkey, isSigner, isWritable: false });
const SYS = r(SystemProgram.programId);

/* ---------- PDAs ---------- */
const find = (seeds: Uint8Array[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
export const agentPda = (asset: PublicKey) => find([enc.encode("agent"), asset.toBytes()]);
export const memoryPda = (agent: PublicKey, hash: Uint8Array) => find([enc.encode("memory"), agent.toBytes(), hash]);
export const playerPda = (owner: PublicKey) => find([enc.encode("player"), owner.toBytes()]);
export const levelPda = (agent: PublicKey) => find([enc.encode("level"), agent.toBytes()]);
export const configPda = () => find([enc.encode("config")]);
export const questClaimPda = (player: PublicKey, questId: number, period: number) => find([enc.encode("quest"), player.toBytes(), le(2, questId), le(4, period)]);
export const boxClaimPda = (player: PublicKey, day: number) => find([enc.encode("box"), player.toBytes(), le(4, day)]);
export const tierClaimPda = (player: PublicKey, tier: number) => find([enc.encode("ref"), player.toBytes(), Uint8Array.of(tier)]);

/* ---------- instructions ---------- */
export const registerAgentIx = (owner: PublicKey, asset: PublicKey, name: string, role: string, dna: string) =>
  ix("register_agent", concat(str(name), str(role), str(dna)), [w(owner, true), r(asset), w(agentPda(asset)), SYS]);
export const updateAgentIx = (owner: PublicKey, asset: PublicKey, name: string, role: string, dna: string) =>
  ix("update_agent", concat(str(name), str(role), str(dna)), [r(owner, true), w(agentPda(asset)), r(asset)]);
export const syncAgentOwnerIx = (newOwner: PublicKey, asset: PublicKey) =>
  ix("sync_agent_owner", new Uint8Array(), [r(newOwner, true), w(agentPda(asset)), r(asset)]);
export const writeMemoryIx = (owner: PublicKey, asset: PublicKey, hash: Uint8Array, uri: string) => {
  const agent = agentPda(asset);
  return ix("write_memory", concat(hash, str(uri)), [w(owner, true), r(agent), r(asset), w(memoryPda(agent, hash)), SYS]);
};
export const deleteMemoryIx = (owner: PublicKey, memory: PublicKey) => ix("delete_memory", new Uint8Array(), [w(owner, true), w(memory)]);
/** Anchor passes the program id for an absent Option<Account>. */
export const initPlayerIx = (owner: PublicKey, referrerPlayer?: PublicKey | null) =>
  ix("init_player", new Uint8Array(), [w(owner, true), w(playerPda(owner)), r(referrerPlayer || PROGRAM_ID), SYS]);
export const checkInIx = (owner: PublicKey) => ix("check_in", new Uint8Array(), [r(owner, true), w(playerPda(owner))]);
export const levelUpIx = (owner: PublicKey, asset: PublicKey, coins: number) => {
  const agent = agentPda(asset);
  return ix("level_up", le(8, coins), [w(owner, true), w(playerPda(owner)), r(agent), r(asset), w(levelPda(agent)), SYS]);
};
export const claimQuestIx = (owner: PublicKey, attestor: PublicKey, questId: number, period: number, coins: number) => {
  const player = playerPda(owner);
  return ix("claim_quest", concat(le(2, questId), le(4, period), le(8, coins)), [w(owner, true), r(attestor, true), r(configPda()), w(player), w(questClaimPda(player, questId, period)), SYS]);
};
export const openBoxIx = (owner: PublicKey, attestor: PublicKey, day: number, coins: number) => {
  const player = playerPda(owner);
  return ix("open_box", concat(le(4, day), le(8, coins)), [w(owner, true), r(attestor, true), r(configPda()), w(player), w(boxClaimPda(player, day)), SYS]);
};
export const claimTierIx = (owner: PublicKey, attestor: PublicKey, tier: number) => {
  const player = playerPda(owner);
  return ix("claim_referral_tier", Uint8Array.of(tier), [w(owner, true), r(attestor, true), r(configPda()), w(player), w(tierClaimPda(player, tier)), SYS]);
};

/* ---------- account decoders ---------- */
const view = (d: Uint8Array) => new DataView(d.buffer, d.byteOffset, d.byteLength);
const hasDisc = (d: Uint8Array, disc: readonly number[]) => d.length >= 8 && disc.every((b, i) => d[i] === b);
const key = (d: Uint8Array, at: number) => new PublicKey(d.subarray(at, at + 32));
function readStr(d: Uint8Array, at: number): [string, number] {
  const n = view(d).getUint32(at, true);
  return [new TextDecoder().decode(d.subarray(at + 4, at + 4 + n)), at + 4 + n];
}

export type PlayerAccount = { owner: string; coins: number; streak: number; lastCheckIn: number; referrer: string | null; lifetime: number };
export function decodePlayer(d: Uint8Array): PlayerAccount | null {
  if (!hasDisc(d, ACCOUNT.Player)) return null;
  const v = view(d);
  const hasRef = d[58] === 1;
  const lifeAt = hasRef ? 91 : 59;
  return {
    owner: key(d, 8).toBase58(),
    coins: Number(v.getBigUint64(40, true)),
    streak: v.getUint16(48, true),
    lastCheckIn: Number(v.getBigInt64(50, true)),
    referrer: hasRef ? key(d, 59).toBase58() : null,
    lifetime: Number(v.getBigUint64(lifeAt, true)),
  };
}
export type AgentAccount = { owner: string; asset: string; name: string; role: string; dna: string };
export function decodeAgent(d: Uint8Array): AgentAccount | null {
  if (!hasDisc(d, ACCOUNT.Agent)) return null;
  const [name, a] = readStr(d, 72);
  const [role, b] = readStr(d, a);
  const [dna] = readStr(d, b);
  return { owner: key(d, 8).toBase58(), asset: key(d, 40).toBase58(), name, role, dna };
}
export type LevelAccount = { agent: string; owner: string; level: number; xp: number };
export function decodeLevel(d: Uint8Array): LevelAccount | null {
  if (!hasDisc(d, ACCOUNT.AgentLevel)) return null;
  return { agent: key(d, 8).toBase58(), owner: key(d, 40).toBase58(), level: d[72], xp: view(d).getUint32(73, true) };
}
export function decodeConfig(d: Uint8Array): { authority: string } | null {
  if (!hasDisc(d, ACCOUNT.Config)) return null;
  return { authority: key(d, 8).toBase58() };
}
export type MemoryAccount = { owner: string; agent: string; contentHash: string; uri: string; revoked: boolean };
export function decodeMemory(d: Uint8Array): MemoryAccount | null {
  if (!hasDisc(d, ACCOUNT.Memory)) return null;
  const [uri, at] = readStr(d, 104);
  return { owner: key(d, 8).toBase58(), agent: key(d, 40).toBase58(), contentHash: Buffer.from(d.subarray(72, 104)).toString("hex"), uri, revoked: d[at] === 1 };
}
/** Owner of a Metaplex Core AssetV1 account (Key::AssetV1 = 1, then the owner). */
export function coreAssetOwner(owner: PublicKey, data: Uint8Array): string | null {
  if (!owner.equals(MPL_CORE_ID) || data.length < 33 || data[0] !== 1) return null;
  return key(data, 1).toBase58();
}

/* ---------- instruction parser (for confirmed transactions) ---------- */
export type ParsedIx =
  | { name: "check_in" | "init_player" | "sync_agent_owner" | "revoke_memory" | "delete_memory" | "init_config" | "update_config"; accounts: string[] }
  | { name: "register_agent" | "update_agent"; accounts: string[]; args: { name: string; role: string; dna: string } }
  | { name: "write_memory"; accounts: string[]; args: { hash: string; uri: string } }
  | { name: "claim_quest"; accounts: string[]; args: { questId: number; period: number; coins: number } }
  | { name: "open_box"; accounts: string[]; args: { day: number; coins: number } }
  | { name: "level_up"; accounts: string[]; args: { coins: number } }
  | { name: "claim_referral_tier"; accounts: string[]; args: { tier: number } };

export function parseLexariIx(data: Uint8Array, accounts: string[]): ParsedIx | null {
  const name = (Object.keys(IX) as IxName[]).find((n) => hasDisc(data, IX[n]));
  if (!name) return null;
  const v = view(data);
  try {
    switch (name) {
      case "register_agent":
      case "update_agent": {
        const [n, a] = readStr(data, 8); const [role, b] = readStr(data, a); const [dna] = readStr(data, b);
        return { name, accounts, args: { name: n, role, dna } };
      }
      case "write_memory": { const [uri] = readStr(data, 40); return { name, accounts, args: { hash: Buffer.from(data.subarray(8, 40)).toString("hex"), uri } }; }
      case "claim_quest": return { name, accounts, args: { questId: v.getUint16(8, true), period: v.getUint32(10, true), coins: Number(v.getBigUint64(14, true)) } };
      case "open_box": return { name, accounts, args: { day: v.getUint32(8, true), coins: Number(v.getBigUint64(12, true)) } };
      case "level_up": return { name, accounts, args: { coins: Number(v.getBigUint64(8, true)) } };
      case "claim_referral_tier": return { name, accounts, args: { tier: data[8] } };
      default: return { name, accounts };
    }
  } catch {
    return null;
  }
}
