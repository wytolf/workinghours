# Arbeitszeit

Private Chromium-Erweiterung zur lokalen Arbeitszeiterfassung mit History,
Ferien, Überzeitkompensation und Statistiken. Alle Daten bleiben im Browser.

## Funktionen

- Arbeitsbeginn und Feierabend manuell setzen
- Zeiteingabe ohne Doppelpunkt: `800`, `0800` und `8:00` werden zu `08:00`
- Beliebig viele Pausen hinzufügen und entfernen; kompakte Seitennavigation ohne Scrollen
- Schnellbuttons für einen festen Abzug von 30 oder 60 Minuten Pause
- Live-Berechnung für den heutigen Tag, solange kein Feierabend eingetragen ist
- Anzeige von Arbeitszeit, Überzeit und Minuszeit
- Eigene Einstellungen für Wochenstunden, Feriengutschrift sowie Hell- und Dunkelmodus
- History in den Einstellungen als JSON-Datei exportieren und wieder importieren
- Automatische lokale Speicherung über `chrome.storage.local`
- Tagesauswahl mit automatischer History-Speicherung vor dem Datumswechsel
- Kalender mit markierten gespeicherten Tagen, Tagesdetails und Löschfunktion
- Statistik für Arbeitsstunden, Feriengutschrift, Soll-Ist-Saldo und Datenqualität

## Tageserfassung und History

Eingaben werden automatisch als **Entwurf** gesichert und bleiben beim Schließen
des Popups erhalten. In die **History** gelangen sie beim manuellen Wechsel auf
ein anderes Datum oder mit **Neuen Tag beginnen**. Beim Datumswechsel wird zuerst
der bisherige Tag gespeichert und anschließend der gewählte Tag geladen. Das
Datumsfeld benennt keinen bestehenden Datensatz um.

Ein Klick auf das Datum öffnet denselben Kalender wie in der History. Gespeicherte
Tage sind nach Arbeit, Ferien und Kompensation markiert; der ausgewählte Tag ist
zusätzlich hervorgehoben. In der Hauptansicht lassen sich auch leere Tage wählen.
Die Monatsnavigation und das Schließen des Kalenders ändern die Erfassung nicht.
Markierungen zeigen gespeicherte History-Einträge, keine noch offenen Entwürfe.
Der Kalenderdialog verwendet eine kompakte Monatsansicht mit schmalen Abständen
und zeigt keine zusätzliche Überschrift und keinen Bedienhinweis.
Er schließt durch einen Klick außerhalb des Dialogs oder mit Escape und benötigt
keinen Schließen-Button. Klicks innerhalb des Kalenders schließen ihn nur bei
erfolgreicher Tagesauswahl.

- **Neuen Tag beginnen:** Angezeigten Tag speichern, dann leere Erfassung für heute.
- **Tag zurücksetzen:** Aktuelle Erfassung ohne History-Speicherung verwerfen, dann
  leere Erfassung für heute. Bereits gespeicherte Einträge bleiben erhalten.

Liegt für heute bereits ein History-Eintrag vor, bleibt dieser nach einem Neustart
geschützt. Ein unveränderter leerer Entwurf überschreibt ihn nicht. Erst neu
eingegebene Inhalte aktualisieren ihn beim nächsten Speichern. Um den gespeicherten
heutigen Tag wieder zu laden, zunächst ein anderes Datum und danach heute wählen.

Vollständig leere Erfassungen und leere Pausenzeilen erzeugen keinen Eintrag und
überschreiben keinen vorhandenen. Unvollständige Erfassungen mit Inhalt sind
speicherbar. Pro Datum wird ein Eintrag verwendet und beim Speichern aktualisiert.
Bei versehentlichen Altduplikaten gilt der erste; die ausdrückliche Löschfunktion
in der History entfernt alle Einträge dieses Datums.

History und Statistik öffnen sich als eigene kleine Browserfenster im bestehenden
Design. Dabei schließt Chromium das Toolbar-Popup; der Entwurf wird vorher
gesichert. Die History bietet ausschließlich Ansicht und Löschen, keine Bearbeitung.
Unter dem Kalender erscheinen nur Leerzustands- und Löschmeldungen, keine Bedienhinweise.
Das Datum ist nur in der Hauptansicht bearbeitbar. Ein geöffneter Entwurf wechselt
auch um Mitternacht nicht automatisch auf ein anderes Datum.

## History sichern und laden

In den **Einstellungen** unter **History sichern und laden** stehen zwei Aktionen:

- **History exportieren:** Lädt eine JSON-Datei mit allen gespeicherten Tagen,
  einschließlich Zeiten, Pausen, Tagesarten, Feriengutschriften und Sollstundenverlauf,
  herunter. Die aktuelle Erfassung ist nicht enthalten; diese bei Bedarf zuerst mit
  einem Datumswechsel oder **Neuen Tag beginnen** in der History speichern.
- **History importieren:** Eine zuvor exportierte JSON-Datei auswählen. Fehlende Tage
  werden ergänzt. Bereits vorhandene Tage bleiben erhalten, auch bei abweichenden
  Werten in der Datei. Bei doppelten Datumswerten in der Datei gilt der erste Eintrag.
  Wiederholtes Importieren erzeugt keine Duplikate.

Bei leerer History übernimmt der Import auch den Sollstundenverlauf bis gestern,
damit frühere Statistiken wiederhergestellt werden. Ab heute gelten weiterhin die
lokalen Wochenstunden. Bei bereits vorhandener History bleibt der gesamte lokale
Sollstundenverlauf maßgebend. Darstellung und aktuelle Feriengutschrift bleiben
erhalten. Die angezeigte Erfassung wird nicht durch die importierten Zeiten ersetzt.
Ist sie bereits bearbeitet und betrifft einen neu importierten Tag, schützt die
bestehende Konfliktanzeige vor versehentlichem Überschreiben.

Fehlerhafte Dateien, unbekannte Dateiversionen und Dateien über 10 MB werden mit
einer Fehlermeldung abgewiesen. Die Datei wird vollständig geprüft, bevor der
Hintergrundprozess die Daten gemeinsam speichert. Bei Speicherfehlern wird kein
erfolgreicher Import angezeigt. Sicherungen werden ausschließlich lokal verarbeitet.
Die Exportdatei enthält persönliche Arbeitszeiten und kann an einem selbst gewählten
Ort aufbewahrt werden.

## Tagesarten und Einstellungen

**Arbeitstag**, **Ferientag** und **Überzeitkompensation** schließen sich aus.
Bei Ferien oder Kompensation bleiben vorhandene Arbeitszeiten und Pausen erhalten,
sind aber deaktiviert und werden nicht angerechnet. Nach Entfernen der Markierung
sind sie wieder nutzbar. Arbeitsbeginn und Feierabend werden manuell erfasst.

- **Ferientag:** Beim Markieren wird die aktuelle Feriengutschrift im Tag gespeichert
  (Standard 8,5 Stunden). Änderungen der Einstellung gelten nur für anschließend neu
  markierte Tage. Laden oder erneutes Speichern verändert die Gutschrift nicht.
- **Überzeitkompensation:** Keine Arbeits- oder Ferienstunden. Das reguläre Soll
  bleibt bestehen und baut dadurch Überzeit ab, ohne zusätzlichen Abzug.
- **Wöchentliche Sollarbeitszeit:** Das Tagessoll beträgt Wochenstunden geteilt durch
  fünf und fällt Montag bis Freitag an. Änderungen gelten ab heute; frühere Tage
  behalten ihr damaliges Soll, auch bei nachträglicher Erfassung.

Die Stundenfelder in den Einstellungen akzeptieren Dezimalstunden mit Punkt oder
Komma, etwa `42,5` und `8.5`. Wochenendarbeit erhöht das Ist ohne zusätzliches Soll.
Ein markierter Ferientag erhält auch am Wochenende seine gespeicherte Gutschrift;
Kompensation an einem Tag ohne Soll baut keine Überzeit ab. Eine automatische
Feiertagsregel gibt es nicht.

## Statistik und Datenqualität

Alle Kennzahlen reichen vom ersten gespeicherten Datum bis **einschließlich gestern**.
Heutige und zukünftige Einträge sind in der History sichtbar und gehen erst nach
Ablauf ihres Datums in die Statistik ein. Ohne auswertbare Einträge wird ein
entsprechender Leerzustand angezeigt.

- Tatsächliche Arbeit und Feriengutschriften werden getrennt ausgewiesen.
- Saldo = Arbeitsstunden + Feriengutschriften − Sollstunden. Auch fehlende Werktage
  innerhalb des Zeitraums tragen Sollstunden bei.
- Durchschnitt = Arbeitsstunden pro tatsächlich gearbeitetem, vollständig erfasstem
  Tag mit positiver Nettozeit. Ferien und Kompensation zählen nicht in diesen
  Durchschnitt; ohne Arbeitstage erscheint „—“.
- Vollständig bedeutet gültiger Beginn und Feierabend, vollständige angefangene
  Zeitpausen und positive Nettozeit. Leere Pausenzeilen sind unschädlich. Die
  erreichte Sollzeit spielt für die Vollständigkeit keine Rolle.
- Unvollständige Arbeitstage bleiben gespeichert, liefern jedoch keine statistischen
  Arbeitsstunden und zählen weder für Durchschnitt noch Arbeitstagsanzahl oder
  Datenqualität. Historische offene Einträge rechnen nicht mit der aktuellen Uhrzeit.

Die Datenqualität misst Vollständigkeit und ist pro Kalenderwoche (Montag bis
Sonntag) auf 100 % gedeckelt. Eine volle Woche erwartet fünf ausgefüllte Tage;
Ferien und Kompensation zählen mit, Duplikate nicht. Ausgefüllte Wochenendtage
zählen innerhalb derselben Woche mit und können keine andere Woche ausgleichen.
Erste und letzte Woche berücksichtigen nur Montag bis Freitag innerhalb des
Auswertungszeitraums. Der Gesamtwert wird anhand erwarteter Tage gewichtet:
2/2 und 3/5 ergeben zusammen 5/7, also 71,4 %. Ohne erwartete Tage erscheint „—“.

## Datenübernahme und Speicherung

Beim ersten Öffnen der neuen Version werden bestehende Zeiten, Pausen und die
Darstellung übernommen. Die bisherige tägliche Sollzeit wird mit fünf multipliziert
und dient als Basiswert für die Wochenstunden. Vorhandene Inhalte haben bisher
kein Datum: Dieses muss einmalig in der Hauptansicht zugeordnet werden, bevor sie
archiviert werden. Leere Bestandsdaten starten mit dem heutigen Datum.

Die ursprünglichen Daten unter `workTimeState` bleiben unverändert als
Migrationsquelle erhalten. Der neue versionierte Zustand liegt unter `workTimeData`.
Die Migration läuft nur einmal; gelöschte History wird nicht aus alten Daten
wiederhergestellt. Entwurf, Einstellungen und History werden durch einen gemeinsamen
Hintergrundprozess geschrieben, damit mehrere Fenster keine Änderungen verlieren.
Bei einem Konflikt bleibt die Erfassung sichtbar und es erscheint ein Hinweis.

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

## Entwicklung und Prüfung

Die Erweiterung selbst benötigt weder Build-Schritt noch zusätzliche Laufzeitpakete.
Für die automatisierten Prüfungen ist Node.js ab Version 22 erforderlich:

```text
npm ci
npm test
npm run check
```

Die Tests prüfen Berechnungen, Migration, Speicherübergänge und Bedienabläufe mit
simuliertem Browser-Speicher. Die DOM-Prüfungen ersetzen keine visuelle Kontrolle
von Layout, Kalenderdialog und Popup-Verhalten im echten Chromium.

Der freigegebene Umfang und die Akzeptanzkriterien stehen in
[docs/history-statistics-plan.md](docs/history-statistics-plan.md).
