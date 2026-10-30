/** Developer accounts: invites, hashed scoped revocable keys, key auth and the CLI device-code login. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../../server/db";
import { developerDeviceCodes, developerInvites, developerKeys, developers } from "../../server/db/marketSchema";
import { authKey, createInvite, createKey, decideDevice, joinWithInvite, pollDevice, revokeKey, sha256, startDevice } from "../../server/market/developers";
import { MAX_KEYS } from "../../server/market/config";
import { person, rnd } from "./helpers";

after(() => setTimeout(() => process.exit(0), 50));
const bearer = (key: string) => new Request("http://x/api", { headers: { authorization: `Bearer ${key}` } });
async function dev() {
  const admin = await person(); const u = await person();
  const inv = await createInvite(admin.id, "test");
  const d = await joinWithInvite(u.id, { invite: inv.code, handle: `h-${rnd()}`, name: "Acme", terms: true });
  return { d, u };
}

test("joining needs a valid, unused, unexpired invite and a free handle", async () => {
  const admin = await person();
  const inv = await createInvite(admin.id, "for Ada");
  assert.match(inv.code, /^LXDEV-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const [stored] = await db().select().from(developerInvites).where(eq(developerInvites.id, inv.id));
  assert.notEqual(stored.codeHash, inv.code, "only a hash is stored");
  const a = await person(); const b = await person();
  await assert.rejects(() => joinWithInvite(a.id, { invite: "LXDEV-NOPE-NOPE", handle: `x-${rnd()}`, name: "A", terms: true }), /isn't valid/);
  const handle = `ada-${rnd()}`;
  const d = await joinWithInvite(a.id, { invite: inv.code.toLowerCase().replace(/-/g, " "), handle, name: "Ada", terms: true });
  assert.equal(d.handle, handle);
  await assert.rejects(() => joinWithInvite(b.id, { invite: inv.code, handle: `b-${rnd()}`, name: "B", terms: true }), /already used/);
  const inv2 = await createInvite(admin.id, "");
  await assert.rejects(() => joinWithInvite(b.id, { invite: inv2.code, handle, name: "B", terms: true }), /taken/);
  await assert.rejects(() => joinWithInvite(b.id, { invite: inv2.code, handle: "lexari", name: "B", terms: true }), /taken/);
  const inv3 = await createInvite(admin.id, "");
  await db().update(developerInvites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(developerInvites.id, inv3.id));
  await assert.rejects(() => joinWithInvite(b.id, { invite: inv3.code, handle: `c-${rnd()}`, name: "B", terms: true }), /expired/);
});

test("keys: shown once, stored hashed, scoped, capped and revocable", async () => {
  const { d } = await dev();
  const { key, view } = await createKey(d.id, "Laptop", ["publish"]);
  assert.match(key, /^lxk_test_[A-Za-z0-9_-]{43}$/);
  const [row] = await db().select().from(developerKeys).where(eq(developerKeys.id, view.id));
  assert.equal(row.keyHash, sha256(key));
  assert.ok(!JSON.stringify(row).includes(key.slice(9)), "the key itself is not stored");
  assert.equal(view.prefix, key.slice(0, 13));
  assert.equal((await authKey(bearer(key), "publish")).developer.id, d.id);
  await assert.rejects(() => authKey(bearer(key), "read"), /can't read/);
  await assert.rejects(() => authKey(bearer("lxk_test_" + "A".repeat(43)), "publish"), /isn't valid/);
  await assert.rejects(() => authKey(new Request("http://x"), "publish"), /Bearer/);
  await revokeKey(d.id, view.id);
  await assert.rejects(() => authKey(bearer(key), "publish"), /revoked/);
  await assert.rejects(() => revokeKey(d.id, view.id), /no such active key/);
  for (let i = 0; i < MAX_KEYS; i++) await createKey(d.id, `k${i}`, ["read"]);
  await assert.rejects(() => createKey(d.id, "one too many", ["read"]), /active keys/);
});

test("a suspended developer's keys stop working", async () => {
  const { d } = await dev();
  const { key } = await createKey(d.id, "k", ["publish", "read"]);
  await db().update(developers).set({ status: "suspended" }).where(eq(developers.id, d.id));
  await assert.rejects(() => authKey(bearer(key), "publish"), /suspended/);
});

test("another developer can't revoke your key", async () => {
  const a = await dev(); const b = await dev();
  const { view } = await createKey(a.d.id, "k", ["read"]);
  await assert.rejects(() => revokeKey(b.d.id, view.id), /no such active key/);
});

test("device login: pending until approved, the key comes out exactly once, denial and expiry", async () => {
  const { d } = await dev();
  const s = await startDevice("ada-laptop", `ip-${rnd()}`);
  assert.match(s.userCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await pollDevice(s.deviceCode)).status, "pending");
  await decideDevice(d.id, s.userCode.toLowerCase(), true);
  await new Promise((r) => setTimeout(r, 4100)); // the poll interval
  const ok = await pollDevice(s.deviceCode);
  assert.equal(ok.status, "approved");
  if (ok.status === "approved") assert.equal((await authKey(bearer(ok.key), "publish")).developer.id, d.id);
  await new Promise((r) => setTimeout(r, 4100));
  assert.equal((await pollDevice(s.deviceCode)).status, "expired", "a second pickup gets nothing");
  await assert.rejects(() => decideDevice(d.id, s.userCode, true), /isn't valid/);

  const n = await startDevice("x", `ip-${rnd()}`);
  await decideDevice(d.id, n.userCode, false);
  assert.equal((await pollDevice(n.deviceCode)).status, "denied");

  const e = await startDevice("x", `ip-${rnd()}`);
  await db().update(developerDeviceCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(developerDeviceCodes.deviceHash, sha256(e.deviceCode)));
  assert.equal((await pollDevice(e.deviceCode)).status, "expired");
  await assert.rejects(() => decideDevice(d.id, e.userCode, true), /isn't valid/);
});

test("polling faster than the interval is told to slow down", async () => {
  const s = await startDevice("x", `ip-${rnd()}`);
  assert.equal((await pollDevice(s.deviceCode)).status, "pending");
  assert.equal((await pollDevice(s.deviceCode)).status, "slow_down");
});
