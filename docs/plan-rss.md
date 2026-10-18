# Plan: Zeilenhöhe im Layout und RSS-Widget

Status: **Entwurf, wartet auf Freigabe.** Grundlage sind SPEC.md §3, §4, §5, §6 und §11 sowie
`docs/decisions.md`. Sobald gebaut ist, wandern die Entscheidungen aus diesem Plan nach
`docs/decisions.md` (Abschnitte „Nach v1 – Zeilenhöhe“ und „Nach v1 – RSS-Widget“). Diese Datei
wird danach gelöscht.

Zuerst kommt die Zeilenhöhe als eigener Baustein (Teil A, Meilenstein L1, **erledigt**, siehe
`docs/decisions.md` „Nach v1 – Höchsthöhe pro Zeile“). Sie hilft allen
Widgets, und das RSS-Widget (Teil B) baut darauf auf.

## Getroffene Wahl (mit der nutzenden Person abgestimmt)

| Frage          | Wahl                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| Höhe           | Höchsthöhe pro Zeile, Standard „Automatisch“, Inhalt scrollt im Panel          |
| Einheit        | rem in 2er-Schritten, wie die maximale Breite                                  |
| Host-Rechte    | pro Feed-Origin, zur Laufzeit beim Hinzufügen                                  |
| Darstellung    | gemischte, chronologische Liste; seit Teil C pro Tab (Kategorie)               |
| Gelesen        | Punkt und fette Schrift für ungelesen, „Alle als gelesen“, optional ausblenden |
| Aktualisierung | nur aus der offenen Newtab-Page, kein Hintergrundskript                        |
| Titelbilder    | klein rechts in der Zeile, pro Widget einschaltbar, Standard aus               |

Wer Feeds getrennt sehen will, platziert mehrere RSS-Widgets. Das erlaubt die Registry ohnehin.

---

# Teil A – Zeilenhöhe im Layout

## A1. Verhalten

- **Pro Zeile, nicht pro Widget:** Widgets einer Zeile sind gleich hoch, sie werden auf das
  höchste gestreckt („Gleich hohe Panels“ in `decisions.md`). Eine Höchsthöhe pro Widget würde dem
  widersprechen, weil ein Nachbar das Panel wieder über seine Grenze strecken würde. Steht ein
  Widget allein in seiner Zeile, ist die Zeilenhöhe seine Höhe.
- **Höchsthöhe:** Die Zeile ist so hoch wie ihr höchster Inhalt, aber nicht höher als `maxHeight`.
  Ist der Inhalt kleiner, bleibt die Zeile kleiner. Ist er größer, scrollt der Inhalt **im
  Panel**. Kopf und Edit-Leiste des Panels bleiben dabei stehen. Ohne Wert gilt „Automatisch“, also
  das heutige Verhalten.
- **Wertebereich:** 12–80 rem in 2er-Schritten. Unter 12 rem passt kaum ein Widget sinnvoll, über
  80 rem ist die Grenze auf keinem üblichen Bildschirm mehr sichtbar.
- **Scrollen im Panel:** `.content` in `WidgetPanel.svelte` ist schon eine Flex-Spalte. Mit
  Höchsthöhe bekommt es `min-height: 0` und `overflow-y: auto`. Die Scrollleiste ist schmal
  (`scrollbar-width: thin`) und nutzt Farb-Tokens. Weiche Kanten oben und unten
  (`mask-image`, wie bei der Tagesliste im Kalender) zeigen, dass es weitergeht. Sie erscheinen nur,
  wenn wirklich gescrollt werden kann. Das Mausrad gibt am Ende an die Page weiter
  (`overscroll-behavior` bleibt `auto`).
- **Widgets mit eigenem Scrollbereich:** Die Registry bekommt das optionale Feld
  `scrollsSelf?: boolean`. Ist es gesetzt, scrollt nicht das ganze Panel. Das Widget bekommt
  stattdessen die verfügbare Höhe als Flex-Kind (`min-height: 0`) und scrollt selbst nur einen
  Teil. RSS nutzt das: Der Kopf mit Titel und Buttons bleibt stehen, nur die Liste scrollt.
- **Uhr:** Sie füllt weiterhin die Höhe, wenn ein Nachbar sie streckt. Ist die Höchsthöhe kleiner
  als ihr Inhalt, scrollt sie wie jedes andere Widget.
- **Responsiv:** Stehen die Widgets einer Zeile auf schmalen Fenstern untereinander, gilt die
  Höchsthöhe für jedes Widget einzeln.
- **Glas:** Die Panel-Rechtecke ändern sich nur über die Höhe, das meldet der `ResizeObserver`
  ohnehin. Scrollen im Panel verschiebt keine Glasflächen, der Layer muss dafür also nichts neu
  lesen.
- **Fokus:** Wird ein Element im Panel fokussiert, das außerhalb des sichtbaren Bereichs liegt,
  scrollt es mit `block: 'nearest'` in den Blick, bei Reduced Motion ohne Animation. Das Link-Board
  und der Kalender profitieren davon ohne Änderung.

## A2. Bedienung im Edit-Modus

- An der Unterkante jeder Zeile sitzt ein waagerechter Griff, im Stil der bestehenden
  Breiten-Trenner (`PanelRow.svelte`): eine Pille, die beim Hover wächst, mit großer Trefferfläche
  und `cursor: row-resize`.
- **Ziehen:** Die Höhe rastet in 2-rem-Schritten ein. Während des Ziehens wird die Zeile genau so
  hoch gezeigt, wie gezogen wird, auch wenn der Inhalt kleiner ist. Ein Etikett zeigt den Wert
  („max. 32 rem“). Nach dem Loslassen gilt er als Höchsthöhe. Zieht man über 80 rem hinaus, wird
  „Automatisch“ gesetzt.
- **Zurücksetzen:** Ein Doppelklick auf den Griff setzt die Zeile auf „Automatisch“.
- **Tastatur:** Der Griff ist ein `role="separator"` mit `aria-orientation="horizontal"`,
  `aria-valuenow` und `aria-valuetext` („Höchstens 32 rem“ bzw. „Automatisch“). `↑`/`↓` ändern um
  2 rem, `Pos1` setzt 12 rem, `Ende` und `Entf` setzen „Automatisch“. Beim ersten Pfeil von
  „Automatisch“ aus wird von der aktuell gezeigten Höhe aus gerechnet.
- Ansagen laufen über die bestehende `aria-live`-Region, wie beim Verschieben.

## A3. Schema und Operationen

- `LayoutRow` bekommt das optionale Feld `maxHeight?: number` (rem). Fehlt es, gilt „Automatisch“.
- **Kein Schema-Sprung:** Das Feld ist additiv, wie `columnGap`, `tileSize` oder die Koordinaten der
  Uhr. Die Validierung (`normalizeColumnRows`) klemmt den Wert auf 12–80, rastet ihn auf 2er-Schritte
  ein und verwirft Ungültiges, ohne zu werfen. `CONFIG_VERSION` bleibt 4.
- **Layout-Operationen:**
  - Wird ein Widget neben eine Zeile gelegt, behält die Zeile ihre Höhe.
  - Wird ein Widget aus einer Zeile gelöst und bildet eine eigene Zeile, ist diese neue Zeile
    „Automatisch“. Die alte Zeile behält ihre Höhe.
  - Verschwindet das letzte Widget einer Zeile, verschwindet die Zeile samt Höhe.
  - Beim Ausschalten einer Seite wandern deren Zeilen samt Höhe in die Mitte.
- Export, Import und Backups nehmen das Feld automatisch mit, weil es in der Config steht.

## A4. Tests

- Validierung: fehlend, zu klein, zu groß, krumme Werte, Strings, `NaN`.
- Layout-Operationen: Höhe bleibt beim Danebenlegen, neue Zeilen starten mit „Automatisch“, Seite
  ausschalten, Zeile löschen.
- Reine Funktion für den Griff: aus Ziehweg, Startwert und Rastung den neuen Wert berechnen,
  inklusive Wechsel zu „Automatisch“ am oberen Ende.
- Komponententest: Tastaturbedienung des Griffs, `aria-valuetext`, Doppelklick setzt zurück. Mit
  gesetzter Höhe hat der Inhalt `overflow-y: auto`, bei `scrollsSelf` nicht.
- Manuelle Checkliste: WebGL- und Static-Stufe, schmales Fenster mit untereinander stehenden
  Widgets, Mausrad am Ende des Panels, Reduced Motion.

---

# Teil B – RSS-Widget

## B1. Abruf

- **Aus der Newtab-Page, ohne Background-Script.** Die Page ist eine Extension-Page. Hat die
  Extension das Host-Recht für eine Origin, gilt für `fetch` dorthin kein CORS. Ein
  Hintergrundskript, eine Message-Schicht oder `alarms` sind dafür nicht nötig.
- **Manifest:** `optional_host_permissions: ['https://*/*']`. `permissions` bleibt bei
  `storage` und `unlimitedStorage`. Bei der Installation und beim Update fragt Firefox also
  nichts zusätzlich. Es gibt keine `host_permissions`.
- **Nur https:** Die Standard-CSP von MV3 für Extension-Pages in Firefox enthält
  `upgrade-insecure-requests`. Ein `http://`-Feed würde also ohnehin auf https gehoben. Eingaben
  mit `http://` werden darum auf `https://` umgeschrieben, mit Hinweis. Feeds, die nur per http
  erreichbar sind, gehen nicht. Im Spike (R0) wird das geprüft.
- **Rechte-Muster:** Angefragt wird `https://*.<host>/*`, wobei ein führendes `www.` vom Host
  entfernt wird. Für `www.heise.de` heißt das `https://*.heise.de/*`. Das Muster deckt `heise.de`,
  `www.heise.de` und z. B. `feeds.heise.de` ab, also die häufigste Umleitung (mit/ohne `www`).
  Eine Public-Suffix-Liste wird dafür nicht gebraucht.
- **Anfrage im Klick:** `permissions.request()` muss in Firefox direkt im Handler einer
  Nutzeraktion laufen. Davor darf kein `await` stehen. Ablauf im Dialog „Feed hinzufügen“:
  URL normalisieren (synchron), dann `request()` als erstes, erst danach abrufen und prüfen.
  Lehnt die Person ab, wird der Feed nicht angelegt, und eine kurze Meldung erklärt, warum.
- **Feed-Suche:** Trägt man eine Website statt eines Feeds ein, wird deren HTML (gleiche Origin,
  also gleiches Recht) nach `<link rel="alternate" type="application/rss+xml|atom+xml|feed+json">`
  durchsucht. Findet sich ein Feed, wird er übernommen. Gibt es mehrere, wählt man aus einer Liste.
  Liegt der Feed auf einer fremden Origin, braucht es einen zweiten Klick („Zugriff auf … erlauben“),
  weil die Geste des ersten Klicks dann verbraucht ist.
- **Umleitung auf fremde Origin:** Ohne Recht für das Ziel scheitert `fetch` wie bei einem
  Netzwerkfehler. Darum wird bei einem Fehler einmal mit `redirect: 'manual'` nachgefragt. Kommt
  eine `opaqueredirect`-Antwort, meldet das Widget „Feed leitet auf eine andere Seite um, bitte die
  endgültige Adresse eintragen“. Das Ziel lässt sich so nicht auslesen. Im Spike wird geprüft, ob
  Firefox sich so verhält.
- **Anfrage selbst:** `credentials: 'omit'` (keine Cookies der Seite), `referrerPolicy` auf
  `no-referrer`, `cache: 'no-cache'` plus `If-None-Match`/`If-Modified-Since` aus dem Cache
  (304 heißt: nur `fetchedAt` erneuern). Zeitlimit 20 s per `AbortController`. Höchstens 5 MB:
  Der Stream wird gelesen und bei Überschreitung abgebrochen.
- **Zeichensatz:** `Response.text()` dekodiert immer als UTF-8. Gelesen wird deshalb als
  `ArrayBuffer` und mit `TextDecoder` dekodiert. Der Zeichensatz kommt aus `Content-Type`, sonst
  aus der XML-Deklaration bzw. dem BOM, sonst UTF-8. Das betrifft z. B. ältere Feeds in ISO-8859-1.
- **Rechte entzogen:** In `about:addons` lassen sich optionale Rechte abschalten. Vor jedem Abruf
  wird deshalb `permissions.contains()` geprüft. Zusätzlich hört die Page auf
  `permissions.onAdded/onRemoved`. Fehlt ein Recht, zeigt das Widget „Zugriff erlauben“. Ein Klick
  fragt alle fehlenden Origins des Widgets in einer einzigen Anfrage an. Das deckt auch einen
  Import auf einem anderen Rechner und das Wiederherstellen eines Backups ab.
- **Rechte abgeben:** Beim Laden der Page und nach Änderungen an den Feeds werden Origins, die
  kein Feed der aktuellen Config mehr braucht, per `permissions.remove()` freigegeben. Das passiert
  nicht sofort beim Entfernen, damit der Rückgängig-Toast ohne neue Abfrage funktioniert.
- **Dev-Server:** Außerhalb der Extension gibt es keine Rechte und es gilt CORS. Eine Middleware
  nur für den Dev-Server (`configureServer` in `vite.config.ts`, `/__dev/feed?url=…`) leitet den
  Abruf weiter. Der Rechte-Helfer meldet dort immer „erlaubt“. Im Build fehlt beides.
- **Registry-Feld `permissions`:** Es bleibt ungenutzt. Es beschreibt feste Rechte beim Hinzufügen
  des Widgets, die Origins von RSS ergeben sich aber erst aus den Feeds. Ein RSS-Widget lässt sich
  ohne jede Abfrage hinzufügen, die Abfrage kommt mit dem ersten Feed.

## B2. Formate und sichere Darstellung

- **Formate:** RSS 2.0, RSS 1.0 (RDF), Atom 1.0 und JSON Feed 1.0/1.1. XML wird mit
  `DOMParser('application/xml')` gelesen, ein `<parsererror>` gilt als Fehler „kein gültiger
  Feed“. JSON Feed wird per `JSON.parse` erkannt (Feld `version` beginnt mit
  `https://jsonfeed.org/version/`). Namespaces werden über `localName` gelesen, damit
  Präfix-Varianten (`atom:link`, `dc:date`, `content:encoded`, `media:thumbnail`) funktionieren.
- **Felder pro Eintrag:** `id` (guid / Atom-`id` / JSON-`id`, sonst Link, sonst Hash aus Titel und
  Datum), `title`, `url`, `published` (ms oder `null`), `summary`, `image` (URL oder `null`).
  Daten werden aus RFC 822, RFC 3339 und `dc:date` gelesen. Unlesbare Daten werden zu `null`, das
  Parsen wirft nie.
- **Kein HTML aus dem Feed im DOM:** Titel und Zusammenfassung werden schon beim Parsen in reinen
  Text verwandelt: Ein inertes Dokument per `DOMParser('text/html')` (keine Skripte, kein Laden von
  Ressourcen), davon `textContent`, Leerraum zusammengefasst, gekürzt (Titel 300, Text 280
  Zeichen). Im Cache steht nur noch Text. Svelte gibt ihn als Textknoten aus. `{@html}` wird nicht
  verwendet. Das prüft ein Test, der nach `@html` in `widgets/rss` sucht.
- **Links:** Relativ zur Feed-Adresse bzw. `xml:base` aufgelöst. Erlaubt sind nur `https:` und
  `http:`, alles andere (`javascript:`, `data:` …) wird verworfen, dann ist der Eintrag nicht
  klickbar. Geöffnet wird mit `rel="noopener noreferrer"` und `referrerpolicy="no-referrer"`.
- **Titelbilder:** Die Bild-URL wird beim Parsen immer ermittelt, damit das Einschalten sofort
  wirkt und keinen neuen Abruf braucht. Quellen in dieser Reihenfolge:
  1. `media:thumbnail`, dann `media:content` mit `medium="image"` oder `type="image/*"` (auch in
     `media:group`). Bei mehreren Größen gewinnt die kleinste mit mindestens 144 px Breite, sonst die
     größte.
  2. `enclosure` bzw. Atom-`link rel="enclosure"` mit `type="image/*"`.
  3. `itunes:image`.
  4. JSON Feed: `image`, dann `banner_image`.
  5. Sonst das erste `<img src>` aus dem HTML-Inhalt. Das wird aus dem inerten Dokument gelesen,
     dabei werden nur Attribute angesehen und nichts geladen. Bilder mit `width` oder `height` ≤ 2
     gelten als Tracking-Pixel und werden übersprungen.

  Erlaubt sind nur http(s)-URLs, relativ aufgelöst, `http` wird zu `https`. `data:`-,
  `javascript:`- und `blob:`-URLs werden verworfen.

- **Favicons:** Das Icon pro Zeile ist das Favicon der Website des Feeds, über den bestehenden
  `favicons.svelte.ts` (ohne Host-Rechte, mit Gedächtnis).
- **Sprache:** Gibt der Feed eine Sprache an (`<language>`, `xml:lang`, JSON `language`), bekommt
  die Zeile ein `lang`-Attribut. Das hilft Screenreadern.

## B3. Cache und Aktualisierung

- **Ort:** `storage.local`, getrennt von der Config, wie `stats`. Exporte bleiben dadurch stabil,
  und Feed-Inhalte landen nicht in Backups.
  - `feeds`: pro Feed-URL `{ fetchedAt, etag, lastModified, title, siteUrl, language, items, error,
retryAt }`. Pro Feed werden höchstens 50 Einträge gehalten. `error` ist `{ code, at, attempts }`
    oder `null`.
  - `feedReads`: pro Feed-URL die IDs der gelesenen Einträge. Der Schlüssel ist getrennt, damit
    „gelesen“ nicht jedes Mal den ganzen Cache neu schreibt.
- Beide Schlüssel laufen über `SyncedValue` (debounced, Tab-Sync über `storage.onChanged`) und
  werden beim Lesen validiert wie die Config. Gelesen-IDs von Einträgen, die nicht mehr im Cache
  stehen, werden beim Abruf entfernt. Cache-Einträge von Feeds, die in keinem Widget mehr stehen,
  verschwinden beim Laden der Page. Bilder selbst werden nicht gecacht, nur ihre URLs. Das Laden
  übernimmt der HTTP-Cache des Browsers.
- **Intervall:** pro Widget wählbar: 15 min, 30 min, 1 h, 3 h, 6 h. Standard ist 30 min. Steht ein
  Feed in mehreren Widgets, gilt das kürzeste Intervall.
- **Zeitpunkte:** beim Öffnen der Page, wenn ein Feed veraltet ist, danach per Timer, solange die
  Page sichtbar ist, und sofort beim Zurückkehren (`visibilitychange`), wenn inzwischen etwas
  veraltet ist. Hintergrund-Tabs rufen nichts ab. Damit mehrere offene Tabs nicht doppelt abrufen,
  trägt der abrufende Tab eine kurze Sperre (`lockUntil`, 60 s) in den Cache-Eintrag ein. Ein
  doppelter Abruf wäre aber nur unnötig, nicht schädlich. Der Button „Aktualisieren“ im Widget
  übergeht das Intervall, nicht aber eine laufende Sperre.
- **Fehler:** Pro Feed gilt ein Backoff: Nach einem Fehler wird erst nach dem doppelten Intervall
  erneut versucht, höchstens nach 24 h. `429` und `503` mit `Retry-After` werden beachtet.
  Fehlercodes: `offline`, `permission`, `network`, `redirect`, `http` (mit Status), `parse`,
  `tooLarge`, `timeout`. Die letzten gültigen Einträge bleiben immer stehen.
- **Offline:** Bei `navigator.onLine === false` wird gar nicht erst abgerufen. Das Widget zeigt den
  Cache mit dem Stand („Stand: vor 3 Std.“). Beim Ereignis `online` werden veraltete Feeds
  sofort abgerufen.

## B4. Darstellung

- **Eine gemischte Liste:** Alle Einträge aller Feeds des Widgets, neueste zuerst, höchstens
  `maxItems`. Einträge ohne Datum bekommen das Datum des ersten Abrufs, in dem sie auftauchten.
  So rutschen sie nicht dauerhaft nach oben oder unten. Gleiche Links aus zwei Feeds erscheinen
  nur einmal.
- **Höhe:** Das Widget setzt `scrollsSelf` (Teil A). Mit Höchsthöhe der Zeile bleibt der Kopf
  stehen, und nur die Liste scrollt. Ohne Höchsthöhe ist die Liste so lang wie `maxItems`. In den
  Widget-Einstellungen weist ein Satz darauf hin, dass sich die Höhe im Edit-Modus an der
  Unterkante der Zeile einstellen lässt.
- **Zeile:** wie die Listen-Ansicht des Link-Boards. Links das Favicon der Quelle (16 px, Fallback
  Anfangsbuchstabe auf Akzent). Daneben der Titel (höchstens zwei Zeilen, ausgeglichen umbrochen)
  und eine Meta-Zeile mit Quelle und relativer Zeit („vor 2 Std.“, das volle Datum im Tooltip).
  Optional folgt eine Zeile Zusammenfassung. Ungelesen: Akzentpunkt vor dem Titel und Gewicht 600.
  Gelesen: sekundäre Textfarbe. Der Unterschied ist damit auch ohne Farbe erkennbar (Punkt und
  Gewicht), und alle Farben kommen aus den bestehenden Tokens, damit Tag und Nacht AA erreichen.
- **Titelbild (wenn eingeschaltet):** rechts in der Zeile, 72 × 48 px, abgerundet mit dem
  Radius-Token, `object-fit: cover`, Platzhalter-Fläche `--field`, bis es geladen ist. Der Platz wird
  nur reserviert, wenn der Eintrag ein Bild hat, damit nichts springt. `<img loading="lazy"
decoding="async" referrerpolicy="no-referrer" alt="">`: Das Bild ist Schmuck, der Titel daneben
  sagt alles. Bei Ladefehler oder wenn es schmaler als 40 px ist, fällt das Feld weg. Die URL wird
  für die Sitzung gemerkt, damit sie nicht erneut versucht wird. In schmalen Panels (Container
  Query unter ~18 rem) schrumpft es auf 56 × 40 px. Wegen `loading="lazy"` laden in einer
  scrollenden Liste nur die sichtbaren Bilder.
- **Kopf:** optionaler Titel des Widgets. Rechts die Icon-Buttons „Alle als gelesen markieren“ und
  „Aktualisieren“ (mit Stand im Tooltip). Läuft ein Abruf, dreht sich das Icon. Bei Reduced Motion
  dreht es sich nicht, dann pulsiert die Deckkraft.
- **Fuß bei Problemen:** „1 Feed nicht erreichbar“ mit Warn-Icon. Ein Klick öffnet ein Popover mit
  dem Grund je Feed und, falls passend, „Zugriff erlauben“ oder „Erneut versuchen“. Der Fuß bleibt
  wie der Kopf stehen, wenn die Liste scrollt.
- **Leere Zustände:** Ohne Feeds steht „Noch keine Feeds“ mit dem Button „Feed hinzufügen“, der die
  Widget-Einstellungen öffnet. Fehlen Rechte, kommt „Zugriff erlauben“. Ist alles gelesen und
  ausgeblendet, steht „Alles gelesen“.
- **Gelesen:** Öffnen markiert den Eintrag als gelesen, egal ob per Klick, Mittelklick oder `Enter`.
  Ein Kontextmenü (bestehendes `Menu`) bietet Öffnen, In neuem Tab öffnen, Als gelesen/ungelesen
  markieren und Link kopieren. Der Status gilt pro Feed, also in allen Widgets mit diesem Feed.
  Beim ersten Abruf eines neuen Feeds ist alles ungelesen.
- **Ziel:** Ein Klick öffnet im selben Tab, wie bei Links mit Standardziel. `Strg/Cmd`+Klick und
  Mittelklick öffnen nativ in einem neuen Tab, weil die Einträge echte `<a href>` sind.
- **Glas:** Das Widget ist ein normales Panel ohne eigene Glasflächen. Es streckt sich nicht in der
  Höhe, wenn ein Nachbar höher ist (wie andere Widgets außer der Uhr).

## B5. Config-Schema

Neuer Widget-Typ `rss` in `WidgetSettingsMap`, `widgets/settings.ts` und `registry.ts`. Icon `rss`
kommt neu in `ui/icons.ts`.

```ts
type RssFeed = {
	id: string;
	/** Normalisierte https-URL des Feeds */
	url: string;
	/** Eigener Name; leer = Titel aus dem Feed */
	name: string;
};

type RssSettings = {
	/** Überschrift im Widget; leer = keine */
	title: string;
	feeds: RssFeed[]; // höchstens 20
	maxItems: number; // 5–50, Schritt 1, Standard 20
	intervalMinutes: 15 | 30 | 60 | 180 | 360; // Standard 30
	showSummary: boolean; // Standard aus
	showImages: boolean; // Standard aus
	hideRead: boolean; // Standard aus
};
```

- **`maxItems`** reicht bis 50 (die Obergrenze des Caches pro Feed), Standard ist 20. Mit
  Höchsthöhe scrollt die Liste, deshalb dürfen es mehr Einträge sein als sichtbar.
- **`showImages`** ist standardmäßig aus, weil die Bilder direkt von den Servern der Feeds laden.
  Die Einstellung sagt das in einem Satz. Firefox trennt die Cookies solcher Anfragen ohnehin pro
  Seite (Total Cookie Protection), einen Referrer gibt es nicht.
- **`parseRssSettings`** ergänzt Fehlendes, verwirft Feeds mit ungültiger oder nicht-https-URL
  (http wird gehoben), entfernt doppelte URLs, klemmt `maxItems` und rastet das Intervall auf den
  nächsten erlaubten Wert ein. Es wirft nie.
- **Kein Schema-Sprung:** Ein neuer Widget-Typ ist additiv, wie bisher bei additiven Feldern.
  `CONFIG_VERSION` bleibt 4, eine Migration ist nicht nötig. Folge: Eine ältere Version der
  Extension verwirft RSS-Widgets beim Import (die Validierung kennt den Typ nicht). Das ist
  vertretbar, weil beide Rechner dieselbe Version bekommen.
- **Default-Config:** Sie bekommt kein RSS-Widget, weil es ohne Rechte-Abfrage nichts zeigen könnte.
- **Export/Import/Backups:** Feed-URLs und Namen stehen in den Settings und reisen mit. Cache und
  Gelesen-Status reisen nicht mit. Nach einem Import auf einem anderen Rechner zeigt das Widget
  „Zugriff erlauben“ (siehe oben). „Alles zurücksetzen“ leert auch `feeds` und `feedReads`.

## B6. Einstellungen des Widgets

- **Feeds:** Liste mit Favicon, Name (bzw. Feed-Titel) und Host. Sortierbar über den bestehenden
  `sortable` (Maus und Tastatur), wobei die Reihenfolge nur die Einstellungen betrifft, weil die
  Liste chronologisch ist. Bearbeiten heißt Name ändern. Entfernen geht mit Rückgängig-Toast.
- **„Feed hinzufügen“:** ein Feld für die URL einer Website oder eines Feeds, dazu ein Button.
  Danach kommt die Rechte-Abfrage von Firefox, dann der Abruf mit Prüfung. Bei Erfolg wird der Feed
  mit Titel übernommen und erscheint sofort im Widget, bei Fehler steht eine Meldung am Feld.
- Dazu: Überschrift, Anzahl der Einträge (Regler), Intervall (`Segmented`), Zusammenfassung
  zeigen, Titelbilder zeigen (mit Hinweis), Gelesene ausblenden.

## B7. Tastatur, i18n, Reduced Motion

- **Tastatur:** Die Liste ist ein Fokusbereich mit Roving Tabindex, also ein Tab-Stopp wie beim
  Link-Board. `↑`/`↓` bewegen, `Pos1`/`Ende` springen an Anfang und Ende, `Enter` öffnet,
  `Strg/Cmd+Enter` öffnet in einem neuen Tab. `M` schaltet gelesen/ungelesen.
  `Kontextmenü-Taste` bzw. `Umschalt+F10` öffnet das Menü. In einer scrollenden Liste rückt der
  fokussierte Eintrag mit `block: 'nearest'` in den Blick. Die Ziffern `1…9` bleiben dem Link-Board
  vorbehalten. Keine Kürzel greifen, solange ein Eingabefeld fokussiert ist. Der Hinweis auf die
  Kürzel hängt per `aria-describedby` an der Liste. Abschluss eines Abrufs und Fehler werden
  über den bestehenden Announcer gemeldet, ohne bei jedem Hintergrund-Abruf zu sprechen. Gemeldet
  wird nur nach „Aktualisieren“.
- **i18n:** Alle Texte in `de.ts`/`en.ts` unter `rss.*`, auch Fehlercodes und leere Zustände.
  Relative Zeit über `Intl.RelativeTimeFormat`, Datum über `Intl.DateTimeFormat`, Anzahlen über die
  vorhandenen Pluralformen. Feed-Inhalte werden nicht übersetzt.
- **Reduced Motion:** Keine Einblende-Animation für neue Einträge oder geladene Bilder, das
  Abruf-Icon dreht sich nicht. Übergänge sind nur Opacity, wie im Rest der Page.

## B8. Manifest und AMO

- `optional_host_permissions: ['https://*/*']` kommt neu dazu, sonst ändert sich am Manifest nichts.
  Der Manifest-Test „fordert keine Host-Permissions an“ wird zu „fordert Host-Rechte nur optional
  an“: `permissions` bleibt gleich, `host_permissions` fehlt, `optional_host_permissions` ist genau
  `['https://*/*']`.
- **Installation und Update:** Optionale Rechte lösen weder bei der Installation noch beim
  Update der `.xpi` eine Abfrage aus. Die Abfrage kommt erst beim ersten Feed.
- **Titelbilder** brauchen kein Recht, sie laden wie die Favicons als `<img>`. Die Standard-CSP
  beschränkt `img-src` nicht. Das wird im Spike mit einem Feed geprüft.
- **`data_collection_permissions`:** Es bleibt bei `required: ['none']`. Die Extension überträgt
  keine Daten an Entwickler oder Dritte. Der Abruf eines Feeds, den die Person selbst eingetragen
  hat, ist die Funktion selbst. Das wird in R0 gegen die aktuelle Mozilla-Dokumentation der
  Datenkategorien geprüft, bevor signiert wird. Sollte Mozilla den Abruf als Übertragung werten,
  wird die Kategorie optional ergänzt und die Entscheidung dokumentiert.
- **Signierung:** Version `1.1.0` über `pnpm version minor`, danach `pnpm ext:sign` (unlisted). AMO
  nimmt jede Version nur einmal an, also wird erst ganz am Ende signiert. `web-ext lint` muss
  ohne neue Warnungen durchlaufen. Feed-Inhalte gehen nie per `innerHTML` ins DOM. Das hält die
  AMO-Warnung `UNSAFE_VAR_ASSIGNMENT` weg. `DOMParser` selbst ist unbedenklich.
- **README:** Ein kurzer Abschnitt erklärt, warum Firefox beim ersten Feed nach Zugriff auf eine
  Seite fragt und wo man das in `about:addons` wieder entzieht.

## B9. Tests

Reine Funktionen mit Fixtures (`src/lib/widgets/rss/fixtures/`), jsdom hat `DOMParser`:

- `parseFeed`: RSS 2.0, RSS 1.0, Atom, JSON Feed. Dazu CDATA, Entities, HTML in Titeln,
  Namespaces mit Präfix, `xml:base` und relative Links, fehlende Felder, kaputtes XML, leere Feeds
  und sehr lange Felder. Es wirft nie.
- `pickImage`: `media:thumbnail`, `media:content` mit mehreren Größen und in `media:group`,
  Bild-Enclosure, `itunes:image`, JSON `image`/`banner_image`, erstes `<img>` im Inhalt,
  übersprungene 1×1-Pixel, abgelehnte `data:`/`javascript:`-URLs, relative URLs, `http` → `https`.
- `toPlainText`: entfernt Tags, Skripte und Styles, dekodiert Entities, fasst Leerraum zusammen,
  kürzt an Wortgrenzen.
- `safeUrl`: nur http(s), relativ auflösen. Abgelehnt werden `javascript:`, `data:` und
  Protokoll-relative Tricks.
- `parseFeedDate`: RFC 822 mit Zeitzonennamen, RFC 3339, `dc:date`, Unsinn ergibt `null`.
- `itemId` und Dubletten, `mergeItems` (Sortierung, Limit, Einträge ohne Datum, gleiche Links).
- `detectCharset`: Header, XML-Deklaration, BOM, Fallback.
- `findFeedLinks(html, base)`: Feed-Suche in HTML.
- `originPattern(url)` (`www.`-Entfernung, Subdomains) und `missingOrigins` /
  `unusedOrigins` (welche Rechte fehlen bzw. abgegeben werden).
- Scheduler: `isDue`, Backoff, `Retry-After` (Sekunden und Datum), kürzestes Intervall über
  Widgets, Sperre zwischen Tabs. Die Zeit wird dabei übergeben.
- `parseRssSettings`, `parseFeedCache`, `parseFeedReads`, Aufräumen des Gelesen-Status.
- `fetchFeed` mit gemocktem `fetch`: 304, Größenlimit, Zeitlimit, Zeichensätze, Opaque-Redirect.
- Komponententests: Tastaturnavigation, Öffnen markiert als gelesen, „Alle als gelesen“,
  Ausblenden, die Zustände „keine Feeds“, „Rechte fehlen“, „offline mit Cache“ und „Fehler“, sowie
  ein Feed-Titel mit `<img onerror>`, der als Text erscheint. Ohne `showImages` wird kein `<img>`
  für Titelbilder gerendert, mit Option fällt ein Bild nach Ladefehler weg.
- Manuelle Checkliste (`docs/checklist.md`): Abfrage beim Hinzufügen, Ablehnen, Rechte in
  `about:addons` entziehen und wieder erlauben, Offline-Modus, zwei offene Tabs, Import auf einem
  „fremden“ Profil, Titelbilder an und aus, scrollende Liste mit Höchsthöhe, Reduced Motion, Tag
  und Nacht.

---

# Teil C – Kategorien als Tabs (nach dem ersten Test)

Beim Testen hat sich gezeigt, dass Kategorien in einem Widget praktischer sind als mehrere
Widgets (z. B. „Webdev“, „Nachrichten“, „Gaming“). Damit wird die Wahl „nur eine gemischte
Liste“ aus Teil B ersetzt: Jeder Tab ist eine Kategorie mit eigenen Feeds, innerhalb eines Tabs
bleibt die Liste chronologisch gemischt. Mit der nutzenden Person abgestimmt:

| Frage      | Wahl                                                               |
| ---------- | ------------------------------------------------------------------ |
| Zähler     | ungelesene Einträge als kleine Zahl am Tab, bei null nichts        |
| „Alle“-Tab | keiner; jeder Tab ist eine Kategorie                               |
| Bedienung  | wie im Link-Board: „+“, Doppelklick/Kontextmenü, Ziehen, `Alt+1…9` |

## C1. Schema

```ts
type RssTab = {
	id: string;
	label: string;
	/** Optionales Emoji, wie bei Link-Tabs */
	icon: string;
	feeds: RssFeed[];
};

type RssSettings = {
	title: string;
	tabs: RssTab[]; // mindestens 1, höchstens 10
	activeTabId: string;
	maxItems: number;
	intervalMinutes: IntervalMinutes;
	showSummary: boolean;
	showImages: boolean;
	hideRead: boolean;
};
```

- **Kein Schema-Sprung:** `parseRssSettings` liest ein altes `feeds` als einen Tab ohne Namen.
  Bestehende RSS-Widgets behalten so ihre Feeds. `CONFIG_VERSION` bleibt 4.
- Höchstens 20 Feeds pro Tab. Derselbe Feed darf in mehreren Tabs stehen; Cache und
  Gelesen-Status gelten weiter pro Feed-URL, also tabübergreifend.
- Anzahl, Intervall und die Schalter bleiben pro Widget, nicht pro Tab.

## C2. Widget

- Tab-Leiste wie im Link-Board (Reiter mit optionalem Emoji, Zahl der ungelesenen Einträge,
  „+“ am Ende). Die Zahl zählt alle ungelesenen Einträge im Cache der Feeds des Tabs, nicht nur
  die sichtbaren, und wird ab 100 als „99+“ gezeigt. Für Screenreader steht sie im Namen des Tabs
  („Webdev, 3 ungelesen“).
- Doppelklick oder Kontextmenü auf einen Reiter: umbenennen, Emoji, löschen (mit
  Rückgängig-Toast, der letzte Tab bleibt). Reiter lassen sich ziehen (bestehender `Sortable`).
- Ist das Widget fokussiert, wechseln `Alt+1…9` die Tabs. Die Ziffern `1…9` bleiben dem
  Link-Board.
- „Alle als gelesen“ und „Aktualisieren“ wirken auf den aktiven Tab. Der Problem-Fuß zeigt nur
  Feeds des aktiven Tabs; ein Tab mit Problemen bekommt ein kleines Warnzeichen am Reiter.
- Abgerufen werden weiter die Feeds aller Tabs, damit die Zähler stimmen.

## C3. Einstellungen

- Die Feeds stehen nach Tabs gruppiert. „Feed hinzufügen“ bekommt eine Auswahl, in welchen
  Tab der Feed kommt (Standard: der aktive Tab). Jeder Feed lässt sich per Auswahlfeld in einen
  anderen Tab verschieben.
- Tabs selbst werden im Widget verwaltet (siehe C2); die Einstellungen zeigen nur ihre Namen als
  Gruppenüberschriften.

## C4. Tests

- `parseRssSettings`: altes `feeds` wird ein Tab, leere Tab-Liste ergibt einen Tab, Grenzen,
  ungültige `activeTabId`.
- Zähler pro Tab, Feeds aller Tabs im Abruf-Dienst, Aufräumen nur von Feeds, die in keinem Tab
  mehr stehen.
- Komponententests: Tab wechseln (Klick, `Alt+Ziffer`), Zähler, Tab anlegen, löschen samt
  Rückgängig, Feed in anderen Tab verschieben.

---

## Meilensteine

Jeder Meilenstein endet mit `pnpm check && pnpm lint && pnpm test && pnpm ext:lint` grün und
einem Commit.

1. **L1 – Zeilenhöhe:** `maxHeight` in `LayoutRow` samt Validierung und Layout-Operationen,
   Scrollen im Panel mit weichen Kanten, Registry-Feld `scrollsSelf`, Griff an der Unterkante mit
   Maus, Tastatur und Ansagen, i18n, Tests (A4). Eintrag in `docs/decisions.md`. Danach ist die
   Höhe für alle bestehenden Widgets nutzbar.
2. **R0 – Rechte und Abruf (Spike), erledigt bis auf die Prüfung in Firefox (mit R4):** Manifest um `optional_host_permissions` ergänzen und den Test
   anpassen. Dazu `lib/permissions.ts` (`originPattern`, `contains`, `request`, `remove`,
   Dev-Fallback) und `lib/net/fetch-feed.ts` (Zeitlimit, Größenlimit, Zeichensatz, bedingte
   Anfrage, Erkennung von Umleitungen). Außerdem die Dev-Proxy-Middleware. In Firefox
   (`pnpm ext:dev`) wird von Hand geprüft: Abfrage im Klick, Abruf ohne CORS, http wird gehoben,
   Opaque-Redirect, Bilder ohne Recht, Entziehen in `about:addons`, `permissions.onRemoved`. Die
   Datenkategorien-Frage wird geklärt. Abweichungen kommen in diesen Plan, bevor R1 beginnt.
3. **R1 – Parser (erledigt):** `widgets/rss/parse.ts`, `text.ts`, `image.ts` und `discover.ts` mit allen
   Fixture-Tests. Noch ohne UI.
4. **R2 – Settings, Cache, Abruf-Steuerung (erledigt):** Typ `rss` im Schema, `parseRssSettings`,
   Registry-Eintrag mit einer schlichten Liste als Platzhalter-Komponente. Dazu `feeds` und
   `feedReads` über `SyncedValue`, Scheduler (rein) und Abruf-Dienst (Sichtbarkeit, online/offline,
   Sperre, Backoff), Aufräumen von Cache und Rechten sowie „Alles zurücksetzen“.
5. **R3 – Widget-Oberfläche (erledigt):** Gemischte Liste mit eigenem Scrollbereich, Zeilen-Design,
   Titelbilder, Gelesen/Ungelesen, Kopf und Fuß, leere und Fehler-Zustände, Kontextmenü, Tastatur,
   Announcer, Reduced Motion, i18n und Komponententests.
6. **R4 – Einstellungen und Rechte-Ablauf (erledigt, Prüfung in Firefox steht aus):** Einstellungs-Komponente, Dialog „Feed hinzufügen“ mit
   Rechte-Abfrage und Feed-Suche, sortieren, umbenennen, entfernen mit Rückgängig, „Zugriff
   erlauben“ im Widget, Kontrastprüfung bei Tag und Nacht.
7. **R4b – Kategorien als Tabs (Teil C, erledigt):** Schema mit Tabs samt Lesen alter Settings,
   Tab-Leiste mit Zählern, Tab-Verwaltung wie im Link-Board, Einstellungen nach Tabs gruppiert,
   Tests.
8. **R5 – Abschluss:** Entscheidungen nach `docs/decisions.md`, Checkliste, README-Abschnitt,
   diesen Plan löschen. Danach `pnpm version minor` (1.1.0) und `pnpm ext:sign`. Signiert wird erst
   nach Rücksprache mit der nutzenden Person, weil AMO jede Version nur einmal annimmt.

## Bewusst nicht enthalten

Volltext-Ansicht im Widget, große Bilder über dem Titel, OPML-Import/-Export, ein „Alle“-Tab,
Abruf im Hintergrund, http-only-Feeds, Feeds mit Anmeldung (außer per Token in der URL), feste
(statt höchstens) Zeilenhöhe. Alles davon ließe sich später ergänzen, ohne das Schema umzubauen
(OPML z. B. als Aktion in den Widget-Einstellungen, eine feste Höhe als zusätzlicher Modus des
Griffs).
