import assert from "node:assert/strict";
import test from "node:test";
import { deviceName } from "./device";

test("the Android app is labeled from its user agent", () => {
  assert.equal(deviceName("LexariAndroid/1.0.0 (Pixel 7)"), "Lexari Android · Pixel 7");
  assert.equal(deviceName("Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0"), "Chrome on Android");
});
