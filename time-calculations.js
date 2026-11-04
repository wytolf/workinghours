export function normalizeTime(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return "";
  if (!/^\d{1,4}$|^\d{1,2}:\d{0,2}$/.test(cleaned)) return null;
  let hours, minutes;
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
  } else {
    hours = Number(cleaned.length <= 2 ? cleaned : cleaned.slice(0, -2));
    minutes = cleaned.length <= 2 ? 0 : Number(cleaned.slice(-2));
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTimeWhileTyping(value) {
  const cleaned = value.replace(/[^\d:]/g, "");
  if (cleaned.includes(":")) {
    const [hours, ...parts] = cleaned.split(":");
    return `${hours.slice(0, 2)}:${parts.join("").slice(0, 2)}`;
  }
  const digits = cleaned.slice(0, 4);
  if (digits.length < 2) return digits;
  if (digits.length === 2) return Number(digits[0]) > 2 || Number(digits) > 23 ? `${digits[0]}:${digits[1]}` : digits;
  if (digits.length === 3) return Number(digits.slice(0, 2)) <= 23 ? `${digits.slice(0, 2)}:${digits[2]}` : `${digits[0]}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function currentTime(now = new Date()) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function formatDuration(minutes, signed = false) {
  const rounded = Math.round(minutes);
  const absolute = Math.abs(rounded);
  const sign = signed ? (rounded > 0 ? "+" : rounded < 0 ? "−" : "±") : "";
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
}

export function validTimes(day) {
  return [day.workStart, day.workEnd].every(value => normalizeTime(value) !== null) &&
    day.breaks.every(pause => "duration" in pause
      ? Number.isFinite(pause.duration) && pause.duration > 0
      : [pause.start, pause.end].every(value => normalizeTime(value) !== null));
}

export function hasContent(day) {
  return day.kind !== "work" || Boolean(day.workStart || day.workEnd) || day.breaks.some(pause => pause.duration || pause.start || pause.end);
}

export function calculateWork(day, liveEnd = null) {
  if (day.kind !== "work") return { worked: 0, complete: false, incompleteBreaks: 0 };
  const start = timeToMinutes(day.workStart);
  let end = timeToMinutes(day.workEnd || liveEnd);
  const incompleteBreaks = day.breaks.filter(pause => !("duration" in pause) && Boolean(pause.start || pause.end) && (!pause.start || !pause.end)).length;
  if (start === null || end === null || !validTimes(day)) return { worked: 0, complete: false, incompleteBreaks };
  if (end < start) end += 1440;
  const intervals = [];
  let fixed = 0;
  const timeline = value => {
    const minute = timeToMinutes(value);
    return minute < start ? minute + 1440 : minute;
  };
  for (const pause of day.breaks) {
    if ("duration" in pause) { fixed += pause.duration; continue; }
    if (!pause.start) continue;
    const from = timeline(pause.start);
    let to = pause.end ? timeline(pause.end) : end;
    if (to < from) to += 1440;
    const clipped = [Math.max(start, from), Math.min(end, to)];
    if (clipped[1] > clipped[0]) intervals.push(clipped);
  }
  const merged = [];
  for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (!last || interval[0] > last[1]) merged.push([...interval]);
    else last[1] = Math.max(last[1], interval[1]);
  }
  const paused = merged.reduce((sum, [from, to]) => sum + to - from, 0);
  const worked = Math.max(0, end - start - paused - fixed);
  return { worked, complete: Boolean(day.workEnd) && incompleteBreaks === 0 && worked > 0, incompleteBreaks };
}
