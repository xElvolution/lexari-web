import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GENERATED, ROOT, generated, validateAll, validateEntry } from "./validate.ts";

const template = () => {
  const dir = join(mkdtempSync(join(tmpdir(), "lx-int-")), "your-protocol");
  cpSync(join(ROOT, "TEMPLATE"), dir, { recursive: true });
  return dir;
};
const edit = (dir: string, fn: (j: any) => void) => { const f = join(dir, "integration.json"); const j = JSON.parse(readFileSync(f, "utf8")); fn(j); writeFileSync(f, JSON.stringify(j)); };
const problems = (dir: string) => validateEntry(dir).problems.join("\n");

test("every real integration is valid and the app's generated copy is current", () => {
  const { entries, problems } = validateAll();
  assert.deepEqual(problems, []);
  assert.ok(entries.length >= 20);
  assert.ok(entries.every((e) => e.kind === "built-in"), "today's entries are Lexari's own connectors");
  assert.equal(readFileSync(GENERATED, "utf8"), JSON.stringify(generated(entries), null, 2) + "\n");
});

test("the template is a valid dapp application", () => {
  assert.equal(problems(template()), "");
});

test("a pull request can't claim built-in status, a live status, or a different slug", () => {
  let d = template(); edit(d, (j) => { j.kind = "built-in"; j.connector = "your-protocol"; delete j.agent; });
  assert.match(problems(d), /Lexari's own connectors/);
  d = template(); edit(d, (j) => { j.status = "live"; });
  assert.match(problems(d), /in-review/);
  d = template(); edit(d, (j) => { j.slug = "other"; });
  assert.match(problems(d), /match the folder/);
  d = template(); edit(d, (j) => { j.agent.id = "someone-else"; });
  assert.match(problems(d), /agent.id must be/);
});

test("dapp safety: free, public HTTPS tools, declared intents only, no withdraw intents", () => {
  let d = template(); edit(d, (j) => { j.agent.pricing = { type: "hire", usd: 5 }; });
  assert.match(problems(d), /free/);
  d = template(); edit(d, (j) => { j.agent.tools[0].url = "https://127.0.0.1/hook"; });
  assert.match(problems(d), /public HTTPS host/);
  d = template(); edit(d, (j) => { j.agent.tools[0].url = "http://api.example.com/hook"; });
  assert.match(problems(d), /agent\.tools\.0\.url/);
  d = template(); edit(d, (j) => { j.agent.tools[1].intents = ["withdraw"]; });
  assert.match(problems(d), /agent\.tools\.1\.intents/);
  d = template(); edit(d, (j) => { delete j.agent; });
  assert.match(problems(d), /needs an agent block/);
});

test("copy, contracts and logos are checked", () => {
  let d = template(); edit(d, (j) => { j.description = "Fast swaps \u2014 always on, for every agent out there."; });
  assert.match(problems(d), /dashes/);
  d = template(); edit(d, (j) => { j.contracts = [{ chain: "Base Sepolia", address: "0x1234567890abcdef", label: "Router" }]; });
  assert.match(problems(d), /valid address/);
  d = template(); writeFileSync(join(d, "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.match(problems(d), /scripts/);
  d = template(); writeFileSync(join(d, "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example.com/x.png"/></svg>');
  assert.match(problems(d), /external/);
  d = template(); edit(d, (j) => { j.extra = true; });
  assert.match(problems(d), /extra|Unrecognized/);
});
