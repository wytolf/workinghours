# Arbeitszeit

Private Chromium-Erweiterung zur lokalen Erfassung der aktuellen Arbeitszeit.

## Funktionen

- Arbeitsbeginn und Feierabend manuell oder mit der aktuellen Uhrzeit setzen
- Zeiteingabe ohne Doppelpunkt: `800`, `0800` und `8:00` werden zu `08:00`
- Beliebig viele Pausen hinzufügen und entfernen; kompakte Seitennavigation ohne Scrollen
- Immer aktive Schnellbuttons für einen festen Abzug von 30 oder 60 Minuten Pause
- Live-Berechnung, solange kein Feierabend eingetragen ist
- Anzeige von Arbeitszeit, Überzeit und Minuszeit
- Eigene Einstellungen für tägliche Sollzeit sowie Hell- und Dunkelmodus
- Automatische lokale Speicherung über `chrome.storage.local`
- „Neuen Tag beginnen“ löscht die Tageswerte, behält aber Sollzeit und Darstellung

## Installation

1. In Chromium, Chrome, Edge, Brave oder Vivaldi `chrome://extensions` öffnen.
2. Den **Entwicklermodus** aktivieren.
3. Auf **Entpackte Erweiterung laden** klicken.
4. Diesen Ordner auswählen.
5. Die Erweiterung bei Bedarf über das Puzzle-Symbol an die Symbolleiste anheften.

Nach einer Aktualisierung der Dateien auf der Erweiterungsseite den runden
**Neu laden**-Button der Erweiterung anklicken.

Die Daten verlassen den Browser nicht. Beim Entfernen der Erweiterung können die
gespeicherten Werte ebenfalls gelöscht werden.