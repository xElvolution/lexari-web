/**
 * Sync merged protocol dApps from integrations/ into the marketplace (server/market/protocols.ts).
 * Run after a deploy: npx tsx scripts/sync-protocols.ts
 * New webhook secrets are written to a 0600 file for Lexari to hand to each protocol privately; they are never printed.
 */
import { writeFileSync } from "node:fs";
import { syncProtocolListings } from "../server/market/protocols";

const r = await syncProtocolListings();
console.log(`listed: ${r.listed.join(", ") || "none"}`);
console.log(`unchanged: ${r.unchanged.join(", ") || "none"}`);
console.log(`delisted: ${r.delisted.join(", ") || "none"}`);
for (const s of r.skipped) console.log(`skipped ${s.slug}: ${s.reason}`);
if (r.secrets.length) {
  const file = `protocol-secrets-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(r.secrets, null, 2) + "\n", { mode: 0o600 });
  console.log(`new webhook secrets for ${r.secrets.map((s) => s.slug).join(", ")} written to ${file}. Send each privately, then delete the file.`);
}
process.exit(0);
