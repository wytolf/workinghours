import test from "node:test";
import assert from "node:assert/strict";
import { localDate } from "../dates.js";
import { emptyDay, LEGACY_KEY, migrate, STORAGE_KEY } from "../state.js";
import { createHistoryBackup } from "../history-backup.js";

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

test("history import serializes with settings and preserves all unrelated stored data", async () => {
  const initial = migrate(null, localDate()), incoming = migrate(null, localDate());
  incoming.history = [{ ...emptyDay("2026-10-01"), kind: "compensation", id: "old", revision: 4 }];
  stored = { [STORAGE_KEY]: initial, [LEGACY_KEY]: { workStart: "08:00" } };
  await Promise.all([enqueue({ type: "settings", patch: { theme: "dark" } }),
    enqueue({ type: "importHistory", backup: createHistoryBackup(incoming) })]);
  assert.equal(stored[STORAGE_KEY].settings.theme, "dark");
  assert.equal(stored[STORAGE_KEY].history.length, 1);
  assert.deepEqual(stored[STORAGE_KEY].draft, initial.draft);
  assert.deepEqual(stored[LEGACY_KEY], { workStart: "08:00" });
});

test("overwrite import and bulk deletion serialize with other writes without removing settings or legacy data", async () => {
  const initial = migrate(null, localDate()), incoming = migrate(null, localDate());
  initial.history = [{ ...emptyDay("2026-10-01"), workStart: "08:00", id: "original", revision: 1 }];
  incoming.history = [{ ...initial.history[0], workEnd: "17:00" }];
  stored = { [STORAGE_KEY]: initial, [LEGACY_KEY]: { workStart: "08:00" } };
  await Promise.all([enqueue({ type: "settings", patch: { theme: "dark" } }),
    enqueue({ type: "importHistoryWithMode", backup: createHistoryBackup(incoming), mode: "overwrite" })]);
  assert.equal(stored[STORAGE_KEY].history[0].workEnd, "17:00");
  const before = structuredClone(stored[STORAGE_KEY]);
  failWrite = true;
  await assert.rejects(enqueue({ type: "deleteAllHistory", expectedHistory: before.history }), /Speicher voll/);
  assert.deepEqual(stored[STORAGE_KEY], before);
  await Promise.all([enqueue({ type: "settings", patch: { vacationCreditMinutes: 480 } }),
    enqueue({ type: "deleteAllHistory", expectedHistory: before.history })]);
  assert.deepEqual(stored[STORAGE_KEY].history, []);
  assert.equal(stored[STORAGE_KEY].settings.theme, "dark");
  assert.equal(stored[STORAGE_KEY].settings.vacationCreditMinutes, 480);
  assert.deepEqual(stored[LEGACY_KEY], { workStart: "08:00" });
});

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
