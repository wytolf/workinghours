import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";
import { parseHTML } from "linkedom";
import { formatDate, localDate, shiftDate } from "../dates.js";
import { draftFor, emptyDay, migrate, STORAGE_KEY } from "../state.js";
import { createHistoryBackup, MAX_BACKUP_BYTES } from "../history-backup.js";

let stored = {}, listeners = new Set(), opened = [], failWrite = false, scriptId = 0;
const today = localDate(), yesterday = shiftDate(today, -1);
globalThis.setInterval = () => 0;
globalThis.chrome = {
  runtime: {
    id: "test-extension", onMessage: { addListener() {} },
    getURL: page => `chrome-extension://test-extension/${page}`,
    async sendMessage(message) {
      try { return { ok: true, data: await enqueue(message.command) }; }
      catch (error) { return { ok: false, error: error.message }; }
    },
  },
  storage: {
    local: {
      async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in stored).map(key => [key, structuredClone(stored[key])])); },
      async set(patch) {
        if (failWrite) { failWrite = false; throw new Error("Speicher voll"); }
        const changes = {};
        for (const [key, value] of Object.entries(patch)) changes[key] = { newValue: structuredClone(value) };
        Object.assign(stored, structuredClone(patch));
        queueMicrotask(() => { for (const listener of listeners) listener(changes, "local"); });
      },
    },
    onChanged: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) },
  },
  windows: {
    async getAll() { return []; }, async update() {},
    async create(options) { opened.push({ ...options, persisted: structuredClone(stored[STORAGE_KEY]) }); },
  },
};
const { enqueue } = await import("../background.js");

function day(date, patch = {}) { return { ...emptyDay(date), workStart: "08:00", workEnd: "16:00", id: `saved-${date}`, revision: 1, ...patch }; }
async function mount(page, initial = migrate(null, today)) {
  listeners = new Set(); opened = []; failWrite = false;
  stored = { [STORAGE_KEY]: structuredClone(initial) };
  const { window, document } = parseHTML(await readFile(new URL(`../${page}.html`, import.meta.url), "utf8"));
  globalThis.window = window; globalThis.document = document;
  Object.defineProperty(document, "activeElement", { value: document.body, writable: true, configurable: true });
  window.HTMLElement.prototype.focus = function () { this.ownerDocument.activeElement = this; };
  const dialog = document.querySelector("dialog");
  if (dialog) {
    dialog.open = false;
    dialog.showModal = function () { this.open = true; };
    dialog.close = function () { this.open = false; this.dispatchEvent(new window.Event("close")); };
  }
  window.close = () => {};
  await import(`../${page}.js?test=${++scriptId}`);
  await flush();
  return document;
}
async function flush() { await pause(15); }
function event(element, type) { element.dispatchEvent(new window.Event(type, { bubbles: true })); }
function enter(selector, value, type = "input") { const element = document.querySelector(selector); element.value = value; event(element, type); }
function click(selector) { event(document.querySelector(selector), "click"); }
function browseTo(date) {
  const targetMonth = date.slice(0, 7);
  while (document.querySelector(".calendar-card").dataset.month !== targetMonth) {
    const month = document.querySelector(".calendar-card").dataset.month;
    click(month < targetMonth ? "#nextMonth" : "#previousMonth");
  }
}
function chooseDate(date) {
  if (!document.querySelector("#dateDialog").open) click("#dayDate");
  browseTo(date);
  click(`button[data-date="${date}"]`);
}
function check(selector, value = true) { document.querySelector(selector).checked = value; event(document.querySelector(selector), "change"); }
function importFile(text, size = text.length) {
  const input = document.querySelector("#historyFile");
  input.files = [{ size, async text() { return text; } }];
  event(input, "change");
}

test("settings export a large history within the import limit and without a draft", async () => {
  const initial = migrate(null, today);
  const breaks = Array.from({ length: 250 }, () => ({ start: "12:00", end: "12:01" }));
  initial.history = Array.from({ length: 1000 }, (_, index) => day(shiftDate(yesterday, -index), { breaks }));
  await mount("popup", initial); click("#openSettings");
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const originalTimeout = globalThis.setTimeout;
  let blob, link, revoked;
  URL.createObjectURL = value => { blob = value; return "blob:test-history"; };
  URL.revokeObjectURL = value => { revoked = value; };
  globalThis.setTimeout = callback => { callback(); };
  const originalClick = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () { if (this.tagName === "A") link = this; };
  try {
    click("#exportHistory"); await flush();
    assert.ok(blob.size <= MAX_BACKUP_BYTES);
    const backup = JSON.parse(await blob.text());
    assert.equal(backup.history[0].date, yesterday);
    assert.equal(backup.history.length, initial.history.length);
    assert.equal(backup.draft, undefined);
    assert.equal(link.getAttribute("download"), `arbeitszeit-history-${today}.json`);
    assert.equal(revoked, "blob:test-history");
    assert.match(document.querySelector("#backupStatus").textContent, /1000 gespeicherten Tagen/);
    assert.equal(document.querySelector("#exportHistory").disabled, false);
    assert.deepEqual(stored[STORAGE_KEY], initial);
  } finally {
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    globalThis.setTimeout = originalTimeout;
    window.HTMLElement.prototype.click = originalClick;
  }
});

test("settings import a file, support repeating it and retain an edited draft", async () => {
  const initial = migrate(null, today), saved = migrate(null, today);
  saved.history = [day(yesterday), day(today)];
  await mount("popup", initial); enter("#workStart", "900"); await flush(); click("#openSettings");
  const json = JSON.stringify(createHistoryBackup(saved));
  importFile(json); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 2);
  assert.equal(stored[STORAGE_KEY].draft.workStart, "9:00");
  assert.equal(stored[STORAGE_KEY].draft.conflict, true);
  assert.equal(document.querySelector("#historyFile").value, "");
  assert.equal(document.querySelector("#backupStatus").hidden, false);
  const revision = stored[STORAGE_KEY].revision;
  importFile(json); await flush();
  assert.equal(stored[STORAGE_KEY].revision, revision);
  click("#closeSettings");
  assert.equal(document.querySelector("#workStart").value, "9:00");
});

test("an outdated background worker shows extension reload instructions without changing history", async () => {
  await mount("popup"); click("#openSettings");
  const before = structuredClone(stored[STORAGE_KEY]);
  const saved = migrate(null, today); saved.history = [day(yesterday)];
  const original = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async message => message.command.type === "importHistoryWithMode"
    ? { ok: false, error: "Unbekannte Speicheraktion." } : original(message);
  try {
    importFile(JSON.stringify(createHistoryBackup(saved))); await flush();
    assert.match(document.querySelector("#settingsError").textContent, /Hintergrundprozess.*Erweiterung.*neu laden/);
    assert.equal(document.querySelector("#backupStatus").hidden, true);
    assert.equal(document.querySelector("#importHistory").disabled, false);
    assert.deepEqual(stored[STORAGE_KEY], before);
  } finally { chrome.runtime.sendMessage = original; }
});

test("settings reject malformed or oversized files and report write failures without success", async () => {
  await mount("popup"); click("#openSettings");
  const before = structuredClone(stored[STORAGE_KEY]);
  for (const [text, size, message] of [["invalid", 7, /gültige.*Sicherung/], ["{}", MAX_BACKUP_BYTES + 1, /10 MB/]]) {
    importFile(text, size); await flush();
    assert.match(document.querySelector("#settingsError").textContent, message);
    assert.equal(document.querySelector("#backupStatus").hidden, true);
    assert.deepEqual(stored[STORAGE_KEY], before);
    assert.equal(document.querySelector("#importHistory").disabled, false);
  }
  const saved = migrate(null, today); saved.history = [day(yesterday)];
  failWrite = true;
  importFile(JSON.stringify(createHistoryBackup(saved))); await flush();
  assert.match(document.querySelector("#settingsError").textContent, /Speicher voll/);
  assert.equal(document.querySelector("#backupStatus").hidden, true);
  assert.deepEqual(stored[STORAGE_KEY], before);
});

test("settings import uses the selected conflict option for matching dates", async () => {
  const initial = migrate(null, today), saved = migrate(null, today);
  initial.history = [day(yesterday), day(shiftDate(today, -2))];
  saved.history = [day(yesterday, { workEnd: "18:00" })];
  await mount("popup", initial); click("#openSettings");
  assert.equal(document.querySelector("#historyImportMode").value, "keep");
  const json = JSON.stringify(createHistoryBackup(saved));
  importFile(json); await flush();
  assert.equal(stored[STORAGE_KEY].history[0].workEnd, "16:00");
  const select = document.querySelector("#historyImportMode");
  select.querySelector('[value="keep"]').selected = false;
  select.querySelector('[value="overwrite"]').selected = true;
  importFile(json); await flush();
  assert.equal(stored[STORAGE_KEY].history[0].workEnd, "18:00");
  assert.deepEqual(stored[STORAGE_KEY].history[1], initial.history[1]);
  assert.match(document.querySelector("#backupStatus").textContent, /überschrieben/);
});

test("delete all requires confirmation, supports cancellation and leaves an empty history after navigation", async () => {
  const initial = migrate(null, today); initial.history = [day(today), day(yesterday)];
  initial.draft = draftFor(today, initial.history);
  await mount("popup", initial); click("#openSettings");
  click("#confirmDeleteHistory"); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 2);
  click("#deleteAllHistory");
  assert.equal(document.querySelector("#deleteHistoryConfirmation").hidden, false);
  assert.equal(document.activeElement.id, "cancelDeleteHistory");
  click("#cancelDeleteHistory");
  assert.equal(document.querySelector("#deleteHistoryConfirmation").hidden, true);
  assert.equal(stored[STORAGE_KEY].history.length, 2);
  click("#deleteAllHistory"); click("#confirmDeleteHistory"); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  assert.deepEqual(stored[STORAGE_KEY].settings, initial.settings);
  assert.equal(document.querySelector("#deleteAllHistory").disabled, true);
  assert.equal(document.querySelector("#deleteHistoryConfirmation").hidden, true);
  assert.match(document.querySelector("#backupStatus").textContent, /gelöscht/);
  click("#closeSettings");
  assert.equal(document.querySelector("#workStart").value, "08:00");
  chooseDate(yesterday); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 0);
});

test("delete all does not hide write errors or delete entries added after confirmation", async () => {
  const initial = migrate(null, today); initial.history = [day(yesterday)];
  await mount("popup", initial); click("#openSettings");
  click("#deleteAllHistory"); failWrite = true; click("#confirmDeleteHistory"); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 1);
  assert.equal(document.querySelector("#backupStatus").hidden, true);
  assert.match(document.querySelector("#settingsError").textContent, /Speicher voll/);
  click("#deleteAllHistory");
  const incoming = migrate(null, today); incoming.history = [day(shiftDate(today, -2))];
  await enqueue({ type: "importHistory", backup: createHistoryBackup(incoming) }); await flush();
  click("#confirmDeleteHistory"); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 2);
  assert.match(document.querySelector("#settingsError").textContent, /erneut aufrufen/);
});

test("manual end entry persists without an end now action", async () => {
  await mount("popup");
  assert.equal(document.querySelector("#setStartNow"), null);
  assert.equal(document.querySelector("#setEndNow"), null);
  enter("#workStart", "800");
  await flush();
  assert.equal(document.querySelector("#workEnd").value, "");
  assert.equal(stored[STORAGE_KEY].draft.workEnd, "");
  enter("#workEnd", "1700");
  event(document.querySelector("#workEnd"), "blur");
  await flush();
  assert.equal(document.querySelector("#workEnd").value, "17:00");
  assert.equal(stored[STORAGE_KEY].draft.workEnd, "17:00");
  assert.equal(document.querySelector("#workedDisplay").textContent, "9:00");
  assert.equal(document.querySelector("#error").hidden, true);
});

test("main date picker marks saved day types and highlights the selected date", async () => {
  const initial = migrate(null, today), month = today.slice(0, 7);
  initial.history = [day(`${month}-01`), day(`${month}-02`, { kind: "vacation", vacationCreditMinutes: 510 }),
    day(`${month}-03`, { kind: "compensation" }), day(`${month}-01`, { kind: "vacation", vacationCreditMinutes: 480 })];
  await mount("popup", initial);
  assert.equal(document.querySelector('input[type="date"]'), null);
  click("#dayDate");
  assert.equal(document.querySelector("#dateDialog").open, true);
  assert.equal(document.querySelector("#dateDialog").getAttribute("aria-label"), "Datum wählen");
  assert.equal(document.querySelectorAll(".has-entry").length, 3);
  for (const [number, kind] of [["01", "work"], ["02", "vacation"], ["03", "compensation"]]) {
    const button = document.querySelector(`button[data-date="${month}-${number}"]`);
    assert.ok(button.classList.contains(kind));
    assert.match(button.getAttribute("aria-label"), /gespeichert/);
    assert.equal(button.disabled, false);
  }
  assert.equal(document.querySelector(".selected").dataset.date, today);
  assert.equal(document.querySelector(".selected").getAttribute("aria-pressed"), "true");
  assert.equal(document.querySelector(".today").getAttribute("aria-current"), "date");
  assert.equal(document.activeElement.dataset.date, today);
  assert.equal(document.querySelector(`button[data-date="${month}-04"]`).disabled, false);
});

test("browsing and closing the main calendar leave the draft and history unchanged", async () => {
  await mount("popup"); enter("#workStart", "800"); await flush();
  const before = structuredClone(stored[STORAGE_KEY]);
  click("#dayDate");
  const nextMonth = shiftDate(`${today.slice(0, 7)}-01`, 32).slice(0, 7);
  click("#nextMonth");
  assert.equal(document.querySelector("#dateCalendar").dataset.month, nextMonth);
  const dialog = document.querySelector("#dateDialog");
  dialog.getBoundingClientRect = () => ({ left: 20, right: 360, top: 20, bottom: 400 });
  const insideClick = new window.Event("click", { bubbles: true });
  Object.assign(insideClick, { clientX: 25, clientY: 25 });
  dialog.dispatchEvent(insideClick);
  assert.equal(dialog.open, true, "Clicking the dialog padding must keep the calendar open");
  click("#monthLabel");
  assert.equal(dialog.open, true, "Clicking calendar content must keep the calendar open");
  const outsideClick = new window.Event("click", { bubbles: true });
  Object.assign(outsideClick, { clientX: 10, clientY: 200 });
  dialog.dispatchEvent(outsideClick); await flush();
  assert.equal(document.querySelector("#dateDialog").open, false);
  assert.equal(document.activeElement.id, "dayDate");
  assert.deepEqual(stored[STORAGE_KEY], before);
  click("#dayDate");
  assert.equal(document.querySelector("#dateCalendar").dataset.month, today.slice(0, 7));
});

test("calendar selection across months saves the old date and loads an existing entry", async () => {
  const initial = migrate(null, today), savedDate = shiftDate(today, -40), futureDate = shiftDate(today, 40);
  initial.history = [day(savedDate, { workStart: "09:00", workEnd: "18:00" })];
  await mount("popup", initial);
  enter("#workStart", "800"); enter("#workEnd", "1600");
  chooseDate(savedDate); await flush();
  assert.equal(document.querySelector("#dateDialog").open, false);
  assert.equal(document.querySelector("#dayDate").textContent, formatDate(savedDate));
  assert.equal(document.querySelector("#workStart").value, "09:00");
  assert.equal(document.querySelector("#workEnd").value, "18:00");
  assert.equal(stored[STORAGE_KEY].history.find(entry => entry.date === today).workEnd, "16:00");
  chooseDate(futureDate); await flush();
  assert.equal(stored[STORAGE_KEY].draft.date, futureDate);
  assert.equal(document.querySelector("#workStart").value, "");
  assert.equal(document.querySelector("#dateDialog").open, false);
  click("#dayDate"); browseTo(today);
  assert.ok(document.querySelector(`button[data-date="${today}"]`).classList.contains("has-entry"));
});

test("an open main calendar refreshes deleted markers without losing its displayed month", async () => {
  const initial = migrate(null, today), savedDate = shiftDate(today, -40);
  initial.history = [day(savedDate)];
  await mount("popup", initial);
  click("#dayDate"); browseTo(savedDate);
  const selector = `button[data-date="${savedDate}"]`;
  document.querySelector(selector).focus();
  assert.ok(document.querySelector(selector).classList.contains("has-entry"));
  await enqueue({ type: "deleteDay", date: savedDate, id: initial.history[0].id, recordRevision: 1 }); await flush();
  assert.equal(document.querySelector("#dateCalendar").dataset.month, savedDate.slice(0, 7));
  assert.equal(document.querySelector(selector).classList.contains("has-entry"), false);
  assert.equal(document.querySelector(selector).disabled, false);
  assert.equal(document.activeElement.dataset.date, savedDate);
  assert.equal(document.querySelector("#dateDialog").open, true);
});

test("legacy calendar assignment rejects an occupied date and retains the existing times", async () => {
  const initial = migrate({ workStart: "08:00", workEnd: "16:00", breaks: [] }, today);
  initial.history = [day(today)];
  await mount("popup", initial);
  chooseDate(today); await flush();
  assert.equal(document.querySelector("#dateDialog").open, true);
  assert.match(document.querySelector("#dateError").textContent, /existiert bereits ein Eintrag/);
  assert.equal(stored[STORAGE_KEY].draft.date, null);
  assert.equal(document.querySelector("#workEnd").value, "16:00");
  chooseDate(yesterday); await flush();
  assert.equal(stored[STORAGE_KEY].draft.date, yesterday);
  assert.equal(document.querySelector("#dateDialog").open, false);
  assert.equal(document.querySelector("#workEnd").value, "16:00");
});

test("shared calendar handles leap days, Monday offsets and supported date boundaries", async () => {
  const initial = migrate(null, today); initial.draft = draftFor("2024-02-29", []);
  await mount("popup", initial); click("#dayDate");
  assert.equal(document.querySelectorAll(".calendar-day").length, 29);
  assert.equal(document.querySelectorAll('#calendarDays > span[aria-hidden="true"]').length, 3);
  assert.equal(document.querySelector(".selected").textContent, "29");
  click("#nextMonth");
  assert.equal(document.querySelectorAll(".calendar-day").length, 31);
  click("#previousMonth");
  assert.equal(document.querySelector(".selected").dataset.date, "2024-02-29");
  for (const [date, boundary, other] of [["0001-01-01", "previousMonth", "nextMonth"], ["9999-12-31", "nextMonth", "previousMonth"]]) {
    initial.draft = draftFor(date, []);
    await mount("popup", initial); click("#dayDate");
    assert.equal(document.querySelector(`#${boundary}`).disabled, true);
    assert.equal(document.querySelector(`#${other}`).disabled, false);
    click(`#${boundary}`);
    assert.equal(document.querySelector("#dateCalendar").dataset.month, date.slice(0, 7));
  }
});

test("main view persists fast input, hidden pause pages and date navigation under the old date", async () => {
  await mount("popup");
  enter("#workStart", "800"); event(document.querySelector("#workStart"), "blur");
  enter("#workEnd", "1700");
  click("#addBreak30"); click("#addBreak60"); click("#addBreak");
  assert.equal(document.querySelector("#breakPageLabel").textContent, "2 / 2");
  await flush();
  chooseDate(yesterday); await flush();
  const data = stored[STORAGE_KEY];
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].date, today);
  assert.equal(data.history[0].workStart, "08:00");
  assert.deepEqual(data.history[0].breaks, [{ duration: 30 }, { duration: 60 }, { start: "", end: "" }]);
  assert.equal(document.querySelector("#workStart").value, "");
  chooseDate(today); await flush();
  assert.equal(document.querySelector("#workEnd").value, "17:00");
  assert.equal(document.querySelector("#error").hidden, true);
});

test("main reset and a subsequent date change leave today's archived entry intact", async () => {
  const initial = migrate(null, today); initial.history = [day(today)]; initial.draft = draftFor(today, initial.history);
  await mount("popup", initial);
  enter("#workEnd", "1800"); click("#discardDay"); await flush();
  assert.equal(document.querySelector("#workStart").value, "");
  assert.equal(stored[STORAGE_KEY].history[0].workEnd, "16:00");
  chooseDate(yesterday); await flush();
  assert.equal(stored[STORAGE_KEY].history[0].workEnd, "16:00");
});

test("day type controls exclude each other and preserve disabled times and vacation credit", async () => {
  await mount("popup");
  enter("#workStart", "800"); enter("#workEnd", "1600");
  check("#vacationDay"); await flush();
  assert.equal(document.querySelector("#timeFields").disabled, true);
  assert.match(document.querySelector("#vacationNote").textContent, /8:30/);
  assert.equal(stored[STORAGE_KEY].draft.vacationCreditMinutes, 510);
  check("#compensationDay"); await flush();
  assert.equal(document.querySelector("#vacationDay").checked, false);
  assert.equal(stored[STORAGE_KEY].draft.kind, "compensation");
  check("#compensationDay", false); await flush();
  assert.equal(document.querySelector("#timeFields").disabled, false);
  assert.equal(document.querySelector("#workStart").value, "8:00");
  assert.equal(document.querySelector("#workedDisplay").textContent, "8:00");
});

test("settings accept comma decimals and do not restamp an existing vacation", async () => {
  await mount("popup");
  check("#vacationDay"); await flush();
  click("#openSettings");
  enter("#weeklyHours", "42,5", "change"); enter("#vacationHours", "8", "change"); await flush();
  const data = stored[STORAGE_KEY];
  assert.equal(data.settings.targetSchedule.changes[0].weeklyTargetMinutes, 2550);
  assert.equal(data.settings.vacationCreditMinutes, 480);
  assert.equal(data.draft.vacationCreditMinutes, 510);
  enter("#vacationHours", "-1", "change"); await flush();
  assert.equal(document.querySelector("#settingsError").hidden, false);
  assert.equal(stored[STORAGE_KEY].settings.vacationCreditMinutes, 480);
});

test("history opening finishes draft saving before requesting the separate window", async () => {
  await mount("popup"); enter("#workStart", "800"); click("#openHistory"); await flush();
  assert.equal(opened.length, 1);
  assert.match(opened[0].url, /history\.html$/);
  assert.equal(opened[0].persisted.draft.workStart, "8:00");
  assert.equal(opened[0].persisted.history.length, 0);
});

test("a pending settings response does not replace text currently being edited", async () => {
  await mount("popup"); click("#openSettings");
  enter("#weeklyHours", "42", "change");
  document.querySelector("#vacationHours").focus();
  document.querySelector("#vacationHours").value = "8,25";
  await flush();
  assert.equal(document.querySelector("#vacationHours").value, "8,25");
  assert.equal(stored[STORAGE_KEY].settings.vacationCreditMinutes, 510);
  event(document.querySelector("#vacationHours"), "change"); await flush();
  assert.equal(stored[STORAGE_KEY].settings.vacationCreditMinutes, 495);
});

test("invalid times block navigation, show an error and retain the edited form", async () => {
  await mount("popup"); enter("#workStart", "29:00"); await flush();
  chooseDate(yesterday); await flush();
  assert.equal(document.querySelector("#dayDate").textContent, formatDate(today));
  assert.equal(document.querySelector("#workStart").value, "29:00");
  assert.equal(document.querySelector("#dateError").hidden, false);
  assert.equal(document.querySelector("#dateDialog").open, true);
  assert.equal(stored[STORAGE_KEY].history.length, 0);
});

test("a failed save cannot archive an old form or clear the current inputs", async () => {
  await mount("popup"); enter("#workStart", "800"); await flush();
  failWrite = true; chooseDate(yesterday); await flush();
  assert.equal(document.querySelector("#dayDate").textContent, formatDate(today));
  assert.equal(document.querySelector("#workStart").value, "8:00");
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  assert.match(document.querySelector("#dateError").textContent, /Speicher voll/);
  assert.equal(document.querySelector("#dateDialog").open, true);
});

test("a concurrent draft change preserves rejected local input until explicit reset", async () => {
  await mount("popup");
  const original = chrome.runtime.sendMessage;
  let intercept = true;
  chrome.runtime.sendMessage = async message => {
    if (intercept && message.command.type === "saveDraft") {
      intercept = false;
      await enqueue({ type: "resetDay", expectedDraftRevision: stored[STORAGE_KEY].draftRevision });
    }
    return original(message);
  };
  try {
    enter("#workStart", "800"); await flush();
    assert.equal(document.querySelector("#workStart").value, "8:00");
    assert.equal(stored[STORAGE_KEY].draft.workStart, "");
    assert.equal(document.querySelector("#error").hidden, false);
    enter("#workEnd", "1600"); await flush();
    assert.equal(stored[STORAGE_KEY].draft.workStart, "");
    click("#discardDay"); await flush();
    assert.equal(document.querySelector("#workStart").value, "");
    assert.equal(document.querySelector("#error").hidden, true);
  } finally { chrome.runtime.sendMessage = original; }
});

test("deletion in the history cannot be undone by an unchanged open main view", async () => {
  const initial = migrate(null, today); initial.history = [day(today)]; initial.draft = draftFor(today, initial.history);
  await mount("popup", initial);
  await enqueue({ type: "deleteDay", date: today, id: initial.history[0].id, recordRevision: 1 });
  await flush();
  chooseDate(yesterday); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  assert.equal(document.querySelector("#error").hidden, true);
});

test("theme changes propagate to an already open history", async () => {
  await mount("history");
  assert.equal(document.querySelector("#historyHint").hidden, false);
  assert.equal(document.querySelector("#historyHint").textContent, "Noch keine Tage in der History gespeichert.");
  await enqueue({ type: "settings", patch: { theme: "dark" } }); await flush();
  assert.equal(document.documentElement.dataset.theme, "dark");
});

test("legacy date assignment keeps existing times and is not a normal date switch", async () => {
  const initial = migrate({ workStart: "08:00", workEnd: "16:00", breaks: [] }, today);
  await mount("popup", initial);
  assert.equal(document.querySelector("#migrationHint").hidden, false);
  chooseDate(yesterday); await flush();
  assert.equal(document.querySelector("#workStart").value, "08:00");
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  click("#resetDay"); await flush();
  assert.equal(stored[STORAGE_KEY].history[0].date, yesterday);
});

test("calendar marks saved dates, opens read-only details and deletes the selected date", async () => {
  const initial = migrate(null, today); initial.history = [day(today, { kind: "vacation", vacationCreditMinutes: 510 })];
  await mount("history", initial);
  assert.equal(document.querySelector("#historyHint").hidden, true);
  assert.doesNotMatch(document.querySelector("main").textContent, /Tage auswählen|Aktuelle Eingaben gelangen/);
  assert.equal(document.querySelectorAll(".has-entry").length, 1);
  assert.equal(document.querySelectorAll('input[type="date"]').length, 0);
  click(`button[data-date="${today}"]`);
  assert.equal(document.querySelector("#dayDialog").open, true);
  assert.match(document.querySelector("#detailContent").textContent, /8:30/);
  click("#deleteDay"); assert.equal(document.querySelector("#deleteConfirmation").hidden, false);
  click("#confirmDelete"); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  assert.equal(document.querySelector("#dayDialog").open, false);
  assert.equal(document.querySelectorAll(".has-entry").length, 0);
  assert.equal(document.querySelector("#historyHint").hidden, false);
  assert.equal(document.querySelector("#historyHint").textContent, `Eintrag vom ${formatDate(today)} gelöscht.`);
});

test("statistics show yesterday, separate vacation hours and use the common cutoff", async () => {
  const initial = migrate(null, today);
  initial.history = [day(yesterday, { kind: "vacation", vacationCreditMinutes: 510 }), day(today)];
  await mount("statistics", initial);
  assert.equal(document.querySelector("#statisticsContent").hidden, false);
  assert.equal(document.querySelector("#worked").textContent, "0:00");
  assert.equal(document.querySelector("#vacation").textContent, "8:30");
  assert.equal(document.querySelector("#average").textContent, "—");
  assert.equal(document.querySelector("#dayCounts").textContent, "0 / 1");
  assert.equal(document.querySelector("#error").hidden, true);
});

test("draft autosaves in the main view do not interrupt history deletion confirmation", async () => {
  const initial = migrate(null, today); initial.history = [day(today)];
  await mount("history", initial);
  click(`button[data-date="${today}"]`); click("#deleteDay");
  await enqueue({ type: "saveDraft", fields: { ...initial.draft, workStart: "09:00" }, expectedDraftRevision: stored[STORAGE_KEY].draftRevision });
  await flush();
  assert.equal(document.querySelector("#dayDialog").open, true);
  assert.equal(document.querySelector("#deleteConfirmation").hidden, false);
});

test("statistics have an explicit empty state for only today's saved entry", async () => {
  const initial = migrate(null, today); initial.history = [day(today)];
  await mount("statistics", initial);
  assert.equal(document.querySelector("#emptyState").hidden, false);
  assert.equal(document.querySelector("#statisticsContent").hidden, true);
});

test("language setting persists and translates the popup, calendar, history and statistics", async () => {
  const labels = {
    de: ["Arbeitszeit", "Einstellungen", "Statistik", "Ferientag"],
    en: ["Working hours", "Settings", "Statistics", "Vacation day"],
    nb: ["Arbeidstid", "Innstillinger", "Statistikk", "Feriedag"],
    fr: ["Temps de travail", "Paramètres", "Statistiques", "Jour de congé"],
  };
  for (const [language, [title, settings, statistics, vacation]] of Object.entries(labels)) {
    const initial = migrate(null, today);
    initial.settings.language = language;
    initial.history = [day(yesterday, { kind: "vacation", vacationCreditMinutes: 510 })];
    await mount("popup", initial);
    assert.equal(document.documentElement.lang, language);
    assert.equal(document.querySelector("h1").textContent, title);
    assert.match(document.querySelector("#vacationDay").parentElement.textContent, new RegExp(vacation));
    click("#dayDate");
    assert.equal(document.querySelector("#previousMonth").getAttribute("aria-label"), {
      de: "Vorheriger Monat", en: "Previous month", nb: "Forrige måned", fr: "Mois précédent",
    }[language]);
    click("#openSettings");
    assert.equal(document.querySelector("#settingsView h1").textContent, settings);
    assert.equal(document.querySelector("#language").value, language);
    await mount("history", initial);
    assert.equal(document.querySelector("#openStatistics").textContent, {
      de: "Statistik öffnen", en: "Open statistics", nb: "Åpne statistikk", fr: "Ouvrir les statistiques",
    }[language]);
    click(`button[data-date="${yesterday}"]`);
    assert.equal(document.querySelector("#detailKind").textContent, vacation);
    await mount("statistics", initial);
    assert.equal(document.querySelector("h1").textContent, statistics);
    assert.equal(document.querySelector("#statisticsContent").hidden, false);
  }
  await mount("popup");
  click("#openSettings");
  for (const [language, heading] of [["en", "Settings"], ["nb", "Innstillinger"], ["fr", "Paramètres"], ["de", "Einstellungen"]]) {
    for (const option of document.querySelector("#language").options) option.selected = false;
    document.querySelector(`#language option[value="${language}"]`).selected = true;
    event(document.querySelector("#language"), "change"); await flush();
    assert.equal(stored[STORAGE_KEY].settings.language, language);
    assert.equal(document.querySelector("#language").value, language);
    assert.equal(document.querySelector("#settingsView h1").textContent, heading);
  }
});

test("an outdated background worker explains why a chosen language was not saved", async () => {
  await mount("popup"); click("#openSettings");
  const original = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = message => original(message.command.type === "settings" && "language" in message.command.patch
    ? { ...message, command: { ...message.command, patch: {} } } : message);
  try {
    for (const option of document.querySelector("#language").options) option.selected = false;
    document.querySelector('#language option[value="en"]').selected = true;
    event(document.querySelector("#language"), "change"); await flush();
    assert.equal(stored[STORAGE_KEY].settings.language, "de");
    assert.equal(document.querySelector("#settingsError").hidden, false);
    assert.match(document.querySelector("#settingsError").textContent, /neu laden/);
  } finally { chrome.runtime.sendMessage = original; }
});

test("an external save does not reset a language choice while the dropdown is in use", async () => {
  await mount("popup"); click("#openSettings");
  const select = document.querySelector("#language");
  select.focus();
  select.querySelector('[value="fr"]').selected = true;
  await enqueue({ type: "settings", patch: { theme: "dark" } }); await flush();
  assert.equal(select.value, "fr");
  event(select, "change"); await flush();
  assert.equal(stored[STORAGE_KEY].settings.language, "fr");
});
