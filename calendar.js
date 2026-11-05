import { formatDate, localDate, parseDate } from "./dates.js";
import { canonicalDays } from "./statistics-calculations.js";

const kindLabels = { work: "Arbeitstag", vacation: "Ferientag", compensation: "Überzeitkompensation" };

export function createCalendar(root, { onSelect, selectEmpty = false }) {
  const $ = selector => root.querySelector(selector);
  let month = localDate().slice(0, 7), history = [], selectedDate = null, disabled = false;
  root.innerHTML = `
    <div class="calendar-heading"><button id="previousMonth" class="icon-button" type="button" aria-label="Vorheriger Monat">←</button><h2 id="monthLabel" aria-live="polite"></h2><button id="nextMonth" class="icon-button" type="button" aria-label="Nächster Monat">→</button></div>
    <div class="calendar-weekdays" aria-hidden="true"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>
    <div id="calendarDays" class="calendar-days"></div>
    <div class="calendar-legend"><span class="legend-work">Arbeit</span><span class="legend-vacation">Ferien</span><span class="legend-compensation">Kompensation</span></div>`;

  function render() {
    const first = parseDate(`${month}-01`);
    root.dataset.month = month;
    $("#monthLabel").textContent = first.toLocaleDateString("de-CH", { month: "long", year: "numeric" });
    const offset = (first.getDay() + 6) % 7;
    const last = new Date(first); last.setMonth(last.getMonth() + 1, 0);
    const days = canonicalDays(history), today = localDate();
    const focused = $("#calendarDays").contains(document.activeElement) ? document.activeElement.dataset.date : null;
    $("#calendarDays").replaceChildren();
    for (let index = 0; index < offset; index++) {
      const spacer = document.createElement("span"); spacer.setAttribute("aria-hidden", "true"); $("#calendarDays").append(spacer);
    }
    for (let day = 1; day <= last.getDate(); day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`, entry = days.get(date);
      const button = document.createElement("button");
      button.type = "button"; button.dataset.date = date;
      button.className = `calendar-day${entry ? ` has-entry ${entry.kind}` : ""}${date === selectedDate ? " selected" : ""}`;
      button.textContent = day; button.disabled = disabled || (!selectEmpty && !entry);
      button.setAttribute("aria-label", `${formatDate(date)}${entry ? `, ${kindLabels[entry.kind]}, gespeichert` : ", kein Eintrag"}`);
      if (selectEmpty) button.setAttribute("aria-pressed", String(date === selectedDate));
      if (date === today) { button.classList.add("today"); button.setAttribute("aria-current", "date"); }
      button.addEventListener("click", () => { if (!button.disabled) onSelect(date, entry); });
      $("#calendarDays").append(button);
      if (focused === date && !button.disabled) button.focus();
    }
    $("#previousMonth").disabled = disabled || month === "0001-01";
    $("#nextMonth").disabled = disabled || month === "9999-12";
  }

  function moveMonth(amount) {
    if (disabled || (amount < 0 && month === "0001-01") || (amount > 0 && month === "9999-12")) return;
    const date = parseDate(`${month}-01`); date.setMonth(date.getMonth() + amount);
    month = localDate(date).slice(0, 7); render();
  }
  $("#previousMonth").addEventListener("click", () => moveMonth(-1));
  $("#nextMonth").addEventListener("click", () => moveMonth(1));

  return {
    update(options) {
      if (options.month !== undefined) month = options.month;
      if (options.history !== undefined) history = options.history;
      if (options.selectedDate !== undefined) selectedDate = options.selectedDate;
      if (options.disabled !== undefined) disabled = options.disabled;
      render();
    },
    focusDate(date) { $(`button[data-date="${date}"]`)?.focus(); },
  };
}
