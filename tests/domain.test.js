import test from "node:test";
import assert from "node:assert/strict";
import { localDate, parseDate, shiftDate } from "../dates.js";
import { applyCommand, assertState, draftFor, emptyDay, migrate } from "../state.js";
import { calculateWork, formatDuration, normalizeTime } from "../time-calculations.js";
import { calculateStatistics, canonicalDays, dailyTarget } from "../statistics-calculations.js";

const TODAY = "2026-10-29";
let id = 0;
function command(data, type, fields = {}, today = TODAY) {
  return applyCommand(data, { type, expectedDraftRevision: data.draftRevision, ...fields }, today, () => `day-${++id}`);
}
function edit(data, fields) {
  return command(data, "saveDraft", { fields: { ...data.draft, ...fields } });
}
function record(date, patch = {}) {
  return { ...emptyDay(date), workStart: "08:00", workEnd: "16:00", id: `record-${++id}`, revision: 1, ...patch };
}
function withDays(days) { return { ...migrate(null, TODAY), history: days }; }

test("local dates survive leap days and daylight-saving boundaries", () => {
  assert.equal(parseDate("2026-02-29"), null);
  assert.equal(localDate(parseDate("2024-02-29")), "2024-02-29");
  assert.equal(shiftDate("2026-03-28", 1), "2026-03-29");
  assert.equal(shiftDate("2026-03-29", 1), "2026-03-30");
  assert.equal(shiftDate("2026-10-25", -1), "2026-10-24");
  assert.equal(localDate(parseDate("0001-01-01")), "0001-01-01");
});

test("time shorthand stays compatible and invalid times are rejected", () => {
  for (const value of ["800", "0800", "8:00", "8"]) assert.equal(normalizeTime(value), "08:00");
  for (const value of ["24:00", "08:60", "-1", "abc", "8::00"]) assert.equal(normalizeTime(value), null);
  assert.equal(formatDuration(-504, true), "−8:24");
});

test("merged, clipped and fixed pauses are subtracted without double counting", () => {
  const day = record(TODAY, { workEnd: "17:00", breaks: [
    { start: "12:00", end: "13:00" }, { start: "12:30", end: "13:30" },
    { start: "16:30", end: "18:00" }, { duration: 30 },
  ] });
  assert.deepEqual(calculateWork(day), { worked: 390, complete: true, incompleteBreaks: 0 });
});

test("overnight work and pauses retain original timeline rules", () => {
  const day = record(TODAY, { workStart: "22:00", workEnd: "06:00", breaks: [{ start: "23:45", end: "00:15" }, { duration: 30 }] });
  assert.equal(calculateWork(day).worked, 420);
  assert.equal(calculateWork(day).complete, true);
});

test("open times never use an implicit current clock", () => {
  const day = record(TODAY, { workEnd: "" });
  assert.equal(calculateWork(day).worked, 0);
  assert.equal(calculateWork(day, "10:00").worked, 120);
  assert.equal(calculateWork(day, "10:00").complete, false);
});

test("empty pause rows are allowed but begun incomplete pauses prevent completeness", () => {
  assert.equal(calculateWork(record(TODAY, { breaks: [{ start: "", end: "" }] })).complete, true);
  assert.equal(calculateWork(record(TODAY, { breaks: [{ start: "12:00", end: "" }] })).complete, false);
  assert.equal(calculateWork(record(TODAY, { breaks: [{ start: "", end: "12:00" }] })).complete, false);
  assert.equal(calculateWork(record(TODAY, { breaks: [{ duration: 500 }] })).complete, false);
});

test("legacy content has no guessed date and retains settings and all pauses", () => {
  const legacy = { targetTime: "08:30", theme: "dark", workStart: "08:00", breaks: [{ duration: 30 }, { start: "12:00", end: "13:00" }] };
  const data = migrate(legacy, TODAY);
  assert.equal(data.draft.date, null);
  assert.equal(data.draft.workStart, "08:00");
  assert.deepEqual(data.draft.breaks, legacy.breaks);
  assert.equal(data.settings.theme, "dark");
  assert.equal(data.settings.targetSchedule.baselineWeeklyMinutes, 2550);
  assert.equal(data.settings.vacationCreditMinutes, 510);
  const assigned = command(data, "selectDate", { date: "2026-10-26" });
  assert.equal(assigned.draft.workStart, "08:00");
  assert.equal(assigned.history.length, 0);
  assert.equal(command(assigned, "newDay").history[0].date, "2026-10-26");
});

test("date switch saves old date, loads new date and later updates the original record", () => {
  let data = edit(migrate(null, TODAY), { workStart: "08:00", workEnd: "16:00" });
  data = command(data, "selectDate", { date: "2026-10-28" });
  assert.equal(data.history[0].date, TODAY);
  assert.equal(data.draft.workStart, "");
  data = command(data, "selectDate", { date: TODAY });
  assert.equal(data.draft.workEnd, "16:00");
  const originalId = data.history[0].id;
  data = edit(data, { workEnd: "17:00" });
  data = command(data, "newDay");
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].id, originalId);
  assert.equal(data.history[0].workEnd, "17:00");
  assert.equal(data.draft.workStart, "");
});

test("empty drafts and empty break rows never create history records", () => {
  let data = migrate(null, TODAY);
  data = edit(data, { breaks: [{ start: "", end: "" }] });
  data = command(data, "newDay");
  data = command(data, "selectDate", { date: "2026-10-28" });
  assert.equal(data.history.length, 0);
});

test("partial entries and fixed pauses are preserved without counting as worked days", () => {
  let data = edit(migrate(null, TODAY), { workStart: "08:00" });
  data = command(data, "newDay");
  assert.equal(data.history[0].workEnd, "");
  data = edit(data, { breaks: [{ duration: 30 }] });
  data = command(data, "newDay");
  assert.equal(data.history.length, 1);
  assert.deepEqual(data.history[0].breaks, [{ duration: 30 }]);
});

for (const action of ["resetDay", "newDay"]) test(`${action} protects today's archived record from a blank reset and later date switch`, () => {
  let data = withDays([record(TODAY)]);
  data.draft = draftFor(TODAY, data.history);
  data = command(data, action);
  assert.equal(data.draft.date, TODAY);
  assert.equal(data.draft.workStart, "");
  data = command(data, "selectDate", { date: "2026-10-28" });
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].workStart, "08:00");
  data = command(data, "selectDate", { date: TODAY });
  assert.equal(data.draft.workStart, "08:00");
});

test("reset discards edits while new day archives them", () => {
  const initial = withDays([record(TODAY)]);
  initial.draft = draftFor(TODAY, initial.history);
  const dirty = edit(initial, { workEnd: "18:00" });
  assert.equal(command(dirty, "resetDay").history[0].workEnd, "16:00");
  assert.equal(command(dirty, "newDay").history[0].workEnd, "18:00");
  assert.equal(dirty.history[0].workEnd, "16:00", "commands do not mutate their input");
});

test("a newly filled draft after reset intentionally updates today's first record", () => {
  let data = withDays([record(TODAY)]);
  data = command(data, "resetDay");
  data = edit(data, { workStart: "09:00", workEnd: "17:00" });
  data = command(data, "newDay");
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].workStart, "09:00");
});

test("clearing every field cannot remove or blank out a saved record", () => {
  let data = withDays([record(TODAY)]);
  data.draft = draftFor(TODAY, data.history);
  data = edit(data, { workStart: "", workEnd: "" });
  data = command(data, "newDay");
  assert.equal(data.history[0].workStart, "08:00");
});

test("first duplicate is loaded and updated; explicit deletion removes all duplicates", () => {
  const first = record(TODAY), second = record(TODAY, { workStart: "09:00" });
  let data = withDays([first, second]);
  data.draft = draftFor(TODAY, data.history);
  assert.equal(data.draft.workStart, "08:00");
  data = edit(data, { workEnd: "17:00" });
  data = command(data, "newDay");
  assert.equal(data.history.length, 2);
  assert.equal(data.history[0].workEnd, "17:00");
  assert.deepEqual(data.history[1], second);
  data = command(data, "deleteDay", { date: TODAY, id: first.id, recordRevision: 2 });
  assert.equal(data.history.length, 0);
});

test("vacation credit is stamped only on marking, never on loading or resaving", () => {
  let data = edit(migrate(null, TODAY), { workStart: "08:00", workEnd: "16:00", kind: "vacation" });
  data = command(data, "settings", { patch: { vacationCreditMinutes: 480 } });
  data = command(data, "newDay");
  assert.equal(data.history[0].vacationCreditMinutes, 510);
  data = command(data, "selectDate", { date: "2026-10-28" });
  data = command(data, "selectDate", { date: TODAY });
  data = edit(data, {});
  data = command(data, "newDay");
  assert.equal(data.history[0].vacationCreditMinutes, 510);
  data = command(data, "selectDate", { date: "2026-10-28" });
  data = edit(data, { kind: "vacation" });
  assert.equal(data.draft.vacationCreditMinutes, 480);
});

test("changing day types preserves times while excluding them from work", () => {
  let data = edit(migrate(null, TODAY), { workStart: "08:00", workEnd: "16:00", breaks: [{ duration: 30 }] });
  data = edit(data, { kind: "vacation" });
  assert.equal(calculateWork(data.draft).worked, 0);
  data = edit(data, { kind: "compensation" });
  assert.equal(data.draft.vacationCreditMinutes, null);
  data = edit(data, { kind: "work" });
  assert.equal(calculateWork(data.draft).worked, 450);
});

test("settings changes retain the historical target, including retroactive entry dates", () => {
  let data = migrate(null, "2026-10-26");
  data = command(data, "settings", { patch: { weeklyTargetMinutes: 2520 } }, "2026-10-27");
  assert.equal(dailyTarget(data.settings, "2026-10-26"), 480);
  assert.equal(dailyTarget(data.settings, "2026-10-27"), 504);
  data = command(data, "settings", { patch: { weeklyTargetMinutes: 2550 } }, "2026-10-27");
  assert.equal(data.settings.targetSchedule.changes.length, 1);
  assert.equal(dailyTarget(data.settings, "2026-10-26"), 480);
  assert.equal(dailyTarget(data.settings, "2026-10-27"), 510);
  assert.equal(dailyTarget(data.settings, "2026-10-31"), 0);
});

test("invalid historical times block archiving without losing draft or changing date", () => {
  const data = edit(migrate(null, TODAY), { workStart: "29:00" });
  assert.throws(() => command(data, "selectDate", { date: "2026-10-28" }), /gültige Uhrzeiten/);
  assert.equal(data.draft.date, TODAY);
  assert.equal(data.draft.workStart, "29:00");
  assert.equal(data.history.length, 0);
  assert.equal(command(data, "resetDay").draft.workStart, "");
});

test("stale draft and stale deletion revisions cannot overwrite newer data", () => {
  const data = edit(migrate(null, TODAY), { workStart: "08:00" });
  assert.throws(() => applyCommand(data, { type: "resetDay", expectedDraftRevision: 0 }, TODAY), /anderen Fenster/);
  const saved = command(data, "newDay");
  assert.throws(() => command(saved, "deleteDay", { date: TODAY, id: saved.history[0].id, recordRevision: 0 }), /inzwischen geändert/);
});

test("deleting an unchanged loaded day suppresses automatic resurrection", () => {
  let data = withDays([record(TODAY)]);
  data.draft = draftFor(TODAY, data.history);
  data = command(data, "deleteDay", { date: TODAY, id: data.history[0].id, recordRevision: 1 });
  const deleted = data;
  data = command(data, "selectDate", { date: "2026-10-28" });
  assert.equal(data.history.length, 0);
  const deliberatelyEdited = edit(deleted, { workEnd: "17:00" });
  assert.equal(command(deliberatelyEdited, "newDay").history.length, 1);
});

test("deleting a day with a dirty draft preserves it and blocks silent restoration", () => {
  let data = withDays([record(TODAY)]);
  data.draft = draftFor(TODAY, data.history);
  data = edit(data, { workEnd: "18:00" });
  data = command(data, "deleteDay", { date: TODAY, id: data.history[0].id, recordRevision: 1 });
  assert.equal(data.draft.workEnd, "18:00");
  assert.equal(data.draft.conflict, true);
  assert.throws(() => command(data, "newDay"), /inzwischen geändert oder gelöscht/);
  assert.equal(command(data, "resetDay").history.length, 0);
});

test("statistics separate work, vacation and compensation without a double debit", () => {
  const data = withDays([record("2026-10-26"), record("2026-10-27", { kind: "vacation", vacationCreditMinutes: 510 }), record("2026-10-28", { kind: "compensation" })]);
  const result = calculateStatistics(data, TODAY);
  assert.equal(result.worked, 480); assert.equal(result.vacation, 510); assert.equal(result.target, 1440);
  assert.equal(result.balance, -450); assert.equal(result.average, 480);
  assert.equal(result.workDays, 1); assert.equal(result.vacationDays, 1); assert.equal(result.quality, 100);
});

test("today and future dates are excluded from every statistic", () => {
  const data = withDays([record("2026-10-28"), record(TODAY, { kind: "vacation", vacationCreditMinutes: 510 }), record("2026-10-30")]);
  const result = calculateStatistics(data, TODAY);
  assert.equal(result.start, "2026-10-28"); assert.equal(result.end, "2026-10-28");
  assert.equal(result.worked, 480); assert.equal(result.vacation, 0); assert.equal(result.workDays, 1); assert.equal(result.expected, 1);
  assert.equal(calculateStatistics(withDays([record(TODAY)]), TODAY), null);
});

test("partial weeks are weighted by expected days, not averaged percentages", () => {
  const data = withDays(["2026-10-15", "2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21"].map(date => record(date)));
  const result = calculateStatistics(data, "2026-10-24");
  assert.equal(result.expected, 7); assert.equal(result.filled, 5); assert.equal(result.quality, 100 * 5 / 7);
});

test("weekend completion is capped per week and duplicates cannot improve quality", () => {
  const dates = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-19"];
  const data = withDays(dates.map(date => record(date)));
  data.history.push(record("2026-10-19", { workEnd: "23:00" }));
  const result = calculateStatistics(data, "2026-10-24");
  assert.equal(result.expected, 10); assert.equal(result.filled, 6); assert.equal(result.quality, 60);
  assert.equal(result.workDays, 7); assert.equal(canonicalDays(data.history).size, 7);
});

test("quality depends on completeness, not achieved hours", () => {
  const data = withDays(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(date => record(date, { workEnd: "10:00" })));
  assert.equal(calculateStatistics(data, "2026-10-24").quality, 80);
  data.history[0].workEnd = "";
  const result = calculateStatistics(data, "2026-10-24");
  assert.equal(result.quality, 60); assert.equal(result.workDays, 3); assert.equal(result.average, 120); assert.equal(result.incompleteDays, 1);
});

test("weekend-only periods have work but no target and no quality denominator", () => {
  const result = calculateStatistics(withDays([record("2026-10-24")]), "2026-10-25");
  assert.equal(result.target, 0); assert.equal(result.worked, 480); assert.equal(result.quality, null);
});

test("zero work days have no average; deleting the first day moves the start", () => {
  const data = withDays([record("2026-10-26", { kind: "vacation", vacationCreditMinutes: 510 }), record("2026-10-28", { kind: "compensation" })]);
  assert.equal(calculateStatistics(data, TODAY).average, null);
  data.history.shift();
  assert.equal(calculateStatistics(data, TODAY).start, "2026-10-28");
  data.history = [];
  assert.equal(calculateStatistics(data, TODAY), null);
});

test("invalid schema or settings cannot corrupt a valid state", () => {
  const data = migrate(null, TODAY);
  assert.throws(() => assertState({ schemaVersion: 99 }), /unbekanntes Format/);
  assert.throws(() => command(data, "settings", { patch: { weeklyTargetMinutes: -1 } }), /gültige Stundenzahl/);
  assert.equal(data.settings.targetSchedule.changes.length, 0);
});
