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
  Untergang aus (etwa einmal im Monat), steht „–“ mit Erklärung im Tooltip; bleibt der Mond den
  ganzen Tag über bzw. unter dem Horizont (hohe Breiten, z. B. Tromsø zur großen Mondwende),
  steht das als Text da.
- **Sonne und Mond als eigene Abschnitte:** Uhr, Sonne und Mond stehen untereinander, Sonne und
  Mond jeweils mit eigenem Schalter. Eine erste Fassung zeigte beide an derselben Stelle
  (tagsüber Sonne, nachts Mond, Umschalter oben rechts); untereinander ist alles auf einen
  Blick sichtbar, und ohne Umschalten bleibt die Höhe des Panels ohnehin gleich. Bei Mondauf- und
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
