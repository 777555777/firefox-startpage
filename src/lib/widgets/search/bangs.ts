import type { SearchEngine } from '$lib/config/types';

export type ParsedQuery = {
	/** Per Bang gewählte Engine; null = keine (bzw. unbekannter Bang) */
	engine: SearchEngine | null;
	/** Suchtext ohne den erkannten Bang */
	query: string;
};

function findEngine(token: string, engines: SearchEngine[]): SearchEngine | null {
	if (!token.startsWith('!') || token.length < 2) return null;
	const bang = token.slice(1).toLowerCase();
	return engines.find((engine) => engine.bang && engine.bang === bang) ?? null;
}

/**
 * Erkennt `!bang suchtext` und `suchtext !bang`. Unbekannte Bangs bleiben normaler Suchtext.
 */
export function parseBang(input: string, engines: SearchEngine[]): ParsedQuery {
	const trimmed = input.trim();
	const tokens = trimmed.split(/\s+/);
	const first = findEngine(tokens[0], engines);
	if (first) return { engine: first, query: tokens.slice(1).join(' ') };
	if (tokens.length > 1) {
		const last = findEngine(tokens[tokens.length - 1], engines);
		if (last) return { engine: last, query: tokens.slice(0, -1).join(' ') };
	}
	return { engine: null, query: trimmed };
}

/** Ziel-URL einer Suche; ohne Suchtext die Startseite der Engine */
export function searchUrl(engine: SearchEngine, query: string): string {
	if (!query.trim()) {
		try {
			return new URL(engine.url.replaceAll('%s', '')).origin;
		} catch {
			return engine.url.replaceAll('%s', '');
		}
	}
	return engine.url.replaceAll('%s', encodeURIComponent(query.trim()));
}
