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
function restore(data, backup, mode) {
  let id = 0;
  return applyCommand(data, { type: mode === undefined ? "importHistory" : "importHistoryWithMode", backup, mode }, today, () => `new-${++id}`);
}

test("overwrite import replaces matching dates, advances revisions and preserves unrelated days and old duplicates", () => {
  const local = source();
  local.history.push(day("2026-11-01"), day("2026-11-02", { workEnd: "10:00", id: "duplicate" }));
  const backup = createHistoryBackup(source());
  backup.history[0].workEnd = "18:00";
  backup.history[1].vacationCreditMinutes = 480;
  backup.history.push({ ...backup.history[0], workEnd: "19:00" });
  const restored = restore(local, backup, "overwrite");
  assert.equal(restored.history.length, local.history.length);
  assert.equal(restored.history[0].workEnd, "18:00");
  assert.equal(restored.history[0].id, local.history[0].id);
  assert.equal(restored.history[0].revision, local.history[0].revision + 1);
  assert.equal(restored.history[1].vacationCreditMinutes, 480);
  assert.deepEqual(restored.history.slice(2), local.history.slice(2));
  assert.deepEqual(restored.settings, local.settings);
  assert.equal(restore(restored, backup, "overwrite"), restored);
  assert.throws(() => applyCommand(restored, { type: "deleteDay", date: local.history[0].date,
    id: local.history[0].id, recordRevision: local.history[0].revision }, today), /inzwischen geändert/);
});

test("explicit keep mode preserves matching records and adds missing dates", () => {
  const local = migrate(null, today);
  local.history = [day("2026-11-02", { workEnd: "12:00" })];
  const restored = restore(local, createHistoryBackup(source()), "keep");
  assert.deepEqual(restored.history[0], local.history[0]);
  assert.equal(restored.history.length, 4);
  const invalid = createHistoryBackup(source()); invalid.history.at(-1).date = "invalid";
  assert.throws(() => restore(local, invalid, "overwrite"), /keine gültige/);
  assert.equal(local.history.length, 1);
  assert.throws(() => restore(local, createHistoryBackup(source()), "unknown"), /Importoption/);
});

test("overwrite refreshes an unchanged loaded draft but preserves edited and reset drafts", () => {
  for (const kind of ["loaded", "edited", "reset"]) {
    const local = source();
    local.draft = draftFor("2026-11-02", local.history, kind !== "reset");
    if (kind === "edited") Object.assign(local.draft, { workEnd: "20:00", changedSinceLoad: true });
    const backup = createHistoryBackup(source()); backup.history[0].workEnd = "18:00";
    const restored = restore(local, backup, "overwrite");
    assert.equal(restored.draft.workEnd, kind === "loaded" ? "18:00" : kind === "edited" ? "20:00" : "");
    assert.equal(restored.draft.conflict, kind === "edited");
    assert.equal(restored.draftRevision, local.draftRevision + 1);
    if (kind !== "edited") {
      const next = applyCommand(restored, { type: "selectDate", date: today, expectedDraftRevision: restored.draftRevision }, today);
      assert.equal(next.history[0].workEnd, "18:00");
    }
  }
});

function deleteAll(data, expectedHistory = data.history) {
  return applyCommand(data, { type: "deleteAllHistory", expectedHistory }, today);
}

test("delete all removes duplicates, keeps settings and prevents an unchanged draft from restoring history", () => {
  const local = source(); local.history.push({ ...local.history[0], id: "duplicate" });
  local.draft = draftFor("2026-11-02", local.history);
  const cleared = deleteAll(local);
  assert.deepEqual(cleared.history, []);
  assert.deepEqual(cleared.settings, local.settings);
  assert.equal(cleared.draft.workStart, "08:00");
  assert.equal(cleared.draft.suppressedAfterDeletion, true);
  assert.equal(cleared.draft.historyReference, null);
  const next = applyCommand(cleared, { type: "selectDate", date: today, expectedDraftRevision: cleared.draftRevision }, today);
  assert.deepEqual(next.history, []);
  assert.equal(deleteAll(cleared), cleared);
  assert.equal(local.history.length, 5);
});

test("delete all preserves edited drafts with a conflict and rejects stale deletion confirmations", () => {
  const local = source(); local.draft = draftFor("2026-11-02", local.history);
  Object.assign(local.draft, { changedSinceLoad: true, workEnd: "20:00" });
  const cleared = deleteAll(local);
  assert.equal(cleared.draft.workEnd, "20:00");
  assert.equal(cleared.draft.conflict, true);
  assert.throws(() => applyCommand(cleared, { type: "newDay", expectedDraftRevision: cleared.draftRevision }, today), /inzwischen geändert/);
  const newer = structuredClone(local); newer.history[0].revision++;
  assert.throws(() => deleteAll(newer, local.history), /erneut aufrufen/);
  newer.history.push(day("2026-11-01"));
  assert.throws(() => deleteAll(newer, local.history), /erneut aufrufen/);
  assert.throws(() => deleteAll(local, null), /erneut aufrufen/);
});

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

test("a backup without days restores past targets when local history is empty", () => {
  const original = source(), local = migrate(null, today);
  local.settings.targetSchedule.changes = [{ effectiveFrom: "2026-11-06", weeklyTargetMinutes: 2700 }];
  assert.equal(restore(local, createHistoryBackup(local)), local);
  original.history = [];
  const backup = createHistoryBackup(original);
  const restored = restore(local, backup);
  assert.deepEqual(restored.history, []);
  assert.equal(weeklyTarget(restored.settings, "2026-11-04"), 2550);
  assert.equal(weeklyTarget(restored.settings, today), 2400);
  assert.equal(weeklyTarget(restored.settings, "2026-11-06"), 2700);
  assert.equal(restore(restored, backup), restored);
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
