import test from "node:test";
import assert from "node:assert/strict";
import { localDate } from "../dates.js";
import { LEGACY_KEY, STORAGE_KEY } from "../state.js";

let stored = {}, failWrite = false, messageListener;
globalThis.chrome = {
  storage: { local: {
    async get(keys) {
      return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in stored).map(key => [key, structuredClone(stored[key])]));
    },
    async set(patch) {
      if (failWrite) { failWrite = false; throw new Error("Speicher voll"); }
      Object.assign(stored, structuredClone(patch));
    },
  } },
  runtime: { id: "test-extension", onMessage: { addListener(listener) { messageListener = listener; } } },
};
const { enqueue } = await import("../background.js");

test("migration is durable and idempotent, and preserves the original undated source", async () => {
  stored = { [LEGACY_KEY]: { workStart: "08:00", targetTime: "08:30", theme: "dark", breaks: [] } };
  const first = await enqueue({ type: "read" });
  assert.equal(first.draft.date, null);
  assert.equal(first.settings.targetSchedule.baselineWeeklyMinutes, 2550);
  await enqueue({ type: "resetDay", expectedDraftRevision: first.draftRevision });
  const second = await enqueue({ type: "read" });
  assert.equal(second.draft.date, localDate());
  assert.equal(second.draft.workStart, "");
  assert.equal(stored[LEGACY_KEY].workStart, "08:00");
});

test("simultaneous settings writes are serialized against the newest state", async () => {
  const results = await Promise.all([
    enqueue({ type: "settings", patch: { theme: "light" } }),
    enqueue({ type: "settings", patch: { vacationCreditMinutes: 480 } }),
    enqueue({ type: "settings", patch: { weeklyTargetMinutes: 2520 } }),
  ]);
  const final = results.at(-1);
  assert.equal(final.settings.theme, "light");
  assert.equal(final.settings.vacationCreditMinutes, 480);
  assert.equal(final.settings.targetSchedule.changes.at(-1).weeklyTargetMinutes, 2520);
});

test("write failure leaves stored history and draft unchanged and queue can recover", async () => {
  const before = structuredClone(stored[STORAGE_KEY]);
  failWrite = true;
  await assert.rejects(enqueue({ type: "resetDay", expectedDraftRevision: before.draftRevision }), /Speicher voll/);
  assert.deepEqual(stored[STORAGE_KEY], before);
  const recovered = await enqueue({ type: "settings", patch: { theme: "dark" } });
  assert.equal(recovered.settings.theme, "dark");
});

test("unknown newer schema is never overwritten or remigrated from legacy", async () => {
  stored = { [STORAGE_KEY]: { schemaVersion: 999 }, [LEGACY_KEY]: { workStart: "08:00" } };
  await assert.rejects(enqueue({ type: "read" }), /unbekanntes Format/);
  assert.deepEqual(stored[STORAGE_KEY], { schemaVersion: 999 });
});

test("runtime listener answers authorized extension messages and ignores foreign channels", async () => {
  stored = {};
  assert.equal(messageListener({ channel: "other" }, { id: "test-extension" }, () => assert.fail()), false);
  assert.equal(messageListener({ channel: "workinghours", command: { type: "read" } }, { id: "foreign-extension" }, () => assert.fail()), false);
  const response = await new Promise(resolve => {
    assert.equal(messageListener({ channel: "workinghours", command: { type: "read" } }, { id: "test-extension" }, resolve), true);
  });
  assert.equal(response.ok, true);
  assert.equal(response.data.schemaVersion, 2);
});
