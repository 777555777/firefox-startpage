import { originPattern } from '$lib/net/permissions';
import type { FeedErrorCode, FeedState } from './cache';
import type { RssFeed } from './settings';

/**
 * Reine Hilfen für die Darstellung des RSS-Widgets: relative Zeiten, Namen der Quellen und
 * welche Feeds Probleme haben.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Relative Zeit wie „vor 5 Min.“ bzw. „5 min ago“; unter einer Minute „jetzt“, ab einer Woche
 * das Datum. Zeiten in der Zukunft (falsche Uhr beim Server) gelten als „jetzt“.
 */
export function relativeTime(date: number, now: number, lang: string): string {
	const diff = Math.max(0, now - date);
	const relative = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
	if (diff < MINUTE) return relative.format(0, 'second');
	if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), 'minute');
	if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), 'hour');
	if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), 'day');
	const sameYear = new Date(date).getFullYear() === new Date(now).getFullYear();
	return new Intl.DateTimeFormat(lang, {
		day: 'numeric',
		month: 'short',
		...(!sameYear && { year: 'numeric' })
	}).format(date);
}

/** Volles Datum mit Uhrzeit, für Tooltips */
export function fullDate(date: number, lang: string): string {
	return new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

/** Anzeigename einer Quelle: eigener Name, sonst Feed-Titel, sonst Host */
export function sourceName(feed: Pick<RssFeed, 'url' | 'name'>, state?: FeedState): string {
	if (feed.name) return feed.name;
	if (state?.title) return state.title;
	try {
		return new URL(feed.url).hostname.replace(/^www\./, '');
	} catch {
		return feed.url;
	}
}

export type FeedProblem = {
	feed: RssFeed;
	/** `permission` = Host-Recht fehlt */
	code: FeedErrorCode | 'permission';
	status?: number;
};

/**
 * Feeds eines Widgets mit Problemen: zuerst fehlende Rechte, dann Abruf-Fehler. „Offline“ zählt
 * nicht, das zeigt das Widget getrennt.
 */
export function feedProblems(
	feeds: RssFeed[],
	cache: Record<string, FeedState>,
	missing: string[]
): FeedProblem[] {
	const problems: FeedProblem[] = [];
	for (const feed of feeds) {
		const pattern = originPattern(feed.url);
		if (pattern && missing.includes(pattern)) {
			problems.push({ feed, code: 'permission' });
			continue;
		}
		const error = cache[feed.url]?.error;
		if (error && error.code !== 'offline') {
			problems.push({
				feed,
				code: error.code,
				...(error.status !== undefined && { status: error.status })
			});
		}
	}
	return problems;
}

/** Jüngster erfolgreicher Abruf über alle Feeds des Widgets */
export function lastFetched(feeds: RssFeed[], cache: Record<string, FeedState>): number | null {
	let latest: number | null = null;
	for (const feed of feeds) {
		const at = cache[feed.url]?.fetchedAt ?? null;
		if (at !== null && (latest === null || at > latest)) latest = at;
	}
	return latest;
}
