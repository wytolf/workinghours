import { parseDate } from "./dates.js";
import { canonicalDays, weeklyTarget } from "./statistics-calculations.js";
import { validTimes } from "./time-calculations.js";

const FORMAT = "workinghours-history";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const INVALID = "Die Datei ist keine gültige Arbeitszeit-History-Sicherung. Es wurden keine Daten importiert.";

function dayFields(day) {
  return { date: day.date, kind: day.kind, workStart: day.workStart, workEnd: day.workEnd,
    breaks: day.breaks.map(pause => "duration" in pause ? { duration: pause.duration } : { start: pause.start, end: pause.end }),
    vacationCreditMinutes: day.kind === "vacation" ? day.vacationCreditMinutes : null };
}

export function createHistoryBackup(data) {
  return { format: FORMAT, version: 1, targetSchedule: structuredClone(data.settings.targetSchedule),
    history: [...canonicalDays(data.history).values()].map(dayFields) };
}

export function validateHistoryBackup(value) {
  const minutes = (number, max) => typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= max;
  const schedule = value?.targetSchedule;
  if (value?.format !== FORMAT || value.version !== 1 || !Array.isArray(value.history) || !schedule ||
      !minutes(schedule.baselineWeeklyMinutes, 10080) || !Array.isArray(schedule.changes) ||
      !schedule.changes.every(change => change && typeof change.effectiveFrom === "string" && parseDate(change.effectiveFrom) && minutes(change.weeklyTargetMinutes, 10080))) throw new Error(INVALID);
  const dates = new Set();
  for (const change of schedule.changes) {
    if (dates.has(change.effectiveFrom)) throw new Error(INVALID);
    dates.add(change.effectiveFrom);
  }
  for (const day of value.history) {
    if (!day || typeof day.date !== "string" || !parseDate(day.date) || !["work", "vacation", "compensation"].includes(day.kind) ||
        typeof day.workStart !== "string" || typeof day.workEnd !== "string" || !Array.isArray(day.breaks) ||
        !day.breaks.every(pause => pause && typeof pause === "object" && ("duration" in pause
          ? Number.isFinite(pause.duration) && pause.duration > 0
          : typeof pause.start === "string" && typeof pause.end === "string")) ||
        (day.kind === "work" && !validTimes(day)) ||
        (day.kind === "vacation" && !minutes(day.vacationCreditMinutes, 1440))) throw new Error(INVALID);
  }
  return { history: value.history.map(dayFields), targetSchedule: {
    baselineWeeklyMinutes: schedule.baselineWeeklyMinutes,
    changes: schedule.changes.map(change => ({ effectiveFrom: change.effectiveFrom, weeklyTargetMinutes: change.weeklyTargetMinutes })),
  } };
}

export function parseHistoryBackup(text) {
  let value;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error(INVALID); }
  validateHistoryBackup(value);
  return value;
}

// Called only inside the background worker's serialized storage command.
export function importHistory(data, value, today, makeId, mode = "keep") {
  if (!["keep", "overwrite"].includes(mode)) throw new Error("Bitte eine gültige Importoption wählen.");
  const backup = validateHistoryBackup(value);
  const existing = canonicalDays(data.history);
  const incoming = [...canonicalDays(backup.history).values()].filter(day => {
    const saved = existing.get(day.date);
    return !saved || (mode === "overwrite" && JSON.stringify(dayFields(saved)) !== JSON.stringify(day));
  });
  let scheduleChanged = false;
  if (!data.history.length) {
    const localSchedule = data.settings.targetSchedule;
    const targetSchedule = { baselineWeeklyMinutes: backup.targetSchedule.baselineWeeklyMinutes,
      changes: [...backup.targetSchedule.changes.filter(change => change.effectiveFrom < today),
        ...localSchedule.changes.filter(change => change.effectiveFrom >= today)] };
    const weeklyTargetMinutes = weeklyTarget(data.settings, today);
    if (weeklyTarget({ targetSchedule }, today) !== weeklyTargetMinutes) {
      targetSchedule.changes.push({ effectiveFrom: today, weeklyTargetMinutes });
    }
    targetSchedule.changes.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    scheduleChanged = JSON.stringify(targetSchedule) !== JSON.stringify(localSchedule);
    if (scheduleChanged) data.settings.targetSchedule = targetSchedule;
  }
  for (const day of incoming) {
    const saved = existing.get(day.date);
    const record = { ...day, id: saved?.id ?? makeId(), revision: (saved?.revision ?? 0) + 1 };
    if (saved) data.history[data.history.indexOf(saved)] = record;
    else data.history.push(record);
    if (data.draft.date === day.date) {
      // Keep edited inputs; refresh an unchanged loaded entry after replacement.
      if (data.draft.changedSinceLoad) data.draft.conflict = true;
      else {
        if (saved && JSON.stringify(dayFields(data.draft)) === JSON.stringify(dayFields(saved))) Object.assign(data.draft, dayFields(record));
        data.draft.historyReference = { id: record.id, revision: record.revision };
      }
      data.draftRevision++;
    }
  }
  return incoming.length > 0 || scheduleChanged;
}
