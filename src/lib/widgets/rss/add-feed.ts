import { normalizeFeedUrl } from '$lib/net/feed-url';
import { fetchFeed, type FetchOptions, type FetchResult } from '$lib/net/fetch-feed';
import { missingAccess, originPattern } from '$lib/net/permissions';
import type { FeedErrorCode } from './cache';
import { findFeedLinks, type FeedLink } from './discover';
import { parseFeed, type ParsedFeed } from './parse';

/**
 * Prüft eine Adresse beim Hinzufügen: Ist sie ein Feed, wird er gleich übernommen. Ist sie eine
 * Webseite, wird nach ausgewiesenen Feeds gesucht. Das Host-Recht für die eingegebene Adresse
 * muss vorher (im Klick) angefragt worden sein; liegt ein gefundener Feed auf einer anderen
 * Origin, meldet die Prüfung das, damit ein zweiter Klick das Recht anfragen kann.
 */

export type ProbeResult =
	| {
			kind: 'feed';
			url: string;
			feed: ParsedFeed;
			etag: string | null;
			lastModified: string | null;
	  }
	/** Die Seite bietet mehrere Feeds an */
	| { kind: 'choose'; links: FeedLink[] }
	/** Der gefundene Feed liegt auf einer Origin ohne Recht */
	| { kind: 'needsAccess'; url: string; pattern: string }
	| { kind: 'error'; code: FeedErrorCode | 'notFound'; status?: number };

type Deps = {
	fetch?: (url: string, options: FetchOptions) => Promise<FetchResult>;
	missingAccess?: (patterns: string[]) => Promise<string[]>;
};

export async function probeFeed(url: string, deps: Deps = {}, depth = 0): Promise<ProbeResult> {
	const request = deps.fetch ?? fetchFeed;
	const result = await request(url, {});
	if (result.kind === 'error') {
		return {
			kind: 'error',
			code: result.error.code,
			...(result.error.status !== undefined && { status: result.error.status })
		};
	}
	// Ohne Cache-Angaben gibt es kein „nicht geändert“; sicherheitshalber als Fehler werten
	if (result.kind === 'notModified') return { kind: 'error', code: 'parse' };

	const parsed = parseFeed(result.body, result.url);
	if (parsed.kind === 'feed') {
		return {
			kind: 'feed',
			url,
			feed: parsed.feed,
			etag: result.etag,
			lastModified: result.lastModified
		};
	}
	if (parsed.kind === 'invalid' || depth > 0) return { kind: 'error', code: 'parse' };

	// Eine Webseite: ausgewiesene Feeds suchen
	// Abgerufen wird nur per https; dieselbe Adresse nicht doppelt anbieten
	const links: FeedLink[] = [];
	for (const link of findFeedLinks(result.body, result.url)) {
		const normalized = normalizeFeedUrl(link.url)?.url;
		if (normalized && !links.some((l) => l.url === normalized))
			links.push({ ...link, url: normalized });
	}
	if (links.length === 0) return { kind: 'error', code: 'notFound' };
	if (links.length > 1) return { kind: 'choose', links };
	return probeWithAccess(links[0].url, deps, depth + 1);
}

/** Prüft eine gefundene Adresse, sofern das Recht dafür schon da ist */
export async function probeWithAccess(
	url: string,
	deps: Deps = {},
	depth = 0
): Promise<ProbeResult> {
	const pattern = originPattern(url);
	if (!pattern) return { kind: 'error', code: 'parse' };
	const missing = await (deps.missingAccess ?? missingAccess)([pattern]);
	if (missing.length > 0) return { kind: 'needsAccess', url, pattern };
	return probeFeed(url, deps, depth);
}
