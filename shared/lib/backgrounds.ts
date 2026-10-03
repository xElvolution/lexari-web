/**
 * NFT-style backgrounds for an agent's ID card face window (and its onchain NFT image).
 * One source of truth: backgrounds.json is also compiled into the Solidity contract
 * (contracts/script/gen-backgrounds.mjs), so the web card and the NFT always match.
 * Each entry draws a 100x100 tile; "{U}" is replaced with a unique id prefix.
 */
import data from "./backgrounds.json";

export type Background = { id: string; label: string; svg: string; ink: string };
export const BACKGROUNDS = data as Background[];
export const BG_IDS = BACKGROUNDS.map((b) => b.id);
export const bgById = (id?: string) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
export const bgMarkup = (id: string | undefined, uid: string) => bgById(id).svg.replaceAll("{U}", uid);
