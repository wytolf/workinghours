import { formatDate, localDate } from "./dates.js";
import { calculateStatistics } from "./statistics-calculations.js";
import { formatDuration } from "./time-calculations.js";
import { applyTheme, onDataChanged, send } from "./storage.js";
import { formatNumber, setLanguage, t, translateTree } from "./i18n.js";

const $ = selector => document.querySelector(selector);
let data;
function render() {
  if (!data) return;
  setLanguage(data.settings.language);
  translateTree();
  applyTheme(data.settings.theme);
  const result = calculateStatistics(data, localDate());
  $("#emptyState").hidden = Boolean(result); $("#statisticsContent").hidden = !result;
  $("#period").textContent = result ? `${formatDate(result.start)} – ${formatDate(result.end)}` : t("Alle gespeicherten Tage bis gestern");
  if (!result) return;
  for (const key of ["worked", "vacation", "target"]) $(`#${key}`).textContent = formatDuration(result[key]);
  $("#balance").textContent = formatDuration(result.balance, true);
  $("#balanceCard").className = `balance ${result.balance > 0 ? "positive" : result.balance < 0 ? "negative" : "neutral"}`;
  $("#average").textContent = result.average === null ? "—" : formatDuration(result.average);
  $("#dayCounts").textContent = `${result.workDays} / ${result.vacationDays}`;
  $("#quality").textContent = result.quality === null ? "—" : `${formatNumber(result.quality, { maximumFractionDigits: 1 })} %`;
  $("#qualityCount").textContent = t("{filled} von {expected} erwarteten Tagen (wochenweise gedeckelt).").replace("{filled}", result.filled).replace("{expected}", result.expected);
  $("#incompleteNote").hidden = !result.incompleteDays;
  $("#incompleteNote").textContent = t("{days} gespeicherte Arbeitstage ohne vollständige positive Nettozeit liefern keine Arbeitsstunden und zählen nicht für Durchschnitt oder Datenqualität.").replace("{days}", result.incompleteDays);
}
$("#closeWindow").addEventListener("click", () => window.close());
onDataChanged(updated => {
  if (data && updated.revision <= data.revision) return;
  const relevant = !data || JSON.stringify([data.history, data.settings]) !== JSON.stringify([updated.history, updated.settings]);
  data = updated;
  if (relevant) render();
});
send({ type: "read" }).then(result => {
  if (!data || result.revision >= data.revision) { data = result; render(); }
}).catch(error => { $("#error").textContent = t(error.message); $("#error").hidden = false; });
setInterval(render, 30_000);
