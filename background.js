import { localDate } from "./dates.js";
import { applyCommand, assertState, LEGACY_KEY, migrate, STORAGE_KEY } from "./state.js";

let queue = Promise.resolve();

export function enqueue(command) {
  const result = queue.then(async () => {
    const stored = await chrome.storage.local.get([STORAGE_KEY, LEGACY_KEY]);
    let data = stored[STORAGE_KEY];
    if (data === undefined) {
      data = assertState(migrate(stored[LEGACY_KEY], localDate()));
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
      assertState((await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY]);
    } else assertState(data);
    if (command.type === "read") return data;
    const updated = applyCommand(data, command, localDate());
    if (updated !== data) await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    return updated;
  });
  queue = result.catch(() => {});
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.channel !== "workinghours" || sender.id !== chrome.runtime.id) return false;
  enqueue(message.command).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
  return true;
});
