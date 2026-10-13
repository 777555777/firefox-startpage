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
- [ ] Schmales Fenster: 3 Spalten werden direkt zu einer (mittig, max. 48 rem), 4 Spalten erst zu 2
- [ ] Sehr schmales Fenster: Widgets einer Zeile stehen untereinander
- [ ] Bestehende Config (v1) wird ohne sichtbare Änderung übernommen

## Ab M3

- [ ] Uhr tickt auf die Sekunde, Kalender blättert, Feiertage mit Tooltip
- [ ] Suche: Bangs, Engine-Umschalter, Link-Vorschläge, `/` fokussiert
- [ ] Link-Board: Tabs, Ansichten, Kontextmenü, DnD, `1…9`, `Alt+1…9`

## Ab M4

- [ ] Upload Bild und Video per Dateiauswahl und per Drag & Drop auf einen Slot
- [ ] Datei über 200 MB zeigt eine Warnung, nicht unterstützte Formate werden abgelehnt
- [ ] Slot pro Tageszeit überschreibt den Haupt-Hintergrund, Entfernen fällt zurück
- [ ] Fokuspunkt und „Füllen/Ganz zeigen“ wirken sofort
- [ ] Phasenzeit so stellen, dass die Phase wechselt: weiche Überblendung, Grading, Schrift
      nachts hell auf dunklem Glas
- [ ] Import einer Config mit fehlendem Medium: Slot ist markiert, Himmelsverlauf erscheint
- [ ] Static-Stufe mit hellem und dunklem Testbild lesbar

## Ab M5

- [ ] Leistung zeigt „WebGL-Glas, Stufe Hoch“; Panels mit Refraktion, Farbsäumen, Glanzkante und Schatten
- [ ] Himmelsverlauf bewegt sich kaum merklich (~15 fps), ohne Flimmern oder Banding
- [ ] Video-Hintergrund läuft flüssig, pausiert im Hintergrund-Tab
- [ ] Spalten scrollen: Glas bleibt deckungsgleich mit dem Inhalt und endet an der Spaltenkante
- [ ] Widgets ziehen: Glas folgt den Panels während der Federanimation
- [ ] Dialog öffnen: Szene dahinter wird weich und dunkler
- [ ] Qualitätsstufe „Statisch“ schaltet sofort auf CSS-Glas, zurück auf „Automatisch“ wieder auf WebGL
- [ ] `pnpm dev` mit `?debug`: Regler ändern das Glas live, Uhrzeit-Regler wechselt die Phase
- [ ] Kontrast mit hellem und dunklem Testbild prüfen (Text auf Glas lesbar)

## Ab M6

- [ ] Mauslicht: Glanzkante folgt dem Zeiger dezent, aus mit „Lichtreflex folgt der Maus“
- [ ] Hover hebt Panels leicht an, Drücken auf die Glasfläche drückt sie ein (nicht bei Links)
- [ ] Reduced Motion (System-Einstellung): Video steht, Himmel steht, kein Mauslicht, keine Federn
- [ ] Leistung → Automatisch: nach „Neu messen“ ~2 s Messung, Stufe und ms pro Bild sichtbar
- [ ] Performance auf beiden Rechnern notieren (Privat, MacBook M4 Pro), mit Video und Bild:
      Stufe nach „Neu messen“, ms pro Bild beim Bewegen der Maus
- [ ] Kontrast: `pnpm dev`, `?debug`, je ein helles und ein dunkles Testbild, Uhrzeit-Regler
      Mittag und Nacht, „Kontrast prüfen“ zeigt überall mindestens 4,5:1
- [ ] Kontextverlust im Debug-Panel auslösen: kurz Static, danach wieder WebGL
