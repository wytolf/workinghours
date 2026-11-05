import test from "node:test";
import assert from "node:assert/strict";
import { createHistoryBackup, parseHistoryBackup } from "../history-backup.js";
import { applyCommand, draftFor, emptyDay, migrate } from "../state.js";
import { calculateStatistics, weeklyTarget } from "../statistics-calculations.js";

const today = "2026-11-05";
function day(date, patch = {}) { return { ...emptyDay(date), workStart: "08:00", workEnd: "17:00", id: date, revision: 7, ...patch }; }
function source() {
  const data = migrate(null, today);
  data.settings.targetSchedule = { baselineWeeklyMinutes: 2400, changes: [{ effectiveFrom: "2026-11-03", weeklyTargetMinutes: 2550 }] };
  data.history = [day("2026-11-02", { breaks: [{ duration: 30 }, { start: "12:00", end: "12:15" }] }),
    day("2026-11-03", { kind: "vacation", vacationCreditMinutes: 510 }),
    day("2026-11-04", { kind: "compensation" }), day(today, { workEnd: "" })];
  return data;
}
function restore(data, backup) {
  let id = 0;
  return applyCommand(data, { type: "importHistory", backup }, today, () => `new-${++id}`);
}

test("JSON backup restores day types, partial entries, pauses and historical statistics", () => {
  const original = source(), empty = migrate(null, today);
  empty.settings.theme = "dark";
  empty.settings.vacationCreditMinutes = 480;
  const backup = parseHistoryBackup(`\uFEFF${JSON.stringify(createHistoryBackup(original))}`);
  assert.equal(backup.history[0].id, undefined);
  assert.equal(backup.draft, undefined);
  const restored = restore(empty, backup);
  assert.deepEqual(createHistoryBackup(restored).history, backup.history);
  assert.deepEqual(calculateStatistics(restored, today), calculateStatistics(original, today));
  assert.equal(restored.settings.theme, "dark");
  assert.equal(restored.settings.vacationCreditMinutes, 480);
  assert.equal(weeklyTarget(restored.settings, today), 2400);
  assert.equal(restored.history[0].revision, 1);
  assert.deepEqual(empty.history, []);
});

test("import preserves existing dates and local schedule and can be repeated without writes", () => {
  const local = migrate(null, today);
  local.history = [day("2026-11-02", { workEnd: "12:00" })];
  const backup = createHistoryBackup(source());
  backup.history.push({ ...backup.history[1], vacationCreditMinutes: 400 });
  const restored = restore(local, backup);
  assert.equal(restored.history.length, 4);
  assert.equal(restored.history[0].workEnd, "12:00");
  assert.equal(restored.history[1].vacationCreditMinutes, 510);
  assert.deepEqual(restored.settings, local.settings);
  assert.equal(restore(restored, backup), restored);
});

test("backup uses the first saved duplicate and preserves disabled non-work inputs", () => {
  const original = source();
  original.history[1].workStart = "29:00";
  original.history.push(day(original.history[0].date, { workEnd: "10:00" }));
  const backup = createHistoryBackup(original);
  assert.equal(backup.history.length, 4);
  assert.equal(backup.history[0].workEnd, "17:00");
  assert.equal(restore(migrate(null, today), backup).history[1].workStart, "29:00");
});

test("invalid JSON, versions, dates, values and partial malformed files are rejected atomically", () => {
  assert.throws(() => parseHistoryBackup("kein JSON"), /gültige.*Sicherung/);
  const corruptions = [
    backup => { backup.version = 99; },
    backup => { backup.history[1].date = "2026-02-30"; },
    backup => { backup.history[1].kind = "other"; },
    backup => { backup.history[1].vacationCreditMinutes = -1; },
    backup => { backup.history[0].workStart = "29:00"; },
    backup => { backup.history[0].breaks = [null]; },
    backup => { backup.history[0].breaks = [{ duration: -30 }]; },
    backup => { backup.targetSchedule.changes[0].weeklyTargetMinutes = "42"; },
    backup => { backup.targetSchedule.changes.push(backup.targetSchedule.changes[0]); },
  ];
  for (const corrupt of corruptions) {
    const backup = createHistoryBackup(source()), local = migrate(null, today), before = structuredClone(local);
    corrupt(backup);
    assert.throws(() => restore(local, backup), /keine gültige/);
    assert.deepEqual(local, before);
  }
});

test("import preserves edited draft and prevents it from overwriting the newly loaded record", () => {
  const local = migrate(null, today);
  local.draft = { ...local.draft, workStart: "09:00", changedSinceLoad: true };
  const restored = restore(local, createHistoryBackup(source()));
  assert.equal(restored.draft.workStart, "09:00");
  assert.equal(restored.draft.conflict, true);
  assert.equal(restored.draftRevision, 1);
  assert.throws(() => applyCommand(restored, { type: "newDay", expectedDraftRevision: 1 }, today), /inzwischen geändert/);
  assert.throws(() => applyCommand(restored, { type: "saveDraft", fields: local.draft, expectedDraftRevision: 0 }, today), /anderen Fenster/);
});

test("unchanged draft cannot replace imported history on subsequent navigation", () => {
  const local = migrate(null, today);
  local.draft = draftFor(today, []);
  const restored = restore(local, createHistoryBackup(source()));
  assert.equal(restored.draft.workStart, "");
  const next = applyCommand(restored, { type: "selectDate", date: "2026-11-01", expectedDraftRevision: restored.draftRevision }, today);
  assert.equal(next.history.find(day => day.date === today).workStart, "08:00");
});
