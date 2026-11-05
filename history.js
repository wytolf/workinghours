import { createCalendar } from "./calendar.js";
import { formatDate } from "./dates.js";
import { canonicalDays, dailyTarget } from "./statistics-calculations.js";
import { calculateWork, formatDuration } from "./time-calculations.js";
import { applyTheme, onDataChanged, openWindow, send } from "./storage.js";

const $ = selector => document.querySelector(selector);
const kindLabels = { work: "Arbeitstag", vacation: "Ferientag", compensation: "Überzeitkompensation" };
let data, selected = null, deleting = false;
const dialog = $("#dayDialog");
const calendar = createCalendar($("#historyCalendar"), { onSelect: (date, entry) => openDetails(entry) });

function showError(error) {
  const target = dialog.open ? $("#detailError") : $("#error");
  target.textContent = error.message; target.hidden = false;
}

function renderCalendar() {
  applyTheme(data.settings.theme);
  calendar.update({ history: data.history });
  $("#historyHint").hidden = canonicalDays(data.history).size > 0;
  $("#historyHint").textContent = $("#historyHint").hidden ? "" : "Noch keine Tage in der History gespeichert.";
}

function detailRow(list, label, value) {
  const title = document.createElement("dt"), content = document.createElement("dd");
  title.textContent = label; content.textContent = value; list.append(title, content);
}

function openDetails(day) {
  selected = day;
  $("#detailDate").textContent = formatDate(day.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  $("#detailKind").textContent = kindLabels[day.kind];
  $("#detailContent").replaceChildren();
  $("#detailError").hidden = true; $("#deleteConfirmation").hidden = true; $("#deleteDay").hidden = false;
  const list = document.createElement("dl"); list.className = "detail-list";
  const result = calculateWork(day), target = dailyTarget(data.settings, day.date);
  const worked = result.complete ? result.worked : 0, vacation = day.kind === "vacation" ? day.vacationCreditMinutes : 0;
  detailRow(list, "Gearbeitet", `${formatDuration(worked)} Std.`);
  if (day.kind === "vacation") detailRow(list, "Feriengutschrift", `${formatDuration(vacation)} Std.`);
  detailRow(list, "Sollzeit", `${formatDuration(target)} Std.`);
  detailRow(list, "Saldo", `${formatDuration(worked + vacation - target, true)} Std.`);
  detailRow(list, "Arbeitsbeginn", day.workStart || "—"); detailRow(list, "Feierabend", day.workEnd || "—");
  $("#detailContent").append(list);
  if (day.breaks.length) {
    const heading = document.createElement("h3"); heading.textContent = "Pausen";
    const pauses = document.createElement("ul"); pauses.className = "detail-breaks";
    for (const pause of day.breaks) {
      const item = document.createElement("li");
      item.textContent = "duration" in pause ? `${pause.duration} Minuten (fest)` : `${pause.start || "offen"} – ${pause.end || "offen"}`;
      pauses.append(item);
    }
    $("#detailContent").append(heading, pauses);
  }
  if (day.kind !== "work" || !result.complete) {
    const note = document.createElement("p"); note.className = "hint";
    note.textContent = day.kind !== "work" ? "Vorhandene Arbeitszeiten und Pausen werden bei dieser Tagesart nicht angerechnet."
      : "Unvollständiger Arbeitstag oder keine positive Nettozeit: zählt nicht als ausgefüllter Arbeitstag und liefert keine statistischen Arbeitsstunden.";
    $("#detailContent").append(note);
  }
  if (!dialog.open) dialog.showModal();
}

$("#closeWindow").addEventListener("click", () => window.close());
$("#closeDetails").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { selected = null; });
$("#openStatistics").addEventListener("click", () => openWindow("statistics.html").catch(showError));
$("#deleteDay").addEventListener("click", () => { $("#deleteDay").hidden = true; $("#deleteConfirmation").hidden = false; $("#cancelDelete").focus(); });
$("#cancelDelete").addEventListener("click", () => { $("#deleteConfirmation").hidden = true; $("#deleteDay").hidden = false; $("#deleteDay").focus(); });
$("#confirmDelete").addEventListener("click", async () => {
  if (deleting || !selected) return;
  deleting = true; $("#confirmDelete").disabled = true;
  const day = selected;
  try {
    data = await send({ type: "deleteDay", date: day.date, id: day.id, recordRevision: day.revision });
    dialog.close(); renderCalendar();
    $("#historyHint").hidden = false;
    $("#historyHint").textContent = `Eintrag vom ${formatDate(day.date)} gelöscht.`; $("#previousMonth").focus();
  } catch (error) { showError(error); }
  finally { deleting = false; $("#confirmDelete").disabled = false; }
});
onDataChanged(updated => {
  if (data && updated.revision <= data.revision) return;
  const relevant = !data || JSON.stringify([data.history, data.settings]) !== JSON.stringify([updated.history, updated.settings]);
  data = updated;
  if (!relevant) return;
  renderCalendar();
  if (selected && !deleting) {
    const latest = canonicalDays(data.history).get(selected.date);
    if (latest) openDetails(latest); else dialog.close();
  }
});
send({ type: "read" }).then(result => {
  if (!data || result.revision >= data.revision) { data = result; renderCalendar(); }
}).catch(showError);
