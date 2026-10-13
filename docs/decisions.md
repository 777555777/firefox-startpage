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
