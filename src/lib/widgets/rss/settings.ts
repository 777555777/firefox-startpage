import { array, bool, createId, int, oneOf, record, str, uniqueId } from '$lib/config/parse';
import { HEIGHT_MODES, type HeightMode } from '$lib/layout/window-fit';
import { feedUrlOrNull } from '$lib/net/feed-url';

export type RssFeed = {
	id: string;
	/** Normalisierte https-URL des Feeds */
	url: string;
	/** Eigener Name; leer = Titel aus dem Feed */
	name: string;
};

/** Eine Kategorie mit eigenen Feeds; innerhalb eines Tabs ist die Liste gemischt */
export type RssTab = {
	id: string;
	label: string;
	/** Optionales Icon, z. B. ein Emoji; leer = keins */
	icon: string;
	feeds: RssFeed[];
};

/** Erlaubte Abruf-Intervalle in Minuten */
export const INTERVALS = [15, 30, 60, 180, 360] as const;
export type IntervalMinutes = (typeof INTERVALS)[number];

export type RssSettings = {
	/** Mindestens ein Tab */
	tabs: RssTab[];
	activeTabId: string;
	/** So viele Einträge zeigt die Liste eines Tabs höchstens */
	maxItems: number;
	intervalMinutes: IntervalMinutes;
	showSummary: boolean;
	/** Titelbilder laden direkt von den Servern der Feeds, deshalb standardmäßig aus */
	showImages: boolean;
	hideRead: boolean;
	/** „Bis Fensterende“ zeigt so viele ganze Einträge, wie bis zum unteren Rand passen */
	height: HeightMode;
};

/** Feeds pro Tab */
export const MAX_FEEDS = 20;
export const MAX_TABS = 10;
/** 50 ist die Obergrenze des Caches pro Feed */
export const MAX_ITEMS = { min: 5, max: 50, default: 20 } as const;
export const NAME_MAX = 100;
export const TAB_LABEL_MAX = 60;

export function createRssTab(label = ''): RssTab {
	return { id: createId(), label, icon: '', feeds: [] };
}

export const defaultRssSettings = (): RssSettings => {
	const tab = createRssTab();
	return {
		tabs: [tab],
		activeTabId: tab.id,
		maxItems: MAX_ITEMS.default,
		intervalMinutes: 30,
		showSummary: false,
		showImages: false,
		hideRead: false,
		height: 'window'
	};
};

/** Rastet auf das nächste erlaubte Intervall ein */
export function snapInterval(value: unknown, fallback: IntervalMinutes): IntervalMinutes {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return INTERVALS.reduce((best, option) =>
		Math.abs(option - value) < Math.abs(best - value) ? option : best
	);
}

function parseFeeds(raw: unknown, ids: Set<string>): RssFeed[] {
	const urls = new Set<string>();
	const feeds: RssFeed[] = [];
	for (const value of array(raw)) {
		const feed = record(value);
		// http wird dabei auf https gehoben, andere Schemata fallen weg
		const url = feedUrlOrNull(feed.url);
		if (!url || urls.has(url) || feeds.length >= MAX_FEEDS) continue;
		urls.add(url);
		feeds.push({ id: uniqueId(feed.id, ids), url, name: str(feed.name, '', NAME_MAX).trim() });
	}
	return feeds;
}

export function parseRssSettings(raw: unknown): RssSettings {
	const d = defaultRssSettings();
	const r = record(raw);
	const tabIds = new Set<string>();
	const feedIds = new Set<string>();
	// Vor den Kategorien gab es nur eine Liste `feeds`; sie wird zu einem Tab ohne Namen
	const rawTabs = Array.isArray(r.tabs) ? r.tabs : [{ feeds: r.feeds }];
	const tabs = rawTabs.slice(0, MAX_TABS).map((value): RssTab => {
		const tab = record(value);
		return {
			id: uniqueId(tab.id, tabIds),
			label: str(tab.label, '', TAB_LABEL_MAX).trim(),
			icon: str(tab.icon, '', 16).trim(),
			feeds: parseFeeds(tab.feeds, feedIds)
		};
	});
	if (tabs.length === 0) tabs.push(createRssTab());
	const activeTabId = tabs.some((tab) => tab.id === r.activeTabId)
		? (r.activeTabId as string)
		: tabs[0].id;
	return {
		tabs,
		activeTabId,
		maxItems: int(r.maxItems, d.maxItems, MAX_ITEMS.min, MAX_ITEMS.max),
		intervalMinutes: snapInterval(r.intervalMinutes, d.intervalMinutes),
		showSummary: bool(r.showSummary, d.showSummary),
		showImages: bool(r.showImages, d.showImages),
		hideRead: bool(r.hideRead, d.hideRead),
		// Auch bestehende Widgets ohne das Feld reichen bis zum Fensterende
		height: oneOf(r.height, HEIGHT_MODES, d.height)
	};
}

/** Aktiver Tab; fällt auf den ersten zurück */
export function activeTabOf(settings: Pick<RssSettings, 'tabs' | 'activeTabId'>): RssTab {
	return settings.tabs.find((tab) => tab.id === settings.activeTabId) ?? settings.tabs[0];
}

/** Alle Feeds aller Tabs, jede Adresse einmal */
export function allFeeds(settings: Pick<RssSettings, 'tabs'>): RssFeed[] {
	const seen = new Set<string>();
	return settings.tabs.flatMap((tab) =>
		tab.feeds.filter((feed) => !seen.has(feed.url) && seen.add(feed.url))
	);
}
