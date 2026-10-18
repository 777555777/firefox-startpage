import type { FeedReads, FeedState } from './cache';
import { allFeeds, type RssSettings } from './settings';

/**
 * Wann ein Feed abgerufen wird, als reine Funktionen mit übergebener Zeit. Abgerufen wird nur
 * aus der sichtbaren Newtab-Page; ein Hintergrundskript gibt es nicht.
 */

const MINUTE = 60_000;
export const LOCK_MS = 60_000;
export const MAX_BACKOFF_MS = 24 * 60 * MINUTE;

/** Intervall pro Feed-URL in ms: steht ein Feed in mehreren Widgets, gilt das kürzeste */
export function feedIntervals(widgets: RssSettings[]): Map<string, number> {
	const intervals = new Map<string, number>();
	for (const settings of widgets) {
		const ms = settings.intervalMinutes * MINUTE;
		for (const feed of allFeeds(settings)) {
			const current = intervals.get(feed.url);
			if (current === undefined || ms < current) intervals.set(feed.url, ms);
		}
	}
	return intervals;
}

/** Nur die Feeds, für die `keep` gilt (z. B. ohne fehlendes Host-Recht) */
export function filterIntervals(
	intervals: Map<string, number>,
	keep: (url: string) => boolean
): Map<string, number> {
	return new Map([...intervals].filter(([url]) => keep(url)));
}

/** Wartezeit nach `attempts` Fehlversuchen: doppeltes, vierfaches … Intervall, höchstens 24 h */
export function backoff(intervalMs: number, attempts: number): number {
	return Math.min(intervalMs * 2 ** Math.max(0, attempts), MAX_BACKOFF_MS);
}

/** Frühester Zeitpunkt für den nächsten regulären Abruf */
export function nextDue(state: FeedState | undefined, intervalMs: number): number {
	if (!state || state.checkedAt === null) return state?.retryAt ?? 0;
	const wait = state.error ? backoff(intervalMs, state.error.attempts) : intervalMs;
	return Math.max(state.checkedAt + wait, state.retryAt ?? 0);
}

export const isLocked = (state: FeedState | undefined, now: number) =>
	(state?.lockUntil ?? 0) > now;

/**
 * Ob jetzt abgerufen werden soll. `force` („Aktualisieren“) übergeht Intervall und Backoff,
 * nicht aber die Sperre eines anderen Tabs oder ein `Retry-After` des Servers.
 */
export function isDue(
	state: FeedState | undefined,
	intervalMs: number,
	now: number,
	force = false
): boolean {
	if (isLocked(state, now)) return false;
	if (force) return (state?.retryAt ?? 0) <= now;
	return nextDue(state, intervalMs) <= now;
}

/** Nächster Zeitpunkt, zu dem irgendein Feed fällig wird (für einen einzigen Timer) */
export function nextWake(
	cache: Record<string, FeedState>,
	intervals: Map<string, number>,
	now: number
): number | null {
	let next: number | null = null;
	for (const [url, interval] of intervals) {
		const state = cache[url];
		const due = Math.max(nextDue(state, interval), isLocked(state, now) ? state!.lockUntil! : 0);
		if (next === null || due < next) next = due;
	}
	return next;
}

// --- Liste im Widget ---------------------------------------------------------------------------

export type ListedItem = {
	feedUrl: string;
	item: FeedState['items'][number];
	/** Zum Sortieren und Anzeigen: Veröffentlichung, sonst erster Abruf */
	date: number;
	read: boolean;
};

/**
 * Gemischte Liste eines Widgets: alle Einträge aller Feeds, neueste zuerst. Derselbe Link aus
 * zwei Feeds erscheint nur einmal. Gelesene fallen auf Wunsch weg.
 */
export function listItems(
	feedUrls: string[],
	cache: Record<string, FeedState>,
	reads: FeedReads,
	options: { maxItems: number; hideRead: boolean }
): ListedItem[] {
	const all: ListedItem[] = [];
	for (const feedUrl of feedUrls) {
		const read = new Set(reads[feedUrl] ?? []);
		for (const item of cache[feedUrl]?.items ?? []) {
			all.push({ feedUrl, item, date: item.published ?? item.firstSeen, read: read.has(item.id) });
		}
	}
	// Stabil sortiert: gleiche Zeit behält die Reihenfolge der Feeds
	all.sort((a, b) => b.date - a.date);
	const links = new Set<string>();
	const result: ListedItem[] = [];
	for (const entry of all) {
		if (entry.item.url) {
			if (links.has(entry.item.url)) continue;
			links.add(entry.item.url);
		}
		if (options.hideRead && entry.read) continue;
		result.push(entry);
		if (result.length >= options.maxItems) break;
	}
	return result;
}
