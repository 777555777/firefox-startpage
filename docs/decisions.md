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
- **Link-Board:** „+ Link“ steht immer am Ende der Gruppe. Nach M6 erschien es eine Zeit lang
  nur im Edit-Modus oder in einer leeren Gruppe (in der Kachel-Ansicht erzeugte es sonst eine
  eigene, fast leere Reihe); das wurde auf Wunsch wieder zurückgenommen, weil der direkte Weg
  praktischer ist. Zusätzlich bietet das Kontextmenü eines Links oder Tabs „Link hinzufügen“. Tabs bearbeitet man per Doppelklick oder Kontextmenü. Löschen von
  Links und Tabs geht ohne Bestätigungsdialog, dafür mit Rückgängig-Toast (wie bei Widgets). Der
  letzte Tab eines Boards kann nicht gelöscht werden.
- **Kachelgröße** (Erweiterung von §6.4): Pro Board einstellbar (`tileSize`, Kantenlänge der
  Icon-Fläche) zwischen 40 und 96 px in 4er-Schritten, Standard 56 px wie bisher. 40 px ist die
  kleinste Fläche, auf der Favicons noch klar erkennbar sind; ab 96 px passen auf schmalen Panels
  kaum noch zwei Kacheln nebeneinander. Icon (64 %), Eckenradius und Spaltenbreite (Fläche +
  48 px) wachsen mit, die Schrift der Namen bleibt gleich. Pro Board statt pro Gruppe, damit
  Gruppen beim Wechseln nicht springen. Kein Schema-Sprung: `parseLinksSettings` ergänzt den
  Standard und begrenzt bzw. rastet ungültige Werte ein.
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

## Nach M6 – Glas ohne Milchschleier

- **Adaptive Tönung großflächig statt pro Pixel** (präzisiert §7.2 Punkt 5): Bisher wurde jedes
  Pixel einzeln auf die Mindesthelligkeit gehoben. Dunkle Stellen wurden dadurch flach weißgrau,
  helle Details blieben stehen. Das Glas wirkte milchig und der Hintergrund „komprimiert“, auch
  bei Frost 0. Jetzt bestimmt die stark weichgezeichnete Szene unter der Fläche, wie weit
  angepasst wird, und alle Pixel werden gleich behandelt. Details bleiben so erhalten.
- **Anheben wie eine Belichtung, Abdunkeln wie getöntes Glas:** Unter heller UI wird zuerst per
  Gamma aufgehellt (`liftLimit`), sodass Farben satt bleiben. Erst was dann noch fehlt, kommt aus
  der Glasfarbe. Unter dunkler UI wird multiplikativ abgedunkelt (`dimLimit`).
- **Grenzwerte und Textfarben:** Die Mindesthelligkeit liegt bei 0,64 (vorher 0,66), die
  Höchsthelligkeit unter dunkler UI bei 0,27 (vorher 0,22). Damit sekundärer Text trotzdem AA
  erreicht, hat er 86 % (hell) bzw. 80 % (dunkel) Deckkraft.
- **Frost entscheidet über die Lesbarkeit auf unruhigen Bildern:** Weil nicht mehr pro Pixel
  geklemmt wird, liegt der schlechteste Messpunkt bei Frost 0 auf einem sehr unruhigen Bild
  (Gras mit Tautropfen) bei etwa 3:1. Ab Frost ~0,5 erreichen alle Tageszeiten AA. Das ist der
  bewusste Tausch für klares Glas. Die Einstellung erklärt es, und die Skala heißt jetzt
  „Klar … Matt“ statt „Klar … Milchig“, weil Frost nur noch weichzeichnet und nicht aufhellt.

## Nach M6 – Mitte und Seitenspalten (Schema v3)

- **Mitte + zwei Seiten statt 1–4 Spalten** (Abweichung von §5): Gleichrangige Spalten ließen
  sich beim Zusammenlegen nie stimmig anordnen, und eine leere Spalte schob die anderen aus der
  Mitte. Jetzt gibt es immer eine Mittelspalte und links und rechts je eine Seitenspalte, die
  sich im Edit-Modus ein- und ausschalten lässt. Zeilen mit Widgets nebeneinander gibt es
  weiter in allen drei Spalten.
- **Symmetrisch:** Beide Seiten sind immer gleich breit, damit die Mitte genau in der
  Bildschirmmitte steht. Das gilt auch, wenn eine Seite leer oder ausgeschaltet ist; ihr Platz
  bleibt dann frei. Gespeichert wird nur die Breite der Mitte im 24er-Raster (`centerSpan`,
  gerade, 8–16, Standard 12). Beide Trenner ändern sie, ein Schritt sind 2 Einheiten.
- **Ohne Seiten** nimmt die Mitte die ganze Breite ein, begrenzt durch die Maximalbreite.
- **Breite Bildschirme:** Die drei Spalten bleiben ein Block, den die Maximalbreite begrenzt,
  und stehen nicht an den Bildschirmrändern.
- **Untereinander ohne Zwischenstufe:** Ist die Mitte schmaler als 20 rem oder eine Seite
  schmaler als 14 rem, steht alles in einer Spalte (mittig, max. 48 rem). Die Reihenfolge ist
  Mitte, rechts, links. In dieser Reihenfolge stehen die Spalten auch im DOM und in der Config.
  Lese- und Tab-Reihenfolge stimmen so überein, und „das erste Link-Board“ für `1…9` liegt in
  der Mitte. Pfeiltasten links/rechts beim Verschieben folgen der sichtbaren Anordnung.
- **Seite ausschalten:** Ihre Widgets wandern ans Ende der Mitte. Ein Hinweis bietet
  „Rückgängig“ an. Im Edit-Modus stehen Hinweise über der Bearbeiten-Leiste statt darauf.
- **Migration v2 → v3:** Bei drei Spalten wird die mittlere zur Mitte. Bei zwei wird die erste
  zur Mitte und die zweite zur rechten Seite. Bei vier teilen sich die beiden mittleren die
  Mitte. Eine einzelne Spalte wird zur Mitte ohne Seiten. Die Breite der Mitte folgt den alten
  Anteilen und wird gerastert.

## Nach M6 – Kein Aufblitzen des Verlaufs beim Öffnen

- **Standbild für den ersten Paint:** Mit eigenem Hintergrund legt das Glas-Canvas beim Laden
  ein kleines JPEG-Standbild an (640 px breit, Bild bzw. erster Video-Frame, mit dem aktuellen
  Grading) und merkt es in `localStorage` (`startpage:poster`, ~15–40 KB). `main.ts` setzt es
  vor dem Mounten als Hintergrund von `<html>`. Ohne eigenen Hintergrund wird es gelöscht.
- **Kein Verlauf beim Laden:** Die Static-Darstellung zeigt beim Start nichts, solange das
  Medium noch lädt, damit das Standbild stehen bleibt. Das Canvas meldet sich erst bereit,
  wenn es seine erste Quelle hat, zeigt diese ohne Überblendung und blendet dann selbst in
  250 ms ein. Die Static-Darstellung liegt darunter und verschwindet erst danach.

## Nach M6 – Favicons, Kacheln und erster Paint

- **Favicons mit Gedächtnis** (präzisiert §3 und §6): Weiter ohne Drittanbieter und ohne
  Host-Rechte, aber nicht mehr nur `/favicon.ico`. Pro Origin werden einmal
  `/apple-touch-icon.png`, `/favicon.svg` und `/favicon.ico` probiert. Genommen wird das erste
  mit mindestens 32 px, sonst das größte. Das Ergebnis (URL und Größe oder „keins“) steht in
  `localStorage` (`startpage:favicons`, 30 Tage bzw. 1 Tag für „keins“). Danach lädt jeder Tab
  nur die bekannte URL, meist aus dem HTTP-Cache, ohne Fehlversuche und ohne Flackern beim
  Tab-Wechsel. Mit eigenem Icon wird gar nicht gesucht. Kleine Favicons (16 px) werden nicht auf
  volle Größe aufgeblasen, sondern höchstens auf ihre eigene, mindestens 60 % der Fläche.
- **Grenze ohne Host-Rechte:** Icons, die eine Seite nur über das HTML ausweist (z. B. YouTube),
  oder die per `Cross-Origin-Resource-Policy` gesperrt sind, sind so nicht erreichbar. Dann gibt
  es das kleine `favicon.ico` oder den Anfangsbuchstaben.
- **Kacheln:** Icon in einer festen Fläche (56 px) oben, darunter Platz für zwei Zeilen Namen.
  So stehen alle Icons auf einer Höhe. Umbrochen wird zwischen Wörtern mit ausgeglichenen
  Zeilen, ohne Silbentrennung; nur zu lange Einzelwörter werden geteilt. Kacheln sind
  mindestens 104 px breit.
- **Erster Paint in `public/boot.js`:** Grundfarbe und Standbild setzt ein kleines, blockierendes
  Skript im `<head>` (kein Inline-Skript, CSP-konform). Als Modul lief das erst nach dem ersten
  Paint. Die Static-Darstellung legt den Himmel erst unter ein Medium, wenn dieses seinen ersten
  Frame hat, und verschwindet erst, wenn das Canvas fertig eingeblendet ist (`transitionend`).

## Nach M6 – Sonnenauf- und -untergang in der Uhr

- **Erweiterung von §6.1:** Die Uhr kann unter dem Datum Sonnenauf- und -untergang zeigen
  (Schalter „Sonnenauf- und -untergang anzeigen“, Default aus). Die Zeiten stehen im Format der
  Uhr (12/24 h wie eingestellt), immer ohne Sekunden.
- **Standortquelle: manuell pro Uhr-Widget.** Die Config hatte bisher keine Koordinaten; die
  Tageszeit-Phasen arbeiten mit festen Startzeiten, nicht mit dem Sonnenstand. Breiten- und
  Längengrad werden deshalb in den Einstellungen des Uhr-Widgets in Dezimalgrad eingetragen
  (`latitude`/`longitude`, `null` = leer). Keine Geolocation-Permission, kein Netzwerk, keine
  API und keine Ortssuche: Geolocation bräuchte eine zusätzliche Berechtigung und fragt im
  Hintergrund einen Netzwerkdienst ab, eine Ortssuche bräuchte Host-Rechte oder eine
  mitgelieferte Ortsdatenbank. Pro Widget statt global, weil Widgets mehrfach platziert werden
  dürfen und die Werte so mit den übrigen Uhr-Einstellungen exportiert und validiert werden.
  Sollten die Tageszeit-Phasen später dem Sonnenstand folgen, wandern die Koordinaten in
  `appearance` und die Uhr liest sie dort.
- **Kein Schema-Sprung:** Die neuen Felder ergänzt `parseClockSettings` mit Defaults; ungültige
  oder außerhalb von ±90°/±180° liegende Werte werden zu `null`. Eingaben dürfen Komma oder
  Punkt nutzen, ungültige bleiben mit Hinweis im Feld stehen und werden nicht gespeichert.
- **Berechnung:** NOAA-Algorithmus (nach Meeus) als reine Funktion in `widgets/clock/sun.ts`,
  Sonnenmittag und Ereignisse je zweimal verfeinert, Zenit 90,833° (Refraktion und
  Sonnenradius). Gerechnet wird für den lokalen Kalendertag des Rechners am angegebenen Ort; die
  Zeiten erscheinen in der Zeitzone des Rechners. Neu gerechnet wird nur beim Tageswechsel.
- **Polartag und Polarnacht:** Liegt der Stundenwinkel zum Sonnenmittag außerhalb von [−1, 1],
  zeigt die Uhr statt der Zeiten „Polartag“ bzw. „Polarnacht“ mit kurzem Hinweis. Am Rand der
  Polarzeit wird die Verfeinerung begrenzt, damit nie `NaN` entsteht.

## Nach M6 – Die ganze Page scrollt

- **Page statt Spalten** (weicht von §5 „Die Page selbst scrollt möglichst nicht“ und §7
  „Spalten-Scroll“ ab): Einzeln scrollende Spalten fühlten sich mit Mitte und Seitenspalten
  zerstückelt an (mehrere Scrollleisten, Mausrad wirkt nur über der jeweiligen Spalte). Jetzt
  scrollt das Dokument, die Spalten wachsen mit ihrem Inhalt. Damit entfallen das Mausrad-Umleiten
  neben einer einzelnen Spalte und der Clip des Glases auf die Spaltenkante (Einträge oben unter
  „Clip auf den Scroll-Container“ und „Mausrad neben der Spalte“ sind damit überholt).
- **Glas-Synchronisation:** Bleibt ereignisgetrieben. Der Layer hört ohnehin per Capture auf jedes
  `scroll`, also auch auf das der Page. Glas-Canvas und Static-Hintergrund stehen fest
  (`position: fixed`), das Standbild aus `boot.js` per `background-attachment: fixed`.
- **Dialoge:** Solange ein Dialog offen ist, steht die Page still (`html:has(dialog[open])`).
- **Drag & Drop:** Ohne eigenen Scroll-Container scrollt beim Ziehen an den Fensterrand die Page.
- **Dialoge springen nicht mehr an den Seitenanfang:** `.glass` setzt `position: relative` und
  überschrieb damit beim Dialog das `position: fixed` des Browsers. Ein modaler Dialog lag so
  absolut am Dokumentanfang, und der Fokus scrollte die Page dorthin; nach dem Schließen blieb
  sie oben. Der Dialog setzt `position: fixed` jetzt selbst (Menüs taten das schon).

## M7 – Auslieferung

- **Versionierung:** SemVer, nur Zahlen (Firefox lehnt Vorabversionen wie `1.1.0-beta.1` ab; der
  Build bricht dann mit klarer Meldung ab). Die erste ausgelieferte Version ist `1.0.0`.
  Erhöht wird mit `pnpm version patch|minor|major`, das in pnpm 10 an `npm version` geht: Es
  führt vorher per `preversion` alle vier Checks aus und erzeugt Commit `chore: Version x.y.z`
  und Tag `vx.y.z` (eingestellt in `.npmrc`). Signiert wird bewusst nicht automatisch danach,
  weil dafür die API-Keys nötig sind und AMO jede Version nur einmal annimmt.
- **Updates:** Ohne eigenen Update-Server (`update_url`) gibt es bei „unlisted“ keine
  automatischen Updates. Eine neue `.xpi` wird über die alte installiert, die Daten bleiben über
  die gleiche Gecko-ID erhalten. Ein Update-Server lohnt sich für zwei Rechner nicht.
- **README** auf Deutsch, wie Spec und Entscheidungen: Installation, Update, Datensicherung,
  Entwicklung und Release-Ablauf.

## Nach v1 – Termine und freie Tage im Kalender

- **Ausbau über v1 hinaus:** §1 und §11 führen „Termine“ als Nicht-v1. Gebaut ist davon nur der
  manuelle Teil, und zwar direkt im Kalender-Widget statt als eigenes Widget `upcoming`: Termine
  (Titel, Tag, optionale Uhrzeit) und freie Tage (einzelner Tag oder Zeitraum mit Bezeichnung,
  z. B. „Urlaub“). Eine ICS-URL mit Host-Rechten zur Laufzeit gibt es weiterhin nicht.
- **Daten global in der Config (Schema v4):** `config.agenda = { events, offDays }` statt in den
  Settings einer Kalender-Instanz. So zeigen mehrere Kalender dieselben Termine, ein späteres
  Widget „Anstehende Termine“ kann sie mitlesen, und Export/Import/Backups nehmen sie ohne
  Sonderweg mit. Die Migration v3 → v4 ergänzt eine leere `agenda`; ein schon vorhandenes Feld
  (z. B. aus einem Import) bleibt erhalten und wird wie immer beim Laden validiert.
- **Format:** Tage als `YYYY-MM-DD` in lokaler Zeit, Uhrzeit als `HH:MM` oder `null`. Ohne
  Zeitzone, weil beide Rechner in derselben stehen und ein Termin „am 21.“ auch nach einem
  Umzug der Daten am 21. bleiben soll. Termine ohne Uhrzeit stehen vor denen mit. Validierung
  verwirft Termine ohne Titel oder mit unmöglichem Datum (31.4.), dreht vertauschte Zeiträume
  um und kürzt Zeiträume auf höchstens 366 Tage. Obergrenzen: 5000 Termine, 1000 Zeiträume.
- **Tagesarten ohne Farbe unterscheidbar:** Wochenende bleibt eine schlichte Fläche. Feiertag
  und frei sind beide schraffiert, damit „arbeitsfrei“ einheitlich aussieht: frei in Petrol mit
  Streifen nach links unten, Feiertag in Rot mit Streifen nach rechts unten und fetter Zahl (der
  rote Punkt entfällt). Ohne Farbe trennt sie die Streifenrichtung. Aufeinanderfolgende freie
  Tage einer Woche bilden ein Band (innen eckig, nur die Enden rund). Bei Überschneidungen gilt
  Feiertag vor frei vor Wochenende. Termine sind bis zu drei Punkte im Zahlenkreis. Frei ist
  Petrol statt Grün, damit es sich auch bei Rot-Grün-Schwäche vom Feiertags-Rot abhebt. Die
  Legende unter dem Raster zeigt immer alle Muster (Feiertag nur, wenn eingeschaltet), damit ihre
  Breite beim Blättern gleich bleibt.
- **Kontrast:** Die Farben stehen als Tokens (`--holiday*`, `--off*`) in `app.css` und gespiegelt
  in `DAY_COLORS` (contrast.ts). Ein Unit-Test prüft Schrift auf jeder Fläche gegen das dunkelste
  bzw. hellste erlaubte Glas der WebGL-Stufen (AA 4,5:1). Dafür ist das Feiertags-Rot im hellen
  Ton dunkler geworden (`#8f0d24` statt `#b4182f`) und im dunklen heller (`#ffc4cd`), die Flächen
  sind im hellen Ton aufgehellt und im dunklen nur leicht getönt. Die Static-Stufe ist manuell bei Tag und Nacht geprüft.
- **Auswahl und Tagesansicht mit fester Höhe:** Ein Klick wählt einen Tag. Rechts in der Zeile
  der Legende stehen der gewählte Tag (Kurzform in fester Breite, „Heute“ als Akzent-Pille, das
  volle Datum für Screenreader) und „+ Termin“/„+ Frei“. Darunter folgt eine Liste von genau
  einer Zeile Höhe: erst Termine, dann freie Zeiträume, zuletzt der Feiertag (die beiden sieht
  man ohnehin im Raster), je mit Bearbeiten/Löschen. Mehr Einträge scrollen zeilenweise
  einrastend, weiche Kanten zeigen, dass es weitergeht. So bleibt die Höhe des Kalenders beim
  Wechsel des Tags gleich, und Nachbar-Widgets in derselben Zeile springen nicht. Lange Titel
  werden abgeschnitten, der volle Titel steht im Tooltip. Ohne Auswahl folgt die Ansicht dem
  heutigen Tag (auch über Mitternacht). Gewählt = Ring, heute = gefüllter Kreis. Ein Doppelklick legt einen Termin an. Löschen hat wie bei Links einen
  Rückgängig-Toast statt einer Bestätigung.
- **Tastatur:** Das Raster ist ein `grid` mit Roving Tabindex. Pfeile bewegen um Tag/Woche,
  `Pos1`/`Ende` an Wochenanfang/-ende, `Bild auf/ab` um einen Monat, mit Umschalt um ein Jahr.
  Verlässt die Auswahl den Monat, blättert der Kalender mit. `Enter` legt einen Termin am Tag an,
  `Leertaste` wählt nur. Der Hinweis dazu hängt per `aria-describedby` am Raster. Die Dialoge
  setzen den Fokus ins erste Feld.
- **Eingabe:** Datum und Uhrzeit über die nativen Felder (`type="date"`/`"time"`), damit
  Darstellung und Bedienung der Sprache des Browsers folgen. Unvollständige Eingaben
  (`validity.badInput`) werden als Fehler gemeldet statt still als „keine Uhrzeit“ gespeichert.

## Nach v1 – Sonne und Mond in der Uhr

- **Ausbau von „Sonnenauf- und -untergang“:** Statt zweier Zeiten zeigt die Uhr einen
  Sonnenbogen: Horizont, Bogen vom Aufgang (links) zum Untergang (rechts), die Sonne als Punkt
  an der Stelle, die dem vergangenen Anteil des Tags entspricht (zeitlich, nicht nach
  Sonnenhöhe), der zurückgelegte Teil farbig. Kurze Striche auf dem Horizont zeigen die
  bürgerliche Dämmerung (Sonne 6° unter dem Horizont) im selben Zeitmaßstab. Darunter Auf- und
  Untergang an den Enden (ohne Icons, die Grafik erklärt sie; Name im Tooltip und für
  Screenreader) und mittig die Tageslänge mit Änderung gegenüber gestern („−4“, voll im
  Tooltip und für Screenreader). Polartag und Polarnacht zeigen weiter den Text statt des Bogens.
- **Mond (neu, Schalter „Mond anzeigen“, Default aus):** Mondscheibe mit der richtigen
  Schattengrenze (auf der Südhalbkugel gespiegelt), Name der Phase, beleuchteter Anteil,
  Mondauf- und -untergang des Tags und der nächste Voll- oder Neumond. Fällt ein Auf- oder
  Untergang aus (etwa einmal im Monat), steht der vom nächsten Tag mit „morgen“ bzw. der Aufgang
  vom Vortag mit „gestern“ da, Erklärung im Tooltip. Eine erste Fassung zeigte „–“, das wirkte
  wie eine fehlende Zeit. So bleibt die Spanne sichtbar, in der der Mond heute am Himmel steht;
  „–“ bleibt nur, wenn auch der Nachbartag kein Ereignis hat. Bleibt der Mond den
  ganzen Tag über bzw. unter dem Horizont (hohe Breiten, z. B. Tromsø zur großen Mondwende),
  steht das als Text da.
- **Sonne und Mond als eigene Abschnitte:** Uhr, Sonne und Mond stehen untereinander, Sonne und
  Mond jeweils mit eigenem Schalter. Eine erste Fassung zeigte beide an derselben Stelle
  (tagsüber Sonne, nachts Mond, Umschalter oben rechts); untereinander ist alles auf einen
  Blick sichtbar, und ohne Umschalten bleibt die Höhe des Panels ohnehin gleich. Streckt ein
  höherer Nachbar in derselben Zeile das Panel, füllt die Uhr die Höhe: Zeit und Datum oben, der
  Mond unten, die Sonne mit gleichem Abstand dazwischen. Dafür wächst der Inhaltsbereich jedes
  Panels mit (Flex-Spalte); andere Widgets bleiben oben stehen und strecken sich nicht. Bei Mondauf- und
  -untergang bleiben kleine Pfeile, weil es dort keine Grafik gibt, die die Zeiten erklärt. Das
  Band ist höchstens 22 rem breit, weil der Bogen ein festes Seitenverhältnis hat und die Zeiten
  an seinen Enden stehen.
- **Berechnung, offline:** Mondposition aus den größten Gliedern der Mondtheorie nach Meeus
  (Kap. 47), Sonnenlänge auf das Äquinoktium des Datums bezogen (ein festes Perihel ergab 2025
  schon 45 Minuten Fehler). Voll- und Neumond treffen die veröffentlichten Zeitpunkte
  (Finsternisse 2024–2026) auf unter 5 Minuten. Mondauf- und -untergang: Höhe des oberen Rands
  mit Refraktion und Parallaxe, Suche in 20-Minuten-Schritten über den lokalen Kalendertag und
  Eingrenzung auf eine halbe Minute. Getestet über Eigenschaften (Vollmond geht mit der Sonne
  unter auf, Neumond mit ihr auf, im Mittel rund 50 Minuten Verspätung pro Tag, ein Ausfall pro
  Monat, zirkumpolare Tage in Tromsø), weil keine verlässliche Referenztabelle mitgeliefert wird.
- **Zeitzone:** Gerechnet wird für den lokalen Kalendertag des Rechners. Liegt dessen Zeitzone
  weit vom eingetragenen Ort entfernt, sucht `sunDay` den Sonnentag, zu dem „jetzt“ gehört,
  damit Tag und Nacht trotzdem stimmen. Die Tests laufen in mehreren Zeitzonen grün.
- **Kein Schema-Sprung:** `showMoon` ergänzt `parseClockSettings` mit Default. Die
  Koordinatenfelder erscheinen, sobald Sonne oder Mond an ist.

## Nach v1 – Höchsthöhe pro Zeile

- **Erweiterung von §5:** Jede Zeile kann eine Höchsthöhe haben (`LayoutRow.maxHeight` in rem,
  12–80 in 2er-Schritten, fehlt = „Automatisch“). Die Zeile ist so hoch wie ihr höchster Inhalt,
  aber nicht höher. Darüber scrollt der Inhalt **im Panel**; Kopf und Edit-Leiste des Panels
  bleiben stehen. So verlängern Widgets mit viel Inhalt (später RSS) die Page nicht. Eine feste
  Höhe (auch bei wenig Inhalt) wurde verworfen, weil sie leere Glasfläche erzeugt.
- **Pro Zeile statt pro Widget:** Widgets einer Zeile sind gleich hoch; eine Grenze pro Widget
  würde ein höherer Nachbar wieder aushebeln. Technisch bekommt jedes Panel der Zeile die Grenze
  als `max-height`. Stehen die Widgets auf schmalen Fenstern untereinander, gilt sie so für
  jedes einzeln.
- **rem statt Anteil der Fensterhöhe**, wie bei der maximalen Breite: auf beiden Rechnern gleich
  groß, unabhängig von der Fenstergröße.
- **Gescrollt wird nur bei Überlauf:** Der Inhaltsbereich wird erst zum Scroll-Container, wenn
  sein Inhalt wirklich höher ist (`ScrollArea` misst per `ResizeObserver` auf Bereich und direkte
  Kinder). Sonst würde er Aufklappendes wie die Suchvorschläge abschneiden. Weiche Kanten oben
  und unten zeigen, dass es weitergeht; 4 px Innenabstand halten Fokusringe sichtbar. Das Mausrad
  gibt am Ende an die Page weiter.
- **`scrollsSelf`** (neues optionales Registry-Feld): Widgets, die selbst nur einen Teil scrollen
  wollen (z. B. eine Liste unter festem Kopf), bekommen die verfügbare Höhe statt eines
  scrollenden Panels. Bisher nutzt es kein Widget, das RSS-Widget wird es tun.
- **Bedienung:** Im Edit-Modus liegt unter jeder Zeile im Abstand ein waagerechter Griff (nimmt
  keinen Platz ein). Ziehen rastet in 2 rem ein und zeigt die Zeile dabei genau so hoch wie
  gezogen, ein Etikett zeigt den Wert. Über 80 rem hinaus gezogen heißt „Automatisch“, ebenso ein
  Doppelklick. Tastatur: `↑` niedriger, `↓` höher (von „Automatisch“ aus ab der gezeigten
  Höhe), `Pos1` = 12 rem, `Ende`/`Entf`/`Rücktaste` = „Automatisch“. Der Griff ist ein
  `separator` mit `aria-valuetext`; eine zusätzliche Ansage gibt es wie bei den
  Breiten-Trennern nicht.
- **Verschieben:** Eine Zeile behält ihre Höhe, wenn Widgets dazukommen oder gehen. Steht ein
  Widget allein in seiner Zeile und wird als eigene Zeile verschoben, nimmt es die Höhe mit; löst
  es sich aus einer geteilten Zeile, startet die neue Zeile mit „Automatisch“. „Rückgängig“ nach
  dem Entfernen stellt die Höhe wieder her.
- **Kein Schema-Sprung:** Das Feld ist additiv. Die Validierung rastet ein, begrenzt und
  verwirft Ungültiges; beim Teilen zu voller Zeilen behalten beide Teile die Höhe.
  `CONFIG_VERSION` bleibt 4.

## Nach v1 – RSS-Widget: Überblick

Umsetzung von SPEC.md §11 in Version 1.1.0. Der Plan dazu wurde mit der nutzenden Person
abgestimmt und ist in den folgenden Abschnitten aufgegangen. Die Wahl in Kürze:

| Frage          | Wahl                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| Host-Rechte    | pro Feed-Origin, optional und erst zur Laufzeit beim Hinzufügen                  |
| Aktualisierung | nur aus der offenen Newtab-Page, kein Hintergrundskript                          |
| Darstellung    | Kategorien als Tabs, darin eine gemischte, chronologische Liste; kein „Alle“-Tab |
| Gelesen        | Punkt und fette Schrift für ungelesen, „Alle als gelesen“, optional ausblenden   |
| Titelbilder    | klein rechts in der Zeile, pro Widget einschaltbar, Standard aus                 |
| Höhe           | über die Höchsthöhe der Zeile (siehe oben), darin scrollt nur die Liste          |

- **Ohne Background-Script:** Die Newtab-Page ist eine Extension-Page. Mit Host-Recht gilt für
  `fetch` dorthin kein CORS; Hintergrundskript, Message-Schicht oder `alarms` braucht es nicht.
  Hintergrund-Tabs rufen nichts ab.
- **Registry-Feld `permissions` bleibt ungenutzt:** Es beschreibt feste Rechte beim Hinzufügen
  eines Widgets; die Origins von RSS ergeben sich erst aus den Feeds. Ein RSS-Widget lässt sich
  ohne Abfrage hinzufügen, die Abfrage kommt mit dem ersten Feed.
- **Kein Schema-Sprung:** Der neue Widget-Typ ist additiv, `CONFIG_VERSION` bleibt 4. Folge: Eine
  ältere Version der Extension verwirft RSS-Widgets beim Import, weil ihre Validierung den Typ
  nicht kennt. Vertretbar, weil beide Rechner dieselbe Version bekommen.
- **Default-Config ohne RSS-Widget,** weil es ohne Rechte-Abfrage nichts zeigen könnte.
- **Export, Import und Backups:** Feed-Adressen, Namen und Kategorien stehen in den Settings und
  reisen mit, Cache und Gelesen-Status nicht. Nach einem Import auf einem anderen Rechner zeigt
  das Widget „Zugriff erlauben“; ein Klick fragt alle fehlenden Origins auf einmal an.
- **Sicherheit:** Feed-Inhalte gehen nie per `innerHTML` oder `{@html}` ins DOM (ein Test prüft
  die Komponenten darauf). Das hält auch die AMO-Warnung `UNSAFE_VAR_ASSIGNMENT` fern.

## Nach v1 – RSS-Widget: Rechte und Abruf

- **Manifest:** `optional_host_permissions: ['https://*/*']`, sonst unverändert. Weder Installation
  noch Update fragen damit etwas ab. Nur https, weil die Standard-CSP von MV3 für Extension-Pages
  `upgrade-insecure-requests` enthält und http-Abrufe ohnehin auf https hebt; eingegebene
  `http://`-Adressen werden umgeschrieben.
- **`data_collection_permissions` bleibt `none`.** Mozillas Richtlinie definiert Übertragung breit
  („outside of the add-on or the local browser“), die Datenkategorien beschreiben aber persönliche
  Daten (Browserverlauf, Seiteninhalte, Standort …). Ein Feed-Abruf überträgt keine davon: Er geht
  an eine Adresse, die die Person selbst eingetragen hat, ohne Cookies (`credentials: 'omit'`) und
  ohne Referrer, und nichts geht an Entwickler oder Dritte. Fordert AMO bei der Signierung etwas
  anderes, wird das hier nachgetragen.
- **Ort im Code:** Die Netzwerk-Teile liegen gesammelt in `src/lib/net/` (`permissions.ts`,
  `feed-url.ts`, `fetch-feed.ts`, `charset.ts`).
- **Rechte-Muster pro Domain samt Subdomains** (`https://*.heise.de/*`, führendes `www.` entfällt);
  IP-Adressen und Namen ohne Punkt (z. B. `localhost`) bekommen das genaue Muster.
  Eine Public-Suffix-Liste braucht es dafür nicht. `requestAccess` ruft die API synchron auf,
  vor jedem `await`, damit die Nutzeraktion in Firefox noch gilt. Außerhalb der Extension gilt
  alles als erlaubt. Nicht mehr gebrauchte Rechte werden erst beim nächsten Laden der Page
  abgegeben, damit „Rückgängig“ nach dem Entfernen ohne neue Abfrage auskommt.
- **Abruf:** Zeitlimit 20 s, höchstens 5 MB (auch ohne `Content-Length`, beim Lesen gezählt),
  bedingte Anfragen über `ETag`/`Last-Modified`, `Retry-After` als Sekunden oder Datum. Der
  Zeichensatz kommt aus BOM, `Content-Type` oder der Angabe im Dokument, weil `Response.text()`
  immer UTF-8 annimmt. Ein Netzwerkfehler wird einmal ohne Folgen der Umleitung wiederholt; eine
  `opaqueredirect`-Antwort heißt dann „Umleitung auf eine Origin ohne Recht“.
- **Dev-Server:** Vite leitet `/__dev/feed?url=…` (nur https) weiter und meldet die endgültige
  Adresse im Header `x-feed-url`. Im Build gibt es die Weiterleitung nicht.
- **Geprüft in Firefox:** Die nutzende Person hat das Widget mit echten Feeds in Firefox
  verwendet (Abfrage im Klick, Abruf ohne CORS) und keine Abweichung gemeldet. Die Randfälle
  (Upgrade von http, `opaqueredirect`, Entziehen in `about:addons`) wurden nicht gezielt
  nachgestellt; sie stehen in `docs/checklist.md`.

## Nach v1 – RSS-Widget: Parser

- **Ein Einstieg für alle Formate:** `parseFeed(body, feedUrl)` in `widgets/rss/parse.ts` erkennt
  RSS 2.0, RSS 1.0 (RDF), Atom 1.0 (auch 0.3) und JSON Feed 1.x und liefert `feed`, `html`
  (Webseite, dann hilft die Feed-Suche) oder `invalid`. Namensräume werden geprüft, damit z. B.
  `atom:link` im RSS-Kanal nicht als Link der Seite gilt und `media:content` nicht als
  Atom-`content`.
- **Nur Text im Ergebnis:** Titel, Zusammenfassung und Feed-Titel sind schon beim Parsen reiner
  Text (`text.ts`). HTML wird in einem inerten Dokument gelesen (`DOMParser`, keine Skripte, kein
  Laden), Skripte, Styles und eingebettete Objekte fallen weg, nach Blockelementen steht ein
  Leerzeichen. RSS-Titel werden nur als HTML gelesen, wenn sie Tags oder Entities enthalten,
  damit „a < b“ erhalten bleibt. Atom-Textkonstrukte folgen ihrem `type`.
- **Grenzen:** höchstens 50 Einträge pro Feed, Titel 300, Zusammenfassung 280, Feed-Titel 200
  Zeichen (an Wortgrenzen mit „…“, ohne Emoji zu zerteilen). Doppelte IDs werden verworfen,
  Einträge ganz ohne Titel, Link und Text auch.
- **IDs:** guid bzw. Atom-`id`, JSON-`id`, `rdf:about`; sonst der Link, sonst ein Hash aus Titel,
  Datum und Text. Eine guid gilt nur als Link, wenn sie eine absolute http(s)-Adresse ist.
- **Adressen:** relativ zur endgültigen Feed-Adresse und allen `xml:base` darüber aufgelöst,
  nur http(s). Bilder werden auf https gehoben.
- **Daten:** RFC 822 mit eigenem Parser, weil Feeds Zeitzonen-Namen wie `CEST`/`MESZ`, deutsche
  Monatsnamen und zweistellige Jahre nutzen, die `Date.parse` nicht kennt; unbekannte Zonen
  gelten als UTC. ISO 8601 über `Date.parse`.
- **Titelbilder** (`image.ts`) werden immer ermittelt, damit das Einschalten ohne neuen Abruf
  wirkt. Reihenfolge: `media:thumbnail`, `media:content` mit Bildtyp (auch in `media:group`),
  Bild-`enclosure`, `itunes:image`, JSON `image`/`banner_image`, sonst das erste `<img>` im
  Inhalt (nur aus dem inerten Dokument gelesen; Bilder mit Breite oder Höhe ≤ 2 gelten als
  Tracking-Pixel). Bei mehreren Größen gewinnt die kleinste mit mindestens 144 px Breite (72 px
  bei doppelter Pixeldichte), ohne Größenangaben die erste. Nur http(s), `http` wird zu `https`.
- **Sprache:** Gibt der Feed eine Sprache an, bekommt jede Zeile ein `lang`-Attribut.
- **Feed-Suche** (`discover.ts`): `<link rel="alternate">` mit RSS-, Atom- oder JSON-Feed-Typ,
  relativ zu `<base href>`. Gewöhnliches `application/json` zählt nur mit „feed“ im Titel, sonst
  kämen z. B. WordPress-API-Links mit. Manche große Seiten (heise.de, golem.de) weisen ihre Feeds
  gar nicht aus; dort muss man die Feed-Adresse direkt eintragen.
- **Tests** laufen mit `// @vitest-environment jsdom`, weil Node keinen `DOMParser` hat. Die
  Fixtures werden per `?raw` importiert. Gegengeprüft auf dem Dev-Server mit echten Feeds (heise,
  tagesschau, golem, The Verge, Daring Fireball als JSON Feed, hnrss).

## Nach v1 – RSS-Widget: Settings, Cache und Abruf

- **Neuer Widget-Typ `rss`** (Schema bleibt v4, siehe Überblick). `parseRssSettings` wirft nie;
  Feeds werden beim Validieren normalisiert (`http` → `https`, andere Schemata und doppelte
  Adressen fallen weg), höchstens 20 pro Kategorie, `maxItems` 5–50 (Standard 20, mehr als
  sichtbar, weil die Liste scrollt), das Intervall rastet auf 15/30/60/180/360 Minuten ein
  (Standard 30). Steht ein Feed in mehreren Widgets, gilt das kürzeste Intervall. Das Widget
  setzt `scrollsSelf`: Mit Höchsthöhe der Zeile bleibt der Kopf stehen und nur die Liste scrollt.
- **Cache und Gelesen-Status** liegen unter `feeds` und `feedReads` in `storage.local`, laufen
  wie Config und Statistik über `SyncedValue` (Tab-Sync, validiert beim Lesen) und reisen nicht
  in Export und Backups. Ein unlesbarer Cache zeigt keinen Hinweis, er füllt sich beim nächsten
  Abruf neu. „Alles zurücksetzen“ leert beide. Im Cache stehen pro Feed höchstens 50 Einträge mit
  `firstSeen` (erster Abruf, in dem sie auftauchten) als Ersatz für ein fehlendes Datum.
- **Abruf-Dienst** (`app.rss`, `FeedService`): ein Timer für alle Feeds, gestellt auf den nächsten
  fälligen. Abgerufen wird nur bei sichtbarer Page, beim Zurückkehren in den Tab, wenn die
  Verbindung wiederkommt und wenn sich die Feeds ändern; höchstens vier gleichzeitig. Die
  Tab-Sperre (`lockUntil`, 60 s) wird vor dem Abruf sofort gespeichert. Offline ist kein Fehler
  des Feeds und löst keinen Backoff aus. Eine Webseite oder Unlesbares statt eines Feeds ergibt
  den Fehler `parse`. Nach Fehlern gilt ein Backoff (doppeltes Intervall, höchstens 24 h),
  `Retry-After` bei `429`/`503` wird beachtet, die letzten gültigen Einträge bleiben stehen.
  „Aktualisieren“ übergeht Intervall und Backoff, aber weder `Retry-After` noch die Sperre eines
  anderen Tabs.
- **Rechte im Dienst:** Fehlende Host-Rechte (`missing`) werden beim Start, bei geänderten Feeds
  und bei `permissions.onAdded/onRemoved` geprüft; solche Feeds werden nicht abgerufen. Nicht
  mehr gebrauchte Rechte gibt der Dienst nur beim Laden der Page ab. Cache und Gelesen-Status
  werden beim Laden und bei geänderten Feeds aufgeräumt. War die Config nicht lesbar, wird nichts
  aufgeräumt und nichts abgegeben.
- **Gelesen** gilt pro Feed-URL und Eintrags-ID. IDs von Einträgen, die aus dem Feed
  verschwunden sind, fallen nach dem nächsten Abruf weg.

## Nach v1 – RSS-Widget: Oberfläche

- **Zeile:** Favicon der Website (über `LinkIcon`, also mit Gedächtnis und Anfangsbuchstabe als
  Ersatz), Titel in höchstens zwei Zeilen, optional zwei Zeilen Zusammenfassung, darunter Quelle ·
  relative Zeit (volles Datum im Tooltip). Hat ein Eintrag keinen Titel, dient der Anfang der
  Zusammenfassung als Titel. Ungelesen: Akzentpunkt, Gewicht 600, Textfarbe; gelesen: normales
  Gewicht, sekundäre Farbe. Für Screenreader steht „Ungelesen:“ vor dem Titel. Quelle und Zeit
  nutzen die sekundäre statt der tertiären Textfarbe, damit auch sie AA erreichen.
- **Kopf:** Tab-Leiste (siehe Kategorien), „Alle als gelesen markieren“ und „Aktualisieren“. Der Stand
  („Aktualisiert vor 5 Min.“) steht im Tooltip und als Beschreibung des Buttons, nicht sichtbar
  im Kopf, damit das Widget ruhig bleibt. Beim Abruf dreht sich das Icon, bei Reduced Motion
  pulsiert es nur.
- **Fuß nur bei Bedarf:** offline mit Stand, bei Problemen „n Feeds haben ein Problem“. Die
  Einzelheiten (Quelle und Grund) stehen in einem aufklappbaren `<details>` statt eines Popovers:
  nativ per Tastatur bedienbar und ohne zusätzlichen Klick, um es zu schließen.
  „Zugriff erlauben“ und „Erneut versuchen“ stehen direkt sichtbar daneben; „Zugriff erlauben“
  fragt alle fehlenden Rechte des Widgets in einer einzigen Anfrage direkt im Klick an.
- **Leere Zustände:** ohne Feeds „Noch keine Feeds“ mit „Feed hinzufügen“, das die
  Widget-Einstellungen öffnet. Dafür bekommen Widgets neu die optionale Eigenschaft
  `opensettings` (nur, wenn es Einstellungen gibt). Sind alle Einträge gelesen und
  ausgeblendet: „Alles gelesen“.
- **Gelesen** wird beim Öffnen (Klick, Mittelklick, `Enter`, Kontextmenü) sofort gespeichert,
  nicht verzögert, weil die Page beim Öffnen im selben Tab gleich verlassen wird.
- **Tastatur:** Die Liste hat einen Tab-Stopp (Roving Tabindex über den Schlüssel des Eintrags,
  damit der Fokus beim Neusortieren nach einem Abruf beim selben Eintrag bleibt). Pfeile,
  `Pos1`/`Ende`, `Enter` (nativ), `Strg/Cmd+Enter` (neuer Tab), `M` (gelesen umschalten). Das
  Kontextmenü (Öffnen, In neuem Tab, Gelesen/Ungelesen, Link kopieren) hängt am nativen
  `contextmenu`-Ereignis, kommt also auch über die Kontextmenü-Taste und `Umschalt+F10`. Im
  Vorschau-Browser des Dev-Servers löste `Umschalt+F10` kein Ereignis aus; in Firefox ist es
  noch zu prüfen. Nach „Aktualisieren“ sagt der Announcer das Ergebnis an.
- **Titelbilder:** Bilder, die nicht laden oder schmaler als 40 px sind, merkt sich die Sitzung
  und zeigt sie nicht erneut. 72 × 48 px, in Panels unter 18 rem 56 × 40 px (Container Query).
  Manche Feeds liefern sehr große Bilder (tagesschau 1920 px); verkleinern lässt sich das ohne
  eigenen Dienst nicht, `loading="lazy"` begrenzt es auf die sichtbaren.

## Nach v1 – RSS-Widget: Einstellungen und Rechte-Ablauf

- **Feed hinzufügen:** Adresse eintragen, `Enter` oder „Hinzufügen“. Im selben Klick wird das
  Host-Recht angefragt (vor jedem `await`), danach abgerufen und geprüft (`add-feed.ts`). Ist die
  Adresse eine Webseite, sucht die Prüfung nach ausgewiesenen Feeds: einer wird direkt
  übernommen, mehrere werden zur Auswahl angeboten (schon vorhandene nicht), keiner ergibt einen
  Hinweis, die Feed-Adresse selbst einzutragen. Liegt der gefundene Feed auf einer anderen
  Domain ohne Recht, erscheint „Zugriff auf … erlauben“ für einen zweiten Klick. Gefundene
  Adressen werden wie Eingaben auf https gebracht. Der Abruf zum Prüfen füllt gleich den Cache,
  damit das Widget sofort Einträge zeigt. Ungültige und doppelte Adressen werden abgelehnt, ohne
  Rechte anzufragen; eine `http://`-Eingabe meldet, dass über https abgerufen wird.
- **Keine Sortierung der Feeds:** Anders als zuerst geplant lassen sich die Feeds nicht
  umsortieren. Die Liste im Widget ist chronologisch gemischt, die Reihenfolge hätte keine
  sichtbare Wirkung.
- **Umbenennen** direkt im Namensfeld jedes Feeds (Platzhalter: Feed-Titel, sonst Host),
  übernommen beim Verlassen des Felds. Unter dem Namen stehen Host und gegebenenfalls der
  aktuelle Fehler.
- **Entfernen mit Rückgängig im Dialog statt als Toast:** Toasts liegen nicht im Top-Layer und
  sind unter einem modalen Dialog nicht klickbar. Deshalb steht „„…“ entfernt – Rückgängig“
  direkt unter der Liste, bis zur nächsten Aktion. Das betrifft bisher nur diesen Dialog; alle
  anderen Rückgängig-Toasts entstehen außerhalb von Dialogen.
- **Intervall-Beschriftungen** kommen aus `Intl.NumberFormat` mit Einheit (`15 Min.`, `1 Std.`),
  nicht aus den Wörterbüchern.
- **Kontrast** bei Tag und Nacht auf dem Dev-Server geprüft (Text, Punkt, Fuß, Dialog).

## Nach v1 – Page minimal scrollbar

- **Ursache:** Unsichtbare Texte für Screenreader (`.visually-hidden`, 1 × 1 px, absolut
  positioniert) blieben an ihrer normalen Stelle. Die Ansage-Region am Ende der Page lag damit
  genau unter der vollen Fensterhöhe, und in scrollenden Listen (RSS) ragten die Texte aus
  weggescrollten Einträgen heraus. Beides machte die Page um 1 px (bzw. mehr) scrollbar.
- **Lösung:** `.visually-hidden` sitzt jetzt oben links in seinem Bezugsrahmen (`top: 0; left: 0`).
  Das ist unbedenklich, weil keines dieser Elemente fokussierbar ist. Zusätzlich sind die
  scrollenden Bereiche (Inhalt eines Panels mit Höchsthöhe, RSS-Liste) `position: relative`,
  damit absolut positionierte Kinder in ihnen bleiben.

## Nach v1 – RSS-Widget: Kategorien als Tabs

- **Ersetzt „nur eine gemischte Liste“:** Nach dem ersten Test im Alltag hat jedes RSS-Widget
  Kategorien als Tabs (z. B. „Webdev“, „Nachrichten“, „Gaming“), jede mit eigenen Feeds;
  innerhalb eines Tabs bleibt die Liste chronologisch gemischt. Einen „Alle“-Tab gibt es nicht.
- **Schema:** `RssSettings.tabs` (höchstens 10, jeweils `label`, `icon`, höchstens 20 `feeds`)
  und `activeTabId` statt `feeds`. Kein Schema-Sprung: `parseRssSettings` liest ein altes
  `feeds` als einen Tab ohne Namen (angezeigt als „Feeds“). Derselbe Feed darf in mehreren
  Kategorien stehen; Cache, Gelesen-Status und Abruf gelten weiter pro Adresse. Abgerufen
  werden die Feeds aller Tabs, damit die Zähler stimmen.
- **Tab-Leiste wie im Link-Board:** Reiter mit optionalem Emoji, „+“ für eine neue Kategorie,
  Doppelklick bzw. Kontextmenü zum Bearbeiten und Löschen (mit Rückgängig-Toast, die letzte
  Kategorie bleibt), Ziehen zum Sortieren, Pfeiltasten in der Leiste, `Alt+1…9`, solange das
  Widget den Fokus hat. Die Tab-Operationen (`moveTab`, `removeTab`, `insertTab`) und der
  Tab-Dialog des Link-Boards sind dafür allgemein geworden; der Dialog kann die Auswahl der
  Ansicht weglassen und eigene Titel tragen („Kategorie“ statt „Gruppe“).
- **Zähler:** ungelesene Einträge aller gecachten Einträge des Tabs als kleine Pille in
  Akzentfarbe (ab 100 „99+“), für Screenreader im Namen des Reiters („Webdev, 3 ungelesen“).
  Hat ein Feed der Kategorie ein Problem, zeigt der Reiter ein kleines Warnzeichen. „Alle als
  gelesen“, „Aktualisieren“ und der Problem-Fuß beziehen sich auf den aktiven Tab.
- **Einstellungen:** Die Feeds stehen nach Kategorien gruppiert; jeder Feed lässt sich per
  Auswahlfeld in eine andere Kategorie verschieben (steht er dort schon, fällt er nur weg).
  Neue Feeds kommen in die gewählte Kategorie, Standard ist die im Widget aktive.
- **Nebenbei behoben:** Der Tab-Dialog setzt den Fokus ins Namensfeld (bisher auf
  „Schließen“, auch im Link-Board), damit man gleich tippen kann.
- **Keine Überschrift mehr:** Die frei wählbare Überschrift des Widgets (`RssSettings.title`)
  entfällt, weil die benannten Tabs schon sagen, worum es geht. Ein gespeicherter Titel wird beim
  Einlesen einfach verworfen; die Liste heißt für Screenreader weiter „Einträge“.

## Nach v1 – Sidebar auf mittleren Bildschirmen

Der Plan dazu wurde mit der nutzenden Person abgestimmt. Er ersetzt „Untereinander ohne
Zwischenstufe“ aus Schema v3: Statt zwei gibt es drei Stufen.

| Stufe  | Wann                                                                    | Darstellung                                    |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Breit  | Seiten nebeneinander mindestens 20 rem (bisher 14), Mitte mindestens 20 | links · Mitte · rechts wie bisher              |
| Mittel | sonst, solange die Mitte neben der **offenen** Sidebar 20 rem breit ist | Mitte + eine Sidebar am linken Rand, Tabs dran |
| Schmal | darunter (bei Standardwerten unter ~780 px Fensterbreite)               | eine Spalte, Mitte · rechts · links wie bisher |

- **Schwelle über die echte Spaltenbreite:** `layoutStage` rechnet wie `fitsSideBySide` aus
  verfügbarer Breite, Maximalbreite, `columnGap` und `centerSpan`, keine festen Breakpoints. Bei
  Standardmitte (12/24) ist die Page ab ~1440 px Fensterbreite breit, mit 14/24 ab ~1700 px.
  Weil immer vom offenen Zustand aus gerechnet wird und `available` am `.frame` ohne Sidebar
  gemessen wird, wechselt Öffnen oder Schließen nie die Stufe.
- **Eine Sidebar für beide Seiten, verschieben statt überlagern:** Das WebGL-Glas bricht nur die
  Szene, eine überlagernde Sidebar ließe den Text der Mitte durchscheinen, und `backdrop-filter`
  passt optisch und von der Leistung her nicht. Die Mitte nutzt den Rest: bei geschlossener
  Sidebar die volle Breite bis zur Maximalbreite, bei offener von der Sidebar bis zum rechten
  Rand, jeweils mittig. Die Sidebar ist 22 rem breit und hat kein eigenes Glas (sonst doppeltes
  Glas), sie ist die Seitenspalte an anderer Stelle.
- **Tabs:** einer pro eingeschalteter Seite mit Widgets, im Edit-Modus auch für leere (Icon
  `plus`), links vor rechts. Beschriftet mit dem Icon des ersten Widgets, Name der Seite und
  Widgets im Tooltip und für Screenreader (`Intl.ListFormat`). Ein Klick öffnet, der aktive Tab
  schließt. Die Tabs hängen an der Kante der Sidebar und fahren mit; der Abstand zur Mitte ist
  mindestens Tab-Breite plus 8 px, reicht der Seitenrand nicht, rückt die geschlossene Mitte ein.
  **Abweichung vom Plan:** Die Tabs sind CSS-Glas wie der Bearbeiten-Knopf, nicht WebGL-Glas
  (Variante `button`). Für so kleine Flächen fällt der Unterschied nicht auf, und die Variante
  bleibt ungenutzt.
- **Lage:** `position: fixed` am linken Rand, so hoch wie das Fenster, damit sie beim Öffnen auch
  auf einer weit gescrollten Page sichtbar ist. Ist ihr Inhalt höher, scrollt sie selbst
  (bewusste Ausnahme von „die ganze Page scrollt“); das Glas wird an ihr abgeschnitten, ein
  Innenabstand hält Platz für Schatten. Beide Seiten bleiben gemountet, die gerade nicht
  gezeigte ist `hidden`; der Glas-Layer überspringt dafür Flächen ohne Rechteck.
- **Bewegung:** Beim Öffnen springt die Mitte im selben Frame, die Sidebar fährt 260 ms herein.
  Beim Schließen fährt sie erst hinaus (`transitionend`, sonst Zeitlimit), dann springt die
  Mitte. Eine Breite pro Frame hätte das Link-Raster ständig umbrechen lassen. Der Glas-Layer
  liest währenddessen jeden Frame (`animateFor` und wie bisher `transitionrun`). Nach dem
  Hinausfahren ist der Inhalt `display: none`, damit keine Schatten am Rand stehen; seine
  Scrollposition geht dabei verloren. Ein Wechsel der Seite blendet nur kurz ein. Reduced
  Motion: kein Fahren, der Inhalt blendet ein und aus, die Lage springt.
- **Zustand pro Rechner** in `localStorage` (`startpage:sidebar`, `{ open, last }`), nicht in der
  Config und ohne Abgleich zwischen Tabs. Standard ist zu. Hat die gespeicherte Seite keinen Tab
  mehr, ist die Sidebar zu, der Wert bleibt stehen. Er gilt nur in der mittleren Stufe.
- **Tastatur und Fokus:** Tabs sind Disclosure-Buttons (`aria-expanded`, `aria-controls`) in
  einer Gruppe „Seitenleiste“, die Sidebar ist ein `<aside>` mit dem Namen der Seite und im DOM
  nach der Mitte (Mitte → Tabs → Inhalt). Geschlossen ist der Inhalt `inert`; schließt sie mit
  dem Fokus darin, geht er vorher auf den Tab. `Esc` mit Fokus in der Sidebar oder auf einem Tab
  schließt sie, vor dem Verlassen des Edit-Modus und nach Verschieben-Abbrechen, Menüs und
  Dialogen. `S` öffnet bzw. schließt die zuletzt offene Seite, `Umschalt+S` wechselt die Seite
  (`[`/`]` lägen auf deutschen Tastaturen auf `Alt`/`AltGr`), mit Ansage. `/` öffnet die Seite,
  in der die erste Suche liegt.
- **Edit-Modus:** ändert das Layout nicht. Ein gezogenes Panel öffnet nach 400 ms über einem Tab
  dessen Seite; losgelassen auf dem Tab landet es als eigene Zeile am Ende. Pfeiltasten beim
  Verschieben folgen `[links, rechts, Mitte]` und öffnen die Zielseite. Breiten-Trenner gibt es
  nur in der breiten Stufe; eine Breite, die die Stufe wechseln würde, wird beim Ziehen nicht
  übernommen.
- **Kein Schema-Sprung:** Alles liegt in der Darstellung und in `localStorage`, `CONFIG_VERSION`
  bleibt 4.
- **Geprüft** im Vorschau-Browser (Chromium) bei 760, 1280 und 1600 px: drei Stufen, Reihenfolge
  von Sprung und Fahrt, `S`/`Umschalt+S`, `Esc` mit Fokus-Rückgabe, `/`, Ablegen auf einem Tab
  und Verschieben per Tastatur. In Firefox, mit Reduced Motion und in der Static-Stufe steht die
  Prüfung noch aus (`docs/checklist.md`).
