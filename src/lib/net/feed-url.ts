/**
 * Adressen von Feeds. Abgerufen wird nur per https: Die Standard-CSP von MV3 hebt http-Anfragen
 * der Extension-Page ohnehin auf https, und das optionale Host-Recht im Manifest gilt nur dafür.
 */

export type FeedUrl = {
	/** Normalisierte https-URL ohne Fragment */
	url: string;
	/** Die Eingabe war `http://` und wurde auf `https://` gehoben */
	upgraded: boolean;
};

/**
 * Prüft und normalisiert eine eingegebene Adresse. Ohne Schema wird `https://` ergänzt.
 * Liefert `null` für alles, was sich nicht abrufen lässt (andere Schemata, Zugangsdaten in der
 * URL, kein Host).
 */
export function normalizeFeedUrl(input: string): FeedUrl | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	let url: URL;
	try {
		url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
	} catch {
		return null;
	}
	const upgraded = url.protocol === 'http:';
	if (upgraded) url.protocol = 'https:';
	if (url.protocol !== 'https:' || !url.hostname) return null;
	// `fetch` lehnt URLs mit Zugangsdaten ab
	if (url.username || url.password) return null;
	url.hash = '';
	return { url: url.href, upgraded };
}

/** Wie `normalizeFeedUrl`, aber nur die URL; für gespeicherte Werte */
export function feedUrlOrNull(value: unknown): string | null {
	return typeof value === 'string' ? (normalizeFeedUrl(value)?.url ?? null) : null;
}
