import { array, isRecord, record, str } from '$lib/config/parse';
import type { FetchErrorCode } from '$lib/net/fetch-feed';
import {
	FEED_TITLE_MAX,
	MAX_ITEMS,
	SUMMARY_MAX,
	TITLE_MAX,
	type FeedItem,
	type ParsedFeed
} from './parse';

/**
 * Cache der Feeds in `storage.local` (Schlüssel `feeds`), getrennt von der Config: Er wird nicht
 * exportiert und landet nicht in Backups. Daneben der Gelesen-Status (`feedReads`), damit
 * „gelesen“ nicht jedes Mal den ganzen Cache neu schreibt. Beides gilt pro Feed-URL, also in
 * allen Widgets mit diesem Feed.
 */

export type FeedErrorCode = FetchErrorCode | 'parse';

export type FeedError = {
	code: FeedErrorCode;
	/** HTTP-Status bei `http` */
	status?: number;
	at: number;
	/** Fehlversuche in Folge, für den Backoff */
	attempts: number;
};

export type CachedItem = FeedItem & {
	/** Erster Abruf, in dem der Eintrag auftauchte; Ersatz für ein fehlendes Datum */
	firstSeen: number;
};

export type FeedState = {
	/** Letzter erfolgreicher Abruf (auch „nicht geändert“) */
	fetchedAt: number | null;
	/** Letzter Versuch, erfolgreich oder nicht */
	checkedAt: number | null;
	etag: string | null;
	lastModified: string | null;
	title: string;
	siteUrl: string | null;
	language: string | null;
	items: CachedItem[];
	error: FeedError | null;
	/** Frühester nächster Versuch laut Server (`Retry-After`) */
	retryAt: number | null;
	/** Ein Tab ruft gerade ab; andere Tabs warten bis dahin */
	lockUntil: number | null;
};

export type FeedCache = Record<string, FeedState>;
export type FeedReads = Record<string, string[]>;

const ERROR_CODES: readonly FeedErrorCode[] = [
	'offline',
	'network',
	'redirect',
	'http',
	'tooLarge',
	'timeout',
	'parse'
];

export const emptyFeedState = (): FeedState => ({
	fetchedAt: null,
	checkedAt: null,
	etag: null,
	lastModified: null,
	title: '',
	siteUrl: null,
	language: null,
	items: [],
	error: null,
	retryAt: null,
	lockUntil: null
});

// --- Validierung -------------------------------------------------------------------------------

const time = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const nullableStr = (value: unknown, max: number): string | null =>
	typeof value === 'string' && value ? value.slice(0, max) : null;

/** Gespeicherte Adressen: nur http(s), Bilder nur https */
function storedUrl(value: unknown, https = false): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value);
		const ok = url.protocol === 'https:' || (!https && url.protocol === 'http:');
		return ok ? url.href : null;
	} catch {
		return null;
	}
}

function parseItem(raw: unknown): CachedItem | null {
	const r = record(raw);
	const id = str(r.id, '', 500);
	const firstSeen = time(r.firstSeen);
	if (!id || firstSeen === null) return null;
	return {
		id,
		title: str(r.title, '', TITLE_MAX),
		url: storedUrl(r.url),
		published: time(r.published),
		summary: str(r.summary, '', SUMMARY_MAX),
		image: storedUrl(r.image, true),
		firstSeen
	};
}

function parseError(raw: unknown): FeedError | null {
	if (!isRecord(raw)) return null;
	const code = raw.code;
	const at = time(raw.at);
	if (!ERROR_CODES.includes(code as FeedErrorCode) || at === null) return null;
	const attempts =
		typeof raw.attempts === 'number' && raw.attempts >= 1 ? Math.floor(raw.attempts) : 1;
	const status = typeof raw.status === 'number' ? Math.floor(raw.status) : undefined;
	return { code: code as FeedErrorCode, at, attempts, ...(status !== undefined && { status }) };
}

export function parseFeedState(raw: unknown): FeedState {
	const r = record(raw);
	const ids = new Set<string>();
	const items: CachedItem[] = [];
	for (const value of array(r.items)) {
		const item = parseItem(value);
		if (!item || ids.has(item.id)) continue;
		ids.add(item.id);
		items.push(item);
		if (items.length >= MAX_ITEMS) break;
	}
	return {
		fetchedAt: time(r.fetchedAt),
		checkedAt: time(r.checkedAt),
		etag: nullableStr(r.etag, 500),
		lastModified: nullableStr(r.lastModified, 100),
		title: str(r.title, '', FEED_TITLE_MAX),
		siteUrl: storedUrl(r.siteUrl),
		language: nullableStr(r.language, 35),
		items,
		error: parseError(r.error),
		retryAt: time(r.retryAt),
		lockUntil: time(r.lockUntil)
	};
}

export function parseFeedCache(raw: unknown): FeedCache {
	const cache: FeedCache = {};
	for (const [url, value] of Object.entries(record(raw))) {
		if (storedUrl(url, true) === url) cache[url] = parseFeedState(value);
	}
	return cache;
}

export function parseFeedReads(raw: unknown): FeedReads {
	const reads: FeedReads = {};
	for (const [url, value] of Object.entries(record(raw))) {
		if (storedUrl(url, true) !== url) continue;
		const ids = [...new Set(array(value).filter((id): id is string => typeof id === 'string'))];
		if (ids.length > 0) reads[url] = ids.slice(0, MAX_ITEMS * 2);
	}
	return reads;
}

// --- Änderungen ---------------------------------------------------------------------------------

/** Gelesen-IDs eines Feeds nach dem Markieren als gelesen bzw. ungelesen */
export function toggleReads(current: string[] | undefined, ids: string[], read: boolean): string[] {
	const next = new Set(current ?? []);
	for (const id of ids) {
		if (read) next.add(id);
		else next.delete(id);
	}
	return [...next];
}

/** Neuer Stand nach erfolgreichem Abruf; `firstSeen` bleibt für bekannte Einträge erhalten */
export function applyFetched(
	previous: FeedState | undefined,
	feed: ParsedFeed,
	meta: { etag: string | null; lastModified: string | null },
	now: number
): FeedState {
	const seen = new Map(previous?.items.map((item) => [item.id, item.firstSeen]));
	return {
		...(previous ?? emptyFeedState()),
		fetchedAt: now,
		checkedAt: now,
		etag: meta.etag,
		lastModified: meta.lastModified,
		title: feed.title,
		siteUrl: feed.siteUrl,
		language: feed.language,
		items: feed.items.map((item) => ({ ...item, firstSeen: seen.get(item.id) ?? now })),
		error: null,
		retryAt: null,
		lockUntil: null
	};
}

/** Neuer Stand nach „nicht geändert“ (304) */
export function applyNotModified(previous: FeedState | undefined, now: number): FeedState {
	return {
		...(previous ?? emptyFeedState()),
		fetchedAt: now,
		checkedAt: now,
		error: null,
		retryAt: null,
		lockUntil: null
	};
}

/** Neuer Stand nach einem Fehler; die letzten gültigen Einträge bleiben stehen */
export function applyFailure(
	previous: FeedState | undefined,
	error: { code: FeedErrorCode; status?: number; retryAt?: number },
	now: number
): FeedState {
	const state = previous ?? emptyFeedState();
	return {
		...state,
		checkedAt: now,
		error: {
			code: error.code,
			at: now,
			attempts: (state.error?.attempts ?? 0) + 1,
			...(error.status !== undefined && { status: error.status })
		},
		retryAt: error.retryAt ?? null,
		lockUntil: null
	};
}

/** Entfernt Cache-Einträge von Feeds, die in keinem Widget mehr stehen */
export function pruneCache(cache: FeedCache, used: { has(url: string): boolean }): FeedCache {
	const entries = Object.entries(cache).filter(([url]) => used.has(url));
	return entries.length === Object.keys(cache).length ? cache : Object.fromEntries(entries);
}

/**
 * Gelesen-IDs nur für Feeds, die noch gebraucht werden (`used`), und nur für Einträge, die es im
 * Cache noch gibt
 */
export function pruneReads(
	reads: FeedReads,
	cache: FeedCache,
	used?: { has(url: string): boolean }
): FeedReads {
	const next: FeedReads = {};
	let changed = false;
	for (const [url, ids] of Object.entries(reads)) {
		if (used && !used.has(url)) {
			changed = true;
			continue;
		}
		const state = cache[url];
		// Ohne Cache-Eintrag (noch nicht geladen) bleibt der Status vorerst stehen
		const kept = state ? ids.filter((id) => state.items.some((item) => item.id === id)) : ids;
		if (kept.length !== ids.length) changed = true;
		if (kept.length > 0) next[url] = kept;
		else if (ids.length > 0) changed = true;
	}
	return changed ? next : reads;
}
