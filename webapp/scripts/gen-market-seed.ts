/**
 * Writes the house listings part of migration 0038 from content/appData SPECIALISTS. Run once when the migration was
 * written (npx tsx scripts/gen-market-seed.ts > /tmp/seed.sql); tests/db/market.test.ts checks the database copy still
 * matches SPECIALISTS, so a change to a house specialist needs a new migration.
 */
import { createHash } from "node:crypto";
import { SPECIALISTS } from "../content/appData";

const lines: string[] = [];
SPECIALISTS.forEach((s, i) => {
  const card = JSON.stringify(s);
  if (card.includes("$card$")) throw new Error("card contains the dollar-quote tag");
  const hash = createHash("sha256").update(card).digest("hex");
  lines.push(`insert into agent_listings (developer_id, slug, status, house, sort_order) select id, '${s.slug}', 'listed', true, ${i} from developers where handle = 'lexari' on conflict (slug) do nothing;`);
  lines.push(`insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card$${card}$card$::jsonb, '${hash}', 'approved', 'House specialist', now() from agent_listings where slug = '${s.slug}' on conflict (listing_id, version) do nothing;`);
});
lines.push(`update agent_listings l set current_version_id = v.id from listing_versions v where v.listing_id = l.id and v.version = '1.0.0' and l.house and l.current_version_id is null;`);
process.stdout.write(lines.join("\n") + "\n");
