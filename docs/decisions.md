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
