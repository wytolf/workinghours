import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setLanguage, t } from "../i18n.js";

test("manifest translations exist for every supported browser locale", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.default_locale, "de");
  for (const field of [manifest.name, manifest.description, manifest.action.default_title]) {
    const key = /^__MSG_(\w+)__$/.exec(field)?.[1];
    assert.ok(key, `Untranslated manifest field: ${field}`);
    for (const locale of ["de", "en", "no", "fr"]) {
      const messages = JSON.parse(await readFile(new URL(`../_locales/${locale}/messages.json`, import.meta.url), "utf8"));
      assert.ok(messages[key]?.message, `Missing ${key} for ${locale}`);
    }
  }
});

test("storage failures are translated in every selectable language", () => {
  const errors = [
    "Die gespeicherten Daten haben ein unbekanntes Format. Sie wurden nicht verändert.",
    "Die gespeicherten Daten sind unvollständig oder ungültig. Sie wurden nicht verändert.",
    "Bitte den übernommenen Zeiten zuerst ein Datum zuordnen.",
    "Ungültige Tageserfassung.", "Ungültiges Datum.", "Ungültige Sprache.",
    "Ungültige Darstellung.", "Unbekannte Speicheraktion.",
  ];
  for (const language of ["en", "nb", "fr"]) {
    setLanguage(language);
    for (const error of errors) assert.notEqual(t(error), error, `${language}: ${error}`);
  }
  setLanguage("de");
});
