export async function send(command) {
  const response = await chrome.runtime.sendMessage({ channel: "workinghours", command });
  if (!response?.ok) {
    if (["importHistory", "importHistoryWithMode", "deleteAllHistory"].includes(command.type) && response?.error === "Unbekannte Speicheraktion.") {
      throw new Error("Der Hintergrundprozess ist noch nicht aktuell. Bitte die Erweiterung auf der Erweiterungsseite über den runden Pfeil neu laden und danach erneut versuchen.");
    }
    throw new Error(response?.error ?? "Die Daten konnten nicht gespeichert werden. Bitte erneut versuchen.");
  }
  return response.data;
}

export async function openWindow(page) {
  const url = chrome.runtime.getURL(page);
  const windows = await chrome.windows.getAll({ populate: true });
  const existing = windows.find(window => window.tabs?.some(tab => tab.url === url));
  if (existing) await chrome.windows.update(existing.id, { focused: true });
  else await chrome.windows.create({ url, type: "popup", width: 440, height: 620 });
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

export function onDataChanged(callback) {
  const listener = (changes, area) => {
    if (area === "local" && changes.workTimeData?.newValue) callback(changes.workTimeData.newValue);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
