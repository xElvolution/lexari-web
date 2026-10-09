import { test } from "node:test";
import assert from "node:assert/strict";
import { everyLabel, everyText, nextRun, parseEvery } from "./schedule";
import { meetName, meetingLink } from "./meet";

test("parseEvery reads the agent's and people's phrasings", () => {
  assert.deepEqual(parseEvery("daily 08:00"), { kind: "daily", h: 8, m: 0 });
  assert.deepEqual(parseEvery("weekdays 9:30"), { kind: "weekdays", h: 9, m: 30 });
  assert.deepEqual(parseEvery("weekly mon 08:00"), { kind: "weekly", dow: 1, h: 8, m: 0 });
  assert.deepEqual(parseEvery("every morning"), { kind: "daily", h: 8, m: 0 });
  assert.deepEqual(parseEvery("daily 7pm"), { kind: "daily", h: 19, m: 0 });
  assert.deepEqual(parseEvery("hourly"), { kind: "hourly" });
  assert.equal(parseEvery("whenever"), null);
  assert.equal(everyText({ kind: "weekly", dow: 5, h: 17, m: 5 }), "weekly fri 17:05");
  assert.equal(everyLabel({ kind: "daily", h: 8, m: 0 }), "Every day at 8:00 AM");
});

test("nextRun lands on the right local time", () => {
  const from = Date.UTC(2026, 9, 9, 4, 0); // 05:00 in Lagos (UTC+1), a Friday
  assert.equal(new Date(nextRun({ kind: "daily", h: 8, m: 0 }, "Africa/Lagos", from)).toISOString(), "2026-10-09T07:00:00.000Z");
  assert.equal(new Date(nextRun({ kind: "daily", h: 4, m: 0 }, "Africa/Lagos", from)).toISOString(), "2026-10-10T03:00:00.000Z");
  assert.equal(new Date(nextRun({ kind: "weekdays", h: 4, m: 0 }, "Africa/Lagos", from)).toISOString(), "2026-10-12T03:00:00.000Z");
  assert.equal(new Date(nextRun({ kind: "weekly", dow: 1, h: 9, m: 0 }, "America/New_York", from)).toISOString(), "2026-10-12T13:00:00.000Z");
});

test("meetingLink finds real meeting links only", () => {
  assert.deepEqual(meetingLink("join https://meet.google.com/abc-defg-hij?authuser=0 now"), { url: "https://meet.google.com/abc-defg-hij", platform: "meet" });
  assert.equal(meetingLink("https://us02web.zoom.us/j/81234567890?pwd=abc")?.platform, "zoom");
  assert.equal(meetingLink("https://meet.jit.si/LexariStandup42")?.platform, "jitsi");
  assert.equal(meetingLink("https://teams.microsoft.com/l/meetup-join/19%3ameeting_x")?.platform, "teams");
  assert.equal(meetingLink("http://meet.google.com/abc-defg-hij"), null);
  assert.equal(meetingLink("https://example.com/j/123"), null);
  assert.equal(meetName("agent", "Rika", "Ada Obi"), "Rika (for Ada)");
  assert.equal(meetName("me", "Rika", "Ada Obi"), "Ada Obi");
  assert.equal(meetName("agent", "Nova", ""), "Nova (notetaker)");
});
