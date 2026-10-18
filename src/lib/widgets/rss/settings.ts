import { array, bool, int, record, str, uniqueId } from '$lib/config/parse';
import { feedUrlOrNull } from '$lib/net/feed-url';

export type RssFeed = {
	id: string;
	/** Normalisierte https-URL des Feeds */
	url: string;
	/** Eigener Name; leer = Titel aus dem Feed */
	name: string;
};

/** Erlaubte Abruf-Intervalle in Minuten */
export const INTERVALS = [15, 30, 60, 180, 360] as const;
export type IntervalMinutes = (typeof INTERVALS)[number];

export type RssSettings = {
	/** Überschrift im Widget; leer = keine */
	title: string;
	feeds: RssFeed[];
	/** So viele Einträge zeigt die Liste höchstens */
	maxItems: number;
	intervalMinutes: IntervalMinutes;
	showSummary: boolean;
	/** Titelbilder laden direkt von den Servern der Feeds, deshalb standardmäßig aus */
	showImages: boolean;
	hideRead: boolean;
};

export const MAX_FEEDS = 20;
/** 50 ist die Obergrenze des Caches pro Feed */
export const MAX_ITEMS = { min: 5, max: 50, default: 20 } as const;
export const TITLE_MAX = 100;
export const NAME_MAX = 100;

export const defaultRssSettings = (): RssSettings => ({
	title: '',
	feeds: [],
	maxItems: MAX_ITEMS.default,
	intervalMinutes: 30,
	showSummary: false,
	showImages: false,
	hideRead: false
});

/** Rastet auf das nächste erlaubte Intervall ein */
export function snapInterval(value: unknown, fallback: IntervalMinutes): IntervalMinutes {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return INTERVALS.reduce((best, option) =>
		Math.abs(option - value) < Math.abs(best - value) ? option : best
	);
}

export function parseRssSettings(raw: unknown): RssSettings {
	const d = defaultRssSettings();
	const r = record(raw);
	const ids = new Set<string>();
	const urls = new Set<string>();
	const feeds: RssFeed[] = [];
	for (const value of array(r.feeds)) {
		const feed = record(value);
		// http wird dabei auf https gehoben, andere Schemata fallen weg
		const url = feedUrlOrNull(feed.url);
		if (!url || urls.has(url) || feeds.length >= MAX_FEEDS) continue;
		urls.add(url);
		feeds.push({ id: uniqueId(feed.id, ids), url, name: str(feed.name, '', NAME_MAX).trim() });
	}
	return {
		title: str(r.title, d.title, TITLE_MAX).trim(),
		feeds,
		maxItems: int(r.maxItems, d.maxItems, MAX_ITEMS.min, MAX_ITEMS.max),
		intervalMinutes: snapInterval(r.intervalMinutes, d.intervalMinutes),
		showSummary: bool(r.showSummary, d.showSummary),
		showImages: bool(r.showImages, d.showImages),
		hideRead: bool(r.hideRead, d.hideRead)
	};
}
