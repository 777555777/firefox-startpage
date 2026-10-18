import { extensionApi } from '$lib/storage/extension';

/**
 * Host-Rechte zur Laufzeit (`optional_host_permissions`). Angefragt wird pro Feed-Origin, und
 * zwar inklusive Subdomains: `https://www.heise.de/feed` braucht `https://*.heise.de/*`. Das deckt
 * die häufigste Umleitung (mit/ohne `www`) und Feed-Subdomains ab, ohne Public-Suffix-Liste.
 *
 * Außerhalb der Extension (Dev-Server, Tests) gibt es keine Rechte; dort gilt alles als erlaubt.
 */

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Muster für das Host-Recht einer URL, oder `null`, wenn sie keine https-URL ist */
export function originPattern(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
	const host = parsed.hostname;
	// IP-Adressen und Hosts ohne Punkt (z. B. `localhost`) bekommen kein Platzhalter-Muster
	if (IPV4.test(host) || host.startsWith('[') || !host.includes('.')) return `https://${host}/*`;
	const base = host.startsWith('www.') && host.split('.').length > 2 ? host.slice(4) : host;
	return `https://*.${base}/*`;
}

/** Benötigte Muster für eine Liste von URLs, ohne Dopplungen */
export function patternsFor(urls: Iterable<string>): string[] {
	const patterns = new Set<string>();
	for (const url of urls) {
		const pattern = originPattern(url);
		if (pattern) patterns.add(pattern);
	}
	return [...patterns].sort();
}

/** Gewährte Muster, die keine der benötigten mehr sind und abgegeben werden können */
export function unusedPatterns(granted: Iterable<string>, needed: Iterable<string>): string[] {
	const keep = new Set(needed);
	return [...granted].filter((pattern) => pattern.startsWith('https://') && !keep.has(pattern));
}

/** Muster, für die das Recht fehlt */
export async function missingAccess(patterns: string[]): Promise<string[]> {
	const api = extensionApi();
	if (!api?.permissions || patterns.length === 0) return [];
	const results = await Promise.all(
		patterns.map(async (pattern) => {
			try {
				return (await api.permissions.contains({ origins: [pattern] })) ? null : pattern;
			} catch {
				return pattern;
			}
		})
	);
	return results.filter((pattern): pattern is string => pattern !== null);
}

/**
 * Fragt Rechte an. Firefox erlaubt das nur direkt im Handler einer Nutzeraktion: Diese Funktion
 * muss deshalb vor jedem `await` aufgerufen werden und ruft die API selbst synchron auf.
 */
export function requestAccess(patterns: string[]): Promise<boolean> {
	const api = extensionApi();
	if (!api?.permissions || patterns.length === 0) return Promise.resolve(true);
	return api.permissions.request({ origins: patterns }).catch((error: unknown) => {
		console.warn('permissions.request fehlgeschlagen', error);
		return false;
	});
}

/** Gibt alle gewährten Host-Rechte ab, die nicht in `needed` stehen; liefert die abgegebenen */
export async function releaseUnusedAccess(needed: string[]): Promise<string[]> {
	const api = extensionApi();
	if (!api?.permissions) return [];
	try {
		const granted = (await api.permissions.getAll()).origins ?? [];
		const unused = unusedPatterns(granted, needed);
		if (unused.length > 0) await api.permissions.remove({ origins: unused });
		return unused;
	} catch (error) {
		console.warn('Host-Rechte abgeben fehlgeschlagen', error);
		return [];
	}
}

/** Meldet, wenn Rechte dazukommen oder entzogen werden (z. B. in `about:addons`) */
export function onAccessChange(listener: () => void): () => void {
	const api = extensionApi();
	if (!api?.permissions) return () => {};
	api.permissions.onAdded.addListener(listener);
	api.permissions.onRemoved.addListener(listener);
	return () => {
		api.permissions.onAdded.removeListener(listener);
		api.permissions.onRemoved.removeListener(listener);
	};
}
