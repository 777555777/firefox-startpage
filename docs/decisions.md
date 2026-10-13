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
