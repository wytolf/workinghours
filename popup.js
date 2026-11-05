import { createCalendar } from "./calendar.js";
import { formatDate, localDate } from "./dates.js";
import { createHistoryBackup, MAX_BACKUP_BYTES, parseHistoryBackup } from "./history-backup.js";
import { dailyTarget, weeklyTarget } from "./statistics-calculations.js";
import { calculateWork, currentTime, formatDuration, formatTimeWhileTyping, normalizeTime } from "./time-calculations.js";
import { applyTheme, onDataChanged, openWindow, send } from "./storage.js";

const $ = selector => document.querySelector(selector);
let data, view, queue = Promise.resolve(), pending = 0, external = null, version = 0, busy = true;
let unsaved = false, stale = false;
let breakPage = 0, breakCounter = 0;
const BREAKS_PER_PAGE = 2;
const dateDialog = $("#dateDialog");
const calendar = createCalendar($("#dateCalendar"), { selectEmpty: true, onSelect: date => transition("selectDate", date) });

function showError(error) {
  const target = dateDialog.open ? $("#dateError") : $("#settingsView").hidden ? $("#error") : $("#settingsError");
  target.textContent = error.message;
  target.hidden = false;
}

function clearErrors() {
  $("#error").hidden = true;
  $("#settingsError").hidden = true;
  $("#dateError").hidden = true;
}

function acceptExternal(updated) {
  const draftChanged = updated.draftRevision !== data.draftRevision;
  data = updated;
  renderDatePicker();
  if (unsaved && draftChanged) {
    stale = true;
    applyTheme(data.settings.theme);
    showError(new Error("Die Erfassung wurde inzwischen geändert. Deine noch ungesicherten Eingaben bleiben sichtbar. Bitte sichere sie bei Bedarf und wähle „Tag zurücksetzen“."));
  } else if (draftChanged && !unsaved) {
    view = structuredClone(data.draft);
    render();
  } else {
    applyTheme(data.settings.theme);
    renderSettings();
    calculate();
  }
}

function enqueue(task) {
  pending++;
  const next = queue.then(task).catch(error => { showError(error); throw error; }).finally(() => {
    pending--;
    if (!pending && external && data && external.revision > data.revision) {
      acceptExternal(external);
    }
    if (!pending) external = null;
  });
  queue = next.catch(() => {});
  return next;
}

function formFields() {
  return {
    kind: $("#vacationDay").checked ? "vacation" : $("#compensationDay").checked ? "compensation" : "work",
    workStart: $("#workStart").value,
    workEnd: $("#workEnd").value,
    breaks: [...$("#breakList").children].map(row => row.dataset.kind === "fixed"
      ? { duration: Number(row.dataset.duration) }
      : { start: row.querySelector(".break-start").value, end: row.querySelector(".break-end").value }),
  };
}

function capture() {
  const fields = formFields();
  if (fields.kind !== view.kind) view.vacationCreditMinutes = fields.kind === "vacation" ? data.settings.vacationCreditMinutes : null;
  Object.assign(view, fields);
  unsaved = true;
  version++;
  return fields;
}

async function persist(fields, capturedVersion) {
  if (stale) throw new Error("Diese Erfassung wurde in einem anderen Fenster geändert. Deine Eingaben bleiben sichtbar; bitte vor „Tag zurücksetzen“ bei Bedarf sichern.");
  data = await send({ type: "saveDraft", fields, expectedDraftRevision: data.draftRevision });
  if (version === capturedVersion) { view = structuredClone(data.draft); unsaved = false; }
  applyTheme(data.settings.theme);
  calculate();
}

function edited() {
  if (busy || !data) return;
  clearErrors();
  const fields = capture(), capturedVersion = version;
  calculate();
  enqueue(() => persist(fields, capturedVersion)).catch(() => {});
}

function setBusy(value) {
  busy = value;
  for (const element of document.querySelectorAll("button, input")) element.disabled = value;
  if (!value) {
    $("#timeFields").disabled = view.kind !== "work";
    updateBreakPagination();
  }
  if (data) renderDatePicker();
}

function transition(type, date) {
  if (busy) return;
  clearErrors();
  const fields = capture(), capturedVersion = version;
  setBusy(true);
  enqueue(async () => {
    // Reset bypasses history saving and the date-change operation entirely.
    if (type !== "resetDay") await persist(fields, capturedVersion);
    data = await send({ type, date, expectedDraftRevision: data.draftRevision });
    stale = false;
    unsaved = false;
    view = structuredClone(data.draft);
    breakPage = 0;
    render();
    if (dateDialog.open) dateDialog.close();
  }).catch(() => { renderDatePicker(); }).finally(() => {
    setBusy(false);
    if (type !== "selectDate") $("#workStart").focus();
    else if (!dateDialog.open) $("#dayDate").focus();
    else calendar.focusDate(date);
  });
}

function attachTimeInput(input) {
  input.addEventListener("input", () => {
    input.value = formatTimeWhileTyping(input.value);
    input.removeAttribute("aria-invalid");
    edited();
  });
  input.addEventListener("blur", () => {
    if (busy) return;
    const normalized = normalizeTime(input.value);
    if (normalized === null) {
      input.setAttribute("aria-invalid", "true");
      showError(new Error("Bitte gültige Uhrzeiten zwischen 00:00 und 23:59 eingeben."));
    } else if (input.value !== normalized) { input.value = normalized; edited(); }
  });
  input.addEventListener("keydown", event => { if (event.key === "Enter") input.blur(); });
}

function addBreakRow(pause = { start: "", end: "" }, focus = false) {
  const fixed = "duration" in pause;
  const fragment = $(fixed ? "#fixedBreakTemplate" : "#breakTemplate").content.cloneNode(true);
  const row = fragment.firstElementChild;
  row.dataset.kind = fixed ? "fixed" : "timed";
  if (fixed) {
    row.dataset.duration = pause.duration;
    row.querySelector(".fixed-break-duration").textContent = `${pause.duration} Min`;
  } else {
    const id = ++breakCounter;
    for (const [index, part] of ["start", "end"].entries()) {
      const input = row.querySelector(`.break-${part}`);
      input.id = `break-${id}-${part}`;
      input.value = pause[part];
      row.querySelectorAll("label")[index].htmlFor = input.id;
      attachTimeInput(input);
    }
  }
  row.querySelector(".remove-break").addEventListener("click", () => {
    row.remove(); updateBreakPagination(); edited();
  });
  $("#breakList").append(fragment);
  if (focus) breakPage = Math.floor(($("#breakList").children.length - 1) / BREAKS_PER_PAGE);
  updateBreakPagination();
  if (focus && !fixed) row.querySelector("input").focus();
}

function updateBreakPagination() {
  const rows = [...$("#breakList").children];
  const count = Math.max(1, Math.ceil(rows.length / BREAKS_PER_PAGE));
  breakPage = Math.max(0, Math.min(breakPage, count - 1));
  rows.forEach((row, index) => { row.hidden = Math.floor(index / BREAKS_PER_PAGE) !== breakPage; });
  $("#emptyBreaks").hidden = rows.length > 0;
  $("#breakPager").hidden = count === 1;
  $("#breakPageLabel").textContent = `${breakPage + 1} / ${count}`;
  $("#previousBreakPage").disabled = busy || breakPage === 0;
  $("#nextBreakPage").disabled = busy || breakPage === count - 1;
}

function calculate() {
  if (!view || !data) return;
  const today = localDate();
  const live = view.date === today && view.kind === "work";
  const result = calculateWork(view, live ? currentTime() : null);
  const target = dailyTarget(data.settings, view.date);
  const credit = view.kind === "vacation" ? view.vacationCreditMinutes ?? 0 : 0;
  const balance = result.worked + credit - target;
  $("#workedDisplay").textContent = formatDuration(result.worked);
  $("#targetDisplay").textContent = view.date ? formatDuration(target) : "—";
  $("#balanceDisplay").textContent = view.date ? formatDuration(balance, true) : "—";
  $("#balanceLabel").textContent = balance > 0 ? "Überzeit" : balance < 0 ? "Minuszeit" : "Saldo";
  $("#balanceCard").className = `balance ${balance > 0 ? "positive" : balance < 0 ? "negative" : "neutral"}`;
  $("#dayLabel").textContent = !view.date ? "DATUM ZUORDNEN" : view.date === today ? "HEUTE" : formatDate(view.date, { weekday: "long" });
  $("#migrationHint").hidden = view.date !== null;
  $("#vacationNote").hidden = view.kind !== "vacation";
  $("#vacationNote").textContent = `Feriengutschrift: ${formatDuration(credit)} Std. (für diesen Tag gespeichert)`;
  $("#timeFields").disabled = busy || view.kind !== "work";
  let message = "Erfassung automatisch lokal gesichert. History-Speicherung beim Datumswechsel oder mit „Neuen Tag beginnen“.";
  if (view.conflict) message = "Dieser gespeicherte Tag wurde inzwischen geändert oder gelöscht. Deine Erfassung bleibt hier erhalten; bitte vor dem Zurücksetzen bei Bedarf die Zeiten sichern.";
  else if (!view.date) message = "Bitte den bisherigen Zeiten zuerst ein Datum zuordnen.";
  else if (view.kind === "compensation") message = "Überzeitkompensation: keine Arbeitsstunden, reguläre Sollzeit bleibt bestehen.";
  else if (view.kind === "vacation") message = "Es zählt ausschließlich die gespeicherte Feriengutschrift.";
  else if (result.incompleteBreaks && live) message = "Unvollständige Pause: für die Statistik bitte beide Uhrzeiten ergänzen.";
  else if (view.workStart && !view.workEnd) message = live ? "Live-Berechnung bis zur aktuellen Uhrzeit. Für die Statistik bitte Feierabend ergänzen." : "Unvollständig: Für historische Arbeitsstunden bitte Feierabend ergänzen.";
  $("#message").textContent = message;
}

function renderSettings() {
  const hours = value => Number((value / 60).toFixed(4)).toLocaleString("de-CH", { maximumFractionDigits: 4, useGrouping: false });
  if (document.activeElement !== $("#weeklyHours")) $("#weeklyHours").value = hours(weeklyTarget(data.settings, localDate()));
  if (document.activeElement !== $("#vacationHours")) $("#vacationHours").value = hours(data.settings.vacationCreditMinutes);
  for (const button of document.querySelectorAll("[data-theme-option]")) button.setAttribute("aria-pressed", String(button.dataset.themeOption === data.settings.theme));
}

function renderDatePicker() {
  $("#dayDate").textContent = view.date ? formatDate(view.date) : "Datum wählen";
  $("#dayDate").setAttribute("aria-label", view.date ? `Datum wählen, ${formatDate(view.date)}` : "Datum wählen");
  if (dateDialog.open) calendar.update({ history: data.history, selectedDate: view.date, disabled: busy });
}

function render() {
  applyTheme(data.settings.theme);
  renderDatePicker();
  $("#workStart").value = view.workStart;
  $("#workEnd").value = view.workEnd;
  $("#vacationDay").checked = view.kind === "vacation";
  $("#compensationDay").checked = view.kind === "compensation";
  $("#breakList").replaceChildren();
  view.breaks.forEach(pause => addBreakRow(pause));
  renderSettings();
  calculate();
}

for (const id of ["workStart", "workEnd"]) attachTimeInput($(`#${id}`));
$("#dayDate").addEventListener("click", () => {
  if (busy) return;
  $("#dateError").hidden = true;
  const date = view.date ?? localDate();
  calendar.update({ history: data.history, selectedDate: view.date, month: date.slice(0, 7), disabled: false });
  dateDialog.showModal();
  calendar.focusDate(date);
});
dateDialog.addEventListener("click", event => {
  if (event.target !== dateDialog) return;
  const bounds = dateDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dateDialog.close();
});
dateDialog.addEventListener("close", () => $("#dayDate").focus());
$("#resetDay").addEventListener("click", () => transition("newDay"));
$("#discardDay").addEventListener("click", () => transition("resetDay"));
$("#addBreak").addEventListener("click", () => { addBreakRow(undefined, true); edited(); });
for (const button of document.querySelectorAll(".quick-break")) button.addEventListener("click", () => { addBreakRow({ duration: Number(button.dataset.duration) }, true); edited(); });
$("#previousBreakPage").addEventListener("click", () => { breakPage--; updateBreakPagination(); });
$("#nextBreakPage").addEventListener("click", () => { breakPage++; updateBreakPagination(); });
for (const [id, other] of [["vacationDay", "compensationDay"], ["compensationDay", "vacationDay"]]) {
  $(`#${id}`).addEventListener("change", () => { if ($(`#${id}`).checked) $(`#${other}`).checked = false; edited(); });
}
$("#openSettings").addEventListener("click", () => {
  $("#mainView").hidden = true; $("#settingsView").hidden = false; renderSettings(); $("#weeklyHours").focus();
});
$("#closeSettings").addEventListener("click", () => { $("#settingsView").hidden = true; $("#mainView").hidden = false; $("#openSettings").focus(); });

function saveSettings(patch) {
  clearErrors();
  enqueue(async () => {
    acceptExternal(await send({ type: "settings", patch }));
    applyTheme(data.settings.theme);
    for (const button of document.querySelectorAll("[data-theme-option]")) button.setAttribute("aria-pressed", String(button.dataset.themeOption === data.settings.theme));
    calculate();
  }).catch(() => {});
}
for (const [id, key, max] of [["weeklyHours", "weeklyTargetMinutes", 168], ["vacationHours", "vacationCreditMinutes", 24]]) {
  $(`#${id}`).addEventListener("change", () => {
    const input = $(`#${id}`), value = input.value.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,4})?$/.test(value) || Number(value) > max) {
      input.setAttribute("aria-invalid", "true");
      showError(new Error(`Bitte eine Stundenzahl zwischen 0 und ${max} eingeben, zum Beispiel 8,5.`));
      return;
    }
    input.removeAttribute("aria-invalid");
    saveSettings({ [key]: Math.round(Number(value) * 60 * 10000) / 10000 });
  });
}
for (const button of document.querySelectorAll("[data-theme-option]")) button.addEventListener("click", () => saveSettings({ theme: button.dataset.themeOption }));

function transferHistory(task) {
  if (busy) return;
  clearErrors();
  $("#backupStatus").hidden = true;
  setBusy(true);
  enqueue(task).catch(() => {}).finally(() => setBusy(false));
}

$("#exportHistory").addEventListener("click", () => transferHistory(async () => {
  const latest = await send({ type: "read" });
  const backup = createHistoryBackup(latest);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `arbeitszeit-history-${localDate()}.json`;
  document.body.append(link);
  try {
    link.click();
    $("#backupStatus").textContent = `Export mit ${backup.history.length} gespeicherten Tagen zum Download übergeben.`;
    $("#backupStatus").hidden = false;
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}));
$("#importHistory").addEventListener("click", () => { if (!busy) $("#historyFile").click(); });
$("#historyFile").addEventListener("change", () => {
  const file = $("#historyFile").files?.[0];
  $("#historyFile").value = "";
  if (!file) return;
  transferHistory(async () => {
    if (file.size > MAX_BACKUP_BYTES) throw new Error("Die Sicherung darf höchstens 10 MB groß sein. Es wurden keine Daten importiert.");
    const backup = parseHistoryBackup(await file.text());
    const updated = await send({ type: "importHistory", backup });
    acceptExternal(updated);
    $("#backupStatus").textContent = "Import abgeschlossen. Fehlende Tage wurden ergänzt; vorhandene Tage bleiben erhalten.";
    $("#backupStatus").hidden = false;
  });
});

$("#openHistory").addEventListener("click", () => {
  if (busy) return;
  const fields = capture(), capturedVersion = version;
  setBusy(true);
  enqueue(async () => { await persist(fields, capturedVersion); await openWindow("history.html"); }).catch(() => {}).finally(() => setBusy(false));
});

onDataChanged(updated => {
  if (!data) { external = updated; return; }
  if (updated.revision <= data.revision) return;
  if (pending) { external = updated; return; }
  acceptExternal(updated);
});
setBusy(true);
send({ type: "read" }).then(result => {
  data = external && external.revision > result.revision ? external : result;
  external = null;
  view = structuredClone(data.draft); render(); setBusy(false);
}).catch(showError);
setInterval(() => calculate(), 30_000);
