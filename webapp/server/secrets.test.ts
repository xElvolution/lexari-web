import { test } from "node:test";
import assert from "node:assert/strict";
import { findSecrets, redactPatterns, scanSecrets } from "../lib/secretScan";
import { referencedNames, scrubber, secretRequestTag, stripSecretTags, takeoverTag } from "./secrets";

test("ordinary messages are not secrets", async () => {
  for (const t of ["can you please help me find the best place to eat tonight in lagos with my friends", "the password is incorrect, what now?", "tx 5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW", "hash 0x" + "a".repeat(64)])
    assert.equal((await findSecrets(t)).length, 0, t);
});
test("keys, seed phrases and private keys are caught", async () => {
  assert.equal(scanSecrets("key sk-proj-abc123def456ghi789jkl012mno")[0].name, "OPENAI_API_KEY");
  assert.equal(scanSecrets("abandon ability able about above absent absorb abstract absurd abuse access accident")[0].kind, "seed");
  assert.equal(scanSecrets("my private key: 0x" + "b".repeat(64))[0].kind, "private");
  assert.equal(scanSecrets("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----")[0].kind, "private");
});
test("scrubber blocks out saved values, their base64, and key-shaped text", () => {
  const s = scrubber([{ name: "TEST_API_KEY", value: "lx-test-9f8e7d6c5b4a" }]);
  const out = s(`echo lx-test-9f8e7d6c5b4a ${Buffer.from("lx-test-9f8e7d6c5b4a").toString("base64")} sk-proj-abc123def456ghi789jkl012mno`);
  assert.ok(!out.includes("lx-test-9f8e7d6c5b4a"));
  assert.match(out, /\[secret:TEST_API_KEY\] \[secret:TEST_API_KEY\]=* \[redacted OpenAI key\]/);
  assert.equal(redactPatterns("nothing here"), "nothing here");
});
test("agent tags", () => {
  const t = 'Sure. <secret name="cloudflare api token" service="Cloudflare" label="Cloudflare API token">To deploy your site.</secret>';
  assert.deepEqual(secretRequestTag(t), { name: "CLOUDFLARE_API_TOKEN", label: "Cloudflare API token", service: "Cloudflare", why: "To deploy your site." });
  assert.equal(stripSecretTags(t), "Sure.");
  assert.equal(takeoverTag("ok <takeover>Sign in to GitHub</takeover>"), "Sign in to GitHub");
  assert.deepEqual(referencedNames('curl -H "Authorization: Bearer $CF_TOKEN" ${OTHER_KEY} $lower'), ["CF_TOKEN", "OTHER_KEY"]);
});
