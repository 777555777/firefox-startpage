# Entscheidungen

Abweichungen von bzw. Präzisierungen zu `SPEC.md`. Neueste Einträge unten.

## M0 – Gerüst

- **Mindestversion Firefox 140** (`strict_min_version: 140.0`): ESR 140 ist die älteste noch
  unterstützte ESR-Linie. Zusätzlich steht `data_collection_permissions: { required: ['none'] }` im
  Manifest, das AMO für neue Extensions verlangt. `gecko_android` ist nur gesetzt, damit
  `web-ext lint` nicht warnt. Android wird nicht unterstützt.
- **TypeScript 6** statt 7: `svelte-check` unterstützt den Go-Port noch nicht verlässlich.
- **Svelte `fragments: 'tree'`**: Svelte baut das DOM per `createElement` statt über
  `innerHTML`-Templates. Das erspart die AMO-Warnung `UNSAFE_VAR_ASSIGNMENT` und ist CSP-freundlich.
- **Schrift** liegt als woff2 (latin + latin-ext, nur aufrecht) in `src/assets/fonts` und nicht als
  npm-Paket, damit `font-display: block` gesetzt werden kann. Lizenz: `OFL.txt` daneben.
- **Komponententests** laufen mit jsdom + Testing Library statt Vitest Browser Mode. Dafür muss kein
  Browser installiert werden, und die Tests laufen in `pnpm test` mit.
- `pnpm ext:lint` baut vorher, damit es auch auf einem frischen Checkout funktioniert.
- `SPEC.md` und `AGENTS.md` sind von Prettier ausgenommen, damit die Spec nicht durch Formatierung
  verändert wird.

## M1 – Daten und Grundlagen

- **Speicher-Schlüssel:** `config`, `stats` und zusätzlich `backups` (letzte 3) in
  `storage.local`. Auf dem Dev-Server liegen sie in `localStorage` mit Präfix `startpage:`.
- **Lesefehler sperren das Speichern:** Kann die gespeicherte Config nicht gelesen werden, läuft
  die Page mit Defaults weiter, speichert in dieser Sitzung aber nichts. So werden vorhandene Daten
  nicht durch Defaults überschrieben. Ein Toast weist darauf hin.
- **Tab-Synchronisation:** Gespeichert wird immer die validierte Form. `storage.onChanged` meldet
  auch eigene Schreibvorgänge. Diese Echos werden über die zuletzt geschriebenen Stände erkannt.
  Kommt eine Änderung aus einem anderen Tab, gewinnt sie, ein ausstehender eigener Stand verfällt.
- **Backups** werden nicht nur vor dem Import angelegt, sondern auch vor „Alles zurücksetzen“ und
  vor dem Wiederherstellen eines Backups. So ist jede dieser Aktionen umkehrbar.
- **„Alles zurücksetzen“** setzt Config und Statistik zurück. Hochgeladene Medien und Backups
  bleiben erhalten.
- **Import und fehlende Medien:** Referenzen auf Medien, die auf diesem Rechner fehlen, bleiben in
  der Config. Der Import meldet sie per Toast mit Namen. Die Hintergrund-Darstellung (M4) fällt
  bei fehlender Datei auf den Shader-Verlauf zurück und markiert den Eintrag in den Einstellungen.
- **Widget-Settings** sind vom Registry-Teil mit Komponenten getrennt (`widgets/settings.ts`), damit
  Validierung und Tests ohne Svelte-Komponenten auskommen.
- **Defaults:** Die Namen der Beispiel-Link-Gruppen folgen der beim Erststart erkannten Sprache.
  Die Standard-Engines haben feste IDs. DuckDuckGo bekommt zusätzlich den Bang `ddg`.
- **Link-URLs** ohne Schema (`example.org`) werden zu `https://…` ergänzt. `javascript:`, `data:`
  und `vbscript:` werden verworfen.
- **Dev-Server:** `/` liefert direkt `newtab.html`.

## M2 – Layout und Edit-Modus

- **Widget-Settings ändern:** Widgets und ihre Einstellungs-Komponenten bekommen statt
  `onchange(s)` eine Funktion `update(mutate)`, die die gespeicherte Instanz direkt ändert. Das passt
  besser zu Svelte-5-Proxys und spart Kopien großer Link-Boards. Registry-Icons sind `IconName`s aus
  der eigenen Icon-Sammlung statt Komponenten.
- **Tastatur-DnD** läuft über den Griff-Button des Panels (im Edit-Modus fokussierbar), nicht über
  das Panel selbst. So gibt es keinen zusätzlichen Tab-Stopp. `Leertaste`/`Enter` greift und legt ab,
  Pfeile verschieben (links/rechts wechselt die gespeicherte Spalte), `Esc` bricht ab. Ein Fokus-
  wechsel nach außen legt ab. Ansagen laufen über eine `aria-live`-Region.
- **Live-Umsortierung:** Beim Ziehen wird der Zustand sofort umsortiert, die übrigen Elemente weichen
  per FLIP-Feder aus. Ein Abbruch (`Esc`) stellt die Ausgangsposition wieder her. Ablageziele wie
  Tab-Reiter werden über `sortable.target()` angebunden.
- **Responsives Zusammenlegen** fasst benachbarte gespeicherte Spalten untereinander in einer
  sichtbaren Spalte zusammen. Jede gespeicherte Spalte bleibt ein eigener Ablagebereich mit eigenem
  „+ Widget“.
- **Menüs und Popover** nutzen die Popover-API (Top-Layer), weil Glas-Panels mit `backdrop-filter`
  sonst `position: fixed` einfangen würden.
- **Einstellungen:** Die Abschnitte „Hintergrund“ (M4) und „Suche“ (M3) kommen mit ihren
  Meilensteinen dazu. Die Qualitätsstufe ist schon wählbar. Bis M5 wird immer die Static-Stufe
  gerendert, ein Hinweis im Dialog sagt das.
- **Default-Akzent** ist `#1872d6` statt eines helleren Blaus, damit weißer Text darauf AA erreicht.
  Text auf dem Akzent ist Weiß, solange es AA erreicht, sonst die kontrastreichere Variante.
- `Esc` verlässt den Edit-Modus, wenn kein Dialog offen ist und nichts gegriffen ist.

## M3 – Widgets

- **Suche ist kein Singleton.** §6.3 spricht von der „(ersten)“ Suche, die `/` fokussiert. Mehrere
  Suchen sind also erlaubt. Die Registry unterstützt `singleton` trotzdem, das „+ Widget“-Menü
  sperrt solche Typen dann.
- **Suchvorschläge** erscheinen nur ohne erkannten Bang. Mit Bang ist klar, wohin die Suche geht.
  Die letzte Option der Liste ist immer „Mit … suchen“. Ohne Suchtext öffnet ein Bang die
  Startseite der Engine (z. B. `!yt` → youtube.com).
- **Engine-Verwaltung:** Name, URL und Bang werden als Entwurf bearbeitet und erst übernommen,
  wenn sie gültig sind (URL mit `%s`, Bang eindeutig). So entstehen keine halb gültigen Engines,
  die beim Speichern verworfen würden. Eigene Engine-Icons (Data-URL) sind im Schema vorgesehen,
  in der Oberfläche aber noch nicht hochladbar. Es wird immer das Favicon genutzt.
- **Link-Board:** „+ Link“ ist immer sichtbar (dezent), nicht nur im Edit-Modus, damit Links ohne
  Umweg hinzugefügt werden können. Tabs bearbeitet man per Doppelklick oder Kontextmenü. Löschen von
  Links und Tabs geht ohne Bestätigungsdialog, dafür mit Rückgängig-Toast (wie bei Widgets). Der
  letzte Tab eines Boards kann nicht gelöscht werden.
- **Links zwischen Boards verschieben** (nice-to-have) ist noch nicht umgesetzt.
- **Kontextmenü** nutzt `popover="manual"` mit eigenem Schließen bei Klick außerhalb. Das
  automatische Light-Dismiss würde ein per Rechtsklick geöffnetes Menü beim Loslassen der Maustaste
  sofort wieder schließen.
- **Ziffern-Kürzel** werden über `KeyboardEvent.code` gelesen, damit `Alt+1…9` auch auf macOS
  funktioniert (dort liefert `key` Sonderzeichen).
- **Feiertage:** Zusätzlich zu den in der Spec genannten Sonderfällen kennt die Berechnung
  Ostersonntag/Pfingstsonntag (BB), den bundesweiten Reformationstag 2017 und den einmaligen Tag der
  Befreiung in Berlin (2020, 2025).
- **Uhr:** Ein Ticker pro Takt (Sekunde/Minute) für die ganze Page, auf die Grenze synchronisiert.
  Beim Zurückkehren in einen Hintergrund-Tab wird sofort aktualisiert.

## Nach M3 – Feedback

- **Spaltenbreiten im 12er-Raster** (Erweiterung des Schemas aus §4): `layout.columnWidths` enthält
  pro Spalte ganze Raster-Einheiten, zusammen immer 12 (z. B. `3·6·3`), mindestens 2 pro Spalte. 12
  ist durch 1–4 teilbar, gleich breite Spalten gehen also immer auf. Im Edit-Modus rasten die
  ziehbaren Trenner in ganzen Einheiten ein (auch per Pfeiltasten). Mit gedrückter Umschalttaste
  wird die Gegenseite gespiegelt (symmetrisch, z. B. `2·8·2`), ein Doppelklick setzt alle zurück.
  Beim Ziehen zeigt jede Spalte ihre Breite in Einheiten an. Ändert man die Spaltenzahl, werden die
  Breiten gleichmäßig verteilt.
- **Abstand und maximale Breite:** `layout.gap` (8–64 px im 4-px-Raster, Standard 24) gilt zwischen
  Spalten und zwischen Panels. `layout.maxWidth` (48–160 rem in 8er-Schritten) begrenzt die
  Gesamtbreite. Ganz rechts auf dem Regler steht „Voll“, dann fehlt das Feld und das Layout nutzt
  die ganze Fensterbreite. Beides sitzt als Regler in der Edit-Leiste.
- **Schema-Version bleibt 1:** Die Felder sind additiv. Fehlen sie, ergänzt die Validierung
  Standardwerte. Ältere relative Breiten (z. B. `[0.8, 1.4, 0.8]`) werden proportional auf das
  Raster gerundet (`[3, 6, 3]`).
- **Zusammenlegen mit eigenen Breiten:** Spalten werden zusammengelegt, wenn sie im Mittel unter
  20 rem fallen oder die schmalste Spalte unter 14 rem. Breitenänderungen, die das auslösen würden,
  werden beim Ziehen nicht übernommen. Sind Spalten zusammengelegt, sind die sichtbaren Spalten
  gleich breit.
- **Einstellungsdialog** hat eine feste Höhe. Nur der Inhalt des Abschnitts scrollt, damit der
  Dialog beim Wechseln der Abschnitte nicht springt.

## M4 – Hintergrund

- **Tageszeit-Übergänge** sind zentriert auf die Phasengrenzen und dauern etwa 60 Minuten
  (bei kurzen Phasen höchstens deren halbe Länge). Die Startzeiten dürfen in beliebiger
  Reihenfolge liegen, es gilt immer die Phase mit dem letzten Beginn vor der Uhrzeit.
- **Hell und dunkel statt stufenlos:** Himmel, Grading und Glas-Farbstich werden kontinuierlich
  gemischt. Die Tonalität der UI (Schrift, Flächen, Glas-Grundfarbe) wechselt dagegen diskret zur
  Mitte des Übergangs in die Nacht (`data-tone` am Root). Ein stufenloser Wechsel von dunkler zu
  heller Schrift ginge durch ein kontrastarmes Grau. Die Schriftfarbe blendet per registrierter
  Custom Property in gut einer Sekunde über. Komponenten verwenden dafür Tokens (`--field`,
  `--raised`, `--surface`, `--track`, `--highlight`, `--shade`, `--accent-text` …) statt fester Farben.
- **Static-Darstellung von Videos:** Die Static-Stufe ist laut §7.4 ohne Animation. Videos zeigen
  dort den ersten Frame. Abgespielt werden sie erst im WebGL-Layer (M5).
- **Grading in der Static-Stufe** wird mit CSS-Filtern (Sättigung, Helligkeit, Kontrast) und einer
  Farbschicht im Modus `soft-light` angenähert. Der Shader in M5 nutzt dieselben Werte.
- **Fokuspunkt** entspricht `object-position` in Prozent. Der WebGL-Layer bildet ihn mit
  derselben Formel ab, damit beide Stufen denselben Ausschnitt zeigen.
- **Große Dateien** (über 200 MB) werden nach einer Warnung trotzdem gespeichert. Nicht
  unterstützte Formate (alles außer JPG, PNG, WebP, AVIF, MP4, WebM) werden abgelehnt. Fehlt der
  MIME-Typ, entscheidet die Dateiendung.
- **Medien aufräumen:** Beim Ersetzen oder Entfernen werden Dateien gelöscht, auf die weder die
  Config noch eines der Backups verweist. So bleibt ein Backup samt Hintergrund wiederherstellbar.
- **Drag & Drop** geht auf jeden einzelnen Slot (Haupt-Hintergrund und Tageszeiten). Daneben
  abgelegte Dateien werden ignoriert, statt den Browser-Viewer zu öffnen.

## M5 – WebGL-Glas

- **Welche Flächen WebGL-Glas sind:** Nur die Widget-Panels melden sich beim Glas-Layer an.
  Dialoge, Menüs, Toasts, die Edit-Leiste und die Suchvorschläge bleiben CSS-Glas mit
  `backdrop-filter`. Sie liegen über anderen Panels, und ihr DOM-Inhalt würde sonst durch das
  Glas scheinen. Der Canvas kann nur die Szene brechen, nicht den DOM darüber (Grenze aus §7.1).
  Mit `backdrop-filter` zeichnen sie die WebGL-Szene samt Panels weich. Das Attachment kennt die
  Varianten `popover` und `button` schon, damit das später ohne Umbau geht.
- **Instanz-Attribute statt Uniform-Buffer:** Jede Fläche ist eine Instanz (Rechteck, Clip,
  Radius, Tiefe, Deckkraft, Variante; 12 Floats, höchstens 64). Gezeichnet wird ein um den
  Schatten vergrößertes Quad pro Fläche. So kostet ein Pixel nur die Flächen, die ihn berühren.
- **Clip auf den Scroll-Container:** Panels liegen in scrollenden Spalten. Glas und Schatten werden
  wie der DOM-Inhalt an der Spaltenkante abgeschnitten.
- **Blur:** Dual-Kawase mit 5 Stufen. Die mittlere Stärke kommt aus Stufe 3, die starke aus Stufe 5.
  Frost blendet von scharf über mittel bis stark. Unabhängig vom Frost hält eine adaptive
  Aufhellung bzw. Abdunklung die Helligkeit unter der Fläche in einem Bereich, in dem Text Kontrast
  hat (§7.2 Punkt 5).
- **Scrim hinter Dialogen:** Der Shader zeichnet die Szene hinter einem offenen Dialog weich und legt
  eine Abdunklung über Szene und Panels (blendet in ~260 ms ein). Das DOM-`::backdrop` dunkelt im
  WebGL-Modus nur noch leicht ab, damit auch der Panel-Text zurücktritt.
- **On-Demand-Rendering:** Rechtecke werden nach ResizeObserver, Scrollen, Fenstergröße,
  Layout-Änderung oder Schriftladen gelesen. Während Federanimationen (DnD) und 600 ms nach einer
  CSS-Transition wird in jedem Frame gelesen. Die Szene wird nur bei Änderungen, Video-Frames,
  Überblendungen oder im 15-fps-Takt des Himmelsverlaufs neu gezeichnet. Im Hintergrund-Tab steht
  alles, Videos pausieren.
- **Qualitätsstufen** Hoch, Mittel und Niedrig sind schon wirksam (DPR-Grenze, halbe Szenen-
  Auflösung, ohne Dispersion bzw. Refraktion, Video-Bildrate). „Automatisch“ startet auf Hoch.
  Das Herunterstufen nach Frame-Zeit ist Teil von M6.
- **Übergang Static → WebGL:** Bis der erste WebGL-Frame steht, bleibt die Static-Darstellung
  sichtbar, das Canvas ist so lange durchsichtig. Damit nachts beim Öffnen nichts hell aufblitzt,
  merkt sich die Page Tonalität und Himmelsfarbe in `localStorage` (`startpage:paint`) und setzt
  sie vor dem Laden der Config.
- **Beim Öffnen** blendet ein eigener Hintergrund nur kurz ein (250 ms). Die ~2 s lange
  Überblendung gilt für Phasenwechsel und neue Uploads.
- **Kontextverlust:** Der Verlust wird abgefangen, die Static-Darstellung übernimmt. Nach
  `webglcontextrestored` wird alles neu aufgebaut. Fehlt WebGL2 ganz, bleibt es bei Static, und
  die Einstellungen zeigen den Grund. Feinschliff und Tests dazu folgen in M6.
- **Debug-Panel** (`?debug`, nur Dev-Build) wird dynamisch importiert und fällt im
  Produktions-Build ganz weg. Die Reglernamen sind die Parameter-Bezeichner aus dem Code und werden
  bewusst nicht übersetzt.
- **Ziehen:** Der Drag-Klon eines Panels zeichnet sein Glas per CSS (er liegt über allem), das
  Original wird auf dem Canvas mit verringerter Deckkraft gezeichnet. Die Markierung beim
  Tastatur-Verschieben ist eine `outline`, weil Panels im WebGL-Modus keinen `box-shadow` zeichnen.

## Nach M5 – Zeilen im Layout (Schema v2)

- **Spalten → Zeilen → Widgets** (Erweiterung des Schemas aus §4/§5): Eine Spalte ist ein Stapel
  aus Zeilen, eine Zeile enthält 1 bis 3 Widgets nebeneinander. `layout.columnItems` ist durch
  `layout.columnRows` ersetzt (`{ items, spans }` pro Zeile). Eine beliebig tiefe Verschachtelung
  gibt es bewusst nicht. Ein freies Dashboard-Raster wurde verworfen, weil es feste Widget-Höhen
  bräuchte und die einzeln scrollenden Spalten aufgäbe.
- **24er-Raster statt 12er:** Spalten mindestens 4 Einheiten, Widgets in einer Zeile mindestens 3.
  Die Breiten einer Zeile sind absolute Raster-Einheiten und ergeben zusammen die Spaltenbreite.
  Ändert sich die Spaltenbreite, werden die Zeilen proportional angepasst. Während einer Geste
  (Ziehen oder Fokus auf dem Trenner) wird immer vom Ausgangszustand aus gerechnet, damit
  wiederholtes Runden die Aufteilung nicht verschiebt.
- **Getrennte Abstände:** `columnGap` (0–128 px) zwischen den Spalten und `panelGap` (4–64 px)
  zwischen Panels, untereinander wie nebeneinander. Beide sitzen als Regler in der Edit-Leiste.
- **Migration v1 → v2:** Jedes Widget wird zur eigenen Zeile, Spaltenbreiten werden auf das
  24er-Raster umgerechnet, der bisherige Abstand gilt für beide neuen Abstände. Das sichtbare
  Layout bleibt gleich.
- **Ziehen mit der Maus:** Im linken bzw. rechten Randbereich eines Panels (28 % der Breite,
  höchstens 120 px) wird daneben abgelegt, sonst als eigene Zeile darüber oder darunter. Wie
  bisher wird live umsortiert. Der Sortable hat dafür eine eigene Platzierungs-Funktion
  (`resolve`) und einen Schnappschuss für den Abbruch bekommen.
- **Tastatur:** Pfeil hoch/runter wechselt die Zeile (ein Widget aus einer geteilten Zeile wird
  dabei zur eigenen Zeile). Links/rechts tauscht innerhalb der Zeile und wechselt am Rand die
  Spalte. Umschalt + hoch/runter setzt das Widget neben die Zeile darüber bzw. darunter.
- **Responsiv:** Würde ein Widget einer Zeile schmaler als 13 rem, stehen die Widgets der Zeile
  untereinander (nur in der Darstellung). Breitenänderungen und Ablegen „daneben“, die das
  auslösen würden, werden im Edit-Modus nicht übernommen.
- **Gleich hohe Panels:** Widgets einer Zeile werden auf die Höhe des höchsten gestreckt, damit
  die Glasflächen eine gemeinsame Unterkante haben.

## Nach M5 – Zusammenlegen in gleich großen Gruppen

- **Responsives Zusammenlegen** (präzisiert §5): Spalten werden nur in gleich großen Gruppen
  zusammengelegt, also 3 → 1 und 4 → 2 → 1. Bei 3 → 2 stünden auf einer Seite zwei Spalten
  untereinander und auf der anderen eine, das ließ sich nie stimmig anordnen.
- **Eine Spalte** ist höchstens 48 rem breit und mittig. So bleiben Panels lesbar, und Zeilen mit
  mehreren Widgets passen oft wieder nebeneinander.
- **Leere Spalten** werden außerhalb des Edit-Modus nicht gerendert. Sonst rückte ihr Abstand die
  darunterliegende Spalte nach unten, wenn beide zusammengelegt sind.
- **Mausrad neben der Spalte:** Ist alles zu einer Spalte zusammengelegt, scrollt das Mausrad
  auch über der freien Fläche daneben die Spalte. Elemente, die selbst scrollen (Dialoge, Menüs,
  Listen), behalten ihr eigenes Scrollen.
- **Uhr skaliert mit dem Panel:** Die Schriftgröße der Uhrzeit folgt per Container Query der
  Panelbreite (höchstens 4,75 rem), statt der Fensterbreite. So ragt sie in schmalen Zeilen nicht heraus.

## M6 – Feinschliff

- **Kein Mauslicht, kein Hover/Press (Abweichung von §7.2 Punkt 6 und §8):** Beides war gebaut,
  hat im Alltag aber zu sehr abgelenkt. Ein Klick auf ein Panel löst außerdem keine Aktion aus,
  das Eindrücken hätte also nichts angekündigt. Die Lichtrichtung folgt nur der Tageszeit. Die
  Einstellung „Lichtreflex folgt der Maus“ und das Config-Feld `appearance.pointerLight` sind
  entfallen. Ein noch gespeichertes Feld wird beim Laden ignoriert, die Schema-Version bleibt 2.
- **Automatische Qualität:** Gemessen wird der Abstand zwischen Frames, die direkt aufeinander
  folgen sollten (Animationen, Ziehen, Überblendungen). Frames im Takt des Himmels oder nach
  Pausen zählen nicht, Abstände über 250 ms auch nicht. Entschieden wird erst, wenn Messungen
  ~1,5 s des 2-s-Fensters abdecken. Die langsamsten 10 % bleiben außen vor, damit einzelne Ruckler
  (GC, Laden) nicht herunterstufen. Beim allerersten Start (und nach „Neu messen“) wird ~2 s lang
  durchgehend gezeichnet und gemessen. Danach wird die stabile Stufe pro Rechner in
  `localStorage` gemerkt (`startpage:quality`), nicht in der Config, weil sie zum Rechner gehört
  und nicht exportiert werden soll. Hochgestuft wird nur über „Neu messen“ in den Einstellungen.
- **Kontrast:** Die adaptive Aufhellung erreicht die Grenzwerte jetzt genau (bezogen auf die
  Helligkeit der Glasfarbe, vorher nur zu 90 %). Die Mindesthelligkeit unter heller UI ist von
  0,62 auf 0,66 gestiegen, die sekundäre Textfarbe hat 78 % statt 68 % Deckkraft. So erreicht auch
  sekundärer Text auf der dunkelsten erlaubten Glasfläche AA (4,7:1). Unit-Tests prüfen das gegen
  Grau als ungünstigsten Hintergrund. Für die manuelle Prüfung mit Testbildern misst das
  Debug-Panel die gezeichneten Glasflächen jedes Panels und zeigt den schlechtesten Kontrast.
  Die Static-Stufe (CSS) kann nicht adaptiv aufhellen. Dort bleibt es bei der manuellen Prüfung.
- **Kontextverlust:** Nach drei Verlusten in einer Sitzung bleibt es bis zum Neuladen bei Static,
  statt immer wieder neu aufzubauen. Das Debug-Panel kann einen Verlust auslösen.
- **Reduced Motion:** Zusätzlich zu Video, Himmel und Federn scrollt auch `scrollIntoView` ohne
  Animation. Eine Änderung der Systemeinstellung wirkt sofort.
