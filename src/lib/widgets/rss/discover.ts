import { collapse, parseHtml, safeUrl, truncate } from './text';

/**
 * Feed-Suche: Trägt man eine Website statt eines Feeds ein, stehen ihre Feeds meist als
 * `<link rel="alternate" type="application/rss+xml" href="…">` im Kopf der Seite.
 */

export type FeedLink = {
	url: string;
	/** Titel aus dem Link, sonst leer */
	title: string;
	format: 'rss' | 'atom' | 'json';
};

const FORMATS: Record<string, FeedLink['format']> = {
	'application/rss+xml': 'rss',
	'application/rdf+xml': 'rss',
	'application/atom+xml': 'atom',
	'application/feed+json': 'json',
	'application/json': 'json'
};

/** Feeds, die eine HTML-Seite ausweist, in ihrer Reihenfolge und ohne Dopplungen */
export function findFeedLinks(html: string, pageUrl: string): FeedLink[] {
	const doc = parseHtml(html);
	// `<base href>` gilt für alle relativen Adressen der Seite
	const base = safeUrl(doc.querySelector('base[href]')?.getAttribute('href'), pageUrl) ?? pageUrl;
	const links: FeedLink[] = [];
	const seen = new Set<string>();
	for (const link of doc.querySelectorAll('link[rel][href][type]')) {
		const rel = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
		const type = (link.getAttribute('type') ?? '').toLowerCase().split(';')[0].trim();
		const format = FORMATS[type];
		if (!rel.includes('alternate') || !format) continue;
		// Gewöhnliches JSON nur, wenn der Link nach Feed aussieht (z. B. WordPress-API-Links nicht)
		if (type === 'application/json' && !/feed/i.test(link.getAttribute('title') ?? '')) continue;
		const url = safeUrl(link.getAttribute('href'), base);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		links.push({ url, title: truncate(collapse(link.getAttribute('title') ?? ''), 200), format });
	}
	return links;
}
