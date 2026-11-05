# Plan: History und Arbeitszeitstatistiken

Status: Vom Nutzer am 29.10.2026 mit „leg los“ freigegeben und umgesetzt.

Prüfstand: 52 automatisierte Prüfungen für Berechnung, Speicherübergänge,
Hintergrundprozess und DOM-Bedienabläufe bestanden. Syntax, Manifest-Verweise und
Seitenelemente geprüft. Eine visuelle Prüfung im echten Chromium war wegen der
Browserrichtlinie für lokale Dateien nicht möglich und bleibt als manuelle
Abnahme offen. Browserdaten des Nutzers wurden bei den Tests nicht verändert.

## 1. Ausgangslage

Die Erweiterung verwendet Manifest V3 und besteht aus `popup.html`, `popup.css`
und `popup.js`. Es gibt keinen Hintergrundprozess und keine Build-Werkzeuge oder
Tests. Hauptansicht und Einstellungen werden innerhalb desselben Toolbar-Popups
umgeschaltet.

Unter `chrome.storage.local.workTimeState` liegt genau ein undatierter Zustand:
`targetTime`, `workStart`, `workEnd`, `breaks`, `theme`. Eingaben werden automatisch
gespeichert. Die aktuelle tägliche Sollzeit beträgt standardmäßig 08:00.

Die Berechnung unterstützt Arbeit über Mitternacht, zusammengeführte überlappende
Zeitpausen und zusätzliche feste Pausen. Ohne Feierabend verwendet sie die aktuelle
Uhrzeit. „Neuen Tag beginnen“ leert bisher die Erfassung.

Das UI ist 390 Pixel breit. Bestehende Karten, Abstände, Farben, Eingabefelder,
Pausenseitennavigation und Hell-/Dunkelmodus bilden die Designgrundlage.
Die Oberfläche wurde anhand von HTML und CSS geprüft; eine direkte Vorschau der
lokalen Datei war durch die Browserrichtlinie gesperrt.

## 2. Verbindliche Anforderungen und bestätigte Entscheidungen

- Pro Datum wird ein logischer Tagesdatensatz verwendet. Bei vorhandenen
  Duplikaten gilt der erste in gespeicherter Reihenfolge. Erneutes Speichern
  aktualisiert diesen ersten Datensatz; neue Duplikate werden nicht angelegt.
- Ein manueller Datumswechsel speichert den bisherigen Tag unter seinem bisherigen
  Datum und lädt anschließend das gewählte Datum oder einen leeren Entwurf.
  Das Datumsfeld dient der Navigation, nicht der Umbenennung eines Datensatzes.
  Das Datum ist ausschließlich in der Hauptansicht bearbeitbar.
- „Neuen Tag beginnen“ speichert den angezeigten Tag und öffnet danach einen
  leeren Entwurf mit heutigem Datum.
- „Tag zurücksetzen“ verwirft die aktuelle Erfassung ohne History-Speicherung und
  öffnet einen leeren Entwurf mit heutigem Datum.
- Ein vorhandener heutiger History-Eintrag bleibt bei beiden Neustart-Aktionen
  erhalten. Ein unveränderter leerer Entwurf darf ihn auch bei anschließendem
  Datumswechsel nicht überschreiben. Eine neu bearbeitete Erfassung kann ihn
  beim nächsten regulären Speichern aktualisieren.
- Vollständig leere Erfassungen erzeugen keinen History-Eintrag und überschreiben
  keinen vorhandenen. Leere Pausenzeilen zählen nicht als Inhalt. Unvollständige
  Erfassungen mit Inhalt sind speicherbar.
- Gespeicherte Einträge werden ausschließlich über die Löschfunktion der History
  entfernt.
- Tagesarten sind Arbeit, Ferien und vollständige Überzeitkompensation. Sie
  schließen sich gegenseitig aus. Vorhandene Zeiten und Pausen bleiben bei Ferien
  oder Kompensation erhalten, sind deaktiviert und werden nicht angerechnet.
- Ein Ferientag erhält beim Markieren eine Kopie der aktuellen Feriengutschrift.
  Standard: 8,5 Stunden beziehungsweise 510 Minuten. Spätere Einstellungsänderungen
  ändern diese Kopie nicht. Laden oder erneutes Speichern gilt nicht als erneutes
  Markieren. Bewusstes Entfernen und erneutes Setzen der Markierung übernimmt den
  dann aktuellen Wert.
- Ein Kompensationstag hat null Arbeits- und null Ferienstunden. Seine reguläre
  Sollzeit bleibt bestehen und reduziert dadurch den Saldo; kein zweiter Abzug.
  Er wird auch ohne Zeitangaben gespeichert und zählt als ausgefüllter Tag.
- Ein ausgefüllter Arbeitstag benötigt gültigen Beginn und Feierabend,
  vollständige angefangene Zeitpausen und eine positive Nettoarbeitszeit.
  Die erreichte Sollzeit ist dafür unerheblich. Ferien- und Kompensationstage
  zählen unabhängig von ihren Zeitfeldern als ausgefüllt.
- Die bisherige tägliche Sollzeit wird durch Wochenstunden ersetzt. Das Tagessoll
  beträgt Wochenstunden geteilt durch fünf. Die Feriengutschrift ist unabhängig.
- Änderungen der Wochenstunden gelten ab dem lokalen Datum der Änderung.
  Vorherige Tage behalten das zuvor geltende Soll, auch bei späterer Erfassung.
- Alle Statistiken beginnen beim ersten gespeicherten Datum und enden gestern.
  Heute und Zukunft bleiben aus sämtlichen Kennzahlen ausgeschlossen.
- Datenqualität: Kalenderwochen Montag bis Sonntag, fünf erwartete Tage pro
  vollständiger Woche, erste Woche erst ab dem ersten gespeicherten Datum,
  letzte Woche nur bis gestern, höchstens 100 % pro Woche. Der Gesamtwert wird
  nach erwarteten Tagen gewichtet. Datumsduplikate zählen nur einmal.

## 3. Verbleibende Festlegungen als Vorschlag zur Planfreigabe

Diese Punkte wurden nach der Aufforderung, Grundsatzfragen selbst zu entscheiden,
für den Plan gewählt. Sie sind von den bereits bestätigten Regeln zu unterscheiden.

1. **Wochenenden:** Soll fällt Montag bis Freitag an, auch bei fehlenden Einträgen.
   Wochenendarbeit erhöht das Ist ohne zusätzliches Soll. Ausgefüllte
   Wochenendtage zählen innerhalb ihrer Kalenderwoche zur Datenqualität mit,
   gedeckelt auf die dort erwarteten Tage. Markierte Ferien am Wochenende erhalten
   ebenfalls ihre gespeicherte Gutschrift; es gibt keine automatische Korrektur
   oder Feiertagslogik. Kompensation an einem Wochenende ohne Soll baut nichts ab.
2. **Unvollständige Arbeitseinträge:** Sie bleiben in der History sichtbar,
   liefern aber keine Arbeitsstunden und zählen weder für Tagesdurchschnitt noch
   Arbeitstagsanzahl oder Datenqualität. Sollstunden bleiben berücksichtigt.
   Ein kurzer Hinweis nennt diese Behandlung in der Statistik.
3. **Live-Berechnung:** Nur der heutige Arbeitsentwurf darf ohne Feierabend live
   rechnen. Vergangene und zukünftige Tage werden ohne Feierabend als
   unvollständig gezeigt; gespeicherte Statistikwerte verwenden nie die aktuelle
   Uhrzeit als Ersatz für einen fehlenden Abschluss.
4. **Auswertungsbeginn:** Nach Löschungen zählt wieder das früheste noch vorhandene
   logische Datum. Ohne gespeicherten Tag bis gestern erscheint ein leerer
   Statistikzustand. Bei null erwarteten Tagen ist die Datenqualität „—“;
   Arbeitsstunden an einem solchen Wochenendabschnitt bleiben auswertbar.
5. **Bestandsdaten ohne Datum:** Bestehende Inhalte werden zunächst als undatierter
   Entwurf erhalten. In der Hauptansicht muss einmalig ihr Datum gewählt werden,
   bevor sie in die History gelangen. Diese erstmalige Zuordnung speichert keinen
   vermeintlichen vorherigen Tag. Dadurch werden alte Inhalte nicht willkürlich
   als heutige Arbeitszeit verbucht. Ohne Inhalte startet die Migration direkt mit
   einem leeren heutigen Entwurf.
6. **Duplikate löschen:** Aktualisieren betrifft nur den ersten Eintrag. Die
   ausdrückliche History-Aktion „Eintrag löschen“ entfernt bei Altduplikaten alle
   Einträge dieses Datums, damit kein zweiter Eintrag unerwartet wieder erscheint.
   Außerhalb dieser Aktion werden Duplikate weder entfernt noch mitgezählt.
7. **Speicherfehler:** Erst nach erfolgreicher Speicherung wechseln Datum und
   Ansicht beziehungsweise startet ein neuer Tag. Bei Fehlern bleibt der Entwurf
   sichtbar und eine verständliche Meldung erklärt den fehlgeschlagenen Vorgang.
   Ungültige, nicht nur unvollständige Zeiteingaben blockieren einen Wechsel,
   der diese Eingaben verlieren würde.

## 4. Datenmodell

Ein neuer versionierter Zustand trennt Einstellungen, Entwurf und History.
Uhrzeiten bleiben lokale `HH:MM`-Werte; Dauern und Gutschriften werden numerisch
in Minuten gespeichert. Datumswerte sind lokale Kalendertage als `YYYY-MM-DD`,
ohne UTC-Konvertierung. Zeitstempel zur Änderungserkennung sind getrennt davon.

```text
workTimeData
  schemaVersion: 2
  revision: fortlaufende Nummer
  draftRevision: eigene Änderungsnummer für konkurrierende Entwurfszugriffe
  settings
    theme: light | dark
    vacationCreditMinutes: 510 als Standard
    targetSchedule
      baselineWeeklyMinutes: bisheriges Tagessoll * 5, sonst 2400
      changes[]
        effectiveFrom: YYYY-MM-DD
        weeklyTargetMinutes: Zahl
  draft
    date: YYYY-MM-DD | null bei undatierten Bestandsinhalten
    kind: work | vacation | compensation
    workStart: HH:MM | leer
    workEnd: HH:MM | leer
    breaks[]: { start, end } | { duration }
    vacationCreditMinutes: Zahl | null
    changedSinceLoad: boolean
    historyReference: { id, revision } | null
    suppressedAfterDeletion: boolean
    conflict: boolean
  history[]
    id: stabile ID
    revision: fortlaufende Nummer dieses Eintrags
    date: YYYY-MM-DD
    kind: work | vacation | compensation
    workStart, workEnd, breaks
    vacationCreditMinutes: Zahl | null
```

Die History-Reihenfolge bleibt für die Regel „erster Eintrag“ stabil. Ein gemeinsamer
Zugriff bildet daraus eine Sicht mit höchstens einem Eintrag pro Datum. Sowohl
Kalender als auch Statistik und Aktualisierung benutzen diesen Zugriff.

Die zeitabhängige Sollregel wird nach dem Datum des ausgewerteten Tages bestimmt,
nicht nach dem Speicherzeitpunkt. Der Basiswert gilt vor der ersten Änderung;
Änderungen sind nach Gültigkeitsdatum geordnet. Mehrere Einstellungsänderungen
am selben Tag ersetzen dessen Sollwert, niemals frühere Datumsstufen.

Abgeleitete Arbeitsstunden, Salden und Qualitätswerte werden berechnet statt als
zweite, möglicherweise widersprüchliche Wahrheit gespeichert. Bei der Aufteilung
des Wochensolls wird erst die Anzeige gerundet, nicht jeder Summand vorab.

## 5. Speicherverhalten und Übergänge

### Automatische Entwurfssicherung

Eingaben sichern weiterhin den aktuellen Entwurf lokal. Das ist vom Archivieren
eines Tages getrennt. Schließen und erneutes Öffnen der Erweiterung stellt genau
diesen Entwurf wieder her, einschließlich Datum und Markierung.

Ein Datumswechsel um Mitternacht ändert einen bereits geöffneten oder gesicherten
Entwurf nicht automatisch. Erst die ausdrücklich vorgesehenen Neustart-Aktionen
setzen das Datum auf den dann aktuellen lokalen Tag.

### Gemeinsame Operation zum Archivieren

1. Formular einschließlich aller Pausenseiten normalisieren und prüfen.
2. Undatierten, leeren oder nach einer History-Löschung unverändert gebliebenen
   Entwurf nicht archivieren.
3. Den ersten vorhandenen History-Eintrag für dieses Datum suchen.
4. Vorhandenen ersten Eintrag aktualisieren oder genau einen neuen anlegen.
5. Feriengutschrift aus dem Entwurf übernehmen, niemals aus der aktuellen Einstellung
   neu ermitteln.

Ein bereits geladener und unveränderter Eintrag benötigt keine erneute
History-Schreiboperation. Ein unvollständiger, aber inhaltlich vorhandener Entwurf
wird gespeichert. Ein leergeräumter Entwurf kann einen History-Eintrag nicht löschen;
dies bleibt der History-Löschfunktion vorbehalten.

### Manueller Datumswechsel A nach B

Vorherigen Tag A archivieren, dann B laden, danach Entwurf und Ansicht auf B setzen.
Alle Werte von A werden mit A gespeichert; der neue Feldwert B darf nicht vorzeitig
in den zu speichernden Datensatz gelangen. Gleiches Datum erneut wählen ist ohne
Wirkung. Beim Laden werden Feriengutschriften nicht neu gesetzt.

### Neuen Tag beginnen

Archivieren und leeren heutigen Entwurf gemeinsam speichern. Ist der angezeigte
Tag bereits heute, bleibt dessen gerade gespeicherter Eintrag in der History,
während die Erfassung leer ist. Ein vorhandener heutiger Eintrag wird nicht geladen.

### Tag zurücksetzen

Nur den Entwurf durch einen leeren heutigen Entwurf ersetzen. Die History bleibt
unverändert. Diese Operation ruft weder die Archivierung noch den manuellen
Datumswechsel auf. Auch nachgelagerte Formularereignisse dürfen nicht archivieren.

### History löschen und mehrere Fenster

Ein kleiner Manifest-V3-Service-Worker übernimmt alle Speichermutationen in einer
Warteschlange. Dadurch überschreiben Hauptansicht, History und Einstellungen nicht
gegenseitig ältere Gesamtkopien. Jede Operation liest den aktuellen Zustand.
Ansichten übernehmen Änderungen über `chrome.storage.onChanged`.

Löscht die History einen Tag, darf ein noch geöffneter unveränderter Entwurf ihn
nicht beim nächsten Wechsel automatisch wiederherstellen. Seine Archivierung wird
bis zu einer bewussten neuen Bearbeitung unterdrückt. Ein bereits bearbeiteter,
zwischenzeitlich veralteter Entwurf wird erhalten und vor einem Überschreiben als
Konflikt angezeigt. Revisionen verhindern das stille Wiederherstellen gelöschter
oder Überschreiben inzwischen geänderter Einträge.

## 6. Berechnung der Statistik

Zeitraum: erstes gespeichertes Datum bis gestern, jeweils einschließlich. Liegt das
erste Datum nach gestern, gibt es noch keinen auswertbaren Zeitraum. Nur die
erste logische Version jedes Datums zählt.

- **Arbeitsstunden:** Summe der Nettoarbeitsminuten vollständiger positiver
  Arbeitseinträge. Bestehende Regeln zu Nachtarbeit, überlappenden Zeitpausen und
  festen Pausen weiterverwenden. Leere Pausenzeilen ignorieren.
- **Ferienstunden:** Summe der gespeicherten Gutschriften der Ferientage im Zeitraum.
- **Sollstunden:** Summe des datumsabhängigen Wochensolls / 5 für alle Tage Montag
  bis Freitag im Zeitraum, einschließlich Tagen ohne Eintrag.
- **Saldo:** Arbeitsstunden + Ferienstunden − Sollstunden.
- **Durchschnitt:** Arbeitsstunden / Anzahl tatsächlich gearbeiteter, vollständiger
  Tage mit positiver Nettozeit; bei null solchen Tagen „—“.
- **Tagesanzahlen:** Arbeitstage und Ferientage getrennt. Kompensationstage zählen
  zu keiner dieser beiden Anzahlen, aber als ausgefüllte Tage für die Datenqualität.
- **Datenqualität:** Für jede geschnittene Kalenderwoche sei E die Anzahl Montag
  bis Freitag innerhalb des Zeitraums und C die Anzahl verschiedener ausgefüllter
  Datumswerte derselben Woche innerhalb des Zeitraums. C umfasst Arbeit, Ferien
  und Kompensation, einschließlich Wochenenden.
  Wochenquote = min(C, E) / E für E > 0.
  Gesamtquote = 100 * Summe(min(C, E)) / Summe(E).
  Wochen mit E = 0 tragen weder Zähler noch Nenner bei.

Der Qualitätshinweis erklärt knapp: „Vollständige Tage im erfassten Zeitraum;
unabhängig von erreichten Sollstunden. Auswertung bis gestern.“

Beispiele:

- Arbeit 8:00, Ferien 8:30 und Kompensation an drei Werktagen mit je 8:00 Soll:
  8:00 tatsächliche Arbeit, 8:30 Ferien, 24:00 Soll, Saldo −7:30, Durchschnitt 8:00.
- Eine volle Woche mit vier ausgefüllten Tagen erreicht 80 %, unabhängig davon,
  ob diese vier Tage insgesamt 20 oder 45 Arbeitsstunden enthalten.
- Erste Woche ab Donnerstag: 2/2, nächste volle Woche: 3/5. Gesamt: 5/7 = 71,4 %.
- Eine Woche mit sechs ausgefüllten Tagen kann höchstens 5/5 beitragen und keine
  Lücke einer anderen Woche ausgleichen.

## 7. UI und technische Aufteilung

### Hauptansicht und Einstellungen

- Datumsfeld in der Hauptansicht; die bisherige feste Überschrift „HEUTE“ passt
  sich dem gewählten Datum an.
- Checkbox „Ferientag“ und Checkbox „Überzeitkompensation“, die sich gegenseitig
  ausschalten. Ohne Markierung gilt Arbeitstag. Zeitfelder und Zeitaktionen sind
  bei einer Markierung deaktiviert; vorhandene Werte bleiben erhalten.
- Bestehende Anzeige für gearbeitet, Soll und Saldo beibehalten. Feriengutschrift
  erscheint zusätzlich bei markierten Ferientagen, statt als Arbeitszeit zu gelten.
- Button „History“ ergänzen. Im Footer stehen „Neuen Tag beginnen“ und
  „Tag zurücksetzen“ als getrennte Aktionen. Beginn und Feierabend werden manuell
  erfasst; die Aktion „Feierabend jetzt“ entfällt.
- Einstellungen: Wochenstunden, Feriengutschrift in Stunden, Darstellung.
  Automatische Speicherung beibehalten. Das aktuelle Wochensoll und eine Änderung
  gelten ab heute; keine rückwirkende Datumsauswahl in den Einstellungen.
- Das kompakte Layout bleibt erhalten. Die zusätzlichen Bedienelemente müssen
  innerhalb der Toolbar-Popup-Höhe erreichbar bleiben. Das heutige globale
  `overflow: hidden` darf keine Inhalte abschneiden; nötigenfalls begrenztes Scrollen.

### History

Eigenes kleines Browserfenster mit `chrome.windows.create({ type: "popup" })` und
lokaler Erweiterungsseite. Keine externe Website und kein zweites Toolbar-Popup.
Das bisherige Toolbar-Popup schließt beim Fokuswechsel; vorher wird die
Entwurfssicherung abgeschlossen. Zum Öffnen eigener Fenster sind keine Leserechte
auf fremde Browser-Tabs nötig.

Monatskalender mit Navigation, sichtbarer Markierung gespeicherter Tage und
zugänglicher Beschriftung für Auswahl und Tagesart. Keine Datumsbearbeitung oder
Bearbeitung der Zeitwerte in der History. Ein Klick auf einen gespeicherten Tag
öffnet einen schließbaren Dialog mit Datum, Tagesart, Beginn, Ende, Pausen,
Arbeitszeit beziehungsweise Gutschrift und damaligem Soll. Unvollständige Einträge
werden erkennbar bezeichnet. Die explizite Löschfunktion entfernt den Tag.

### Statistik

Button innerhalb der History öffnet ein separates kleines Popup-Fenster.
Es verwendet dieselben Designvariablen und zeigt Zeitraum, Stunden, Saldo,
Tagesdurchschnitt und Tagesanzahlen in kompakten Karten. Datenqualität wird
zurückhaltend als Prozentwert mit kurzem Hinweis dargestellt. Keine zusätzlichen
Filter, Diagramme, Exportfunktionen oder weiteren Statistiken in diesem Umfang.

### Vorgesehene Dateien und Verantwortlichkeiten

- `popup.html`, `popup.css`, `popup.js`: bestehende Hauptansicht und Einstellungen
  erweitern; allgemeine Designregeln für die neuen Ansichten gemeinsam nutzen.
- `history.html`, `history.js`: Kalender und Tagesdialog.
- `statistics.html`, `statistics.js`: Kennzahlen und Leerzustand.
- `time-calculations.js`: reine Arbeitszeitberechnung ohne UI oder aktuelle Uhrzeit
  als versteckte Abhängigkeit; Live-Endzeit bei Bedarf ausdrücklich übergeben.
- `statistics.js` nutzt einen getrennten Berechnungsteil für Zeitraum, Sollverlauf,
  Tagesklassifikation und Datenqualität, der unabhängig von der Anzeige prüfbar ist.
- `dates.js`: lokale Kalenderdaten, Tages- und Wochengrenzen.
- `state.js`: Schemavalidierung, Migration und Speicherübergänge ohne Browserzugriff.
- `storage.js`: Nachrichten an den einzigen Schreibprozess, Fenster und gemeinsame
  Darstellungsaktualisierung. Der kanonische Datumszugriff liegt im Berechnungsteil.
- `background.js`: Service-Worker mit serialisierten Speichervorgängen.
- `manifest.json`: Hintergrundprozess eintragen, Beschreibung/Version anpassen;
  Berechtigung `storage` bleibt ausreichend.
- `README.md`: Bedienung, Speicherung, Tagesarten und Berechnungsregeln erklären.

Offizielle technische Grundlagen:
- https://developer.chrome.com/docs/extensions/develop/ui/add-popup
- https://developer.chrome.com/docs/extensions/reference/api/windows

## 8. Übernahme vorhandener Daten

1. Neue Schemaversion prüfen. Nur ohne bereits gültigen neuen Zustand migrieren.
2. Bestehende Uhrzeiten, Pausen und Darstellung übernehmen. Bisheriges Tagessoll
   in Minuten mit fünf multiplizieren und als historischen Basiswert verwenden.
3. Feriengutschrift initial auf 510 Minuten setzen. Keine Ferien- oder
   Kompensationstage erfinden.
4. Bestehende Erfassung mit Inhalt und ohne Datum als undatierten Entwurf erhalten;
   Datum einmalig in der Hauptansicht zuordnen. Keine Arbeitsdaten als heute
   archivieren, nur weil die neue Version heute erstmals geöffnet wird.
5. Neuen Zustand vollständig speichern und prüfen. Alten `workTimeState` als
   unveränderte Migrationsquelle belassen; nach erfolgreicher Migration nicht mehr
   als aktiven Datenbestand lesen. Wiederholtes Öffnen darf nicht erneut migrieren
   oder später gelöschte History aus Altbeständen wiederherstellen.
6. Bei Fehlern Bestandsdaten nicht überschreiben und Migration nachvollziehbar
   abbrechen. Für bislang undatierte Daten lässt sich kein früherer Sollverlauf
   rekonstruieren; der übernommene Basiswert gilt bis zur ersten neuen Änderung.

## 9. Umsetzungsschritte nach Freigabe

1. Reine Arbeitszeitberechnung aus der UI lösen und vorhandene Nachtarbeits- und
   Pausenregeln erhalten.
2. Versioniertes Datenmodell, datierten Sollverlauf, Migration und einzigen
   Schreibprozess umsetzen; Archivierung von Entwurfssicherung trennen.
3. Hauptansicht mit Datum, Tagesarten und den zwei Neustart-Aktionen erweitern.
4. Einstellungen auf Wochenstunden und unabhängige Feriengutschrift umstellen.
5. History-Fenster, Kalender, Tagesdialog und Löschablauf ergänzen.
6. Statistikberechnung und Statistikfenster ergänzen.
7. Akzeptanzfälle automatisiert prüfen, UI in beiden Darstellungen und im echten
   Chromium-Erweiterungskontext kontrollieren; README aktualisieren.

## 10. Überprüfbare Akzeptanzkriterien

### Datumswechsel und Speicherung

- A bearbeiten, B wählen: A ist unter A gespeichert; B zeigt ausschließlich B
  oder leere Werte. A erneut wählen lädt A. Mehrfaches Speichern erhöht die Anzahl
  der Einträge für A nicht.
- Ein ungeladener/neu leerer Tag erzeugt weder beim Wechsel noch bei „Neuen Tag
  beginnen“ einen Eintrag. Ein unvollständiger Tag mit Beginn bleibt erhalten.
- Leere Pausenzeilen allein erzeugen keinen History-Eintrag. Eine feste Pause
  allein gilt als Inhalt, aber nicht als ausgefüllter Arbeitstag.
- Zwei vorhandene Einträge für A: Anzeige, Aktualisierung und Statistik verwenden
  den ersten. Seine Aktualisierung verändert den zweiten nicht. Die Datenqualität
  erhöht sich durch das Duplikat nicht.
- Ein Fehler beim Speichern lässt Datum und Entwurf stehen und erzeugt keine
  Erfolgsmeldung. Schnelles mehrfaches Wechseln verliert keine bestätigten Eingaben.
- Schließen, erneutes Öffnen und ein Browserneustart erhalten Entwurf und History.

### Zurücksetzen und Löschen

- „Neuen Tag beginnen“ archiviert den bisherigen nichtleeren Tag und öffnet einen
  leeren heutigen Entwurf. „Tag zurücksetzen“ archiviert keine aktuellen Änderungen.
- Für heute liegt ein History-Eintrag vor: Beide Neustart-Aktionen leeren nur den
  Entwurf; der heutige gespeicherte Eintrag bleibt vorhanden. Ein anschließender
  Wechsel vom unberührten leeren Entwurf überschreibt ihn nicht.
- Eine neu bearbeitete heutige Erfassung aktualisiert beim Archivieren den ersten
  heutigen Eintrag. Ein späterer manueller Wechsel zurück zu heute lädt ihn.
- Reset löst keine Datumswechsel-Archivierung aus. Das gilt auch bei Blur-Ereignissen
  noch fokussierter Zeitfelder und unmittelbar aufeinanderfolgenden Aktionen.
- Nur die History-Löschaktion entfernt Einträge; bei Duplikaten entfernt sie das
  ganze Datum. Kein offener unveränderter Entwurf stellt es automatisch wieder her.
- Gleichzeitige Einstellungsänderung und History-Löschung verlieren keine Daten;
  ein veralteter bearbeiteter Entwurf überschreibt keine neuere Revision still.

### Ferien und Kompensation

- Ferientag bei 8,5 Stunden markieren, speichern, Einstellung auf 8 ändern:
  bestehender Tag bleibt bei 8,5. Neu markierter Tag erhält 8. Erneutes Laden oder
  Speichern des bestehenden Tags verändert seine Gutschrift nicht.
- Ferien und Kompensation sind ohne Zeiten speicherbar und zählen als ausgefüllt.
  Gegenseitiges Umschalten erzeugt keine Kombination beider Arten.
- Vorhandene Zeiten sind bei einer Markierung deaktiviert und nicht angerechnet;
  nach dem Entfernen der Markierung sind sie unverändert wieder nutzbar.
- Kompensation bei 8:00 Werktagssoll liefert 0:00 Arbeit, 0:00 Ferien, −8:00 Saldo.
  Ein vorheriger Gesamtsaldo von +12:00 sinkt dadurch auf +4:00.

### Statistik und Datenqualität

- Heute und zukünftige Einträge ändern bis zum jeweils folgenden Tag keine Kennzahl.
  Ein einzelner heutiger Datensatz führt zum noch nicht auswertbaren Leerzustand.
- Ein gültiger Arbeitstag mit nur 2 Stunden zählt als ausgefüllt. Fehlender
  Feierabend oder eine offene angefangene Zeitpause zählt nicht. Leere Pausenzeilen
  verhindern einen sonst vollständigen Arbeitstag nicht.
- Historische unvollständige Einträge verändern sich nicht mit der aktuellen Uhrzeit.
- Urlaubsgutschrift und tatsächliche Arbeit bleiben getrennt; Ferien- und
  Kompensationstage gehen nicht in den Arbeitszeitdurchschnitt ein.
- 4/5 ausgefüllte Tage ergeben 80 %, auch bei überschrittener Wochensollzeit.
  2/2 und 3/5 ergeben zusammen 71,4 %. 6/5 wird auf 100 % gedeckelt und verbessert
  keine andere Woche. Duplikate verbessern keine Quote.
- Bei Start am Wochenende ohne erwarteten Werktag ist die Qualität „—“, ohne
  Division durch null; erfasste Arbeitsstunden bleiben sichtbar.
- Montag bei 40 Wochenstunden, Änderung am Dienstag auf 42: Montag behält 8:00,
  Dienstag erhält 8:24. Auch eine erst später erfasste Montagsarbeit behält 8:00 Soll.
- Fehlende Werktage innerhalb des Auswertungszeitraums tragen Sollstunden bei;
  Wochenendarbeit trägt Arbeitsstunden ohne zusätzliches Soll bei.
- Arbeit über Mitternacht, überlappende Zeitpausen und feste Pausen liefern dieselbe
  Nettozeit wie die bisherige Berechnung für vollständig erfasste Fälle.
- Nach Löschung des frühesten Datums beginnt die Auswertung beim nächsten noch
  vorhandenen Datum. Ohne verbleibende Einträge erscheinen verständliche Leerzustände.

### Migration und Oberfläche

- Eine alte tägliche Sollzeit von 8:30 wird als 42,5 Wochenstunden übernommen;
  Darstellung und sämtliche Pausen bleiben erhalten.
- Undatierte Bestandsinhalte werden vor der Datumszuordnung nicht als heute
  archiviert. Die Zuordnung erhält die Inhalte und ist ausschließlich in der
  Hauptansicht möglich. Wiederholtes Öffnen migriert nicht erneut.
- Kalender markiert genau die gespeicherten logischen Datumswerte. Details und
  Statistik lassen sich schließen; die History bietet keine Datumsbearbeitung.
- Hauptansicht, History, Details und Statistik funktionieren per Tastatur und in
  Hell-/Dunkelmodus. Kein Bedienelement wird durch die Popup-Abmessungen abgeschnitten.
- Beim Öffnen der History ist der Entwurf bereits gesichert, bevor das Toolbar-Popup
  durch den Fokuswechsel geschlossen wird.

## 11. Umfang und Freigabe

Dieses Dokument beschreibt den ursprünglich freigegebenen Umfang. Export/Import
wurde am 05.11.2026 zusätzlich beauftragt und wie unten beschrieben ergänzt.
Nicht Bestandteil sind Synchronisierung, Feiertagskalender, Teilferien, stundenweise Kompensationsbuchungen
oder zusätzliche Auswertungsfilter. Die Freigabe umfasst auch die als Vorschlag
gekennzeichneten Festlegungen.

## 12. Ergänzung: History-Import und -Export

- Zwei Aktionen in den Einstellungen sichern und laden eine lokale JSON-Datei
  (`workinghours-history`, Dateiversion 1). Enthalten sind gespeicherte Tage und
  der Sollstundenverlauf; der Entwurf und weitere Einstellungen sind ausgenommen.
- Der Import ergänzt fehlende Datumswerte, erhält vorhandene Einträge und verwendet
  bei Duplikaten in der Datei den ersten. Interne IDs und Revisionen werden neu
  vergeben. Wiederholter Import ist ohne weitere Änderung möglich.
- Bei leerer History wird der importierte Sollverlauf bis gestern übernommen.
  Ab heute bleiben die lokalen Wochenstunden wirksam. Bei vorhandener History
  bleibt der lokale Sollverlauf unverändert.
- Der Hintergrundprozess validiert die vollständige Sicherung und speichert atomar
  innerhalb seiner bisherigen Warteschlange. Ungültige Dateien oder unbekannte
  Versionen verändern keine Daten. Die Dateiauswahl akzeptiert höchstens 10 MB.
- Eine offene Erfassung bleibt erhalten. Bei einem bearbeiteten Entwurf für einen
  neu importierten Tag wird ein Konflikt gesetzt; veraltete Entwurfsrevisionen
  dürfen die importierten Daten nicht überschreiben.
- Automatisierte Prüfungen decken JSON-Rundlauf mit unveränderter historischer
  Statistik, Tagesarten, Pausen, unvollständige Tage, Duplikate, ungültige Dateien,
  Dateigröße, Speicherfehler, gleichzeitige Änderungen und die Einstellungsaktionen ab.
- Eine visuelle Prüfung der Ergänzung im echten Chromium konnte wegen der
  Browserrichtlinie für lokale Dateien nicht durchgeführt werden.
