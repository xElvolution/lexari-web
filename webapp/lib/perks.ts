/**
 * What each level perk does (the list the Hub shows is PERKS in lib/hub.ts). Used by the app and the server,
 * always gated by the agent's real level (hub_levels on the server, the Hub state in the app).
 *  2 Quick replies    its replies jump the model queue (starts answering sooner)
 *  3 Bigger memory    keeps 50 more notes (cap 100 -> 150) and reads more of them into each reply (8 -> 20)
 *  4 Card glow        a glowing frame on its ID card and tiles
 *  5 Second shift     answers two chats or jobs at once (one otherwise)
 *  6 Extra skill slot one more skill (4 -> 5)
 *  7 Holo card        holographic, moving ID card background
 *  8 Priority desk    first in line for compute (ahead of everyone in the model queue)
 *  9 Mentor           its notes are shared with your other agents (they read them in their replies)
 * 10 Legend           gold badge and gold card frame
 */
export const PERK = { quick: 2, memory: 3, glow: 4, shift: 5, skill: 6, holo: 7, desk: 8, mentor: 9, legend: 10 } as const;
export const hasPerk = (level: number, p: keyof typeof PERK) => level >= PERK[p];
export const skillSlots = (level: number) => (level >= PERK.skill ? 5 : 4);
export const recallSize = (level: number) => (level >= PERK.memory ? 20 : 8);
export const memoryCap = (level: number) => (level >= PERK.memory ? 150 : 100);
export const shifts = (level: number) => (level >= PERK.shift ? 2 : 1);
export const queuePriority = (level: number) => (level >= PERK.desk ? 2 : level >= PERK.quick ? 1 : 0);
