const STORAGE_KEY = "workTimeState";

const elements = {
  mainView: document.querySelector("#mainView"),
  settingsView: document.querySelector("#settingsView"),
  openSettings: document.querySelector("#openSettings"),
  closeSettings: document.querySelector("#closeSettings"),
  targetTime: document.querySelector("#targetTime"),
  workStart: document.querySelector("#workStart"),
  workEnd: document.querySelector("#workEnd"),
  breakList: document.querySelector("#breakList"),
  emptyBreaks: document.querySelector("#emptyBreaks"),
  breakTemplate: document.querySelector("#breakTemplate"),
  fixedBreakTemplate: document.querySelector("#fixedBreakTemplate"),
  breakPager: document.querySelector("#breakPager"),
  breakPageLabel: document.querySelector("#breakPageLabel"),
  previousBreakPage: document.querySelector("#previousBreakPage"),
  nextBreakPage: document.querySelector("#nextBreakPage"),
  addBreak: document.querySelector("#addBreak"),
  quickBreakButtons: [...document.querySelectorAll(".quick-break")],
  themeButtons: [...document.querySelectorAll("[data-theme-option]")],
  setStartNow: document.querySelector("#setStartNow"),
  setEndNow: document.querySelector("#setEndNow"),
  resetDay: document.querySelector("#resetDay"),
  workedDisplay: document.querySelector("#workedDisplay"),
  targetDisplay: document.querySelector("#targetDisplay"),
  balanceDisplay: document.querySelector("#balanceDisplay"),
  balanceCard: document.querySelector("#balanceCard"),
  balanceLabel: document.querySelector("#balanceLabel"),
  message: document.querySelector("#message"),
};

let state = {
  targetTime: "08:00",
  workStart: "",
  workEnd: "",
  breaks: [],
  theme: "light",
};
let breakCounter = 0;
let breakPage = 0;
const BREAKS_PER_PAGE = 2;

function formatTimeWhileTyping(value) {
  const cleaned = value.replace(/[^\d:]/g, "");

  if (cleaned.includes(":")) {
    const [hours = "", ...minuteParts] = cleaned.split(":");
    const minutes = minuteParts.join("");
    return `${hours.slice(0, 2)}:${minutes.slice(0, 2)}`;
  }

  const digits = cleaned.slice(0, 4);
  if (digits.length < 2) return digits;

  if (digits.length === 2) {
    const firstTwo = Number(digits);
    return Number(digits[0]) > 2 || firstTwo > 23
      ? `${digits[0]}:${digits[1]}`
      : digits;
  }

  if (digits.length === 3) {
    return Number(digits.slice(0, 2)) <= 23
      ? `${digits.slice(0, 2)}:${digits[2]}`
      : `${digits[0]}:${digits.slice(1)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTime(value) {
  const cleaned = value.trim().replace(/[^\d:]/g, "");
  if (!cleaned) return "";

  let hours;
  let minutes;

  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    if (parts.length !== 2 || !parts[0]) return null;
    hours = Number(parts[0]);
    minutes = parts[1] === "" ? 0 : Number(parts[1]);
  } else {
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length <= 2) {
      hours = Number(digits);
      minutes = 0;
    } else if (digits.length === 3) {
      hours = Number(digits[0]);
      minutes = Number(digits.slice(1));
    } else if (digits.length === 4) {
      hours = Number(digits.slice(0, 2));
      minutes = Number(digits.slice(2));
    } else {
      return null;
    }
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToClock(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function currentTime() {
  const now = new Date();
  return minutesToClock(now.getHours() * 60 + now.getMinutes());
}

function formatDuration(totalMinutes, signed = false) {
  const rounded = Math.round(totalMinutes);
  const absolute = Math.abs(rounded);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const sign = signed ? (rounded > 0 ? "+" : rounded < 0 ? "−" : "±") : "";
  return `${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

function getNormalizedInput(input) {
  const normalized = normalizeTime(input.value);
  return normalized === null ? "" : normalized;
}

function collectStateFromForm() {
  const targetTime = normalizeTime(elements.targetTime.value);
  const workStart = normalizeTime(elements.workStart.value);
  const workEnd = normalizeTime(elements.workEnd.value);

  if (targetTime) state.targetTime = targetTime;
  if (workStart !== null) state.workStart = workStart;
  if (workEnd !== null) state.workEnd = workEnd;

  state.breaks = [...elements.breakList.children].map((row) => {
    if (row.dataset.kind === "fixed") {
      return { duration: Number(row.dataset.duration) };
    }
    return {
      start: getNormalizedInput(row.querySelector(".break-start")),
      end: getNormalizedInput(row.querySelector(".break-end")),
    };
  });
}

async function saveState() {
  collectStateFromForm();
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  calculate();
}

function showTimeError(input) {
  input.setAttribute("aria-invalid", "true");
  elements.message.textContent = "Bitte eine gültige Uhrzeit zwischen 00:00 und 23:59 eingeben.";
}

function attachTimeInput(input) {
  input.addEventListener("input", () => {
    const formatted = formatTimeWhileTyping(input.value);
    if (input.value !== formatted) input.value = formatted;
    input.removeAttribute("aria-invalid");

    const normalized = normalizeTime(input.value);
    if (normalized !== null) saveState();
  });

  input.addEventListener("blur", () => {
    if (!input.value) {
      input.removeAttribute("aria-invalid");
      saveState();
      return;
    }

    const normalized = normalizeTime(input.value);
    if (!normalized) {
      showTimeError(input);
      return;
    }

    input.value = normalized;
    input.removeAttribute("aria-invalid");
    saveState();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });
}

function addBreakRow(breakData = { start: "", end: "" }, shouldSave = true, shouldFocus = false) {
  const fragment = elements.breakTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".break-row");
  const startInput = row.querySelector(".break-start");
  const endInput = row.querySelector(".break-end");
  const labels = row.querySelectorAll("label");
  const id = ++breakCounter;

  row.dataset.kind = "timed";
  startInput.id = `break-${id}-start`;
  endInput.id = `break-${id}-end`;
  labels[0].htmlFor = startInput.id;
  labels[1].htmlFor = endInput.id;
  startInput.value = breakData.start || "";
  endInput.value = breakData.end || "";
  attachTimeInput(startInput);
  attachTimeInput(endInput);

  row.querySelector(".remove-break").addEventListener("click", () => {
    row.remove();
    updateBreakPagination();
    saveState();
  });

  elements.breakList.append(row);
  if (shouldFocus) breakPage = Math.ceil(elements.breakList.children.length / BREAKS_PER_PAGE) - 1;
  updateBreakPagination();
  if (shouldSave) saveState();
  if (shouldFocus) startInput.focus();
}

function addFixedBreakRow(duration, shouldSave = true) {
  const fragment = elements.fixedBreakTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".fixed-break-row");
  row.dataset.kind = "fixed";
  row.dataset.duration = String(duration);
  row.querySelector(".fixed-break-duration").textContent = `${duration} Min`;
  row.querySelector(".remove-break").addEventListener("click", () => {
    row.remove();
    updateBreakPagination();
    saveState();
  });

  elements.breakList.append(row);
  breakPage = Math.ceil(elements.breakList.children.length / BREAKS_PER_PAGE) - 1;
  updateBreakPagination();
  if (shouldSave) saveState();
}

function updateBreakPagination() {
  const rows = [...elements.breakList.children];
  const pageCount = Math.max(1, Math.ceil(rows.length / BREAKS_PER_PAGE));
  breakPage = Math.max(0, Math.min(breakPage, pageCount - 1));

  rows.forEach((row, index) => {
    row.hidden = Math.floor(index / BREAKS_PER_PAGE) !== breakPage;
  });

  elements.emptyBreaks.hidden = rows.length > 0;
  elements.breakPager.hidden = rows.length <= BREAKS_PER_PAGE;
  elements.breakPageLabel.textContent = `${breakPage + 1} / ${pageCount}`;
  elements.previousBreakPage.disabled = breakPage === 0;
  elements.nextBreakPage.disabled = breakPage === pageCount - 1;
}

function toTimelineMinute(value, workStartMinute) {
  let minute = timeToMinutes(value);
  if (minute === null) return null;
  if (minute < workStartMinute) minute += 1440;
  return minute;
}

function mergeIntervals(intervals) {
  const sorted = intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];

  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1]) {
      merged.push([...interval]);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }

  return merged;
}

function calculate() {
  const startMinute = timeToMinutes(state.workStart);
  const target = timeToMinutes(state.targetTime) ?? 0;
  let worked = 0;
  let incompleteBreaks = 0;
  const fixedPauseMinutes = state.breaks.reduce(
    (total, pause) => total + (Number(pause.duration) || 0),
    0,
  );

  if (startMinute !== null) {
    const effectiveEnd = state.workEnd || currentTime();
    let endMinute = timeToMinutes(effectiveEnd);
    if (endMinute !== null && endMinute < startMinute) endMinute += 1440;

    if (endMinute !== null) {
      const pauseIntervals = [];

      for (const pause of state.breaks) {
        if (pause.duration) continue;
        if (!pause.start) {
          if (pause.end) incompleteBreaks += 1;
          continue;
        }

        const pauseStart = toTimelineMinute(pause.start, startMinute);
        let pauseEnd;

        if (pause.end) {
          pauseEnd = toTimelineMinute(pause.end, startMinute);
          if (pauseEnd < pauseStart) pauseEnd += 1440;
        } else {
          pauseEnd = endMinute;
          incompleteBreaks += 1;
        }

        const clippedStart = Math.max(startMinute, pauseStart);
        const clippedEnd = Math.min(endMinute, pauseEnd);
        if (clippedEnd > clippedStart) pauseIntervals.push([clippedStart, clippedEnd]);
      }

      const pauseMinutes = mergeIntervals(pauseIntervals).reduce(
        (total, [pauseStart, pauseEnd]) => total + pauseEnd - pauseStart,
        0,
      );
      worked = Math.max(0, endMinute - startMinute - pauseMinutes - fixedPauseMinutes);
    }
  }

  const balance = worked - target;
  elements.workedDisplay.textContent = formatDuration(worked);
  elements.targetDisplay.textContent = formatDuration(target);
  elements.balanceDisplay.textContent = formatDuration(balance, true);
  elements.balanceLabel.textContent = balance > 0 ? "Überzeit" : balance < 0 ? "Minuszeit" : "Saldo";
  elements.balanceCard.classList.toggle("positive", balance > 0);
  elements.balanceCard.classList.toggle("negative", balance < 0);
  elements.balanceCard.classList.toggle("neutral", balance === 0);


  if (!state.workStart) {
    elements.message.textContent = "Arbeitsbeginn eintragen oder „Start jetzt“ wählen.";
  } else if (incompleteBreaks > 0) {
    elements.message.textContent = "Eine offene Pause wird bis zur aktuellen Uhrzeit abgezogen.";
  } else if (!state.workEnd) {
    elements.message.textContent = "Live-Berechnung bis zur aktuellen Uhrzeit.";
  } else {
    elements.message.textContent = "Alle Werte sind lokal gespeichert.";
  }
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  elements.themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === state.theme));
  });
}

function openSettings() {
  elements.mainView.hidden = true;
  elements.settingsView.hidden = false;
  elements.targetTime.focus();
  elements.targetTime.select();
}

function closeSettings() {
  elements.settingsView.hidden = true;
  elements.mainView.hidden = false;
  elements.openSettings.focus();
}

function addQuickBreak(duration) {
  addFixedBreakRow(duration);
  elements.message.textContent = `${duration} Minuten Pause wurden abgezogen.`;
}

async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const saved = stored[STORAGE_KEY];

  if (saved) {
    state = {
      targetTime: normalizeTime(saved.targetTime) || "08:00",
      workStart: normalizeTime(saved.workStart) || "",
      workEnd: normalizeTime(saved.workEnd) || "",
      breaks: Array.isArray(saved.breaks) ? saved.breaks : [],
      theme: saved.theme === "dark" ? "dark" : "light",
    };
  }

  applyTheme(state.theme);
  elements.targetTime.value = state.targetTime;
  elements.workStart.value = state.workStart;
  elements.workEnd.value = state.workEnd;
  state.breaks.forEach((pause) => {
    if (pause.duration) addFixedBreakRow(Number(pause.duration), false);
    else addBreakRow(pause, false);
  });
  breakPage = 0;
  updateBreakPagination();
  calculate();
}

attachTimeInput(elements.targetTime);
attachTimeInput(elements.workStart);
attachTimeInput(elements.workEnd);

elements.openSettings.addEventListener("click", openSettings);
elements.closeSettings.addEventListener("click", closeSettings);
elements.addBreak.addEventListener("click", () => addBreakRow(undefined, true, true));
elements.previousBreakPage.addEventListener("click", () => {
  breakPage -= 1;
  updateBreakPagination();
});
elements.nextBreakPage.addEventListener("click", () => {
  breakPage += 1;
  updateBreakPagination();
});
elements.quickBreakButtons.forEach((button) => {
  button.addEventListener("click", () => addQuickBreak(Number(button.dataset.duration)));
});
elements.themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeOption);
    saveState();
  });
});

elements.setStartNow.addEventListener("click", () => {
  elements.workStart.value = currentTime();
  elements.workEnd.value = "";
  saveState();
});

elements.setEndNow.addEventListener("click", () => {
  if (!getNormalizedInput(elements.workStart)) {
    elements.message.textContent = "Bitte zuerst einen Arbeitsbeginn eintragen.";
    elements.workStart.focus();
    return;
  }
  elements.workEnd.value = currentTime();
  saveState();
});

elements.resetDay.addEventListener("click", async () => {
  const targetTime = state.targetTime || "08:00";
  const theme = state.theme;
  state = { targetTime, workStart: "", workEnd: "", breaks: [], theme };
  elements.workStart.value = "";
  elements.workEnd.value = "";
  elements.breakList.replaceChildren();
  breakPage = 0;
  updateBreakPagination();
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  calculate();
  elements.workStart.focus();
});

loadState();
setInterval(() => {
  collectStateFromForm();
  calculate();
}, 30_000);