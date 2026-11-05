# Hinweise für Agenten

## Projekt
- Private Chromium-Erweiterung zur lokalen Arbeitszeiterfassung.
- JavaScript mit ES-Modulen, HTML und CSS; kein Build-Schritt.
- Oberfläche und Kommunikation auf Deutsch halten.
- Fachliche Regeln stehen in `README.md` und `docs/history-statistics-plan.md`.

## Änderungen
- Änderungen klein halten und dem bestehenden Stil folgen.
- Vorhandene Module für Datum, Zeitberechnung, Zustand und Speicherung nutzen.
- Daten bleiben lokal im Browser. Speicheränderungen über den gemeinsamen Hintergrundprozess führen.
- Bestehende Daten und Migrationen bei Änderungen am Speichermodell erhalten.
- Abhängigkeiten und Werkzeuge niemals eigenständig installieren oder aktualisieren. Vor jeder Installation oder Aktualisierung den Nutzer ausdrücklich fragen und seine Zustimmung abwarten; ein allgemeiner Arbeitsauftrag gilt nicht als Zustimmung.
- Diese Regel gilt auch für bereits deklarierte Abhängigkeiten (z. B. `npm ci` oder `npm install`), globale Installationen und Befehle, die Pakete bei Bedarf herunterladen (z. B. `npx`). Vor der Rückfrage die benötigten Pakete und den Zweck nennen.
- Bei geändertem Verhalten die Dokumentation und passende Tests aktualisieren.

## Prüfung
- Vorhandenes Node.js ab Version 22 verwenden. Fehlen benötigte Abhängigkeiten oder Werkzeuge, vor ihrer Installation ausdrücklich um Zustimmung bitten.
- Nach Codeänderungen `npm test` und `npm run check` ausführen.
- Änderungen an der Oberfläche zusätzlich in Chromium prüfen, sofern verfügbar; andernfalls die fehlende Sichtprüfung nennen.
