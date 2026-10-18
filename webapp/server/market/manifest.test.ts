/** The shared manifest schema (sdk/packages/manifest) stays in step with the app's own lists. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_CATEGORIES, FACE_COLORS, LEXARI_MODELS, TONES, parseManifest } from "@lexari/manifest";
import { CATEGORIES, TONES as APP_TONES } from "@/content/appData";
import { MODELS, KEY_PROVIDERS } from "@/content/models";
import { PALETTE } from "@shared/components/avatar";

test("manifest models are Lexari models, never bring-your-own", () => {
  const byo = new Set(KEY_PROVIDERS.flatMap((p) => p.models.map((m) => m.id)));
  for (const id of LEXARI_MODELS) {
    const m = MODELS.find((x) => x.id === id);
    assert.ok(m, `${id} is a Lexari model`);
    assert.notEqual(m!.pool, "byo");
    assert.ok(!byo.has(id), `${id} is not a key-provider model`);
  }
});

test("categories, face colors and tones match the app", () => {
  assert.deepEqual([...AGENT_CATEGORIES], CATEGORIES.filter((c) => c !== "All"));
  assert.deepEqual([...FACE_COLORS].sort(), Object.keys(PALETTE).sort());
  assert.deepEqual([...TONES], APP_TONES.map((t) => t.id));
});

test("the server parses manifests with the shared schema", () => {
  const r = parseManifest({ manifestVersion: 1, id: "hello-agent", name: "Hello", version: "0.1.0", category: "Planning", face: { seed: 1, color: "purple" }, persona: { job: "Says hello", quip: "Hi there.", description: "A friendly first agent that greets you.", examples: ["Say hello"] } });
  assert.ok(r.ok);
});
