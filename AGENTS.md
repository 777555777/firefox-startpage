# Agent-Hinweise

- Lies zuerst `SPEC.md`. Sie ist die verbindliche Spezifikation.
- Arbeite die Meilensteine in `SPEC.md` §13 der Reihe nach ab. Am Ende jedes Meilensteins müssen
  `pnpm check && pnpm lint && pnpm test && pnpm ext:lint` grün sein. Danach wird committet.
- Weicht etwas von der Spec ab oder ist dort unklar, entscheide pragmatisch und dokumentiere die
  Entscheidung in `docs/decisions.md`. Die Spec wird nicht stillschweigend geändert.
- Svelte 5 mit Runes, kein SvelteKit. UI-Texte stehen nie hartcodiert im Code, sondern laufen immer über i18n.
- Code-Kommentare schreibst du auf Deutsch.
- Die Referenzprojekte `../startpage` und `../startpage-old` werden nur gelesen, nie verändert.
