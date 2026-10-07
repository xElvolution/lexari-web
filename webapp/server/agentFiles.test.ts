import { test } from "node:test";
import assert from "node:assert/strict";
import { fileTags, kindOf, safeName, sniff, stripFileTags } from "./agentFiles";
import { imageProvider, imagineTask, stripImagine } from "./imageGen";

test("content types come from the bytes, not the name", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.deepEqual(sniff("photo.jpg", png), { mime: "image/png", kind: "image" });
  assert.deepEqual(sniff("x", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), { mime: "image/jpeg", kind: "image" });
  assert.equal(sniff("doc.bin", Buffer.from("%PDF-1.7\n")).mime, "application/pdf");
  assert.deepEqual(sniff("hello.py", Buffer.from("print('hi')\n")), { mime: "text/plain; charset=utf-8", kind: "code" });
  assert.deepEqual(sniff("data.csv", Buffer.from("a,b\n1,2\n")), { mime: "text/csv; charset=utf-8", kind: "text" });
  // HTML or SVG never gets its own type: it is plain text at most
  assert.equal(sniff("page.html", Buffer.from("<html><script>alert(1)</script></html>")).mime, "text/plain; charset=utf-8");
  assert.equal(sniff("pic.svg", Buffer.from("<svg onload=alert(1)>")).mime, "text/plain; charset=utf-8");
  assert.equal(sniff("blob", Buffer.from([0, 1, 2, 3, 0xfe])).mime, "application/octet-stream");
});

test("file names are cleaned", () => {
  assert.equal(safeName("/home/agent/Outputs/report.csv"), "report.csv");
  assert.equal(safeName('..\\..\\evil"<x>.py'), "evilx.py");
  assert.equal(safeName("...hidden"), "hidden");
  assert.equal(safeName(""), "file");
  assert.equal(safeName("a".repeat(300)).length, 120);
});

test("the agent can only attach files under /home/agent", () => {
  assert.deepEqual(fileTags("Here you go <file>/home/agent/Outputs/hello.py</file>"), ["/home/agent/Outputs/hello.py"]);
  assert.deepEqual(fileTags('<file path="~/Outputs/a.csv"/> and <file>notes.txt</file>'), ["/home/agent/Outputs/a.csv", "/home/agent/notes.txt"]);
  assert.deepEqual(fileTags("<file>/etc/passwd</file><file>/home/agent/../../etc/shadow</file><file>/home/agentx/a</file>"), []);
  assert.equal(fileTags("<file>/home/agent/1</file><file>/home/agent/2</file><file>/home/agent/3</file><file>/home/agent/4</file><file>/home/agent/5</file>").length, 4);
  assert.equal(stripFileTags("Done.\n<file>/home/agent/Outputs/hello.py</file>"), "Done.");
  assert.equal(stripFileTags('Done. <file path="~/a.py"/>'), "Done.");
});

test("kinds for the card", () => {
  assert.equal(kindOf("a.py", "text/plain; charset=utf-8"), "code");
  assert.equal(kindOf("a.md", "text/plain; charset=utf-8"), "text");
  assert.equal(kindOf("a.png", "image/png"), "image");
  assert.equal(kindOf("a.zip", "application/octet-stream"), "other");
});

test("the image tool is hidden without a key", () => {
  const keep = { x: process.env.XAI_API_KEY, o: process.env.OPENROUTER_API_KEY, g: process.env.LEXARI_IMAGE_GEN };
  delete process.env.XAI_API_KEY; delete process.env.OPENROUTER_API_KEY; delete process.env.LEXARI_IMAGE_GEN;
  assert.equal(imageProvider(), null);
  process.env.OPENROUTER_API_KEY = "test";
  assert.equal(imageProvider(), "openrouter");
  process.env.XAI_API_KEY = "test";
  assert.equal(imageProvider(), "xai");
  process.env.LEXARI_IMAGE_GEN = "off";
  assert.equal(imageProvider(), null);
  for (const [k, v] of [["XAI_API_KEY", keep.x], ["OPENROUTER_API_KEY", keep.o], ["LEXARI_IMAGE_GEN", keep.g]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  assert.equal(imagineTask("Sure! <imagine>a red fox\n in snow</imagine>"), "a red fox in snow");
  assert.equal(imagineTask("no tool here"), null);
  assert.equal(stripImagine("Sure! <imagine>a red fox</imagine>"), "Sure!");
});
