import { parseDate } from "./dates.js";
import { importHistory } from "./history-backup.js";
import { canonicalDays } from "./statistics-calculations.js";
import { hasContent, normalizeTime, timeToMinutes, validTimes } from "./time-calculations.js";

export const STORAGE_KEY = "workTimeData";
export const LEGACY_KEY = "workTimeState";
export const CONFLICT_MESSAGE = "Der gespeicherte Tag wurde inzwischen geändert oder gelöscht. Deine Erfassung bleibt erhalten. Bitte sichere bei Bedarf die angezeigten Zeiten, wähle „Tag zurücksetzen“ und rufe das gewünschte Datum erneut auf.";

export function emptyDay(date) {
  return { date, kind: "work", workStart: "", workEnd: "", breaks: [], vacationCreditMinutes: null };
}

function reference(day) {
  return day ? { id: day.id, revision: day.revision } : null;
}

export function draftFor(date, history, load = true) {
  const day = canonicalDays(history).get(date);
  const fields = day && load ? dayFields(day) : emptyDay(date);
  return { ...fields, changedSinceLoad: false, historyReference: reference(day), suppressedAfterDeletion: false, conflict: false };
}

function dayFields(day) {
  return { date: day.date, kind: day.kind, workStart: day.workStart, workEnd: day.workEnd,
    breaks: structuredClone(day.breaks), vacationCreditMinutes: day.vacationCreditMinutes };
}

export function migrate(legacy, today) {
  const old = legacy ?? {};
  const daily = timeToMinutes(old.targetTime) ?? 480;
  const draft = draftFor(today, []);
  draft.workStart = typeof old.workStart === "string" ? old.workStart : "";
  draft.workEnd = typeof old.workEnd === "string" ? old.workEnd : "";
  draft.breaks = Array.isArray(old.breaks) ? old.breaks.map(pause => "duration" in pause
    ? { duration: Number(pause.duration) } : { start: pause.start ?? "", end: pause.end ?? "" }) : [];
  if (hasContent(draft)) { draft.date = null; draft.changedSinceLoad = true; }
  return { schemaVersion: 2, revision: 0, draftRevision: 0, settings: {
    theme: old.theme === "dark" ? "dark" : "light", language: "de", vacationCreditMinutes: 510,
    targetSchedule: { baselineWeeklyMinutes: daily * 5, changes: [] },
  }, draft, history: [] };
}

export function assertState(data) {
  if (!data || data.schemaVersion !== 2 || !Number.isInteger(data.revision) || !Number.isInteger(data.draftRevision) ||
      !Array.isArray(data.history) || !data.draft || !data.settings?.targetSchedule ||
      !Array.isArray(data.settings.targetSchedule.changes)) throw new Error("Die gespeicherten Daten haben ein unbekanntes Format. Sie wurden nicht verändert.");
  const validNumber = value => Number.isFinite(value) && value >= 0;
  const validDay = day => day && (day.date === null || parseDate(day.date)) &&
    ["work", "vacation", "compensation"].includes(day.kind) && typeof day.workStart === "string" &&
    typeof day.workEnd === "string" && Array.isArray(day.breaks) && day.breaks.every(pause => pause &&
      ("duration" in pause ? Number.isFinite(pause.duration) && pause.duration > 0 : typeof pause.start === "string" && typeof pause.end === "string")) &&
    (day.kind !== "vacation" || validNumber(day.vacationCreditMinutes));
  if (!validDay(data.draft) || !validNumber(data.settings.vacationCreditMinutes) ||
      !validNumber(data.settings.targetSchedule.baselineWeeklyMinutes) ||
      !data.settings.targetSchedule.changes.every(change => parseDate(change.effectiveFrom) && validNumber(change.weeklyTargetMinutes)) ||
      !data.history.every(day => validDay(day) && parseDate(day.date) && typeof day.id === "string" && Number.isInteger(day.revision))) {
    throw new Error("Die gespeicherten Daten sind unvollständig oder ungültig. Sie wurden nicht verändert.");
  }
  return data;
}

function archive(data, makeId) {
  const draft = data.draft;
  if (draft.conflict) throw new Error(CONFLICT_MESSAGE);
  if (!hasContent(draft) || draft.suppressedAfterDeletion) return;
  if (!parseDate(draft.date)) throw new Error("Bitte den übernommenen Zeiten zuerst ein Datum zuordnen.");
  if (draft.kind === "work" && !validTimes(draft)) throw new Error("Bitte gültige Uhrzeiten zwischen 00:00 und 23:59 eingeben.");
  const existing = canonicalDays(data.history).get(draft.date);
  const expected = draft.historyReference;
  if (existing ? !expected || existing.id !== expected.id || existing.revision !== expected.revision : expected !== null) throw new Error(CONFLICT_MESSAGE);
  if (existing && !draft.changedSinceLoad) return;
  const record = { ...dayFields(draft), workStart: normalizeTime(draft.workStart) ?? draft.workStart,
    workEnd: normalizeTime(draft.workEnd) ?? draft.workEnd,
    id: existing?.id ?? makeId(), revision: (existing?.revision ?? 0) + 1 };
  record.breaks = record.breaks.map(pause => "duration" in pause ? pause : {
    start: normalizeTime(pause.start) ?? pause.start, end: normalizeTime(pause.end) ?? pause.end,
  });
  if (existing) data.history[data.history.indexOf(existing)] = record;
  else data.history.push(record);
}

export function applyCommand(current, command, today, makeId = () => crypto.randomUUID()) {
  assertState(current);
  const data = structuredClone(current);
  const draftCommands = ["saveDraft", "selectDate", "newDay", "resetDay"];
  if (draftCommands.includes(command.type) && command.expectedDraftRevision !== data.draftRevision) {
    throw new Error("Die Erfassung wurde in einem anderen Fenster geändert. Bitte das Fenster erneut öffnen; deine letzte lokal gesicherte Erfassung bleibt erhalten.");
  }
  switch (command.type) {
    case "importHistory":
    case "importHistoryWithMode":
      if (!importHistory(data, command.backup, today, makeId, command.type === "importHistory" ? "keep" : command.mode)) return current;
      break;
    case "deleteAllHistory": {
      const expected = command.expectedHistory;
      if (!Array.isArray(expected) || expected.length !== data.history.length || !expected.every((day, index) => day &&
          day.date === data.history[index].date && day.id === data.history[index].id && day.revision === data.history[index].revision)) {
        throw new Error("Die History wurde inzwischen geändert. Bitte das Löschen erneut aufrufen und bestätigen.");
      }
      if (!data.history.length) return current;
      if (canonicalDays(data.history).has(data.draft.date)) {
        if (data.draft.changedSinceLoad) data.draft.conflict = true;
        else { data.draft.historyReference = null; data.draft.suppressedAfterDeletion = true; }
        data.draftRevision++;
      }
      data.history = [];
      break;
    }
    case "saveDraft": {
      const before = JSON.stringify(dayFields(data.draft));
      const fields = command.fields;
      if (!fields || !["work", "vacation", "compensation"].includes(fields.kind) || typeof fields.workStart !== "string" || typeof fields.workEnd !== "string" || !Array.isArray(fields.breaks)) throw new Error("Ungültige Tageserfassung.");
      data.draft.workStart = fields.workStart;
      data.draft.workEnd = fields.workEnd;
      data.draft.breaks = structuredClone(fields.breaks);
      if (fields.kind !== data.draft.kind) {
        data.draft.vacationCreditMinutes = fields.kind === "vacation" ? data.settings.vacationCreditMinutes : null;
        data.draft.kind = fields.kind;
      }
      if (before !== JSON.stringify(dayFields(data.draft))) {
        data.draft.changedSinceLoad = true;
        data.draft.suppressedAfterDeletion = false;
      }
      break;
    }
    case "selectDate": {
      if (!parseDate(command.date)) throw new Error("Bitte ein gültiges Datum wählen.");
      if (command.date === data.draft.date) return current;
      if (data.draft.date === null) {
        if (canonicalDays(data.history).has(command.date)) throw new Error("Für dieses Datum existiert bereits ein Eintrag. Bitte ein freies Datum zuordnen.");
        data.draft.date = command.date;
        data.draft.changedSinceLoad = true;
      } else {
        archive(data, makeId);
        data.draft = draftFor(command.date, data.history);
      }
      break;
    }
    case "newDay":
      archive(data, makeId);
      data.draft = draftFor(today, data.history, false);
      break;
    case "resetDay":
      data.draft = draftFor(today, data.history, false);
      break;
    case "deleteDay": {
      if (!parseDate(command.date)) throw new Error("Ungültiges Datum.");
      const day = canonicalDays(data.history).get(command.date);
      if (!day || day.id !== command.id || day.revision !== command.recordRevision) throw new Error("Der Eintrag wurde inzwischen geändert. Bitte die Details erneut öffnen.");
      data.history = data.history.filter(entry => entry.date !== command.date);
      if (data.draft.date === command.date) {
        if (data.draft.changedSinceLoad) data.draft.conflict = true;
        else { data.draft.historyReference = null; data.draft.suppressedAfterDeletion = true; }
        data.draftRevision++;
      }
      break;
    }
    case "settings": {
      const patch = command.patch ?? {};
      if ("language" in patch) {
        if (!["de", "en", "nb", "fr"].includes(patch.language)) throw new Error("Ungültige Sprache.");
        data.settings.language = patch.language;
      }
      if ("theme" in patch) {
        if (!["light", "dark"].includes(patch.theme)) throw new Error("Ungültige Darstellung.");
        data.settings.theme = patch.theme;
      }
      for (const key of ["weeklyTargetMinutes", "vacationCreditMinutes"]) {
        if (key in patch && (!Number.isFinite(patch[key]) || patch[key] < 0 || patch[key] > (key === "weeklyTargetMinutes" ? 10080 : 1440))) throw new Error("Bitte eine gültige Stundenzahl eingeben.");
      }
      if ("vacationCreditMinutes" in patch) data.settings.vacationCreditMinutes = patch.vacationCreditMinutes;
      if ("weeklyTargetMinutes" in patch) {
        const changes = data.settings.targetSchedule.changes.filter(change => change.effectiveFrom !== today);
        changes.push({ effectiveFrom: today, weeklyTargetMinutes: patch.weeklyTargetMinutes });
        data.settings.targetSchedule.changes = changes.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      }
      break;
    }
    default: throw new Error("Unbekannte Speicheraktion.");
  }
  if (draftCommands.includes(command.type)) data.draftRevision++;
  data.revision++;
  return assertState(data);
}
