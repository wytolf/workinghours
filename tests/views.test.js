import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";
import { parseHTML } from "linkedom";
import { localDate, shiftDate } from "../dates.js";
import { draftFor, emptyDay, migrate, STORAGE_KEY } from "../state.js";
import { currentTime } from "../time-calculations.js";

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
function check(selector, value = true) { document.querySelector(selector).checked = value; event(document.querySelector(selector), "change"); }

test("end now fills and persists the current time after a manually entered start", async () => {
  await mount("popup");
  assert.equal(document.querySelector("#setStartNow"), null);
  enter("#workStart", "800");
  assert.equal(document.querySelector("#setEndNow").disabled, false);
  const before = currentTime();
  click("#setEndNow");
  await flush();
  const end = document.querySelector("#workEnd").value;
  assert.ok([before, currentTime()].includes(end));
  assert.equal(stored[STORAGE_KEY].draft.workEnd, end);
  assert.equal(document.querySelector("#error").hidden, true);
});

test("end now records the time even when the start has not been entered yet", async () => {
  await mount("popup");
  const before = currentTime();
  click("#setEndNow");
  await flush();
  const end = document.querySelector("#workEnd").value;
  assert.ok([before, currentTime()].includes(end), "Clicking end now must fill the end time");
  assert.equal(stored[STORAGE_KEY].draft.workEnd, end);
  assert.equal(stored[STORAGE_KEY].draft.workStart, "");
  assert.equal(document.querySelector("#error").hidden, true);
  enter("#workStart", "800");
  await flush();
  assert.equal(stored[STORAGE_KEY].draft.workEnd, end);
});

test("end now replaces an invalid end without changing the start or breaks", async () => {
  await mount("popup");
  enter("#workStart", "29:00");
  click("#addBreak30");
  enter("#workEnd", "29:00");
  event(document.querySelector("#workEnd"), "blur");
  assert.equal(document.querySelector("#workEnd").getAttribute("aria-invalid"), "true");
  const before = currentTime();
  click("#setEndNow");
  await flush();
  assert.ok([before, currentTime()].includes(stored[STORAGE_KEY].draft.workEnd));
  assert.equal(stored[STORAGE_KEY].draft.workStart, "29:00");
  assert.deepEqual(stored[STORAGE_KEY].draft.breaks, [{ duration: 30 }]);
  assert.equal(document.querySelector("#workEnd").hasAttribute("aria-invalid"), false);
});

test("end now stays unavailable for historical dates, vacation and compensation", async () => {
  await mount("popup");
  for (const id of ["#vacationDay", "#compensationDay"]) {
    check(id);
    await flush();
    assert.equal(document.querySelector("#setEndNow").disabled, true);
    click("#setEndNow");
    await flush();
    assert.equal(stored[STORAGE_KEY].draft.workEnd, "");
    check(id, false);
    await flush();
  }
  enter("#dayDate", yesterday, "change");
  await flush();
  assert.equal(document.querySelector("#setEndNow").disabled, true);
  click("#setEndNow");
  await flush();
  assert.equal(stored[STORAGE_KEY].draft.workEnd, "");
});

test("main view persists fast input, hidden pause pages and date navigation under the old date", async () => {
  await mount("popup");
  enter("#workStart", "800"); event(document.querySelector("#workStart"), "blur");
  enter("#workEnd", "1700");
  click("#addBreak30"); click("#addBreak60"); click("#addBreak");
  assert.equal(document.querySelector("#breakPageLabel").textContent, "2 / 2");
  await flush();
  enter("#dayDate", yesterday, "change"); await flush();
  const data = stored[STORAGE_KEY];
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].date, today);
  assert.equal(data.history[0].workStart, "08:00");
  assert.deepEqual(data.history[0].breaks, [{ duration: 30 }, { duration: 60 }, { start: "", end: "" }]);
  assert.equal(document.querySelector("#workStart").value, "");
  enter("#dayDate", today, "change"); await flush();
  assert.equal(document.querySelector("#workEnd").value, "17:00");
  assert.equal(document.querySelector("#error").hidden, true);
});

test("main reset and a subsequent date change leave today's archived entry intact", async () => {
  const initial = migrate(null, today); initial.history = [day(today)]; initial.draft = draftFor(today, initial.history);
  await mount("popup", initial);
  enter("#workEnd", "1800"); click("#discardDay"); await flush();
  assert.equal(document.querySelector("#workStart").value, "");
  assert.equal(stored[STORAGE_KEY].history[0].workEnd, "16:00");
  enter("#dayDate", yesterday, "change"); await flush();
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
  enter("#dayDate", yesterday, "change"); await flush();
  assert.equal(document.querySelector("#dayDate").value, today);
  assert.equal(document.querySelector("#workStart").value, "29:00");
  assert.equal(document.querySelector("#error").hidden, false);
  assert.equal(stored[STORAGE_KEY].history.length, 0);
});

test("a failed save cannot archive an old form or clear the current inputs", async () => {
  await mount("popup"); enter("#workStart", "800"); await flush();
  failWrite = true; enter("#dayDate", yesterday, "change"); await flush();
  assert.equal(document.querySelector("#dayDate").value, today);
  assert.equal(document.querySelector("#workStart").value, "8:00");
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  assert.match(document.querySelector("#error").textContent, /Speicher voll/);
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
  enter("#dayDate", yesterday, "change"); await flush();
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  assert.equal(document.querySelector("#error").hidden, true);
});

test("theme changes propagate to an already open history", async () => {
  await mount("history");
  await enqueue({ type: "settings", patch: { theme: "dark" } }); await flush();
  assert.equal(document.documentElement.dataset.theme, "dark");
});

test("legacy date assignment keeps existing times and is not a normal date switch", async () => {
  const initial = migrate({ workStart: "08:00", workEnd: "16:00", breaks: [] }, today);
  await mount("popup", initial);
  assert.equal(document.querySelector("#migrationHint").hidden, false);
  enter("#dayDate", yesterday, "change"); await flush();
  assert.equal(document.querySelector("#workStart").value, "08:00");
  assert.equal(stored[STORAGE_KEY].history.length, 0);
  click("#resetDay"); await flush();
  assert.equal(stored[STORAGE_KEY].history[0].date, yesterday);
});

test("calendar marks saved dates, opens read-only details and deletes the selected date", async () => {
  const initial = migrate(null, today); initial.history = [day(today, { kind: "vacation", vacationCreditMinutes: 510 })];
  await mount("history", initial);
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
