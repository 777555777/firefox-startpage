# Plan: GitLab-Widget „Meine Arbeit“

Status: **Entwurf, wartet auf Freigabe.** Grundlage sind SPEC.md §3, §4, §6 und §11 sowie
`docs/decisions.md`, vor allem die Abschnitte zum RSS-Widget und zu „Bis Fensterende“. Sobald
gebaut ist, wandern die Entscheidungen nach `docs/decisions.md` (Abschnitte „Nach v1 –
GitLab-Widget: …“). Diese Datei wird danach gelöscht, wie beim RSS-Plan.

Das Widget zeigt auf einen Blick:

- MRs, bei denen die Person als Reviewer angefragt ist,
- die eigenen offenen MRs mit Pipeline-Status, Konflikt und Draft,
- die Anzahl der offenen To-dos mit Link nach GitLab.

## Getroffene Wahl (mit der nutzenden Person abgestimmt)

| Frage          | Wahl                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| Darstellung    | Abschnitte „Reviews“ und „Meine MRs“ untereinander, To-dos als Knopf im Kopf   |
| Intervall      | pro Widget wählbar: 2 / 5 / 10 / 15 / 30 min, Standard 5 min                   |
| Neue Reviews   | Akzentpunkt und fette Schrift, bis geöffnet oder „Alle gesehen“ (wie RSS)      |
| Avatare        | keine; Initialen der Person auf Akzentfarbe                                    |
| Filter         | keiner, alles, was GitLab für die Person liefert                               |
| Schon geprüft  | gedimmt unter den offenen Reviews, mit „Genehmigt“ bzw. „Änderungen angefragt“ |
| „Meine MRs“    | von der Person erstellt (Autor), inklusive Drafts                              |
| Firmen-Instanz | https mit gültigem Zertifikat, nur per VPN erreichbar                          |
| Zugriff        | Personal Access Token mit Scope `read_api`, nur lokal, nie im Export           |
| Host-Rechte    | pro Instanz-Origin, optional, zur Laufzeit beim Verbinden (wie RSS)            |
| Aktualisierung | nur aus der offenen, sichtbaren Newtab-Page, kein Hintergrundskript            |

Wer mehrere Instanzen nutzt (Firma und gitlab.com), platziert mehrere GitLab-Widgets. Jedes
Widget gehört zu genau einer Instanz.

---

## 1. Abruf und API

### 1.1 Welche Anfragen

Pro Aktualisierung gibt es **zwei Anfragen**:

1. **GraphQL** (`POST <basis>/api/graphql`) mit einer Abfrage für beide MR-Listen:
   `currentUser { username name reviewRequestedMergeRequests(state: opened, first: 50)
authoredMergeRequests(state: opened, first: 50) }`. Pro MR werden gelesen: `id`, `iid`,
   `title`, `webUrl`, `draft`, `conflicts`, `detailedMergeStatus`, `updatedAt`,
   `project { fullPath }`, `author { username name }`, `headPipeline { status }` und für Reviews
   `reviewers { nodes { username mergeRequestInteraction { reviewState } } }`. Dazu kommt jeweils
   `pageInfo { hasNextPage }`.
2. **REST** `GET <basis>/api/v4/user_counts` → `todos` (Anzahl offener To-dos). Ein
   `count` auf der To-do-Verbindung in GraphQL ist nicht verlässlich dokumentiert, `user_counts`
   dagegen schon. Es ist eine sehr billige Anfrage.

**Warum GraphQL:** Die REST-Listen (`GET /merge_requests`) liefern kein `head_pipeline`. Das
steht nur am einzelnen MR. Mit REST wären es also 3 + n Anfragen (n = Anzahl eigener MRs), mit
GraphQL immer 2. Zusätzlich wird beim Verbinden und danach höchstens einmal am Tag
`GET /api/v4/personal_access_tokens/self` abgefragt (Ablaufdatum und Scopes des Tokens).

**Versionen:** Unbekannte Felder lassen in GraphQL die ganze Abfrage scheitern. Die Firmen-Instanz
kann älter sein als gitlab.com. Deshalb gibt es eine zweite, schlanke Abfrage ohne
`detailedMergeStatus` und `mergeRequestInteraction`. Meldet GitLab einen Fehler zu einem unbekannten
Feld, wird automatisch die schlanke Abfrage verwendet und das pro Instanz im Cache gemerkt. Ohne
Prüfstatus kann das Widget „schon geprüft“ nicht erkennen. Dann stehen alle Reviews gleich oben.
Welche Felder die Firmen-Instanz kann, klärt der Spike (G0).

**Limits:** Die Listen holen höchstens 50 MRs. Gibt es mehr (`hasNextPage`), steht am Ende des
Abschnitts „Alle in GitLab anzeigen“ mit einem Link auf die passende Liste in GitLab. Ist die
Abfrage zu komplex (GraphQL-Komplexitätslimit), wird `first` auf 30 gesenkt. G0 misst das.

### 1.2 Anfrage selbst

- **Gemeinsamer Kern mit RSS:** Zeitlimit (20 s), Größenlimit (2 MB für JSON),
  `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-cache'`, `Retry-After`,
  Erkennung von offline und von Umleitungen. Das wird aus `fetch-feed.ts` in einen
  gemeinsamen Kern `lib/net/request.ts` gezogen. `fetchFeed` baut darauf auf und ändert sich im
  Verhalten nicht.
- **Token im Header,** nie in der URL: `Authorization: Bearer <token>` für GraphQL und REST
  (beides für Personal Access Tokens dokumentiert, G0 prüft es). `private_token=` als
  Query-Parameter wird nie verwendet, weil URLs in Logs und Verlauf landen.
- **Ohne Cookies:** `credentials: 'omit'` sorgt dafür, dass nur das Token zählt und nicht eine
  zufällig offene GitLab-Sitzung im Browser. Sonst würde ein ungültiges Token unbemerkt
  „funktionieren“, solange man im Browser angemeldet ist.
- **ETag:** Liefert GitLab für `user_counts` ein `ETag`, wird es mit `If-None-Match` genutzt.
  Für den GraphQL-`POST` gibt es kein HTTP-Caching. Ob GitLab-REST ETags überhaupt sendet, ist
  nicht sicher dokumentiert; G0 prüft das. Sparsam ist der Abruf vor allem durch das Intervall,
  die Tab-Sperre und den Abruf nur bei sichtbarer Page. ETag wäre nur eine kleine Zugabe.
- **Rate-Limits:** Bei 5 min sind das 24 Anfragen pro Stunde und Widget-Instanz, weit unter
  jedem üblichen Limit (gitlab.com: 2000/min). `429` mit `Retry-After` bzw. `RateLimit-Reset`
  wird beachtet.

### 1.3 Instanz-Adresse

- Frei einstellbar, Platzhalter `https://gitlab.com`. `normalizeInstanceUrl` macht aus der Eingabe
  die Basis-Adresse: ohne Schema wird `https://` ergänzt, `http://` wird auf `https://` gehoben
  (mit Hinweis, wie bei RSS). Abgeschnitten werden Endungen wie `/api/v4…`, `/-/…`,
  `/dashboard…` und `/users/sign_in`, außerdem Query, Hash und ein abschließender `/`. Ein
  Unterpfad (`https://firma.de/gitlab`) bleibt erhalten.
- **Nur https:** Wie bei RSS hebt die CSP der Extension-Page http ohnehin auf https. Die Instanz
  der Firma ist https mit gültigem Zertifikat, das passt. Ein Zertifikat, dem Firefox nicht
  vertraut, sieht für `fetch` aus wie ein Netzwerkfehler. Die Meldung nennt das als mögliche Ursache.

### 1.4 Host-Rechte

- **Wiederverwendung:** `originPattern`, `requestAccess`, `missingAccess` und `onAccessChange` aus
  `lib/net/permissions.ts`. `gitlab.firma.de` wird zu `https://*.gitlab.firma.de/*`. Das Manifest
  bleibt unverändert (`optional_host_permissions: ['https://*/*']`).
- **Fehler heute im Code, muss zuerst behoben werden:** Der `FeedService` gibt beim Laden **alle**
  Host-Rechte ab, die kein RSS-Feed braucht (`releaseUnusedAccess`). Damit würde er das Recht der
  GitLab-Instanz bei jedem Öffnen der Page entziehen. Das Abgeben wandert deshalb aus dem
  `FeedService` in den `AppState`. Er bildet die Vereinigung der Muster aller Widgets: RSS-Feeds
  plus GitLab-Instanzen. Das ist der erste Teil von G1, mit Test.
- **Anfrage im Klick:** „Verbinden“ in den Widget-Einstellungen normalisiert die Adresse
  synchron und ruft dann als Erstes `requestAccess` auf, vor jedem `await`. Erst danach wird
  geprüft und gespeichert.
- **Fehlt das Recht** (abgelehnt, in `about:addons` entzogen, Import auf anderem Rechner), zeigt
  das Widget „Zugriff erlauben“. Wie bei RSS fragt ein Klick direkt an.

### 1.5 Dev-Server

`devFeedProxy` in `vite.config.ts` wird zu einer allgemeinen Weiterleitung ausgebaut: Sie leitet
`POST` weiter und reicht `authorization`, `content-type` und `if-none-match` durch. Sie
gibt `ratelimit-*` zurück. Sie loggt weder Header noch Inhalt. Sie gibt es nur im Dev-Server,
gebunden an `localhost`. Auf dem Dev-Server liegt das Token in `localStorage` (Präfix
`startpage:`), wie alle Daten dort. Das wird in der README erwähnt.

---

## 2. Token

### 2.1 Speicherung

- **Eigener Schlüssel `gitlabAuth` in `storage.local`,** getrennt von `config`, wie `stats` und
  `feeds`. Pro Instanz-Basis gibt es einen Eintrag:
  `{ token, savedAt, username, expiresAt, scopes, checkedAt }`. Mehrere Widgets mit derselben
  Instanz teilen sich das Token.
- Er läuft über `SyncedValue` (validiert, Tab-Sync). Wird das Token in Tab A eingetragen, wirkt es
  sofort in Tab B.
- **Nicht im Export, nicht in Backups:** Export und Backups enthalten nur `config` (und optional
  `stats`). Das Token steht nie in der Config. Ein Test legt ein Token an, erzeugt Export und
  Backup und prüft, dass die Zeichenkette darin nicht vorkommt.
- **Ehrlicher Hinweis in den Einstellungen:** Das Token liegt unverschlüsselt im Firefox-Profil
  dieses Rechners. Andere Extensions und Websites können es nicht lesen. Eine Verschlüsselung ohne
  eigenes Passwort wäre nur Schein, deshalb gibt es sie nicht. Empfohlen werden `read_api` und ein
  Ablaufdatum.

### 2.2 Nirgends sichtbar

- Fehler sind Codes (`auth`, `scope`, `network` …) und nie Texte aus Antworten oder Anfragen.
  `console.warn` bekommt nie Anfrage-Objekte, Header oder Optionen mit Token. Ein Test durchsucht
  den serialisierten Cache, die Fehlerobjekte und alle Aufrufe von `console.*` während eines
  gemockten Abrufs nach dem Token.
- Das Eingabefeld ist `type="password"`, `autocomplete="off"`, `spellcheck="false"`. Nach dem
  Speichern zeigen die Einstellungen nur „Token gespeichert (…a1b2)“ und den Benutzernamen,
  nie das Token selbst.
- Der Announcer und die Toasts nennen das Token nie.
- Agenten bekommen das Token nie: Tests nutzen Platzhalter, den Spike und die Prüfung in Firefox
  führt die nutzende Person mit ihrem eigenen Token aus.

### 2.3 Löschen

- **„Token entfernen“** in den Widget-Einstellungen löscht den Eintrag sofort. Das Widget zeigt
  danach „Nicht verbunden“.
- **Widget entfernt:** Das Token bleibt bis zum nächsten Laden der Page, damit „Rückgängig“
  funktioniert. Danach entfernt der Dienst Tokens von Instanzen, die kein Widget mehr nutzt. Das
  ist dieselbe Regel wie bei den Host-Rechten. Er tut das nicht, wenn die Config nicht lesbar war.
- **Adresse geändert:** Das Token der alten Instanz fällt beim nächsten Laden weg, wenn sie kein
  anderes Widget nutzt.
- **„Alles zurücksetzen“** leert `gitlabAuth`, den Cache und den Gesehen-Status.

### 2.4 Import und Backups

- Die Instanz-Adresse steht in den Settings und reist mit, das Token nicht.
- **Auf einem anderen Rechner** (oder nach „Token entfernen“) zeigt das Widget „Nicht verbunden“
  mit dem Knopf „Token eintragen“, der die Widget-Einstellungen öffnet. Fehlt auch das Host-Recht,
  wird es beim Verbinden mit angefragt.
- **Auf demselben Rechner** (Backup wiederhergestellt, Import des eigenen Exports) bleibt ein
  vorhandenes Token für dieselbe Instanz-Basis gültig. Das Widget läuft ohne Rückfrage weiter.
- Ein Import löscht keine Tokens sofort. Tokens von Instanzen, die nach dem Import kein Widget
  mehr nutzt, fallen erst beim nächsten Laden weg (gleiche Regel wie oben).

### 2.5 Token anlegen

In den Einstellungen gibt es den Link „Token in GitLab erstellen“ auf
`<basis>/-/user_settings/personal_access_tokens?name=Startseite&scopes=read_api`. GitLab füllt
Name und Scope damit vor. Ältere Versionen nutzen `/-/profile/personal_access_tokens`. G0 prüft,
welcher Pfad bei der Firma gilt, und notfalls kommt der ältere Pfad dazu.

---

## 3. Fehlerzustände

Die letzten gültigen Daten bleiben immer stehen, mit „Stand: vor 20 Min.“ im Fuß.

| Code         | Wann                                      | Meldung (Sinn)                                | Aktion                                  | Abruf danach               |
| ------------ | ----------------------------------------- | --------------------------------------------- | --------------------------------------- | -------------------------- |
| `noToken`    | kein Token für die Instanz                | „Nicht mit GitLab verbunden“                  | „Token eintragen“                       | keiner                     |
| `permission` | Host-Recht fehlt                          | „Zugriff auf gitlab.firma.de nicht erlaubt“   | „Zugriff erlauben“ (fragt im Klick an)  | keiner                     |
| `auth`       | `401`                                     | „Token ungültig oder abgelaufen“              | „Neues Token eintragen“, Link erstellen | pausiert, bis Token neu    |
| `scope`      | `403` mit `insufficient_scope`            | „Token fehlt der Scope read_api“              | wie `auth`                              | pausiert, bis Token neu    |
| `network`    | Netzwerkfehler, Zeitlimit                 | „GitLab nicht erreichbar, VPN verbunden?“     | „Erneut versuchen“                      | Backoff, höchstens 30 min  |
| `redirect`   | Umleitung auf fremde Origin (z. B. SSO)   | „GitLab leitet auf eine Anmeldeseite um“      | „In GitLab öffnen“                      | Backoff                    |
| `http`       | `5xx`, `429` und sonstige                 | „GitLab antwortet mit Fehler 503“             | „Erneut versuchen“                      | Backoff bzw. `Retry-After` |
| `graphql`    | `errors` in der Antwort, kein Feldproblem | „GitLab konnte die Abfrage nicht beantworten“ | „Erneut versuchen“                      | Backoff                    |
| `offline`    | `navigator.onLine === false`              | „Offline“                                     | keine                                   | beim Ereignis `online`     |

- **Kein Dauerfeuer bei 401/403:** Nach einem Fehlschlag der Anmeldung wird nicht weiter
  abgefragt, bis ein neues Token gespeichert ist. Sonst könnten wiederholte Fehlversuche die
  Instanz zu einer IP-Sperre bringen.
- **VPN:** Ein Verbindungsaufbau zum VPN löst kein `online`-Ereignis aus. Deshalb ist der
  Backoff für `network` kurz (doppeltes Intervall, höchstens 30 min statt 24 h wie bei RSS). Beim
  Zurückkehren in den Tab wird einmal neu versucht, wenn seit dem letzten Versuch mindestens eine
  Minute vergangen ist. So ist das Widget nach dem Einwählen beim nächsten Blick aktuell.
- **Token läuft bald ab:** Endet es in höchstens 14 Tagen (`expiresAt` aus
  `personal_access_tokens/self`), zeigt der Fuß „Token läuft in 5 Tagen ab“ mit Link zum
  Erstellen. Kennt die Instanz den Endpunkt nicht, entfällt der Hinweis ohne Fehler.
- **Fehler im Kopf statt Fuß?** Nein, wie bei RSS: Der Fuß erscheint nur bei Bedarf, die
  Einzelheiten stehen in einem `<details>`, die Aktion direkt daneben.

---

## 4. Cache, Gesehen-Status und Abruf-Steuerung

### 4.1 Cache

- `storage.local`, Schlüssel `gitlab`, über `SyncedValue`, nicht im Export. Pro Instanz-Basis:
  `{ fetchedAt, checkedAt, user, reviews, own, todos, moreReviews, moreOwn, variant, error,
retryAt, lockUntil }`. `variant` ist `full` oder `lean` (siehe 1.1).
- **Einträge** (`MrItem`): `id`, `ref` (`team/app!412`), `title` (ohne „Draft: “), `url`,
  `draft`, `conflicts`, `mergeStatus`, `pipeline` (Status oder `null`), `author` (Name,
  Benutzername), `updatedAt` sowie für Reviews `reviewState`. Alles wird beim Einlesen validiert
  wie die Config. Titel werden gekürzt (300 Zeichen). Adressen werden nur übernommen, wenn sie
  https sind und auf der Origin der Instanz liegen. Sonst ist der Eintrag nicht klickbar.
- Einträge von Instanzen, die kein Widget mehr nutzt, verschwinden beim Laden der Page.

### 4.2 Gesehen-Status (neue Review-Anfragen)

- Schlüssel `gitlabSeen` in `storage.local`: pro Instanz die IDs gesehener Review-MRs.
- Ein Review-MR ist **neu**, solange seine ID nicht gesehen ist. Öffnen (Klick, Mittelklick,
  `Enter`, Kontextmenü) und „Alle gesehen“ markieren als gesehen.
- **Erneute Review-Anfrage:** Wechselt der Prüfstatus beim Abruf von geprüft (`REVIEWED`,
  `APPROVED`, `REQUESTED_CHANGES`) zurück auf `UNREVIEWED`, fällt die ID aus `gitlabSeen`. Der MR
  gilt damit wieder als neu.
- **Erster Abruf** einer Instanz: Alles, was schon da ist, gilt als gesehen. Sonst wäre beim
  Einrichten jeder alte Review „neu“.
- IDs, die in keinem Review mehr stehen, fallen nach dem Abruf weg (wie `feedReads`).

### 4.3 Abruf-Steuerung

- **Gemeinsame reine Funktionen:** `isDue`, `nextDue`, `backoff`, `isLocked` und `nextWake` aus
  `widgets/rss/schedule.ts` arbeiten nur mit `checkedAt`, `error.attempts`, `retryAt` und
  `lockUntil`. Sie wandern unverändert nach `lib/net/poll.ts` und werden generisch über diesen
  Ausschnitt typisiert. RSS importiert sie von dort, und die bestehenden Tests ziehen mit um.
  `backoff` bekommt die Obergrenze als Parameter (RSS 24 h, GitLab `network` 30 min).
- **`GitlabService`** (`app.gitlab`) nach dem Muster des `FeedService`: ein Timer für alle
  Instanzen, Abruf nur bei sichtbarer Page, beim Zurückkehren, bei `online`, wenn sich Widgets,
  Tokens oder Rechte ändern. Dazu die Tab-Sperre `lockUntil` (60 s). Steht eine Instanz in
  mehreren Widgets, gilt das kürzeste Intervall. „Aktualisieren“ übergeht Intervall und Backoff,
  nicht aber `Retry-After` und die Sperre eines anderen Tabs.
- Die Sichtbarkeits- und Online-Schleife wird **nicht** in eine gemeinsame Klasse gezogen: Der
  `FeedService` ruft viele Adressen mit einem Pool ab, GitLab meist eine Instanz. Eine
  gemeinsame Basisklasse würde RSS ohne Not umbauen. Die reinen Funktionen sind der
  wiederverwendete Teil.

---

## 5. Darstellung

### 5.1 Aufbau

```
┌ GitLab                     [☑ 3 To-dos] [↻] ┐
│ REVIEWS · 2                                    │
│ ●  AM  Fix login timeout          team/app !412 │
│         Anna Muster · vor 2 Std.   Draft       │
│    JK  Add CSV export              team/api !88 │
│ ─ geprüft ─                                    │
│    LS  Cache invalidation          team/app !401│  (gedimmt, „Genehmigt“)
│ MEINE MRS · 3                                  │
│ ✓  Refactor auth                   team/app !409│
│ ✗  Bump deps            Konflikt   team/api !91 │
│ ◐  New dashboard        Draft      team/app !415│
│ Stand: vor 3 Min.                              │  (nur bei Problemen/offline)
└────────────────────────────────────────────────┘
```

- **Kopf:** Name der Instanz (Host, bei gitlab.com „GitLab“) mit dem Benutzernamen im Tooltip.
  Rechts stehen der Knopf „3 To-dos“ (Icon und Anzahl, Link auf `<basis>/dashboard/todos`, bei 0
  gedimmt „Keine To-dos“, bei unbekannt nur Icon) und „Aktualisieren“ (Stand im Tooltip, dreht
  sich beim Abruf, bei Reduced Motion pulsiert es). „Alle gesehen“ erscheint nur, wenn es neue
  Reviews gibt.
- **Abschnitte:** „Reviews · n“ und „Meine MRs · n“ als kleine Überschriften (`<h3>`, Stil wie
  Legenden im Kalender). Ein leerer Abschnitt zeigt eine Zeile („Keine offenen Reviews“, „Keine
  offenen MRs“).
- **Reviews:** Zuerst die offenen (neueste Aktivität zuerst), dann die schon geprüften gedimmt
  unter einer feinen Trennlinie „Geprüft“. Kennt die Instanz keinen Prüfstatus (`lean`), entfällt
  die Trennung.
- **Meine MRs:** nach `updatedAt`, neueste zuerst.

### 5.2 Zeile

- **Links:** Bei Reviews stehen die Initialen des Autors auf Akzentfarbe (24 px, Kreis), wie der
  Ersatz-Buchstabe bei Links. Es werden keine Bilder geladen. Bei eigenen MRs steht dort das
  Pipeline-Symbol.
- **Mitte:** Titel (höchstens zwei Zeilen), darunter eine Meta-Zeile. Bei Reviews: Autor ·
  relative Zeit. Bei eigenen MRs: relative Zeit. Die Zeit ist die letzte Aktivität
  (`updatedAt`), das volle Datum steht im Tooltip.
- **Rechts:** Die Referenz `team/app !412` in sekundärer Farbe, in schmalen Panels (Container
  Query unter ~18 rem) nur `!412`. Davor höchstens ein Status-Chip nach Priorität:
  Konflikt › Rebase nötig › Diskussionen offen › Draft. „Genehmigt“ bzw. „Änderungen
  angefragt“ gibt es nur bei geprüften Reviews.
- **Neu:** Akzentpunkt vor dem Titel, Gewicht 600. Für Screenreader steht „Neu:“ davor. Das
  ist dieselbe Gestaltung wie ungelesen bei RSS.
- **Pipeline-Symbole** (neue Icons in `ui/icons.ts`): erfolgreich (Haken im Kreis), fehlgeschlagen
  (Kreuz im Kreis), läuft bzw. wartet (halber Kreis; dreht sich nicht, auch ohne Reduced
  Motion, damit nichts dauernd zappelt), abgebrochen bzw. übersprungen (Strich), manuell (Hand
  bzw. Play), keine Pipeline (nichts). Jedes Symbol hat einen Text für Screenreader und einen
  Tooltip („Pipeline fehlgeschlagen“). Farbe allein trägt keine Bedeutung.
- **Farben:** Neu kommt das Token `--success` dazu (Tag und Nacht, AA auf Glas geprüft). Für
  „fehlgeschlagen“ und „Konflikt“ gilt das vorhandene `--danger`, für „läuft“ `--accent-text`.

### 5.3 Höhe „Bis Fensterende“

- Das Widget setzt `scrollsSelf` und `fillsWindow` (Standard „Bis Fensterende“, wie RSS).
- **Zwei Listen statt einer:** Neue reine Funktion `fitSections` in `layout/window-fit.ts`. Sie
  bekommt den verfügbaren Platz und die Unterkanten der Einträge beider Abschnitte (samt
  Überschriften). Jeder nicht leere Abschnitt bekommt zuerst bis zu 2 Einträge, den Rest füllen
  die Reviews, dann die eigenen MRs. Es zählen nur ganze Einträge. Unter jedem gekürzten
  Abschnitt steht ein eigenes „n weitere anzeigen“ (bestehendes `FitMore`). Es klappt nur diesen
  Abschnitt aus.
- Messen, `inert` für abgeschnittene Einträge und Zurückklappen beim nächsten Öffnen laufen wie
  bei RSS über `WindowFit`. `WindowFit` bekommt dafür eine zweite Liste.

### 5.4 Leere Zustände

- **Nicht eingerichtet** (keine Adresse oder kein Token): Icon, „Mit GitLab verbinden“ und ein
  Knopf, der die Einstellungen öffnet (`opensettings`).
- **Alles leer:** „Keine offenen Reviews und MRs“ mit der To-do-Zahl im Kopf.

### 5.5 Bedienung

- **Öffnen:** Ein Klick öffnet im selben Tab. `Strg/Cmd`+Klick und Mittelklick öffnen nativ in
  einem neuen Tab, weil die Einträge echte `<a href>` mit `rel="noopener noreferrer"` sind.
- **Tastatur:** Beide Abschnitte bilden einen Fokusbereich mit Roving Tabindex (ein Tab-Stopp).
  `↑`/`↓` laufen über die Abschnittsgrenze hinweg, `Pos1`/`Ende`, `Enter`, `Strg/Cmd+Enter`,
  `M` schaltet neu/gesehen (nur Reviews). Das Kontextmenü (bestehendes `Menu`) bietet Öffnen, In
  neuem Tab öffnen, Link kopieren, Referenz kopieren (`team/app!412`) und Als gesehen bzw. neu
  markieren. Ziffern bleiben dem Link-Board vorbehalten.
- **Announcer:** nur nach „Aktualisieren“ („2 Reviews, 3 eigene MRs, 1 Pipeline
  fehlgeschlagen“), nicht bei Hintergrund-Abrufen.
- **Sicherheit:** Titel und Namen aus GitLab gehen nur als Text ins DOM, nie per `{@html}`. Den
  bestehenden Test, der RSS-Komponenten auf `@html` prüft, gibt es dann auch für `widgets/gitlab`.

---

## 6. Config-Schema

Neuer Widget-Typ `gitlab` in `WidgetSettingsMap`, `widgets/settings.ts` und `registry.ts`. Das
Icon `merge` (ein schlichter Merge-Pfeil) kommt neu in `ui/icons.ts`. Das GitLab-Logo wird nicht
verwendet.

```ts
type GitlabSettings = {
	/** Normalisierte https-Basis der Instanz; leer = noch nicht eingerichtet */
	instanceUrl: string;
	intervalMinutes: 2 | 5 | 10 | 15 | 30; // Standard 5
	/** „Bis Fensterende“ zeigt so viele ganze Einträge, wie bis zum unteren Rand passen */
	height: HeightMode; // Standard 'window'
};
```

- **`parseGitlabSettings`** normalisiert die Adresse (ungültig wird leer), rastet das Intervall ein
  und ergänzt `height`. Es wirft nie.
- **Kein Schema-Sprung:** Ein neuer Typ ist additiv, `CONFIG_VERSION` bleibt 4. Folge wie bei RSS:
  Eine ältere Version der Extension verwirft GitLab-Widgets beim Import.
- **Bewusst wenig Einstellungen:** Kein Filter, keine Avatar-Option, keine Anzahl (es sind
  höchstens 50 pro Abschnitt, „Bis Fensterende“ kürzt). Neue Felder ließen sich später additiv
  ergänzen.
- **Default-Config:** ohne GitLab-Widget.

---

## 7. Einstellungen des Widgets

- **Instanz:** Feld „GitLab-Adresse“ (Platzhalter `https://gitlab.com`).
- **Token:** Passwortfeld, daneben der Link „Token in GitLab erstellen“ (nur aktiv mit gültiger
  Adresse). Dazu der Hinweis auf den Scope `read_api`, ein Ablaufdatum und den Speicherort (2.1).
- **„Verbinden“** (auch per `Enter`):
  1. Adresse normalisieren, Token trimmen und grob prüfen (keine Leerzeichen, 20–255 Zeichen),
     alles synchron.
  2. `requestAccess` für die Instanz, vor jedem `await`. Wird abgelehnt, wird nichts gespeichert
     und eine Meldung erklärt warum.
  3. Prüfen mit dem neuen Token: `personal_access_tokens/self` (Scopes, Ablauf; fehlt der Endpunkt,
     geht es ohne weiter) und die GraphQL-Abfrage. Die Antwort füllt gleich den Cache, damit das
     Widget sofort Einträge zeigt.
  4. Erst bei Erfolg wird das Token gespeichert. Bei `auth`, `scope` oder `network` steht die
     Meldung am Feld, und das alte Token (falls vorhanden) bleibt unverändert.
- **Verbunden:** „Verbunden als @name · Token …a1b2 · läuft am 12.03.2027 ab“ mit den Knöpfen
  „Token ersetzen“ und „Token entfernen“.
- **Intervall** über `Segmented` mit Beschriftungen aus `Intl.NumberFormat` (wie RSS).
- **Höhe:** „Bis Fensterende / Nach Inhalt“ (wie RSS).

---

## 8. i18n, Reduced Motion, Kontrast

- Alle Texte in `de.ts`/`en.ts` unter `gitlab.*`, auch Fehlercodes, Pipeline-Status, Chips und
  leere Zustände. Anzahlen über die vorhandenen Pluralformen, Zeiten über
  `Intl.RelativeTimeFormat`/`Intl.DateTimeFormat`. Titel aus GitLab werden nicht übersetzt.
- Reduced Motion: keine Einblendung neuer Einträge, „Aktualisieren“ pulsiert statt zu drehen.
- Kontrast bei Tag und Nacht geprüft: `--success`, `--danger`, gedimmte geprüfte Reviews (mindestens
  sekundäre Textfarbe, AA), Chips und Punkt.

---

## 9. Tests

- `normalizeInstanceUrl`: Schema ergänzen, http → https, Unterpfad, `/api/v4`, `/-/…`,
  `/dashboard`, `/users/sign_in`, Query, Hash, Unsinn.
- `parseGitlabSettings`, `parseGitlabAuth`, `parseGitlabCache`, `parseGitlabSeen`: fehlend, falsch,
  zu lang, fremde Origins in URLs. Keiner wirft.
- Antwort-Mapping (`toMrItems`): volle und schlanke Variante, fehlende Pipeline, „Draft: “-Präfix,
  Prüfstatus der eigenen Person unter mehreren Reviewern, `hasNextPage`, URLs auf fremder Origin.
- Fehlerzuordnung: 401, 403 mit und ohne `insufficient_scope`, 429 mit `Retry-After`, 5xx,
  GraphQL-`errors` mit unbekanntem Feld (→ `lean`) und mit anderem Fehler, Netzwerk, Zeitlimit,
  `opaqueredirect`, offline.
- Gesehen: erster Abruf gilt als gesehen, erneute Anfrage macht wieder neu, Aufräumen.
- `fitSections`: ein Abschnitt leer, beide kurz, Mindestanteile, Rest an Reviews, alles passt.
- `lib/net/poll.ts` (umgezogene RSS-Tests) plus Obergrenze als Parameter.
- **Rechte-Abgabe:** RSS und GitLab zusammen, ein GitLab-Recht wird beim Laden nicht entzogen.
- **Token-Dichtheit:** Export, Backup, Cache, Fehlerobjekte und `console.*` enthalten das Token
  nie. Die Anfrage enthält es nur im Header, nie in der URL.
- Dienst mit gemocktem `fetch` und übergebener Zeit: Intervall, Sperre, Backoff (`network` 30 min),
  Pause bei `auth`/`scope` bis Token neu, `online`, Rückkehr in den Tab.
- Komponententests: Abschnitte, neue Reviews, gedimmte geprüfte, Pipeline-Text für
  Screenreader, Tastatur über beide Abschnitte, Kontextmenü, leere Zustände, alle Fehlerfüße mit
  Aktion, To-do-Knopf, ein Titel mit `<img onerror>` erscheint als Text. Einstellungen: Verbinden
  (Recht abgelehnt, 401, Erfolg), Token entfernen, Token wird nach dem Speichern nicht angezeigt.
- Manuelle Checkliste (`docs/checklist.md`): gitlab.com und Firmen-Instanz, VPN aus und an,
  Token widerrufen in GitLab, Token ohne `read_api`, Recht in `about:addons` entziehen, zwei
  Tabs, Import auf einem fremden Profil, Reduced Motion, Tag und Nacht, schmales Panel.

---

## Meilensteine

Jeder Meilenstein endet mit `pnpm check && pnpm lint && pnpm test && pnpm ext:lint` grün und
einem Commit.

1. **G0 – Spike (API-Probe):** Ein Skript `scripts/gitlab-probe.ts` (`pnpm gitlab:probe`) liest
   `GITLAB_URL` und `GITLAB_TOKEN` aus der Umgebung und gibt nur Ergebnisse aus, nie das Token.
   Es prüft: GitLab-Version (`/api/v4/version`), GraphQL mit `read_api` und `Authorization:
Bearer`, welche Felder es gibt (volle oder schlanke Variante), Komplexität bei `first: 50`,
   `user_counts`, `personal_access_tokens/self` mit `read_api`, ETag bei `user_counts`, Antworten
   bei falschem Token (401) und bei einem Token nur mit `read_user` (403), den Pfad zum
   Token-Anlegen. Die **nutzende Person** führt es mit eigenen Tokens aus, gegen gitlab.com und
   im Büro gegen die Firmen-Instanz, und gibt die Ausgabe zurück. Abweichungen kommen in diesen
   Plan, bevor G1 beginnt.
2. **G1 – Gemeinsame Netz-Teile:** Rechte-Abgabe aus dem `FeedService` in den `AppState`
   verlegen (Vereinigung aller Widgets), `lib/net/request.ts` als gemeinsamer Kern unter
   `fetchFeed`, reine Abruf-Funktionen nach `lib/net/poll.ts`, Dev-Weiterleitung für `POST` und
   `authorization`. RSS verhält sich unverändert, alle bisherigen Tests bleiben grün.
3. **G2 – GitLab-Kern ohne Oberfläche:** Typ `gitlab` im Schema mit `parseGitlabSettings`,
   `normalizeInstanceUrl`, `gitlabAuth`, `gitlab` und `gitlabSeen` über `SyncedValue`, API-Client
   (GraphQL voll/schlank, `user_counts`, Token-Info), Mapping, Fehlerzuordnung, `GitlabService`,
   Aufräumen (Cache, Gesehen, Tokens), „Alles zurücksetzen“. Registry-Eintrag mit schlichter
   Platzhalter-Liste. Tests aus §9 für diesen Teil, inklusive Token-Dichtheit.
4. **G3 – Widget-Oberfläche:** Abschnitte, Zeilen, Pipeline-Icons, `--success`, Chips, neu und
   gesehen, To-do-Knopf, Kopf und Fuß, leere und Fehler-Zustände mit Aktionen, `fitSections`
   samt `WindowFit` für zwei Listen, Tastatur, Kontextmenü, Announcer, Reduced Motion, i18n,
   Komponententests.
5. **G4 – Einstellungen und Verbinden:** Einstellungs-Komponente mit Adresse, Token, Link zum
   Anlegen, „Verbinden“ mit Rechte-Anfrage im Klick und Prüfung, Token ersetzen und entfernen,
   Ablauf-Hinweis, Intervall, Höhe. Kontrastprüfung bei Tag und Nacht. Die nutzende Person
   prüft in Firefox (`pnpm ext:dev`) mit gitlab.com und, im Büro, mit der Firmen-Instanz und
   VPN aus/an.
6. **G5 – Abschluss:** Entscheidungen nach `docs/decisions.md`, Checkliste, README-Abschnitt
   (Token anlegen, Scope, wo es liegt, wie man es löscht, warum Firefox nach Zugriff fragt),
   diesen Plan löschen. **Release erst nach Rücksprache:** `pnpm version minor` (1.3.0),
   `pnpm ext:sign`, `git push --follow-tags`.

## Bewusst nicht enthalten

Systembenachrichtigungen und Zahl im Tab-Titel (nicht gewählt), Avatare, Filter auf Projekte
oder Gruppen, „zugewiesene“ MRs, Abruf im Hintergrund, mehrere Instanzen pro Widget, Tokens nur
für die Sitzung (`storage.session`), Anmeldung per OAuth statt Token, Aktionen in GitLab
(genehmigen, mergen; dafür bräuchte es den Scope `api`), Polarion, Figma, Teams und Outlook.
Filter, Avatare und zugewiesene MRs ließen sich später als additive Felder ergänzen.
