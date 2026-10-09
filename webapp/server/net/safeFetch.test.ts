import { test } from "node:test";
import assert from "node:assert/strict";
import { privateIp, safeFetch } from "./safeFetch";
import { deviceName, ipHint } from "../security/device";

test("private, loopback, metadata and mapped addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "192.0.0.1"])
    assert.equal(privateIp(ip), true, ip);
  for (const ip of ["1.1.1.1", "8.8.8.8", "104.18.0.1", "2606:4700::1111"]) assert.equal(privateIp(ip), false, ip);
});

test("only https URLs are fetched, and IP literals in private ranges never connect", async () => {
  await assert.rejects(safeFetch("http://example.com/"));
  await assert.rejects(safeFetch("https://127.0.0.1/"));
  await assert.rejects(safeFetch("https://[::1]/"));
  await assert.rejects(safeFetch("https://169.254.169.254/latest/meta-data"));
});

test("device names and ip hints", () => {
  assert.match(deviceName("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"), /Chrome.*Android/);
  assert.match(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"), /Safari.*iPhone/);
  assert.equal(ipHint("1.2.3.4"), "1.2.x.x");
});
