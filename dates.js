export function localDate(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return year >= 1 && localDate(date) === value ? date : null;
}

export function shiftDate(value, days) {
  const date = parseDate(value);
  if (!date) throw new Error("Bitte ein gültiges Datum wählen.");
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function isWeekday(value) {
  const day = parseDate(value).getDay();
  return day !== 0 && day !== 6;
}

export function weekStart(value) {
  return shiftDate(value, -((parseDate(value).getDay() + 6) % 7));
}

export function formatDate(value, options) {
  return parseDate(value)?.toLocaleDateString("de-CH", options ?? { day: "2-digit", month: "2-digit", year: "numeric" }) ?? "Ohne Datum";
}
