# Plan: Mittlere Layout-Stufe mit Sidebar

Status: **Freigegeben am 19.10.2026** mit allen Empfehlungen aus Abschnitt 11. Grundlage sind SPEC.md §5, §7.1 und §8 (mit §7.4 zu
Reduced Motion) sowie die Abschnitte „Nach M5 – Zeilen“, „Nach M5 – Zusammenlegen“, „Nach M6 –
Mitte und Seitenspalten (Schema v3)“ und „Nach M6 – Die ganze Page scrollt“ in
`docs/decisions.md`. Sobald gebaut ist, wandern die Entscheidungen nach `docs/decisions.md`
(Abschnitt „Nach v1 – Sidebar auf mittleren Bildschirmen“). Diese Datei wird danach gelöscht.

## Anlass

Auf Laptop-Bildschirmen werden die Seitenspalten zu schmal. Die Mitte bleibt auch bei leerer
Seite genau mittig („Symmetrisch“ in Schema v3). Dadurch bleibt eine leere linke Seite ungenutzt,
während rechts Links und RSS zusammengedrückt werden. Heute gibt es nur zwei Zustände:
nebeneinander oder alles untereinander.

## Getroffene Wahl (mit der nutzenden Person abgestimmt)

| Frage     | Wahl                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| Stufen    | Breit (drei Spalten) · Mittel (Sidebar links) · Schmal (eine Spalte)          |
| Sidebar   | **eine** Sidebar am linken Rand für beide Seiten, immer nur eine Seite offen  |
| Tabs      | bis zu zwei, einer pro Seite, nur für Seiten mit Widgets                      |
| Öffnen    | Klick auf einen Tab öffnet seine Seite, Klick auf den aktiven Tab schließt    |
| Mitte     | verschieben statt überlagern, die Mitte nutzt den verbleibenden Platz         |
| Animation | die Mitte springt einmal auf ihre neue Breite, nur die Sidebar fährt sichtbar |
| Glas      | der Layer liest während der Fahrt pro Frame (Flag „animating“)                |
| Zustand   | offen/zu und welche Seite pro Rechner in `localStorage`, nicht in der Config  |
| Scrollen  | die Page scrollt wie bisher, Dialoge sperren das Scrollen                     |

**Verschieben statt Überlagern:** Das WebGL-Glas liegt als Canvas hinter dem gesamten DOM
(§7.1). Eine Sidebar über der Mitte würde nur die Szene brechen, nicht den DOM-Inhalt der Mitte,
und dessen Text schiene durch die Sidebar. `backdrop-filter` passt weder optisch (anderes Glas als
die Panels) noch von der Leistung her. Deshalb weicht die Mitte aus, und nichts überlappt.

---

## 1. Die drei Stufen

| Stufe      | Wann                                                               | Darstellung                                    |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| **Breit**  | Seiten und Mitte erreichen ihre Mindestbreiten nebeneinander       | wie heute: links · Mitte · rechts              |
| **Mittel** | nicht breit, aber die Mitte neben der offenen Sidebar ist ≥ 20 rem | Mitte + Sidebar links mit Tabs am Rand         |
| **Schmal** | auch das passt nicht                                               | wie heute: eine Spalte, Mitte · rechts · links |

Ohne eingeschaltete Seiten gibt es keine Stufen, die Mitte nimmt wie heute die ganze Breite ein.

### 1.1 Schwelle Breit → Mittel

Entschieden wird über die **echte Spaltenbreite aus der bestehenden Anordnung**, nicht über
einen festen Viewport-Breakpoint: Aus verfügbarer Breite, Maximalbreite, `columnGap` und
`centerSpan` ergibt sich, wie breit Seite und Mitte nebeneinander wären (das rechnet
`fitsSideBySide` heute schon). Neu ist nur die Grenze für die Seite:

- Seite ≥ **20 rem** (bisher 14 rem) und Mitte ≥ 20 rem → Breit.
- Sonst Mittel, sofern die Bedingung aus 1.2 erfüllt ist.

So verschiebt eine breitere Mitte die Schwelle von selbst, und auf beiden Rechnern gilt dieselbe
Regel. Zur Einordnung, bei `columnGap` 24 px und vollem Seitenrand von 56 px:

| `centerSpan` | Breit ab (Fenster), neu | Breit ab (Fenster), heute (14 rem) |
| ------------ | ----------------------- | ---------------------------------- |
| 12 (Std.)    | ~1440 px                | ~1030 px                           |
| 14           | ~1700 px                | ~1220 px                           |
| 16           | ~2080 px                | ~1500 px                           |

Ein MacBook Pro 14″ (1512 px) bliebe mit der Standardmitte knapp breit, ab `centerSpan` 14
käme die Sidebar. **Gewählt: 20 rem** (Frage 4).

Beim Ziehen der Breiten-Trenner bleibt es wie heute: Eine Breite, die die Stufe wechseln würde,
wird nicht übernommen. Sonst sprängen die Seiten mitten in der Geste in die Sidebar.

### 1.2 Schwelle Mittel → Schmal

Mittel gilt, solange die Mitte **neben der offenen Sidebar** noch mindestens `MIN_CENTER_REM`
(20 rem) breit ist. Entscheidend ist der offene Zustand, auch wenn die Sidebar gerade zu ist.
Sonst würde das Öffnen die Stufe wechseln. Mit der Sidebar-Breite aus 2.1 liegt der Übergang
bei etwa 780 px Fensterbreite. Darunter steht alles untereinander wie heute.

### 1.3 Keine Rückkopplung

Die Stufe hängt nur von der Breite ab, die der Page **ohne** Sidebar zur Verfügung steht. Heute
misst `Board.svelte` sie per `bind:clientWidth` am `.frame`. Diese Messung bleibt am `.frame`,
der Platz für die Sidebar entsteht erst innerhalb (Abstand am `.board`). Würde die geöffnete
Sidebar die gemessene Breite verringern, könnte das Öffnen auf Schmal schalten, die Sidebar
verschwände, die Breite wüchse wieder, und die Stufe pendelte.

### 1.4 Welche Seiten einen Tab bekommen

- Außerhalb des Edit-Modus: eingeschaltete Seiten **mit** mindestens einem Widget.
- Im Edit-Modus: alle eingeschalteten Seiten, auch leere, damit man über „+ Widget“ etwas
  hineinlegen kann.
- Hat keine Seite einen Tab, gibt es keine Sidebar. Die Mitte nimmt dann wie „Ohne Seiten“
  die volle Breite bis zur Maximalbreite ein. Das ist der eigentliche Gewinn bei leerer linker
  Seite.
- Reihenfolge der Tabs von oben nach unten: links, dann rechts. Das entspricht der Anordnung in
  der breiten Stufe.

## 2. Darstellung in der mittleren Stufe

### 2.1 Sidebar

- **Eine Spalte Panels, kein eigenes Glas:** Die Sidebar ist die bisherige Seitenspalte an
  anderer Stelle. Sie hat keinen eigenen Hintergrund, sonst lägen Panels auf einer Glasfläche
  (doppeltes Glas). Abgesetzt wird sie durch den Abstand zur Mitte.
- **Breite:** fest **22 rem**. Das liegt knapp über der neuen Mindestbreite einer Seite, damit
  der Inhalt nicht schmaler wirkt als in der breiten Stufe. Zeilen mit mehreren Widgets stellen
  sich wie bisher untereinander, wenn ein Widget schmaler als 13 rem würde (`rowFits` bekommt
  die Sidebar-Breite als Spaltenbreite). Einstellbar wird die Breite vorerst nicht.
- **Lage:** `position: fixed` am linken Rand, oben und unten mit dem Seitenrand der Page. So ist
  sie beim Öffnen immer dort, wo man gerade ist, auch wenn die Page weit gescrollt ist. Eine
  Sidebar im Dokumentfluss stünde nach dem Öffnen womöglich oberhalb des Sichtbaren.
- **Eigenes Scrollen nur bei Überlauf:** Ist der Inhalt höher als das Fenster, scrollt die
  Sidebar selbst (`overflow-y: auto`, dünne Scrollleiste). Das Mausrad gibt am Ende an die Page
  weiter. Das ist eine bewusste Ausnahme von „die ganze Page scrollt“: Die Mitte scrollt weiter
  mit der Page, die Sidebar steht still daneben. Innen hält ein Abstand Platz für Schatten und
  Fokusringe, weil das Glas am Scroll-Container abgeschnitten wird.
- **Beide Seiten bleiben gemountet:** Die gerade nicht gezeigte Seite ist `hidden`. Beim
  Wechseln zwischen den Tabs bleibt so der Zustand der Widgets erhalten (Scrollposition,
  aufgeklappte Details, Eingaben), und nichts lädt neu. Zwischen den Stufen (breit ↔ mittel)
  werden die Seitenspalten dagegen neu gemountet, weil sie in einem anderen Container liegen.
  Das passiert nur beim Ändern der Fenstergröße.
- **Landmark:** `<aside>` mit dem Namen der offenen Seite. Im DOM steht sie nach der Mitte
  (siehe 4.3).

### 2.2 Mitte

- **Sidebar zu:** volle verfügbare Breite bis zur Maximalbreite, mittig. Links bleibt nur der
  Platz, den die Tabs brauchen.
- **Sidebar offen:** von der Sidebar (plus Abstand) bis zum rechten Rand, begrenzt durch die
  Maximalbreite und in diesem Bereich mittig.
- Der Abstand zwischen Sidebar und Mitte ist `columnGap`, aber mindestens so breit wie die
  Tabs plus 8 px. Die Tabs liegen in diesem Abstand und überdecken so nie Inhalt der Mitte.
  Aus demselben Grund ist der linke Seitenrand der Page in der mittleren Stufe mindestens so
  breit wie die Tabs.
- Die Mitte bekommt in der mittleren Stufe ihre Breite in px wie eine einzelne Spalte; `areaPx`
  liefert dann diese Breite für die Mitte und die Sidebar-Breite für beide Seiten.

### 2.3 Tabs am Rand

- Die Tabs hängen an der rechten Kante der Sidebar (`left: 100%`) und fahren mit ihr. Bei
  geschlossener Sidebar ragen sie aus dem linken Fensterrand, bei offener sitzen sie im Abstand
  zwischen Sidebar und Mitte.
- Oben, im Abstand des Seitenrands, untereinander. Etwa 36 × 44 px, zur Mitte hin abgerundet,
  zum Rand hin eckig.
- **Glas:** Die Tabs überlappen keinen DOM-Inhalt. Sie melden sich deshalb als WebGL-Glas mit
  der vorhandenen Variante `button` an (in der Static-Stufe CSS-Glas wie alle Flächen).
- Der aktive Tab ist hervorgehoben (Akzentkante zur Mitte hin plus `aria-expanded="true"`).
- Inhalt des Tabs: **Icon des ersten Widgets der Seite** (Frage 1), eine leere Seite im
  Edit-Modus zeigt `plus`.
- Tooltip: Name der Seite und ihre Widgets, z. B. „Linke Spalte: Uhr, Kalender“.

### 2.4 Bewegung

- **Öffnen:** Im selben Frame springt die Mitte auf ihre schmalere Breite, die Sidebar fährt von
  links herein (`transform: translateX`, ~260 ms, `--ease-out`). Die Mitte gibt also zuerst den
  Platz frei, nichts überlappt.
- **Schließen:** Erst fährt die Sidebar hinaus, danach (`transitionend`, mit Zeitlimit als
  Rückfall) springt die Mitte auf die volle Breite. Andersherum würde die Mitte unter die noch
  sichtbare Sidebar wachsen.
- **Wechsel der Seite** bei offener Sidebar: Kein Fahren, der Inhalt wechselt sofort und blendet
  kurz ein (Opacity, ~150 ms).
- **Warum die Mitte springt:** Würde ihre Breite pro Frame mitwachsen, bräche das Link-Raster
  (Kacheln pro Reihe) und die Zeilenaufteilung in jedem Frame neu um. Ein einzelner Sprung ist
  ruhiger und kostet ein Layout statt zwanzig.
- **Glas:** Der Layer reagiert schon heute auf `transitionrun` mit `animateFor(600)` und liest dann
  pro Frame die Rechtecke. Die Fahrt (260 ms) liegt darin. Zusätzlich ruft die Sidebar beim Start
  ausdrücklich `glassLayer.animateFor(…)` auf, damit es nicht am Ereignis hängt. Den Sprung der
  Mitte meldet der `ResizeObserver`.
- **Reduced Motion:** Kein Fahren, die Sidebar blendet nur ein bzw. aus (Opacity, wie §7.4 für
  Federn vorgibt). Die Reihenfolge Mitte/Sidebar bleibt.
- **Beim Laden** gibt es keine Animation: Der gespeicherte Zustand wird vor dem ersten Rendern
  gelesen, die Transition wird erst nach dem ersten Frame aktiv.

### 2.5 Leere Rechtecke im Glas-Layer

Die verborgene Seite (`hidden`) hat ein Rechteck von 0 × 0. `glassLayer.sync()` überspringt
künftig Flächen ohne Breite oder Höhe, damit kein Schatten-Quad an der Ecke oben links entsteht.
Die Panels der geschlossenen Sidebar liegen außerhalb des Fensters, der Shader zeichnet dort
nichts. Sie zählen weiter zur Grenze von 64 Flächen, wie bisher alle Panels.

## 3. Zustand

- Schlüssel `startpage:sidebar` in `localStorage`, Wert `{ open: 'left' | 'right' | null,
last: 'left' | 'right' }`. `last` bestimmt, welche Seite ein Kürzel ohne Seitenangabe öffnet.
- Gelesen wird synchron beim Start des Boards, geschrieben bei jeder Änderung. Zugriffe stehen in
  `try/catch`. Ohne `localStorage` ist die Sidebar zu und merkt sich nichts.
- Ungültige Werte werden zu „zu“. Gibt es für die gespeicherte Seite keinen Tab (leer,
  ausgeschaltet, per Tab-Sync geändert), ist die Sidebar zu. Der gespeicherte Wert bleibt
  stehen, bis man selbst etwas öffnet oder schließt.
- **Standard beim ersten Mal: zu.**
- Gilt nur in der mittleren Stufe. In der breiten und der schmalen Stufe wird der Wert weder
  gelesen noch verändert. Wechselt man per Fenstergröße zurück in die mittlere Stufe, ist der
  letzte Zustand wieder da.
- Kein Abgleich zwischen offenen Tabs: Jeder Tab hat seinen eigenen Zustand, ein neuer Tab startet
  mit dem zuletzt gespeicherten.

## 4. Tastatur und Fokus

### 4.1 Tabs

- Jeder Tab ist ein `<button>` mit `aria-expanded` und `aria-controls` auf die Sidebar. Bewusst
  kein `role="tab"`: Ein Tab-Muster ohne sichtbares Panel im geschlossenen Zustand und mit
  „aktiven Tab anklicken schließt“ entspricht dem Disclosure-Muster.
- Die Gruppe heißt für Screenreader „Seitenleiste“ (`role="group"`).
- `Enter`/`Leertaste` öffnen, wechseln oder schließen wie ein Klick. Der Fokus bleibt auf dem Tab.
  Der nächste `Tab`-Schritt führt in den Inhalt der Sidebar.

### 4.2 `inert` und `Esc`

- Bei geschlossener Sidebar ist ihr Inhalt `inert`: nicht fokussierbar, nicht anklickbar, für
  Screenreader nicht vorhanden. Die Tabs liegen außerhalb und bleiben erreichbar.
- **Schließen mit Fokus in der Sidebar** (Kürzel, Klick auf den Tab, `Esc`): Der Fokus geht
  zuerst auf den Tab der Seite, dann wird `inert` gesetzt. Sonst fiele der Fokus auf `<body>`.
- **`Esc`** schließt die Sidebar, wenn der Fokus in ihr oder auf einem Tab liegt. Reihenfolge,
  wenn mehreres in Frage kommt:
  1. Tastatur-Verschieben abbrechen (wie heute, mit `stopPropagation`)
  2. Menü, Popover oder Dialog schließen (nativ)
  3. Sidebar schließen (Fokus in Sidebar oder auf einem Tab)
  4. Edit-Modus verlassen
- Liegt der Fokus in der Mitte, bleibt `Esc` beim heutigen Verhalten.

### 4.3 Reihenfolge im DOM

Mitte → Tabs → Sidebar-Inhalt (linke Seite, dann rechte). Das setzt die Regel aus Schema v3 fort:
Die Mitte kommt zuerst, „das erste Link-Board“ für `1…9` liegt weiter in der Mitte. Visuell
steht die Sidebar links, in der Lesereihenfolge folgt sie der Mitte. In der breiten und der
schmalen Stufe ändert sich die DOM-Reihenfolge nicht.

### 4.4 Ziele in einer geschlossenen Sidebar

- **`/` (Suche):** Liegt die erste Suche in einer Seite und ist die Sidebar zu bzw. zeigt die
  andere Seite, öffnet `/` diese Seite und fokussiert dann das Feld. Heute würde
  `querySelector` das Feld auch in einer `inert`-Sidebar finden, und der Fokus ginge ins Leere.
- **`1…9`:** Öffnen Links ohne Fokus, das funktioniert auch bei geschlossener Sidebar. Keine
  Änderung.
- **Neues Widget** über „+ Widget“ in einer Seite: Die Sidebar ist dabei offen (siehe 5), der
  Fokus geht wie heute auf den Griff.

### 4.5 Kürzel

Nur, wenn kein Eingabefeld fokussiert und kein Overlay offen ist (wie `E`). **Gewählt** (Frage 2): `S` öffnet bzw. schließt die zuletzt offene Seite,
`Umschalt+S` wechselt die Seite.

## 5. Edit-Modus und Drag & Drop

**Gewählt** (Frage 3): Ziehen auf einen Tab öffnet die Seite.

- **Empfehlung: Edit-Modus ändert das Layout nicht, Ziehen auf einen Tab öffnet.**
  - Im Edit-Modus gibt es Tabs für alle eingeschalteten Seiten, auch leere (1.4).
  - Verweilt ein gezogenes Widget ~400 ms über einem Tab, öffnet sich diese Seite
    („spring-loaded“). Dann kann man es an eine beliebige Stelle der Seite legen.
  - Loslassen direkt auf dem Tab legt es als eigene Zeile ans Ende der Seite. Dafür gibt es schon
    `sortable.target()` (wie bei den Tab-Reitern des Link-Boards) und `overTarget`.
  - Tastatur: `←`/`→` beim Verschieben folgen der sichtbaren Anordnung `[links, rechts, Mitte]`
    (die Sidebar steht links der Mitte, darin links vor rechts). Wandert ein Widget in eine
    Seite, die gerade nicht offen ist, öffnet sie sich.
- **Alternative: Edit-Modus erzwingt die offene Sidebar.** Einfacher zu bauen, aber das Betreten
  des Edit-Modus lässt die Mitte springen, und das Link-Raster bricht um.

Unabhängig davon:

- Die Breiten-Trenner und die Anzeige der Raster-Einheiten gibt es nur in der breiten Stufe. In
  der mittleren Stufe hat `centerSpan` keine Wirkung auf die Darstellung, nur auf die Schwelle.
- Das Ausschalten einer Seite (Edit-Leiste) verhält sich wie heute: Ihre Widgets wandern in die
  Mitte, und ihr Tab verschwindet.
- Beim Ziehen am Fensterrand scrollt die Page, über der Sidebar mit eigenem Überlauf die Sidebar.
  Das deckt `#autoScroll` in `sortable.svelte.ts` schon ab (es sucht den Scroll-Container unter
  dem Zeiger).

## 6. Weitere Folgen

- **Edit-Leiste und Toasts** bleiben unten mittig über dem ganzen Fenster. Bei offener Sidebar
  können sie deren unteren Rand berühren. Sie sind CSS-Glas über allem, das tun sie heute über
  den Panels auch.
- **Dialoge** sperren das Scrollen der Page (`html:has(dialog[open])`). Die Sidebar scrollt nur
  bei eigenem Überlauf und liegt dann ohnehin hinter dem modalen Dialog.
- **Fokus beim Wechsel der Stufe** (Fenstergröße) geht verloren, wenn er in einer Seite lag, weil
  die Seite neu gemountet wird. Das ist selten und wird nicht abgefangen.
- **Schema:** Ohne eigenen Namen pro Seite (Frage 1) gibt es keine Änderung, `CONFIG_VERSION`
  bleibt 4.

## 7. i18n

Neue Schlüssel in `de.ts`/`en.ts` (Vorschlag):

| Schlüssel          | Deutsch           | Englisch          |
| ------------------ | ----------------- | ----------------- |
| `sidebar.tabs`     | Seitenleiste      | Sidebar           |
| `sidebar.open`     | {area} öffnen     | Open {area}       |
| `sidebar.close`    | {area} schließen  | Close {area}      |
| `sidebar.contents` | {area}: {widgets} | {area}: {widgets} |
| `sidebar.empty`    | {area} (leer)     | {area} (empty)    |
| `sidebar.opened`   | {area} geöffnet   | {area} opened     |
| `sidebar.shortcut` | Kürzel: {keys}    | Shortcut: {keys}  |

Die Widget-Liste in `sidebar.contents` wird mit `Intl.ListFormat` gebildet. `sidebar.opened` sagt
der Announcer an, wenn sich eine Seite beim Ziehen oder per Kürzel öffnet. Die Namen der Seiten
kommen weiter aus `area.left`/`area.right` („Linke Spalte“/„Rechte Spalte“). In der Sidebar steht
die rechte Spalte zwar links, der Name bezeichnet aber den Bereich der Config, wie im Edit-Modus.

## 8. Code

- `src/lib/layout/operations.ts`: neue Konstanten `MIN_SIDE_WIDE_REM = 20` (ersetzt
  `MIN_SIDE_REM` in `fitsSideBySide`) und `SIDEBAR_REM = 22`.
- `src/lib/layout/arrangement.ts`:
  - `layoutStage(layout, availablePx, remPx)` → `'wide' | 'sidebar' | 'stacked'`, reine
    Funktion (Abschnitt 1).
  - `arrange(…)` bekommt Stufe und offene Seite und liefert zusätzlich `stage`,
    `sidebar: { width, gap } | null` und die Breite der Mitte. `areaPx` rechnet für alle drei
    Stufen. `order` für die Pfeiltasten folgt 5.
  - `sidebarTabs(layout, editing)` → Seiten mit Tab (1.4).
- `src/lib/layout/sidebar-state.ts` (neu): Lesen, Validieren und Schreiben von
  `startpage:sidebar`, dazu `effectiveSide(stored, tabs)`.
- `src/lib/layout/Sidebar.svelte` (neu): Sidebar mit Tabs, Fahrt, `inert`, `Esc`, Glas der Tabs.
  Die Segmente der Seiten bleiben in `Board.svelte` (DnD-Listen, `placementAt`) und werden als
  Snippet hineingereicht.
- `src/lib/layout/Board.svelte`: Stufe statt `sideBySide`, Abstand der Mitte, Reihenfolge Sidebar
  öffnen/Mitte springen, DnD auf Tabs.
- `src/lib/glass/layer.ts`: leere Rechtecke überspringen (2.5).
- `src/App.svelte`: Kürzel, `/` öffnet die Seite mit der Suche, `Esc`-Reihenfolge.
- `src/lib/i18n/de.ts`, `en.ts`: Schlüssel aus 7.

## 9. Tests

- **`arrangement.test.ts` (Stufen-Entscheidung als reine Funktion):**
  - Breit, mittel und schmal an den Grenzen (knapp darüber, knapp darunter) für
    `centerSpan` 8/12/16 und verschiedene `columnGap`.
  - Die Maximalbreite begrenzt die Breite, aus der entschieden wird.
  - Ohne Seiten oder ohne Tabs: keine Sidebar, die Mitte voll breit.
  - Mittel bleibt mittel, egal ob die Sidebar offen ist (keine Rückkopplung).
  - Breite der Mitte offen/zu, Abstand mindestens Tab-Breite, `areaPx` je Stufe.
  - `order` in der mittleren Stufe.
- **`sidebarTabs`:** leere Seiten ohne Tab, im Edit-Modus mit, ausgeschaltete nie.
- **`sidebar-state.test.ts`:** ungültige und fehlende Werte, Seite ohne Tab → zu,
  `localStorage` wirft → zu.
- **`layer.svelte.test.ts`:** Fläche mit 0 × 0 wird nicht ausgegeben.
- **Komponententest `Sidebar.svelte.test.ts`** (jsdom): Tabs mit `aria-expanded`, Klick öffnet,
  Klick auf den aktiven schließt, Wechsel der Seite, `inert` bei geschlossener Sidebar, `Esc`
  schließt und setzt den Fokus auf den Tab, kein Tab für leere Seiten.
- **Manuell** (`docs/checklist.md`): Laptop-Breite (1280–1512 px) und breiter Bildschirm,
  Fenster über die Schwellen ziehen, Fahrt mit WebGL-Glas ohne Nachziehen, Static-Stufe, Reduced
  Motion, Ziehen auf einen Tab, Tastatur komplett ohne Maus, Screenreader-Namen.

## 10. Meilensteine

Jeder endet mit `pnpm check && pnpm lint && pnpm test && pnpm ext:lint` und einem Commit.

1. **S1 – Stufen als reine Funktionen:** Konstanten, `layoutStage`, erweitertes `arrange`/`areaPx`,
   `sidebarTabs`, `sidebar-state.ts`, alle Unit-Tests. `Board.svelte` bleibt noch bei der
   heutigen Entscheidung (Schwelle 14 rem), damit die Page bis S2 nicht schlechter wird. Sichtbar
   ändert sich nichts.
2. **S2 – Sidebar und Tabs:** `Sidebar.svelte`, Lage, Breite der Mitte, Fahrt mit Sprung-
   Reihenfolge, Glas (Tabs, leere Rechtecke, `animateFor`), Reduced Motion, Zustand in
   `localStorage`, Tab-Inhalt nach Frage 1, i18n, Komponententest.
3. **S3 – Tastatur, Edit-Modus und Drag & Drop:** `inert`, `Esc`-Reihenfolge, Fokus beim
   Schließen, Kürzel nach Frage 2, `/` öffnet die Seite mit der Suche, Edit-Modus nach Frage 3
   (Tabs für leere Seiten, Ziehen auf Tabs, Pfeiltasten).
4. **S4 – Abschluss:** Abschnitt in `docs/decisions.md`, Punkte in `docs/checklist.md`, manuelle
   Prüfung in Firefox auf dem Laptop, diese Datei löschen.

## 11. Fragen und Antworten

Alle vier wurden mit der jeweiligen Empfehlung beantwortet: 1a, 2a, Ziehen auf einen Tab, 20 rem.

1. **Beschriftung der Tabs**
   - **a) Icon des ersten Widgets der Seite (Empfehlung):** keine Schema-Änderung, die
     Registry hat die Icons schon (`clock`, `calendar`, `link`, `rss` …). Name und Widgets
     stehen im Tooltip und für Screenreader. Eine leere Seite im Edit-Modus zeigt `plus`.
   - **b) Eigener Name pro Seite,** senkrecht geschrieben: neues Feld `layout.sideLabels`, additiv
     ohne Sprung der Version, aber mit Eingabe im Edit-Modus. Tabs werden dadurch deutlich
     höher.
2. **Tastenkürzel**
   - **a) `S` öffnet/schließt (zuletzt offene Seite), `Umschalt+S` wechselt die Seite
     (Empfehlung).** Auf jeder Tastaturbelegung ohne Zusatztaste erreichbar.
   - **b) `[` und `]` für links und rechts.** Auf der deutschen Mac-Tastatur liegen sie auf
     `Alt+5`/`Alt+6`, unter Windows auf `AltGr+8`/`AltGr+9`. Globale Kürzel ignorieren heute jede
     Zusatztaste, und über `KeyboardEvent.code` wären es die Tasten `Ü` und `+`.
   - **c) Kein Kürzel.**
3. **Edit-Modus:** Ziehen auf einen Tab öffnet die Seite (Empfehlung) oder der Edit-Modus
   erzwingt die offene Sidebar (siehe 5).
4. **Schwelle:** Seite unter **20 rem** → Sidebar, entschieden über die echte Spaltenbreite der
   Anordnung (Empfehlung, siehe 1.1). Alternativ ein anderer Wert, z. B. 18 rem, dann käme die
   Sidebar erst bei schmaleren Fenstern.

## Bewusst nicht enthalten

- Einstellbare Breite der Sidebar.
- Sidebar rechts oder je Seite am eigenen Rand. Gewählt ist **eine** Sidebar links.
- Animierte Verschiebung der Mitte, wenn sich nur ihre Lage ändert und nicht ihre Breite (bei
  gesetzter Maximalbreite). Das wäre später per FLIP möglich, ohne dass das Raster umbricht.
- Zähler auf den Tabs (z. B. ungelesene RSS-Einträge).
- Überlagernde Sidebar, auch nicht in der schmalen Stufe.
