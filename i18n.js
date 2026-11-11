export const languages = ["de", "en", "nb", "fr"];
const locales = { de: "de-CH", en: "en-GB", nb: "nb-NO", fr: "fr-CH" };
let language = "de";
const entries = [
  ["Arbeitszeit", "Working hours", "Arbeidstid", "Temps de travail"],
  ["History", "History", "Historikk", "Historique"],
  ["Einstellungen", "Settings", "Innstillinger", "Paramètres"],
  ["Einstellungen öffnen", "Open settings", "Åpne innstillinger", "Ouvrir les paramètres"],
  ["Zurück zur Zeiterfassung", "Back to time entry", "Tilbake til tidsregistrering", "Retour à la saisie"],
  ["HEUTE", "TODAY", "I DAG", "AUJOURD’HUI"],
  ["DATUM ZUORDNEN", "ASSIGN A DATE", "VELG DATO", "ATTRIBUER UNE DATE"],
  ["KONFIGURATION", "CONFIGURATION", "OPPSETT", "CONFIGURATION"],
  ["Datum", "Date", "Dato", "Date"],
  ["Datum wählen", "Choose date", "Velg dato", "Choisir une date"],
  ["Ferientag", "Vacation day", "Feriedag", "Jour de congé"],
  ["Überzeitkompensation", "Time off in lieu", "Avspasering", "Récupération d’heures"],
  ["Arbeitstag", "Workday", "Arbeidsdag", "Jour travaillé"],
  ["Die bisherigen Zeiten haben noch kein Datum. Bitte einmalig zuordnen.", "Existing times have no date yet. Please assign one.", "Eksisterende tider mangler dato. Velg en dato.", "Les heures existantes n’ont pas encore de date. Veuillez en attribuer une."],
  ["Gearbeitet", "Worked", "Arbeidet", "Travaillé"],
  ["Sollzeit", "Target hours", "Måltid", "Heures prévues"],
  ["Saldo", "Balance", "Saldo", "Solde"],
  ["Überzeit", "Overtime", "Overtid", "Heures supplémentaires"],
  ["Minuszeit", "Time deficit", "Undertid", "Heures manquantes"],
  ["Arbeitszeiten und Pausen", "Working hours and breaks", "Arbeidstid og pauser", "Heures de travail et pauses"],
  ["Arbeitsbeginn", "Start of work", "Arbeidsstart", "Début du travail"],
  ["Feierabend", "End of work", "Arbeidsslutt", "Fin du travail"],
  ["Pausen", "Breaks", "Pauser", "Pauses"],
  ["Manuell oder ab jetzt hinzufügen", "Add manually or from now", "Legg til manuelt eller fra nå", "Ajouter manuellement ou dès maintenant"],
  ["+ Manuell", "+ Manual", "+ Manuelt", "+ Manuellement"],
  ["Min Pause", "min break", "min pause", "min de pause"],
  ["Schnellpause hinzufügen", "Add a quick break", "Legg til hurtigpause", "Ajouter une pause rapide"],
  ["Vorherige Pausen", "Previous breaks", "Forrige pauser", "Pauses précédentes"],
  ["Nächste Pausen", "Next breaks", "Neste pauser", "Pauses suivantes"],
  ["Noch keine Pause erfasst.", "No breaks recorded yet.", "Ingen pauser registrert ennå.", "Aucune pause enregistrée."],
  ["Neuen Tag beginnen", "Start a new day", "Start en ny dag", "Commencer un nouveau jour"],
  ["Tag zurücksetzen", "Reset day", "Tilbakestill dagen", "Réinitialiser le jour"],
  ["Wöchentliche Sollarbeitszeit (Stunden)", "Weekly target (hours)", "Ukentlig arbeidstid (timer)", "Objectif hebdomadaire (heures)"],
  ["Gilt ab heute. Tagessoll: Wochenstunden ÷ 5, Montag bis Freitag.", "Applies from today. Daily target: weekly hours ÷ 5, Monday to Friday.", "Gjelder fra i dag. Dagsmål: uketimer ÷ 5, mandag til fredag.", "Applicable dès aujourd’hui. Objectif quotidien : heures hebdomadaires ÷ 5, du lundi au vendredi."],
  ["Gutschrift pro Ferientag (Stunden)", "Credit per vacation day (hours)", "Godskriving per feriedag (timer)", "Crédit par jour de congé (heures)"],
  ["Standard: 8,5. Bereits markierte Ferientage behalten ihre Gutschrift.", "Default: 8.5. Existing vacation days retain their credit.", "Standard: 8,5. Eksisterende feriedager beholder godskrivingen.", "Valeur par défaut : 8,5. Les jours déjà marqués conservent leur crédit."],
  ["Darstellung", "Appearance", "Utseende", "Apparence"],
  ["Hell", "Light", "Lys", "Clair"], ["Dunkel", "Dark", "Mørk", "Sombre"],
  ["Sprache", "Language", "Språk", "Langue"],
  ["History sichern und laden", "Back up and restore history", "Sikkerhetskopier og importer historikk", "Sauvegarder et importer l’historique"],
  ["Beim Import", "On import", "Ved import", "Lors de l’importation"],
  ["Vorhandene Tage behalten", "Keep existing days", "Behold eksisterende dager", "Conserver les jours existants"],
  ["Vorhandene Tage überschreiben", "Overwrite existing days", "Overskriv eksisterende dager", "Écraser les jours existants"],
  ["History exportieren", "Export history", "Eksporter historikk", "Exporter l’historique"],
  ["History importieren", "Import history", "Importer historikk", "Importer l’historique"],
  ["History-Sicherung auswählen", "Choose history backup", "Velg sikkerhetskopi", "Choisir une sauvegarde"],
  ["Alle Datensätze löschen", "Delete all records", "Slett alle oppføringer", "Supprimer tous les enregistrements"],
  ["Gesamte History löschen", "Delete all history", "Slett hele historikken", "Supprimer tout l’historique"],
  ["Alle gespeicherten History-Einträge endgültig löschen? Einstellungen und aktuelle Erfassung bleiben erhalten.", "Permanently delete all saved history entries? Settings and the current entry will remain.", "Slette alle lagrede historikkoppføringer permanent? Innstillinger og dagens registrering beholdes.", "Supprimer définitivement toutes les entrées de l’historique ? Les paramètres et la saisie actuelle seront conservés."],
  ["Abbrechen", "Cancel", "Avbryt", "Annuler"], ["Alle löschen", "Delete all", "Slett alle", "Tout supprimer"],
  ["Änderungen werden automatisch gespeichert.", "Changes are saved automatically.", "Endringer lagres automatisk.", "Les modifications sont enregistrées automatiquement."],
  ["Von", "From", "Fra", "De"], ["Bis", "To", "Til", "À"],
  ["Pause entfernen", "Remove break", "Fjern pause", "Supprimer la pause"],
  ["feste Pause", "fixed break", "fast pause", "pause fixe"],
  ["GESPEICHERTE TAGE", "SAVED DAYS", "LAGREDE DAGER", "JOURS ENREGISTRÉS"],
  ["History schließen", "Close history", "Lukk historikk", "Fermer l’historique"],
  ["Gespeicherte Tage im Kalender", "Saved days in calendar", "Lagrede dager i kalenderen", "Jours enregistrés dans le calendrier"],
  ["Statistik öffnen", "Open statistics", "Åpne statistikk", "Ouvrir les statistiques"],
  ["Tagesdetails schließen", "Close day details", "Lukk dagsdetaljer", "Fermer les détails du jour"],
  ["Diesen gespeicherten Tag endgültig löschen?", "Permanently delete this saved day?", "Slette denne lagrede dagen permanent?", "Supprimer définitivement ce jour enregistré ?"],
  ["Tag löschen", "Delete day", "Slett dag", "Supprimer le jour"], ["Eintrag löschen", "Delete entry", "Slett oppføring", "Supprimer l’entrée"],
  ["ARBEITSZEIT IM ÜBERBLICK", "WORKING HOURS AT A GLANCE", "OVERSIKT OVER ARBEIDSTID", "APERÇU DU TEMPS DE TRAVAIL"],
  ["Statistik", "Statistics", "Statistikk", "Statistiques"], ["Statistik schließen", "Close statistics", "Lukk statistikk", "Fermer les statistiques"],
  ["Noch keine Auswertung möglich", "No statistics available yet", "Ingen statistikk tilgjengelig ennå", "Aucune statistique disponible"],
  ["Die Statistik beginnt mit dem ersten gespeicherten Tag und reicht bis gestern. Heutige Einträge zählen ab morgen.", "Statistics start with the first saved day and end yesterday. Today's entries count from tomorrow.", "Statistikken starter med første lagrede dag og går til i går. Dagens oppføringer teller fra i morgen.", "Les statistiques commencent au premier jour enregistré et vont jusqu’à hier. Les saisies d’aujourd’hui compteront demain."],
  ["Arbeitszeitstatistik", "Working hours statistics", "Arbeidstidsstatistikk", "Statistiques du temps de travail"],
  ["Tatsächlich gearbeitet", "Actual work", "Faktisk arbeid", "Travail effectif"],
  ["Feriengutschrift", "Vacation credit", "Feriegodskriving", "Crédit de congé"],
  ["Sollstunden", "Target hours", "Måltimer", "Heures prévues"],
  ["Saldo inkl. Ferien", "Balance incl. vacation", "Saldo inkl. ferie", "Solde, congés inclus"],
  ["Ø pro gearbeitetem Tag", "Avg. per worked day", "Snitt per arbeidsdag", "Moy. par jour travaillé"],
  ["Arbeits- / Ferientage", "Work / vacation days", "Arbeids- / feriedager", "Jours travaillés / congés"],
  ["Stunden", "Hours", "Timer", "Heures"], ["Tage", "Days", "Dager", "Jours"],
  ["Datenqualität", "Data quality", "Datakvalitet", "Qualité des données"],
  ["Vollständige Tage im erfassten Zeitraum, unabhängig von erreichten Sollstunden. Maximal fünf Tage pro voller Woche; Ferien und Kompensation zählen mit.", "Complete days in the recorded period, regardless of target hours reached. At most five days per full week; vacation and time off in lieu count.", "Fullstendige dager i perioden, uavhengig av oppnådd måltid. Maks fem dager per full uke; ferie og avspasering teller med.", "Jours complets sur la période, indépendamment de l’objectif atteint. Cinq jours au maximum par semaine complète ; congés et récupération sont inclus."],
  ["Auswertung bis gestern. Fehlende Werktage tragen Sollstunden bei. Kompensation reduziert den Saldo über die reguläre Sollzeit.", "Calculated through yesterday. Missing weekdays contribute target hours. Time off in lieu reduces the balance through regular target hours.", "Beregnet til og med i går. Manglende hverdager gir måltimer. Avspasering reduserer saldoen gjennom ordinær måltid.", "Calcul jusqu’à hier. Les jours ouvrables manquants ajoutent des heures prévues. La récupération réduit le solde via l’objectif habituel."],
  ["Vorheriger Monat", "Previous month", "Forrige måned", "Mois précédent"], ["Nächster Monat", "Next month", "Neste måned", "Mois suivant"],
  ["Mo", "Mon", "Ma", "Lu"], ["Di", "Tue", "Ti", "Ma"], ["Mi", "Wed", "On", "Me"], ["Do", "Thu", "To", "Je"], ["Fr", "Fri", "Fr", "Ve"], ["Sa", "Sat", "Lø", "Sa"], ["So", "Sun", "Sø", "Di"],
  ["Arbeit", "Work", "Arbeid", "Travail"], ["Ferien", "Vacation", "Ferie", "Congés"], ["Kompensation", "Time off", "Avspasering", "Récupération"],
  ["gespeichert", "saved", "lagret", "enregistré"], ["kein Eintrag", "no entry", "ingen oppføring", "aucune entrée"],
  ["Ohne Datum", "No date", "Uten dato", "Sans date"], ["Std.", "hrs", "t", "h"],
  ["Min", "min", "min", "min"], ["für diesen Tag gespeichert", "saved for this day", "lagret for denne dagen", "enregistré pour ce jour"],
  ["Erfassung automatisch lokal gesichert. History-Speicherung beim Datumswechsel oder mit „Neuen Tag beginnen“.", "Entry saved locally automatically. Add it to history by changing the date or starting a new day.", "Registreringen lagres automatisk lokalt. Legg den i historikken ved å bytte dato eller starte en ny dag.", "La saisie est enregistrée automatiquement sur cet appareil. Ajoutez-la à l’historique en changeant de date ou en commençant un nouveau jour."],
  ["Dieser gespeicherte Tag wurde inzwischen geändert oder gelöscht. Deine Erfassung bleibt hier erhalten; bitte vor dem Zurücksetzen bei Bedarf die Zeiten sichern.", "This saved day has changed or been deleted. Your entry remains here; save the times if needed before resetting.", "Denne lagrede dagen er endret eller slettet. Registreringen beholdes her; ta vare på tidene før du tilbakestiller om nødvendig.", "Ce jour enregistré a été modifié ou supprimé. Votre saisie reste ici ; conservez les heures avant de réinitialiser si nécessaire."],
  ["Bitte den bisherigen Zeiten zuerst ein Datum zuordnen.", "Please assign a date to the existing times first.", "Velg først en dato for de eksisterende tidene.", "Veuillez d’abord attribuer une date aux heures existantes."],
  ["Überzeitkompensation: keine Arbeitsstunden, reguläre Sollzeit bleibt bestehen.", "Time off in lieu: no working hours; regular target hours still apply.", "Avspasering: ingen arbeidstimer; ordinært mål gjelder fortsatt.", "Récupération : aucune heure travaillée ; l’objectif habituel reste applicable."],
  ["Es zählt ausschließlich die gespeicherte Feriengutschrift.", "Only the saved vacation credit counts.", "Bare lagret feriegodskriving teller.", "Seul le crédit de congé enregistré est pris en compte."],
  ["Unvollständige Pause: für die Statistik bitte beide Uhrzeiten ergänzen.", "Incomplete break: enter both times for statistics.", "Ufullstendig pause: fyll ut begge klokkeslettene for statistikken.", "Pause incomplète : saisissez les deux heures pour les statistiques."],
  ["Live-Berechnung bis zur aktuellen Uhrzeit. Für die Statistik bitte Feierabend ergänzen.", "Live calculation through the current time. Enter the end of work for statistics.", "Løpende beregning til nå. Fyll ut arbeidsslutt for statistikken.", "Calcul en direct jusqu’à maintenant. Saisissez l’heure de fin pour les statistiques."],
  ["Unvollständig: Für historische Arbeitsstunden bitte Feierabend ergänzen.", "Incomplete: enter the end of work for historical working hours.", "Ufullstendig: fyll ut arbeidsslutt for historiske arbeidstimer.", "Incomplet : saisissez l’heure de fin pour les heures travaillées passées."],
  ["offen", "open", "åpen", "ouverte"], ["Minuten (fest)", "minutes (fixed)", "minutter (fast)", "minutes (fixe)"],
  ["Noch keine Tage in der History gespeichert.", "No days saved in history yet.", "Ingen dager lagret i historikken ennå.", "Aucun jour enregistré dans l’historique."],
  ["Vorhandene Arbeitszeiten und Pausen werden bei dieser Tagesart nicht angerechnet.", "Existing working hours and breaks are not counted for this day type.", "Eksisterende arbeidstider og pauser telles ikke for denne dagtypen.", "Les heures de travail et pauses existantes ne sont pas comptabilisées pour ce type de jour."],
  ["Unvollständiger Arbeitstag oder keine positive Nettozeit: zählt nicht als ausgefüllter Arbeitstag und liefert keine statistischen Arbeitsstunden.", "Incomplete workday or no positive net time: does not count as a complete workday or contribute working hours to statistics.", "Ufullstendig arbeidsdag eller ingen positiv nettotid: teller ikke som fullført arbeidsdag og gir ingen arbeidstimer i statistikken.", "Jour de travail incomplet ou sans durée nette positive : ne compte pas comme jour complet et n’ajoute pas d’heures aux statistiques."],
  ["Alle gespeicherten Tage bis gestern", "All saved days through yesterday", "Alle lagrede dager til og med i går", "Tous les jours enregistrés jusqu’à hier"],
  ["Eintrag vom", "Entry from", "Oppføring fra", "Entrée du"], ["gelöscht.", "deleted.", "slettet.", "supprimée."],
  ["{filled} von {expected} erwarteten Tagen (wochenweise gedeckelt).", "{filled} of {expected} expected days (capped per week).", "{filled} av {expected} forventede dager (begrenset per uke).", "{filled} jours sur {expected} attendus (plafonnés par semaine)."],
  ["{days} gespeicherte Arbeitstage ohne vollständige positive Nettozeit liefern keine Arbeitsstunden und zählen nicht für Durchschnitt oder Datenqualität.", "{days} saved workdays without complete positive net time contribute no working hours and do not count toward the average or data quality.", "{days} lagrede arbeidsdager uten fullstendig positiv nettotid gir ingen arbeidstimer og teller ikke i gjennomsnitt eller datakvalitet.", "{days} jours de travail enregistrés sans durée nette positive complète n’ajoutent aucune heure et ne comptent pas dans la moyenne ni la qualité des données."],
  ["Die Erfassung wurde inzwischen geändert. Deine noch ungesicherten Eingaben bleiben sichtbar. Bitte sichere sie bei Bedarf und wähle „Tag zurücksetzen“.", "The entry has changed. Your unsaved input remains visible. Save it if needed, then select Reset day.", "Registreringen er endret. Ulagrede inndata vises fortsatt. Ta vare på dem ved behov, og velg Tilbakestill dagen.", "La saisie a été modifiée. Vos données non enregistrées restent visibles. Conservez-les si nécessaire, puis choisissez Réinitialiser le jour."],
  ["Diese Erfassung wurde in einem anderen Fenster geändert. Deine Eingaben bleiben sichtbar; bitte vor „Tag zurücksetzen“ bei Bedarf sichern.", "This entry was changed in another window. Your input remains visible; save it if needed before resetting the day.", "Registreringen ble endret i et annet vindu. Inndata vises fortsatt; ta vare på dem før tilbakestilling ved behov.", "Cette saisie a été modifiée dans une autre fenêtre. Vos données restent visibles ; conservez-les avant de réinitialiser si nécessaire."],
  ["Die Sicherung darf höchstens 10 MB groß sein. Es wurden keine Daten importiert.", "The backup must be no larger than 10 MB. No data was imported.", "Sikkerhetskopien kan ikke være større enn 10 MB. Ingen data ble importert.", "La sauvegarde ne doit pas dépasser 10 Mo. Aucune donnée n’a été importée."],
  ["Import abgeschlossen. Tage aus der Datei wurden übernommen; vorhandene Tage desselben Datums wurden überschrieben.", "Import complete. Days from the file were added; existing days with the same date were overwritten.", "Importen er fullført. Dager fra filen ble lagt til; eksisterende dager med samme dato ble overskrevet.", "Importation terminée. Les jours du fichier ont été ajoutés ; les jours existants à la même date ont été écrasés."],
  ["Import abgeschlossen. Fehlende Tage wurden ergänzt; vorhandene Tage bleiben erhalten.", "Import complete. Missing days were added; existing days were kept.", "Importen er fullført. Manglende dager ble lagt til; eksisterende dager ble beholdt.", "Importation terminée. Les jours manquants ont été ajoutés ; les jours existants ont été conservés."],
  ["Alle History-Einträge wurden gelöscht.", "All history entries were deleted.", "Alle historikkoppføringer ble slettet.", "Toutes les entrées de l’historique ont été supprimées."],
  ["Bitte eine Stundenzahl zwischen 0 und {max} eingeben, zum Beispiel 8,5.", "Enter a number of hours between 0 and {max}, for example 8.5.", "Skriv inn et timetall mellom 0 og {max}, for eksempel 8,5.", "Saisissez un nombre d’heures entre 0 et {max}, par exemple 8,5."],
  ["Export mit {days} gespeicherten Tagen zum Download übergeben.", "Export with {days} saved days sent to download.", "Eksport med {days} lagrede dager sendt til nedlasting.", "Exportation de {days} jours enregistrés envoyée au téléchargement."],
  ["Bitte gültige Uhrzeiten zwischen 00:00 und 23:59 eingeben.", "Enter valid times between 00:00 and 23:59.", "Skriv inn gyldige klokkeslett mellom 00:00 og 23:59.", "Saisissez des heures valides entre 00:00 et 23:59."],
  ["Bitte ein gültiges Datum wählen.", "Choose a valid date.", "Velg en gyldig dato.", "Choisissez une date valide."],
  ["Für dieses Datum existiert bereits ein Eintrag. Bitte ein freies Datum zuordnen.", "An entry already exists for this date. Choose an unused date.", "Det finnes allerede en oppføring for denne datoen. Velg en ledig dato.", "Une entrée existe déjà à cette date. Choisissez une date libre."],
  ["Die Datei ist keine gültige Arbeitszeit-History-Sicherung. Es wurden keine Daten importiert.", "This file is not a valid working hours history backup. No data was imported.", "Filen er ikke en gyldig sikkerhetskopi av arbeidstidshistorikken. Ingen data ble importert.", "Ce fichier n’est pas une sauvegarde valide de l’historique. Aucune donnée n’a été importée."],
  ["Bitte eine gültige Importoption wählen.", "Choose a valid import option.", "Velg et gyldig importvalg.", "Choisissez une option d’importation valide."],
  ["Die Daten konnten nicht gespeichert werden. Bitte erneut versuchen.", "The data could not be saved. Please try again.", "Dataene kunne ikke lagres. Prøv igjen.", "Les données n’ont pas pu être enregistrées. Réessayez."],
  ["Der Hintergrundprozess ist noch nicht aktuell. Bitte die Erweiterung auf der Erweiterungsseite über den runden Pfeil neu laden und danach erneut versuchen.", "The background process is outdated. Reload the extension on the extensions page, then try again.", "Bakgrunnsprosessen er utdatert. Last inn utvidelsen på nytt på utvidelsessiden, og prøv igjen.", "Le processus en arrière-plan est obsolète. Rechargez l’extension sur la page des extensions, puis réessayez."],
  ["Der gespeicherte Tag wurde inzwischen geändert oder gelöscht. Deine Erfassung bleibt erhalten. Bitte sichere bei Bedarf die angezeigten Zeiten, wähle „Tag zurücksetzen“ und rufe das gewünschte Datum erneut auf.", "The saved day was changed or deleted. Your entry remains intact. Save the displayed times if needed, reset the day, then reopen the date.", "Den lagrede dagen ble endret eller slettet. Registreringen beholdes. Ta vare på tidene ved behov, tilbakestill dagen og åpne datoen på nytt.", "Le jour enregistré a été modifié ou supprimé. Votre saisie est conservée. Gardez les heures affichées si nécessaire, réinitialisez le jour, puis rouvrez la date."],
  ["Die Erfassung wurde in einem anderen Fenster geändert. Bitte das Fenster erneut öffnen; deine letzte lokal gesicherte Erfassung bleibt erhalten.", "The entry was changed in another window. Reopen this window; your last locally saved entry remains intact.", "Registreringen ble endret i et annet vindu. Åpne vinduet på nytt; siste lokalt lagrede registrering beholdes.", "La saisie a été modifiée dans une autre fenêtre. Rouvrez cette fenêtre ; votre dernière saisie enregistrée localement est conservée."],
  ["Die History wurde inzwischen geändert. Bitte das Löschen erneut aufrufen und bestätigen.", "History has changed. Start and confirm the deletion again.", "Historikken er endret. Start og bekreft slettingen på nytt.", "L’historique a changé. Relancez et confirmez la suppression."],
  ["Der Eintrag wurde inzwischen geändert. Bitte die Details erneut öffnen.", "The entry has changed. Reopen its details.", "Oppføringen er endret. Åpne detaljene på nytt.", "L’entrée a changé. Rouvrez ses détails."],
  ["Bitte eine gültige Stundenzahl eingeben.", "Enter a valid number of hours.", "Skriv inn et gyldig antall timer.", "Saisissez un nombre d’heures valide."],
  ["Die Sprache konnte nicht gespeichert werden. Bitte die Erweiterung auf der Erweiterungsseite über den runden Pfeil neu laden und erneut wählen.", "The language could not be saved. Reload the extension on the extensions page, then choose it again.", "Språket kunne ikke lagres. Last inn utvidelsen på nytt på utvidelsessiden, og velg språk igjen.", "La langue n’a pas pu être enregistrée. Rechargez l’extension sur la page des extensions, puis choisissez-la à nouveau."],
  ["Die gespeicherten Daten haben ein unbekanntes Format. Sie wurden nicht verändert.", "Saved data has an unknown format and was not changed.", "Lagrede data har et ukjent format og ble ikke endret.", "Les données enregistrées ont un format inconnu et n’ont pas été modifiées."],
  ["Die gespeicherten Daten sind unvollständig oder ungültig. Sie wurden nicht verändert.", "Saved data is incomplete or invalid and was not changed.", "Lagrede data er ufullstendige eller ugyldige og ble ikke endret.", "Les données enregistrées sont incomplètes ou invalides et n’ont pas été modifiées."],
  ["Bitte den übernommenen Zeiten zuerst ein Datum zuordnen.", "Assign a date to the imported times first.", "Velg først en dato for de overførte tidene.", "Attribuez d’abord une date aux heures reprises."],
  ["Ungültige Tageserfassung.", "Invalid day entry.", "Ugyldig dagsregistrering.", "Saisie du jour invalide."],
  ["Ungültiges Datum.", "Invalid date.", "Ugyldig dato.", "Date invalide."],
  ["Ungültige Sprache.", "Invalid language.", "Ugyldig språk.", "Langue invalide."],
  ["Ungültige Darstellung.", "Invalid appearance setting.", "Ugyldig visningsinnstilling.", "Paramètre d’apparence invalide."],
  ["Unbekannte Speicheraktion.", "Unknown storage action.", "Ukjent lagringshandling.", "Action de stockage inconnue."],
];
const catalog = new Map(entries.map(row => [row[0], row]));
const originals = new WeakMap();
const attributes = new WeakMap();
const titles = new WeakMap();

export function setLanguage(value) { language = languages.includes(value) ? value : "de"; }
export function getLanguage() { return language; }
export function locale() { return locales[language]; }
export function t(source) { return catalog.get(source)?.[languages.indexOf(language)] ?? source; }
export function formatNumber(value, options) { return value.toLocaleString(locale(), options); }

export function translateTree(root = document) {
  if (root.nodeType === 3) translateText(root);
  const nodes = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : root.querySelectorAll("*");
  for (const node of nodes) {
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      if (!node.hasAttribute(attribute)) continue;
      let saved = attributes.get(node);
      if (!saved) { saved = {}; attributes.set(node, saved); }
      if (!(attribute in saved)) saved[attribute] = node.getAttribute(attribute);
      node.setAttribute(attribute, t(saved[attribute]));
    }
    for (const child of node.childNodes) if (child.nodeType === 3) translateText(child);
  }
  document.documentElement.lang = language;
  if (!titles.has(document)) titles.set(document, document.title);
  document.title = titles.get(document).split(" · ").map(t).join(" · ");
}

function translateText(node) {
  const raw = originals.get(node) ?? node.textContent;
  originals.set(node, raw);
  const trimmed = raw.trim();
  if (catalog.has(trimmed)) node.textContent = raw.replace(trimmed, t(trimmed));
}
