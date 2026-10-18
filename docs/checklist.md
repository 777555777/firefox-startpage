# Manuelle Checkliste

Pro Meilenstein einmal durchgehen. Nicht zutreffende Punkte (noch nicht gebaut) überspringen.

## Immer

- [ ] `pnpm ext:dev` startet Firefox mit geladener Extension
- [ ] Neuer Tab zeigt die Startpage
- [ ] Startseite (Home-Button, Browser-Start) zeigt die Startpage
- [ ] Keine Fehler in der Konsole (`about:debugging` → Extension → Untersuchen)
- [ ] Tastaturbedienung komplett ohne Maus möglich
- [ ] Schrift ist Figtree (kein Fallback-Flackern)

## Ab M1

- [ ] Änderung in Tab A erscheint in Tab B ohne Neuladen
- [ ] Export erzeugt JSON, Import stellt den Stand wieder her, Backup ist danach vorhanden
- [ ] Sprachwechsel DE/EN wirkt sofort

## Ab M2

- [ ] Edit-Modus per Button und `E`
- [ ] Widgets per Maus und per Tastatur (`Leertaste`, Pfeile, `Leertaste`/`Esc`) verschieben
- [ ] Widget entfernen → Toast → Rückgängig
- [ ] Spaltenzahl ändern, schmales Fenster legt Spalten nur optisch zusammen

## Layout mit Zeilen (nach M5)

- [ ] Widget an den linken/rechten Rand eines anderen ziehen: steht daneben, gleich hoch
- [ ] Trenner in einer Zeile ziehen, Pfeiltasten, Umschalt (symmetrisch), Doppelklick (gleichmäßig)
- [ ] Tastatur: Pfeil hoch/runter löst aus der Zeile, Umschalt + hoch/runter heftet an
- [ ] Spaltenabstand und Widget-Abstand getrennt einstellbar
- [ ] Sehr schmales Fenster: Widgets einer Zeile stehen untereinander

## Mitte und Seitenspalten (Schema v3)

- [ ] Bestehende Config (v2) wird übernommen: bei drei Spalten wird die mittlere zur Mitte
- [ ] Mitte steht genau in der Bildschirmmitte, auch wenn eine Seite leer oder ausgeschaltet ist
- [ ] Trenner links oder rechts ziehen: Mitte ändert sich in 2er-Schritten, beide Seiten gleich
- [ ] Pfeiltasten auf dem Trenner, Doppelklick und „Standardbreite“ setzen auf 6 · 12 · 6
- [ ] Seite ausschalten: Widgets stehen am Ende der Mitte, „Rückgängig“ stellt alles wieder her
- [ ] Schmales Fenster: alles in einer Spalte (mittig, max. 48 rem) in der Reihenfolge Mitte,
      rechts, links; Tab-Reihenfolge ebenso
- [ ] Ohne Seiten nimmt die Mitte die ganze Breite (bis zur Maximalbreite) ein

## Ab M3

- [ ] Uhr tickt auf die Sekunde, Kalender blättert, Feiertage mit Tooltip
- [ ] Uhr mit Sonne: Koordinaten eintragen (Komma oder Punkt), Bogen mit Sonnenpunkt, Zeiten im
      Format der Uhr, Tageslänge mit Änderung; 69,65 / 18,96 zeigt im Sommer Polartag und im
      Winter Polarnacht
- [ ] Uhr mit Mond: Phase und Scheibe passen zum Himmel, Auf- und Untergang, nächster
      Voll-/Neumond; mit Sonne zusammen stehen Uhr, Sonne und Mond untereinander, beide einzeln
      abschaltbar; neben einem höheren Widget verteilen sie sich gleichmäßig über die Höhe
- [ ] Suche: Bangs, Engine-Umschalter, Link-Vorschläge, `/` fokussiert
- [ ] Link-Board: Tabs, Ansichten, Kontextmenü, DnD, `1…9`, `Alt+1…9`
- [ ] Kacheln: Icons auf einer Höhe, Namen brechen zwischen Wörtern um, „+ Link“ immer am
      Ende der Gruppe (auch ohne Edit-Modus), Kontextmenü bietet „Link hinzufügen“
- [ ] Board-Einstellungen → Kachelgröße: Regler (auch per Pfeiltasten) ändert die Kacheln sofort,
      „Standard“ setzt auf 56 px zurück, Icons bleiben auch groß scharf
- [ ] Favicons: beim zweiten Öffnen kein Flackern, im Netzwerk-Tab keine 404-Versuche mehr

## Termine und freie Tage (Schema v4)

- [ ] Bestehende Config (v3) wird übernommen, Kalender zeigt „Keine Termine“
- [ ] Tag per Klick und per Tastatur wählen (Pfeile, `Pos1`/`Ende`, `Bild auf/ab`, Umschalt für
      ein Jahr); „Heute“ springt zurück
- [ ] `Enter` auf einem Tag bzw. „+ Termin“: Termin mit und ohne Uhrzeit anlegen, bearbeiten,
      löschen, „Rückgängig“; Punkte im Raster, Liste sortiert (ohne Uhrzeit zuerst)
- [ ] „+ Frei“: einzelnen Tag und Zeitraum (auch über Monats- und Jahresgrenze) eintragen,
      bearbeiten, löschen; Zeitraum erscheint als schraffiertes Band
- [ ] Wochenende (schlicht), Feiertag (rote Schraffur nach rechts) und frei (Schraffur nach
      links) bei Tag und Nacht, mit WebGL und in der Static-Stufe unterscheidbar und lesbar, auch
      in Graustufen
- [ ] Tage mit null, einem und mehreren Einträgen anklicken: Kalender und Nachbar-Widgets in
      derselben Zeile ändern ihre Höhe nicht; die Liste scrollt zeilenweise
- [ ] Weit nach unten scrollen, Dialog öffnen und schließen: Page bleibt an ihrer Stelle
- [ ] Export enthält Termine und freie Tage, Import auf dem anderen Rechner zeigt sie
- [ ] Zwei Kalender-Widgets zeigen dieselben Einträge

## Ab M4

- [ ] Upload Bild und Video per Dateiauswahl und per Drag & Drop auf einen Slot
- [ ] Datei über 200 MB zeigt eine Warnung, nicht unterstützte Formate werden abgelehnt
- [ ] Slot pro Tageszeit überschreibt den Haupt-Hintergrund, Entfernen fällt zurück
- [ ] Fokuspunkt und „Füllen/Ganz zeigen“ wirken sofort
- [ ] Phasenzeit so stellen, dass die Phase wechselt: weiche Überblendung, Grading, Schrift
      nachts hell auf dunklem Glas
- [ ] Import einer Config mit fehlendem Medium: Slot ist markiert, Himmelsverlauf erscheint
- [ ] Static-Stufe mit hellem und dunklem Testbild lesbar
- [ ] Neuer Tab mit Video als Hintergrund: kein Aufblitzen des Verlaufs, das Standbild geht
      weich ins Video über

## Ab M5

- [ ] Leistung zeigt „WebGL-Glas, Stufe Hoch“; Panels mit Refraktion, Farbsäumen, Glanzkante und Schatten
- [ ] Himmelsverlauf bewegt sich kaum merklich (~15 fps), ohne Flimmern oder Banding
- [ ] Video-Hintergrund läuft flüssig, pausiert im Hintergrund-Tab
- [ ] Page scrollen: nur eine Scrollleiste, Glas bleibt deckungsgleich mit den Panels, das
      Mausrad wirkt auch neben den Spalten; offener Dialog sperrt das Scrollen
- [ ] Widget beim Ziehen an den oberen/unteren Fensterrand: Page scrollt mit
- [ ] Widgets ziehen: Glas folgt den Panels während der Federanimation
- [ ] Dialog öffnen: Szene dahinter wird weich und dunkler
- [ ] Qualitätsstufe „Statisch“ schaltet sofort auf CSS-Glas, zurück auf „Automatisch“ wieder auf WebGL
- [ ] `pnpm dev` mit `?debug`: Regler ändern das Glas live, Uhrzeit-Regler wechselt die Phase
- [ ] Kontrast mit hellem und dunklem Testbild prüfen (Text auf Glas lesbar)

## Ab M6

- [ ] Reduced Motion (System-Einstellung): Video steht, Himmel steht, keine Federn
- [ ] Leistung → Automatisch: nach „Neu messen“ ~2 s Messung, Stufe und ms pro Bild sichtbar
- [ ] Performance auf beiden Rechnern notieren (Privat, MacBook M4 Pro), mit Video und Bild:
      Stufe und ms pro Bild nach „Neu messen“
- [ ] Kontrast: `pnpm dev`, `?debug`, je ein helles und ein dunkles Testbild, Uhrzeit-Regler
      Mittag und Nacht, „Kontrast prüfen“ zeigt überall mindestens 4,5:1
- [ ] Kontextverlust im Debug-Panel auslösen: kurz Static, danach wieder WebGL

## Ab M7

- [ ] `pnpm version …` führt erst alle Checks aus, dann Commit `chore: Version x.y.z` und Tag `vx.y.z`
- [ ] `pnpm ext:sign` legt eine signierte `.xpi` in `web-ext-artifacts/` ab
- [ ] `.xpi` per Drag & Drop bzw. `about:addons` installieren, „Änderungen beibehalten“ bestätigen
- [ ] `about:addons` zeigt die richtige Version
- [ ] Neue Version über die alte installieren: Einstellungen, Links und Hintergründe bleiben
- [ ] Installation auf beiden Rechnern (Privat, MacBook M4 Pro)

## Höchsthöhe pro Zeile

- [ ] Griff unter einer Zeile ziehen: Zeile folgt in 2-rem-Schritten, Etikett zeigt den Wert
- [ ] Danach scrollt höherer Inhalt im Panel, weiche Kanten oben/unten, Mausrad gibt am Ende an die Page weiter
- [ ] Doppelklick bzw. `Entf` setzt auf „Automatisch“, Pfeiltasten ändern um 2 rem
- [ ] Zeile mit zwei Widgets: beide gleich hoch, nur das überlaufende scrollt; Suchvorschläge werden nicht abgeschnitten
- [ ] Widget allein verschieben: Höhe wandert mit; Entfernen + Rückgängig stellt sie wieder her
- [ ] WebGL- und Static-Stufe: Glas folgt der neuen Höhe, schmales Fenster (untereinander)

## RSS – Rechte und Abruf (R0)

Noch ohne Oberfläche; prüfbar, sobald „Feed hinzufügen“ existiert (R4).

- [ ] Installation und Update der `.xpi` fragen keine Rechte ab, `about:addons` → Berechtigungen zeigt den optionalen Zugriff
- [ ] `permissions.request` im Klick zeigt die Firefox-Abfrage für `*.domain`, Ablehnen legt nichts an
- [ ] Abruf eines Feeds mit Recht klappt ohne CORS-Fehler, ohne Recht nicht
- [ ] `http://`-Feed wird über https abgerufen (Upgrade der Standard-CSP)
- [ ] Umleitung auf eine fremde Origin ergibt den Fehler „Umleitung“ (`opaqueredirect`)
- [ ] Recht in `about:addons` entziehen: Page bemerkt es (`permissions.onRemoved`) ohne Neuladen
- [ ] Titelbilder laden als `<img>` ohne Host-Recht

## RSS – Widget (R3)

- [ ] Gemischte Liste neueste zuerst, Quelle und Zeit stimmen, lange Titel höchstens zwei Zeilen
- [ ] Klick/Mittelklick/`Enter` öffnet und markiert gelesen; `Strg/Cmd+Enter` öffnet neuen Tab
- [ ] `Tab` erreicht die Liste einmal, Pfeile/`Pos1`/`Ende` wandern, `M` schaltet gelesen um
- [ ] Kontextmenü per Rechtsklick, Kontextmenü-Taste und `Umschalt+F10`
- [ ] „Alle als gelesen“, „Gelesene ausblenden“ → „Alles gelesen“
- [ ] Titelbilder an/aus, kaputte Bilder verschwinden, schmales Panel zeigt kleinere Bilder
- [ ] Mit Höchsthöhe der Zeile scrollt nur die Liste, Kopf und Fuß bleiben stehen
- [ ] Offline-Hinweis mit Stand; Fehler-Fuß mit Gründen, „Erneut versuchen“
- [ ] Tag und Nacht: Text, Punkt und Fuß gut lesbar (WebGL und Static)
