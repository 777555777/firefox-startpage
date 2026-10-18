# Startpage

Eine Firefox-Extension, die den neuen Tab und die Startseite durch eine eigene Startpage ersetzt:
Uhr, Kalender, Suche, Link-Boards und RSS-Feeds als Widgets auf Liquid Glass über einem eigenen Hintergrundbild
oder -video. Alles ist über die Oberfläche einstellbar, auf Deutsch und Englisch.

Die Extension wird nicht im Add-on-Store gelistet, sondern „unlisted“ signiert und als `.xpi`-Datei
installiert. Die verbindliche Spezifikation steht in [`SPEC.md`](SPEC.md), Entscheidungen und
Abweichungen in [`docs/decisions.md`](docs/decisions.md).

## Installation

Voraussetzung ist Firefox 140 oder neuer (aktuelle ESR reicht).

1. Die signierte `.xpi`-Datei besorgen. Sie liegt nach dem Signieren in `web-ext-artifacts/`
   (siehe [Release](#release)).
2. Die Datei in ein Firefox-Fenster ziehen, oder `about:addons` öffnen → Zahnrad →
   **Add-on aus Datei installieren…** → Datei wählen.
3. Die Nachfrage zum Hinzufügen bestätigen.
4. Beim ersten neuen Tab fragt Firefox, ob die Änderung am neuen Tab beibehalten werden soll:
   **Änderungen beibehalten** wählen. Für die Startseite (Home-Button, Browser-Start) kommt die
   gleiche Frage ggf. beim ersten Öffnen der Startseite.

Ist die Startseite danach noch nicht die Startpage: Einstellungen → **Startseite** → „Startseite
und neue Fenster“ auf die Erweiterung stellen.

### Update

Eine neue Version wird genauso installiert wie die erste, einfach über die vorhandene drüber.
Einstellungen, Links und hochgeladene Hintergründe bleiben erhalten, weil die Extension-ID gleich
bleibt. Automatische Updates gibt es bei „unlisted“ ohne eigenen Update-Server nicht.

### RSS-Feeds und Zugriff auf Websites

Das RSS-Widget ruft Feeds direkt aus der Startpage ab, ohne Hintergrundprozess und nur, solange
ein neuer Tab offen ist. Dafür braucht die Extension Zugriff auf die Website des Feeds. Bei der
Installation fragt Firefox deshalb nichts ab. Erst beim **ersten Feed einer Website** erscheint die
Frage, ob die Extension auf z. B. `*.heise.de` zugreifen darf. Ohne diese Erlaubnis lässt sich der
Feed nicht abrufen und wird nicht angelegt.

- Der Zugriff gilt nur für diese Domain samt Subdomains und nur über https. Abgerufen wird ohne
  Cookies und ohne Referrer; Daten gehen an niemanden außer an die Website selbst.
- Wird kein Feed einer Website mehr gebraucht, gibt die Extension den Zugriff beim nächsten
  Öffnen eines neuen Tabs von selbst zurück.
- Entziehen lässt er sich jederzeit in `about:addons` → Startpage → Reiter **Berechtigungen**
  (in neueren Firefox-Versionen „Berechtigungen und Daten“). Das Widget zeigt dann „Zugriff
  erlauben“, bis man ihn wieder erteilt.
- Nach einem Import auf einem anderen Rechner fehlen die Zugriffe dort noch; ein Klick auf
  „Zugriff erlauben“ im Widget fragt alle auf einmal an.

Feeds lassen sich im Widget in Kategorien (Tabs) ordnen. Damit eine lange Liste die Page nicht
verlängert, bekommt die Zeile im Bearbeiten-Modus eine Höchsthöhe (Griff unter der Zeile); dann
scrollt nur die Liste. Feed-Inhalte und Gelesen-Status bleiben auf dem Rechner und sind nicht im
Export enthalten, die Feeds selbst schon.

### Daten sichern und auf einen anderen Rechner bringen

Jeder Rechner hat eigene Daten, es gibt keinen Sync. Übertragen wird über
Einstellungen → **Daten** → Export bzw. Import (JSON). Hochgeladene Bilder und Videos sind nicht
im Export enthalten und müssen auf dem anderen Rechner neu hochgeladen werden.

> **Achtung:** Beim **Entfernen** der Extension löscht Firefox alle ihre Daten. Vorher exportieren.

## Entwicklung

Benötigt Node.js und pnpm.

```bash
pnpm install
```

| Befehl           | Zweck                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| `pnpm dev`       | Dev-Server mit HMR im normalen Browser (`?debug` öffnet das Debug-Panel) |
| `pnpm ext:dev`   | Build im Watch-Modus und Firefox mit geladener Extension                 |
| `pnpm check`     | Typprüfung (svelte-check)                                                |
| `pnpm lint`      | Prettier und ESLint                                                      |
| `pnpm test`      | Unit- und Komponententests (Vitest)                                      |
| `pnpm ext:lint`  | Build und `web-ext lint`                                                 |
| `pnpm ext:build` | Unsigniertes `.zip` in `web-ext-artifacts/`                              |
| `pnpm ext:sign`  | Build und Signierung „unlisted“ bei AMO, ergibt die `.xpi`               |

Vor jedem Commit müssen `pnpm check && pnpm lint && pnpm test && pnpm ext:lint` grün sein. Die
manuelle Prüfliste steht in [`docs/checklist.md`](docs/checklist.md).

## Release

Die Version steht nur in `package.json`, das Manifest übernimmt sie beim Build. Versioniert wird
nach [SemVer](https://semver.org/lang/de/) (`Major.Minor.Patch`, nur Zahlen, keine Vorabversionen
wie `-beta.1`, die Firefox nicht annimmt). AMO nimmt jede Version nur einmal an, vor jedem
Signieren muss sie also steigen.

### Einmalig: API-Keys

Im [AMO Developer Hub](https://addons.mozilla.org/developers/addon/api/key/) unter
**Manage API Keys** einen Key erzeugen und in `.env.local` im Projektordner eintragen:

```dotenv
WEB_EXT_API_KEY=user:12345678:123
WEB_EXT_API_SECRET=…
```

`.env.local` steht in `.gitignore` und wird nie committet.

### Ablauf

1. Arbeitsstand ist committet, `docs/checklist.md` ist durchgegangen.
2. Version erhöhen. Das führt vorher alle Checks aus, erzeugt den Commit `chore: Version x.y.z`
   und den Tag `vx.y.z`:

   ```bash
   pnpm version patch   # Fehlerbehebungen: 1.0.0 → 1.0.1
   pnpm version minor   # neue Funktionen:  1.0.1 → 1.1.0
   pnpm version major   # große Umbauten:   1.1.0 → 2.0.0
   ```

3. Signieren. Das dauert meist wenige Minuten, die signierte `.xpi` landet in `web-ext-artifacts/`:

   ```bash
   pnpm ext:sign
   ```

4. Commit und Tag pushen:

   ```bash
   git push --follow-tags
   ```

5. Die `.xpi` auf beiden Rechnern installieren (siehe [Update](#update)).

Fragt AMO beim Signieren nach dem Quellcode (der Build ist gebündelt und minifiziert), reicht ein
Archiv des Repos zum Tag, z. B. `git archive -o source.zip vx.y.z`.
