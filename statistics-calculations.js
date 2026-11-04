import { isWeekday, parseDate, shiftDate, weekStart } from "./dates.js";
import { calculateWork } from "./time-calculations.js";

export function canonicalDays(history) {
  const days = new Map();
  for (const day of history) if (parseDate(day.date) && !days.has(day.date)) days.set(day.date, day);
  return days;
}

export function weeklyTarget(settings, date) {
  let target = settings.targetSchedule.baselineWeeklyMinutes;
  for (const change of [...settings.targetSchedule.changes].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))) {
    if (change.effectiveFrom <= date) target = change.weeklyTargetMinutes;
  }
  return target;
}

export function dailyTarget(settings, date) {
  return date && isWeekday(date) ? weeklyTarget(settings, date) / 5 : 0;
}

export function calculateStatistics(data, today) {
  const end = shiftDate(today, -1);
  const days = [...canonicalDays(data.history).values()].filter(day => day.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  if (!days.length) return null;
  const start = days[0].date;
  let worked = 0, vacation = 0, workDays = 0, vacationDays = 0, incompleteDays = 0, target = 0;
  const weeks = new Map();
  const week = date => {
    const key = weekStart(date);
    if (!weeks.has(key)) weeks.set(key, { expected: 0, filled: 0 });
    return weeks.get(key);
  };
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    target += dailyTarget(data.settings, date);
    if (isWeekday(date)) week(date).expected++;
  }
  for (const day of days) {
    let filled = false;
    if (day.kind === "vacation") {
      vacation += day.vacationCreditMinutes;
      vacationDays++;
      filled = true;
    } else if (day.kind === "compensation") filled = true;
    else {
      const result = calculateWork(day);
      if (result.complete) { worked += result.worked; workDays++; filled = true; }
      else incompleteDays++;
    }
    if (filled) week(day.date).filled++;
  }
  let expected = 0, filled = 0;
  for (const count of weeks.values()) { expected += count.expected; filled += Math.min(count.filled, count.expected); }
  return { start, end, worked, vacation, target, balance: worked + vacation - target, workDays, vacationDays, incompleteDays,
    average: workDays ? worked / workDays : null, quality: expected ? 100 * filled / expected : null, expected, filled };
}
