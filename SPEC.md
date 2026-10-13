# Firefox Startpage – Spezifikation v1

Eine Firefox-Extension, die den neuen Tab (und optional die Startseite) durch eine eigene, vollständig
über die Oberfläche konfigurierbare Startpage ersetzt. Sie soll identisch auf dem Privat- und dem
Arbeitsrechner laufen und dort jeweils unabhängig angepasst werden können.

Dies ist ein kompletter Neubau. Die Vorgänger `../startpage` (SvelteKit, Steam-2003-Theme) und
`../startpage-old` (erste Extension mit ds.css) dienen nur als Referenz für Logik (siehe [§12](#12-übernahme-aus-dem-alten-projekt)).
Der Steam-Look wird **nicht** übernommen.

---

## 1. Ziele und Nicht-Ziele

**Ziele**

- Alles ist über die UI konfigurierbar: Widgets, Links, Layout, Hintergrund, Sprache, Qualität. Für
  Änderungen ist nie ein Rebuild nötig.
- Visuell: moderne, durchdachte Interpretation von **Frutiger Aero**. Hochwertiges **Liquid Glass**
  (Refraktion, Dispersion, Fresnel, Glanzkante) liegt über einem eigenen Hintergrundbild oder -video.
- Auf schwächerer Hardware (Arbeitsrechner) flüssig, mit Qualitätsstufen und automatischem Downgrade.
- Zweisprachig (DE/EN).

**Nicht-Ziele für v1**

- Kein Sync zwischen Rechnern. Beide Rechner haben getrennte Daten, übertragen wird per JSON-Export/-Import.
- Kein öffentliches AMO-Listing (Signierung nur „unlisted“).
- Kein Chrome-Support. Die Architektur soll ihn nicht verbauen, er wird aber nicht getestet.
- RSS, Notizen und Termine werden noch nicht gebaut (siehe [§11 Roadmap](#11-roadmap-nicht-v1)).

### Gestaltungsleitlinien „Aero, aber nicht Klischee“

- Glas ist **Material, kein Effekt**. Es trägt Inhalt und muss lesbar bleiben. Nur Widgets, Dialoge
  und Menüs sind Glas, sonst nichts.
- Keine Blasen, Delfine oder Lens-Flares und kein Glossy-Overkill. Aero-Anleihen sind gezielt:
  satte, natürliche Farben, Licht und Tiefe, weiche Rundungen und Tageslicht-Stimmung.
- Typografie, Abstände und Interaktionen folgen heutigen Standards: klare Hierarchie, großzügiger
  Weißraum, sichtbarer Fokus, volle Tastaturbedienbarkeit.
- Bewegung ist ruhig und physikalisch (Federn), nie verspielt-hektisch. `prefers-reduced-motion` wird respektiert.

---

## 2. Tech-Stack

| Bereich         | Wahl                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| UI              | **Svelte 5** (Runes), **ohne SvelteKit**                               |
| Build           | **Vite**, ein HTML-Entry `newtab.html`                                 |
| Sprache         | TypeScript strict                                                      |
| Paketmanager    | pnpm                                                                   |
| Tests           | Vitest (Unit), optional Vitest Browser Mode/Playwright für Komponenten |
| Lint/Format     | ESLint + Prettier (Tabs, single quotes, wie in den Vorgängern)         |
| Extension-Tools | `web-ext` (run, lint, build, sign), `webextension-polyfill` + Typen    |
| Rendering Glas  | WebGL2, handgeschriebene Shader, **keine** 3D-Library                  |
| Schrift         | **Figtree** Variable (OFL), mitgeliefert als woff2                      |

Weitere Runtime-Dependencies sollen sparsam sein. Kleine Dinge (DnD, i18n, Feiertage) werden selbst
implementiert, siehe jeweilige Abschnitte.

### Scripts (Soll)

- `dev`: Vite-Dev-Server, die Page läuft im normalen Browser mit HMR (Storage fällt auf localStorage/IndexedDB zurück, siehe [§4](#4-datenmodell-und-speicherung))
- `build`: Vite-Build nach `dist/`, inklusive `manifest.json`. Die Version wird aus `package.json` übernommen.
- `ext:dev`: Build im Watch-Modus + `web-ext run` (Firefox mit geladener Extension)
- `ext:lint`, `ext:build` (.zip), `ext:sign` (`web-ext sign --channel=unlisted`, API-Keys aus Env-Variablen `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET`, lokal in `.env.local`, die in `.gitignore` steht und nie committet wird)
- `check` (svelte-check), `lint`, `format`, `test`

---

## 3. Extension

- **Manifest V3**, Firefox ≥ aktuelle ESR.
- `chrome_url_overrides.newtab` → `newtab.html`. Zusätzlich `chrome_settings_overrides.homepage`
  auf dieselbe Seite, damit sie auch beim Start erscheint.
- `browser_specific_settings.gecko.id` im Format `name@domain`, die Domain muss nicht existieren
  → **`firefox-startpage@stampf`**. Die ID ist intern, nicht der Anzeigename, und darf nach der ersten Signierung nicht mehr geändert werden.
- **Permissions v1:** `storage`, `unlimitedStorage` (für Video-Uploads in IndexedDB).
  Keine Host-Permissions in v1. Favicons werden als `<img>` direkt von der jeweiligen Origin geladen.
- Spätere Widgets (RSS usw.) fordern Host-Rechte zur Laufzeit über `optional_host_permissions` an.
  Das wird in v1 noch nicht umgesetzt, die Architektur muss es aber zulassen.
- Die CSP von MV3 erlaubt keine Inline-Skripte und kein `eval`. Der Build darf beides nicht erzeugen.
- Hinweis: Firefox gibt beim neuen Tab den Fokus der Adressleiste. Ein Autofokus der Suche wird
  **nicht** versucht. Stattdessen fokussiert `/` die Suche.
- Name und Beschreibung im Manifest sind über `_locales/de` und `_locales/en` lokalisiert.

---

## 4. Datenmodell und Speicherung

### Speicherorte

- **Konfiguration** liegt als ein JSON-Dokument in `browser.storage.local` unter dem Schlüssel `config`.
- **Medien** (hochgeladene Bilder/Videos) liegen als Blobs in **IndexedDB** (`media`-Store). In der
  Config steht nur ihre ID.
- **Statistik** (Link-Klicks) liegt getrennt in `storage.local` unter `stats`, damit Config-Exporte stabil bleiben.
- Ein **Storage-Adapter** kapselt das alles. Außerhalb der Extension (Dev-Server) wird automatisch
  auf `localStorage` + IndexedDB ausgewichen. Jeder Zugriff ist fehlertolerant: Schlägt Speichern
  fehl, läuft die Page weiter und zeigt einen dezenten Hinweis.
- Änderungen werden debounced gespeichert (~300 ms). Über `storage.onChanged` wird zwischen offenen
  Tabs synchronisiert (Änderung in Tab A wird in Tab B sichtbar).

### Schema (Skizze)

```ts
type Config = {
	version: number; // Schema-Version, Migrationen bei Erhöhung
	language: 'de' | 'en' | 'auto';
	layout: {
		columns: 1 | 2 | 3 | 4;
		/** Widget-Instanz-IDs pro Spalte, in Reihenfolge */
		columnItems: string[][];
		/** Maximale Inhaltsbreite in rem, optional */
		maxWidth?: number;
	};
	widgets: Record<string, WidgetInstance>; // id → Instanz
	appearance: {
		accent: string; // Hex, Default sattes Aero-Blau
		glass: { frost: number /* 0 klar … 1 milchig */ };
		background: BackgroundConfig;
		timeOfDay: TimeOfDayConfig;
		quality: 'auto' | 'high' | 'medium' | 'low' | 'static';
		pointerLight: boolean;
	};
	search: SearchConfig;
};

type WidgetInstance = { id: string; type: WidgetType; settings: unknown /* je Typ validiert */ };
type WidgetType = 'clock' | 'calendar' | 'search' | 'links'; // später: 'rss' | 'notes' | 'upcoming'

type BackgroundConfig = {
	/** Haupt-Hintergrund; null = Shader-Verlauf */
	main: MediaRef | null;
	/** Optionale Slots pro Tageszeit; leer = main verwenden */
	slots: Partial<Record<DayPhase, MediaRef>>;
	fit: 'cover' | 'contain';
	/** Fokuspunkt für cover, 0..1 */
	focus: { x: number; y: number };
};
type MediaRef = { id: string; kind: 'image' | 'video'; name: string };

type DayPhase = 'morning' | 'day' | 'evening' | 'night';
type TimeOfDayConfig = {
	grading: boolean; // Color-Grading an/aus
	/** Beginn der Phasen in Minuten nach Mitternacht, editierbar */
	phaseStart: Record<DayPhase, number>; // Default 06:00, 10:00, 17:30, 21:30
};
```

- Jede Instanz-Settings-Struktur wird beim Laden **validiert** (Fehlendes ergänzen, Ungültiges
  verwerfen, nie werfen). Das gilt auch für den Import.
- **Migrationen:** `migrate(raw): Config` mit Unit-Tests pro Versionssprung.
- **Erststart:** Eine sinnvolle Default-Config wird erzeugt: 3 Spalten mit Uhr + Kalender | Suche + Links | Links.
  Dazu ein Beispiel-Link-Board und die Standard-Suchmaschinen.

### Export/Import

- Der **Export** schreibt eine JSON-Datei mit Config, Links und optional der Statistik. Medien werden
  nicht eingebettet, der Export listet sie nur mit Namen auf.
- Der **Import** ersetzt die gesamte Config nach einer Bestätigung. Fehlende Medien werden markiert,
  der Hintergrund fällt dann auf den Shader-Verlauf zurück.
- Vor dem Import wird automatisch ein Backup der aktuellen Config im Storage abgelegt (letzte 3),
  das sich in den Einstellungen wiederherstellen lässt.
- Einstellungen → „Alles zurücksetzen“ (mit Bestätigung).

---

## 5. Layout und Edit-Modus

### Layout

- 1–4 Spalten, einstellbar. Jedes Widget ist ein **eigenes Glas-Panel**, sie werden pro Spalte
  untereinander gestapelt.
- Responsiv: Ist der Viewport zu schmal für die gewählte Spaltenzahl (Mindestbreite pro Spalte
  ~20 rem), werden Spalten **nur in der Darstellung** zusammengelegt. Die gespeicherte Zuordnung bleibt erhalten.
- Die Page selbst scrollt möglichst nicht. Ist eine Spalte zu hoch, scrollt diese Spalte. Das
  vereinfacht die Synchronisation mit dem Glas-Layer ([§7](#7-hintergrund-und-liquid-glass)).

### Edit-Modus

- Ein Toggle (dezenter Glas-Button in einer Ecke und das Tastenkürzel `E`, wenn kein Eingabefeld
  fokussiert ist) schaltet den Edit-Modus.
- Im Edit-Modus gilt:
  - Jedes Panel zeigt einen Drag-Griff, ein Zahnrad (Widget-Einstellungen) und ein Entfernen-Symbol (mit Undo-Toast statt Bestätigungsdialog).
  - Widgets lassen sich per **Drag & Drop** innerhalb einer Spalte und zwischen Spalten verschieben.
    Dazu gibt es eine Tastatur-Alternative: Panel fokussieren, `Leertaste` greift, Pfeiltasten
    verschieben, `Leertaste` legt ab, `Esc` bricht ab.
  - Am Ende jeder Spalte gibt es „+ Widget“ mit einer Auswahl der Widget-Typen.
  - Spaltenanzahl und Zugang zu den **globalen Einstellungen** befinden sich in einer schwebenden Edit-Leiste.
- Drag & Drop wird selbst implementiert (Pointer Events + FLIP-Animation mit Federn), ohne Library.
  Dieselbe Implementierung wird für Links und Link-Tabs wiederverwendet.

### Globale Einstellungen (Dialog)

Die Abschnitte sind:

- **Allgemein:** Sprache (Auto/DE/EN)
- **Darstellung:** Akzentfarbe (Colorpicker + 6 Vorschläge), Glas-Frost (Slider), Lichtreflex folgt Maus (an/aus)
- **Hintergrund:** Haupt-Hintergrund und Tageszeit-Slots (hochladen, ersetzen, entfernen,
  Vorschau), Fokuspunkt, Fit, Color-Grading an/aus, Phasenzeiten
- **Leistung:** Qualitätsstufe, Anzeige der aktuellen FPS/Stufe (wenn Auto)
- **Suche:** Suchmaschinen und Bangs ([§6.3](#63-suche))
- **Daten:** Export, Import, Backups, Zurücksetzen

---

## 6. Widgets v1

### Widget-Architektur

Eine **Registry** beschreibt jeden Typ:

```ts
type WidgetDefinition<S> = {
	type: WidgetType;
	name: I18nKey;
	icon: Component;
	defaultSettings: () => S;
	parseSettings: (raw: unknown) => S; // validiert, wirft nie
	component: Component<{ id: string; settings: S; editing: boolean }>;
	settingsComponent?: Component<{ settings: S; onchange: (s: S) => void }>;
	/** Optional: Permissions, die beim Hinzufügen angefragt werden (für Roadmap-Widgets) */
	permissions?: { origins?: string[]; permissions?: string[] };
	singleton?: boolean; // z. B. Suche nur einmal
};
```

- Alle Widgets dürfen **mehrfach** platziert werden (Ausnahme: `singleton`).
- Widget-Einstellungen öffnen sich als Glas-Popover/Dialog am Panel.
- Ein Widget-Fehler darf nie die Page reißen. Jedes Widget steckt in einer Error-Boundary
  (`<svelte:boundary>`) mit Hinweis und „Zurücksetzen“-Option.

### 6.1 Uhr

- Einstellungen: Sekunden an/aus, 12/24 h (Default aus der Sprache), Datum anzeigen an/aus, Datumsformat kurz/lang.
- Die Darstellung ist groß und typografisch ruhig. Nur ein Timer, der auf die Sekunden- bzw.
  Minutengrenze synchronisiert ist.

### 6.2 Kalender

- Monatsansicht (immer 6 Wochen, damit die Höhe beim Blättern stabil bleibt), Blättern, „Heute“-Sprung.
- Einstellungen: Wochenstart Mo/So, Kalenderwochen (ISO 8601) an/aus, Feiertage an/aus + **Bundesland**.
- **Feiertage** werden offline für Deutschland berechnet: bundeseinheitliche Feiertage plus
  Landesfeiertage pro Bundesland, bewegliche Feste über das Osterdatum (Gauß/Anonymous-Gregorian).
  Sonderfälle wie Buß- und Bettag (SN), Fronleichnam, Mariä Himmelfahrt (BY: als landesweit behandeln),
  Reformationstag, Allerheiligen, Weltkindertag (TH), Frauentag (BE, MV) werden berücksichtigt.
  Unit-Tests prüfen gegen bekannte Jahre.
- Feiertage werden markiert, ihr Name erscheint als Tooltip bzw. `title`/aria-label. Das heutige Datum ist hervorgehoben.

### 6.3 Suche

- **Mehrere Engines** werden in den globalen Einstellungen gepflegt: Name, URL-Template mit `%s`,
  optionaler **Bang** (z. B. `g`, `gh`, `mdn`) und Icon (Favicon automatisch). Eine Engine ist Default.
- Im Widget sitzt ein Engine-Umschalter (Dropdown/Segment) direkt am Eingabefeld. Die gewählte
  Engine gilt nur bis zum Absenden, danach ist wieder die Default-Engine aktiv.
- **Bangs:** `!gh svelte` oder `svelte !gh` leitet an die Engine mit diesem Bang. Unbekannte Bangs
  werden als normaler Suchtext behandelt. Während der Eingabe zeigt ein Chip die erkannte Engine.
- **Links mitdurchsuchen:** Beim Tippen erscheinen bis zu 5 passende Links aus allen Link-Boards
  oberhalb der Web-Suche, per Fuzzy-Match auf Label und Host, gewichtet mit der Klick-Statistik.
  Mit Pfeiltasten wird navigiert, `Enter` öffnet den gewählten Link, ohne Auswahl wird gesucht.
  `Strg/Cmd+Enter` öffnet in einem neuen Tab.
- Es werden keine Online-Suchvorschläge der Engines genutzt (Privatsphäre, keine Host-Permissions).
- Defaults: DuckDuckGo (Default), Google `!g`, GitHub `!gh`, MDN `!mdn`, Wikipedia DE `!w`, YouTube `!yt`.
- Das globale Kürzel `/` fokussiert die (erste) Suche.

### 6.4 Link-Board

Es basiert auf der Logik aus `../startpage/src/lib/widgets/link-board/` und wird erweitert.

- Ein Board hat **Tabs** (Gruppen), jeder Tab hat Label, optionales Icon und eine **Ansicht**:
  Kapseln, Kacheln oder Liste.
- Ein Link besteht aus Label, URL (http(s) oder App-Schema wie `vscode://`, `obsidian://`),
  Ziel (gleicher/neuer Tab) und Icon: automatisch über das Favicon der Origin, eigenes Bild
  (Upload, als kleines Data-URL in der Config) oder als Fallback der Anfangsbuchstabe auf Akzentfarbe.
- Link und Tab lassen sich hinzufügen, bearbeiten und löschen (Dialog). Ein Kontextmenü auf dem Link
  bietet Öffnen, In neuem Tab öffnen, URL kopieren, Bearbeiten und Löschen.
- **Drag & Drop:** Links innerhalb eines Tabs sortieren, auf einen anderen Tab-Reiter ziehen
  (verschieben), Tabs sortieren. Das funktioniert auch außerhalb des Edit-Modus per langem Drücken
  bzw. Ziehen am Link, ein versehentlicher Klick darf dabei aber nicht öffnen (Schwellwert ~5 px).
  Links zwischen verschiedenen Boards zu verschieben ist nice-to-have.
- **Mehrere Boards:** Jede Instanz hat eigene Tabs und Links. Die Daten liegen in den Settings der Instanz.
- **Tastatur-Navigation:**
  - Ein Board ist ein Fokusbereich. Pfeiltasten bewegen den Fokus zwischen Links (Roving Tabindex),
    `Enter` öffnet, `Strg/Cmd+Enter` öffnet in einem neuen Tab.
  - Ist ein Board fokussiert, wechseln `Alt+1…9` dessen Tabs und `1…9` öffnen den n-ten Link des aktiven Tabs.
  - Ohne Fokus auf einem Board gelten `1…9` für das **erste** Board der Page.
  - Keine Kürzel greifen, solange ein Eingabefeld fokussiert ist.
- **Statistik:** Klickanzahl und zuletzt geöffnet werden pro URL gezählt. Sie dienen als optionales
  Badge (in den Board-Einstellungen an/aus) und als Gewichtung in der Suche.

---

## 7. Hintergrund und Liquid Glass

### 7.1 Schichten

```
┌─────────────────────────────────────────────┐
│ DOM (Svelte): Panels transparent, nur Inhalt │  z-index 1+
├─────────────────────────────────────────────┤
│ <canvas> WebGL2, fullscreen, fixed           │  z-index 0
│   Pass 1: Szene (Video/Bild/Shader-Verlauf)  │
│           + Tageszeit-Grading + Crossfade    │
│   Pass 2: Blur-Mip-Kette (Dual-Kawase)       │
│   Pass 3: Composite – Glasflächen            │
└─────────────────────────────────────────────┘
```

- Das DOM liegt transparent über dem Canvas. Glas-Panels zeichnen im DOM **keinen** Hintergrund,
  sondern registrieren sich beim Glas-Layer.
- Registrierung per Svelte-Attachment, z. B. `<section {@attach glass({ radius: 24, depth: 1 })}>`.
  Der Layer kennt so für jede Fläche Rechteck, Eckenradius, Z-Reihenfolge und Variante (Panel, Popover, Button).
- **Rect-Synchronisation:**
  - Im Ruhezustand ist sie ereignisgetrieben über `ResizeObserver`, Spalten-Scroll, Fenster-Resize
    und Layout-Änderungen.
  - Während Animationen oder Drag liest der Layer die Rects pro Frame (Flag „animating“).
  - Es gibt keine fortlaufenden `getBoundingClientRect`-Aufrufe im Leerlauf.
- Maximal ~64 Flächen. Die Daten gehen per Uniform-Buffer oder Daten-Textur an den Shader.
- Inhärente Grenze: Das Glas bricht nur die **Hintergrundszene**, nicht den DOM-Inhalt darunter
  liegender Panels. Überlappende Flächen (Popover über Panel) werden in Z-Reihenfolge composited.
  Hinter Dialogen dimmt ein Scrim die Szene, das ist ein Shader-Uniform.

### 7.2 Glas-Shader (Composite-Pass)

Pro Pixel innerhalb einer Fläche (Rounded-Rect bzw. Squircle als SDF) wird Folgendes berechnet:

1. **Höhenprofil/Normale** aus der SDF. Die Fläche ist in der Mitte flach, zum Rand hin gibt es
   einen gewölbten Bevel (Breite ~16–28 px, abhängig von `depth`).
2. **Refraktion:** Die Szene wird versetzt entlang der Normalen abgetastet, sodass der Effekt am Rand stark ist.
3. **Dispersion:** R, G und B werden mit leicht unterschiedlichem Brechungsindex abgetastet, was am
   Rand zu dezenten Farbsäumen führt.
4. **Frost:** Je nach `glass.frost` wird zwischen scharfer und geblurrter Szene (Mip-Level) gemischt.
   Mehr Frost bedeutet bessere Lesbarkeit.
5. **Tönung:** Ein leichter Tint aus Phase/Akzent, plus Aufhellung oder Abdunklung je nach
   Szenen-Luminanz unter der Fläche (adaptiv, damit Text immer Kontrast hat).
6. **Fresnel-Rand + Specular:** Ein Glanzlicht an der Kante. Die Lichtrichtung ergibt sich aus der
   Tageszeit und, falls aktiviert, dezent aus der **Mausposition** (Feder-geglättet, nie abrupt).
7. **Schatten:** Ein weicher Kontaktschatten unter der Fläche wird im Shader gezeichnet.

Die Shader-Parameter sind als Konstanten zentral gebündelt, damit sie sich leicht feinjustieren
lassen. Ein Debug-Panel (nur im Dev-Build, z. B. `?debug`) bietet Slider für alle Glas-Parameter und eine FPS-Anzeige.

### 7.3 Hintergrundquellen

- **Shader-Verlauf (Default ohne Upload):** Ein ruhiger, langsam animierter Himmelsverlauf im Aero-Stil
  (Blau → Cyan → Horizontlicht, sehr weiche Bewegung, kein Rauschen-Flimmern). Er folgt der Tageszeit
  (Morgenrot, Mittag, Abendgold, Nachtblau). Er kommt ohne Assets aus.
- **Eigene Datei:** Bild (jpg/png/webp/avif) oder Video (mp4/webm). Der Upload geht per Dateiauswahl
  oder Drag & Drop auf den Einstellungsbereich und wird in IndexedDB gespeichert.
  - Größenlimit mit Warnung ab ~200 MB.
  - Videos laufen stumm, als Loop und `playsinline`, Updates per `requestVideoFrameCallback`.
  - Bilder werden einmal als Textur hochgeladen.
- **Slots pro Tageszeit:** Optional ein eigener Hintergrund pro Phase. Beim Phasenwechsel wird
  weich übergeblendet (~2 s Crossfade im Shader). Leere Slots verwenden `main`.
- **Color-Grading (abschaltbar):** Abhängig von der Phase wird im Shader eingefärbt:
  - Morgen: warm und leicht entsättigt
  - Tag: neutral
  - Abend: golden/orange
  - Nacht: dunkelblau, abgedunkelt
  Übergänge werden kontinuierlich interpoliert, nicht gestuft. Die Glas-Tönung und die UI-Tokens
  (Textfarbe auf Glas, Schatten) folgen der Phase. Dieser Mechanismus ersetzt einen klassischen Dark Mode.
- Die Phasengrenzen sind konfigurierbar (Defaults siehe Schema). Die aktuelle Phase plus ein
  Übergangsfaktor wird als reaktiver Wert bereitgestellt, den auch das CSS nutzt (Custom Properties).

### 7.4 Qualitätsstufen und Fallback

| Stufe      | Inhalt                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **High**   | Volle Auflösung (bis DPR 2), Refraktion + Dispersion + Specular + Mauslicht, Video mit nativer Framerate |
| **Medium** | Szene/Blur in halber Auflösung, keine Dispersion, Video max. 30 fps                                     |
| **Low**    | Weiterhin WebGL, aber nur Frost + Rand-Glanz, kein Mauslicht, Video max. 24 fps                         |
| **Static** | **Kein WebGL.** CSS-Fallback: Hintergrund als `<img>`/Video-Posterframe, Panels mit `backdrop-filter: blur() saturate()`, Gradient-Glanzkante, keine Animation |

- **Auto:** Die Page startet auf High und misst die Frame-Zeit über ein rollierendes Fenster
  (~2 s). Liegt der Durchschnitt über ~22 ms, wird um eine Stufe gesenkt. Innerhalb einer Sitzung
  gibt es kein automatisches Hochstufen. Die zuletzt stabile Stufe wird pro Rechner gemerkt und
  beim nächsten Öffnen als Startpunkt verwendet.
- `prefers-reduced-motion`: Video pausiert (Standbild), Shader-Verlauf statisch, kein Mauslicht,
  keine Feder-Animationen (nur Opacity-Übergänge). Das Glas selbst bleibt (statisch gerendert).
- WebGL2 nicht verfügbar oder Kontextverlust nicht wiederherstellbar → Static.
  `webglcontextlost`/`restored` wird sauber behandelt.
- **Immer:** Ist der Tab unsichtbar (`visibilitychange`), stoppt die Render-Schleife und das Video
  pausiert. Ohne Video, Mausbewegung und Animation rendert der Layer nur bei Änderungen
  (On-Demand-Rendering) bzw. mit stark reduzierter Rate für den langsamen Shader-Verlauf (~15 fps).

---

## 8. Visuelles System

- Tokens als CSS Custom Properties: Akzent (aus einem Hex wird per **OKLCH** eine kleine Palette
  abgeleitet: Hover, Pressed, Subtle, Text-on-Accent), Text auf Glas (primär/sekundär),
  Radien, Abstände (4-px-Raster), Schatten, Schriftgrößen, Easing/Federn.
- Die Tokens ändern sich mit der Tageszeit-Phase. Text auf Glas ist z. B. tagsüber dunkel und nachts hell.
- Schrift: Figtree Variable, mitgeliefert, `font-display: block` (lokal, also sofort verfügbar).
- Fokus: ein deutlicher Fokusring in Akzentfarbe mit Abstand, nur bei `:focus-visible`.
- Kontrast: Text auf Glas muss WCAG AA erreichen. Das wird über Frost und adaptive Tönung
  sichergestellt und manuell mit einem hellen und einem dunklen Testbild geprüft.
- Interaktions-Feedback: Hover hebt die Glasfläche leicht an (stärkerer Rand-Glanz, minimal mehr
  Schatten). Beim Drücken drückt sie ein. Das wird über Shader-Parameter pro Fläche gesteuert,
  nicht über CSS-Transforms auf großen Panels.

---

## 9. Internationalisierung

- Eigene kleine i18n-Lösung: typisierte Wörterbücher `de.ts`/`en.ts` (gleiche Keys, der Compiler
  prüft auf Vollständigkeit), eine Funktion `t(key, params)` und Pluralformen über `Intl.PluralRules`.
- `language: 'auto'` übernimmt die Sprache aus `browser.i18n.getUILanguage()` bzw. `navigator.language`. Fallback ist EN.
- Datum, Uhrzeit und Wochentage werden über `Intl` mit der gewählten Sprache formatiert.
- Sprachwechsel wirkt sofort ohne Reload.

---

## 10. Qualität und Tests

- **Unit-Tests (Pflicht):** Config-Validierung und Migrationen, Import/Export, Bang-Parsing,
  Fuzzy-Link-Suche, Feiertage (mehrere Jahre und Bundesländer), Kalenderraster und ISO-KW,
  Layout-Operationen (verschieben, Spaltenanzahl ändern, responsives Zusammenlegen),
  Phasenberechnung/Interpolation, Akzent-Palette, Qualitäts-Auto-Logik (mit simulierten Frame-Zeiten).
- **Komponententests** (wo sinnvoll): Link-Board-Tastaturnavigation, Edit-Modus-Toggle, Suche-Dropdown.
- **Manuelle Checkliste** pro Meilenstein in `docs/checklist.md`: `web-ext run`, neuer Tab,
  Startseite, Upload Bild/Video, Reduced Motion, Static-Stufe, Tastaturbedienung komplett ohne Maus.
- `pnpm check && pnpm lint && pnpm test && pnpm ext:lint` müssen grün sein.
- Barrierefreiheit:
  - Semantische Landmarks und Dialoge (`<dialog>`), Fokus-Falle in Dialogen, `aria-live` für Toasts.
  - Alles muss per Tastatur erreichbar sein.
  - Das Canvas ist `aria-hidden`.

---

## 11. Roadmap (nicht v1)

Die Architektur (Widget-Registry, `optional_host_permissions`, Storage-Adapter) muss diese Punkte
ohne Umbau ermöglichen:

- **RSS:** Feeds hinzufügen. Beim Hinzufügen wird die Host-Permission der Feed-Origin zur Laufzeit
  angefragt. Gecacht wird in `storage.local`, aktualisiert nach Intervall.
- **Notizen:** ein oder mehrere Notizfelder pro Instanz (Plaintext/Markdown light), Autosave.
- **Termine:** kommende Termine aus einer ICS-URL (Permission zur Laufzeit) oder als manuelle Einträge.
- Weitere Ideen: Sonnenauf- und -untergangszeiten aus manuell eingegebenem Standort für die Phasen,
  Sync über Firefox Sync oder eigenen Server, mehrere Profile, Lesezeichen-Import, Custom CSS.

---

## 12. Übernahme aus dem alten Projekt

Aus `../startpage` (Referenz, nicht kopieren ohne Prüfung):

- `src/lib/widgets/link-board/link-data.ts`: Validierung, `faviconUrl`, `displayHost` und Stats-Parsing
  als Ausgangspunkt (an das neue Schema anpassen).
- `src/lib/widgets/calendar/month-grid.ts` (+ Spec): 6-Wochen-Raster.
- `src/lib/utils/storage.ts`: Idee des fehlertoleranten Adapters.
- Link-Board-Komponenten (Kapsel, Kachel, Zeile, Dialog, Kontextmenü): als funktionale Referenz.
  Das Styling wird komplett neu gemacht.

Aus `../startpage-old`: das Extension-Setup (Scripts für `web-ext`, `chrome_url_overrides`) als Referenz.

Verworfen werden das Steam-Theme, `ds.css`, SvelteKit und die Config-Datei im Code.

---

## 13. Meilensteine

Die Reihenfolge ist so gewählt, dass früh eine **benutzbare** Page existiert (zunächst mit
CSS-Glas) und der aufwendige WebGL-Teil danach kommt. Jeder Meilenstein endet mit grünen Checks
und einem Commit.

1. **M0 – Gerüst:** Vite + Svelte 5 + TS, Lint/Format/Test, `manifest.json`, `web-ext`-Scripts,
   leere Newtab-Page läuft in Firefox. Schrift eingebunden.
2. **M1 – Daten und Grundlagen:** Storage-Adapter, Config-Schema, Validierung, Migrationen,
   Default-Config, i18n, Tab-übergreifende Synchronisation, Export/Import/Backups.
3. **M2 – Layout und Edit-Modus:** Spalten, Panels (vorerst CSS-Glas = Static-Stufe),
   Widget-Registry, Edit-Modus, DnD inklusive Tastatur, globale Einstellungen (Grundgerüst), Toasts mit Undo.
4. **M3 – Widgets:** Uhr, Kalender inklusive Feiertage und KW, Suche inklusive Engines, Bangs und
   Link-Vorschlägen, Link-Board inklusive Tabs, Ansichten, DnD, Kontextmenü, Tastatur, Statistik.
   **→ Ab hier im Alltag nutzbar.**
5. **M4 – Hintergrund:** Uploads (Bild/Video) in IndexedDB, Slots, Fokuspunkt/Fit, Static-Darstellung
   mit Bild/Video, Tageszeit-Phasen und CSS-Token-Anpassung.
6. **M5 – WebGL-Glas:** Canvas-Layer, Szenen-Pass inklusive Shader-Verlauf, Grading und Crossfade,
   Blur-Kette, Composite mit Refraktion, Dispersion, Fresnel und Schatten, Glas-Attachment,
   Rect-Sync, Debug-Panel.
7. **M6 – Feinschliff:** Mauslicht, Hover/Press über Shader, Qualitätsstufen + Auto, Reduced Motion,
   Kontextverlust, Performance-Messung auf beiden Rechnern, Kontrast-Check.
8. **M7 – Auslieferung:** `ext:sign` (unlisted), README mit Installationsanleitung (.xpi), Versionierung.

---

## 14. Entscheidungen zu ehemals offenen Punkten

- Gecko-ID: `firefox-startpage@stampf`. Der Anzeigename ist davon unabhängig und kommt aus `_locales`.
- AMO-Account ist vorhanden. API-Keys (JWT issuer/secret) gibt es im Developer Hub unter „Manage API Keys“.
- Der Arbeitsrechner ist ein MacBook M4 Pro. Signierte Add-ons sollten installierbar sein. Die
  Qualitätsstufen bleiben trotzdem drin, für Akkubetrieb und ältere Rechner.
- Schrift: Figtree.
- Default-Akzentfarbe: Aero-Blau.
