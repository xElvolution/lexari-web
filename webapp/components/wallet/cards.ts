/**
 * Agent payment cards. Each agent buys its own card with devnet SOL paid to the Lexari treasury.
 * Cards come from the server's issuer (server/cards/issuer.ts). Today that is the devnet TEST issuer,
 * so the card number cannot be used anywhere real. A real issuer plugs in on the server only.
 */
export const CARD_LIMITS = [100, 250, 500, 1000];
export const CARD_TEST_NOTE = "This is a devnet test card. The number works only inside Lexari's test environment, not at real shops.";
