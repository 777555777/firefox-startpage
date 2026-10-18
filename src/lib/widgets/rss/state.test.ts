import { describe, expect, it } from 'vitest';
import {
	applyFailure,
	applyFetched,
	applyNotModified,
	emptyFeedState,
	parseFeedCache,
	parseFeedReads,
	pruneCache,
	pruneReads,
	type CachedItem,
	type FeedState
} from './cache';
import type { ParsedFeed } from './parse';
import {
	backoff,
	feedIntervals,
	isDue,
	listItems,
	LOCK_MS,
	MAX_BACKOFF_MS,
	nextDue,
	nextWake
} from './schedule';
import { defaultRssSettings, parseRssSettings, type RssSettings } from './settings';

const MIN = 60_000;
const NOW = Date.UTC(2026, 9, 18, 12);
const A = 'https://a.example.org/feed';
const B = 'https://b.example.org/feed';

const item = (id: string, extra: Partial<CachedItem> = {}): CachedItem => ({
	id,
	title: `Titel ${id}`,
	url: `https://a.example.org/${id}`,
	published: null,
	summary: '',
	image: null,
	firstSeen: NOW,
	...extra
});

const state = (extra: Partial<FeedState> = {}): FeedState => ({ ...emptyFeedState(), ...extra });

const widget = (urls: string[], intervalMinutes: RssSettings['intervalMinutes'] = 30) =>
	parseRssSettings({ feeds: urls.map((url) => ({ url })), intervalMinutes });

describe('RSS-Einstellungen', () => {
	it('ergänzt Fehlendes', () => {
		expect(parseRssSettings(undefined)).toEqual(defaultRssSettings());
		expect(defaultRssSettings()).toMatchObject({
			maxItems: 20,
			intervalMinutes: 30,
			showImages: false
		});
	});

	it('normalisiert Feeds und verwirft Ungültiges und Doppeltes', () => {
		const settings = parseRssSettings({
			feeds: [
				{ id: 'x', url: 'http://example.org/feed', name: '  Beispiel ' },
				{ id: 'x', url: 'https://example.org/feed' },
				{ url: 'javascript:alert(1)' },
				{ url: 'ftp://example.org/' },
				'kaputt',
				{ url: 'example.net/rss' }
			]
		});
		expect(settings.feeds.map((feed) => [feed.url, feed.name])).toEqual([
			['https://example.org/feed', 'Beispiel'],
			['https://example.net/rss', '']
		]);
		expect(new Set(settings.feeds.map((feed) => feed.id)).size).toBe(2);
	});

	it('begrenzt Feeds, Einträge und rastet das Intervall ein', () => {
		const many = Array.from({ length: 30 }, (_, i) => ({ url: `https://e${i}.example.org/` }));
		const settings = parseRssSettings({ feeds: many, maxItems: 500, intervalMinutes: 50 });
		expect(settings.feeds).toHaveLength(20);
		expect(settings.maxItems).toBe(50);
		expect(settings.intervalMinutes).toBe(60);
		expect(parseRssSettings({ maxItems: 1, intervalMinutes: 'oft' })).toMatchObject({
			maxItems: 5,
			intervalMinutes: 30
		});
	});
});

describe('Feed-Cache', () => {
	it('validiert gespeicherte Daten und verwirft Unbrauchbares', () => {
		const cache = parseFeedCache({
			[A]: {
				fetchedAt: NOW,
				items: [
					item('1'),
					item('1'),
					{ ...item('2'), url: 'javascript:alert(1)', image: 'http://x.example/a.jpg' },
					{ id: 'ohne-firstSeen' }
				],
				error: { code: 'http', status: 503, at: NOW, attempts: 2 },
				lockUntil: -5
			},
			'http://unsicher.example.org/': {},
			kaputt: {}
		});
		expect(Object.keys(cache)).toEqual([A]);
		expect(cache[A].items.map((i) => [i.id, i.url, i.image])).toEqual([
			['1', 'https://a.example.org/1', null],
			['2', null, null]
		]);
		expect(cache[A].error).toEqual({ code: 'http', status: 503, at: NOW, attempts: 2 });
		expect(cache[A].lockUntil).toBeNull();
	});

	it('validiert den Gelesen-Status', () => {
		expect(parseFeedReads({ [A]: ['1', '1', 2, '3'], [B]: [], x: ['1'] })).toEqual({
			[A]: ['1', '3']
		});
	});

	it('übernimmt Abrufe und behält, wann ein Eintrag zuerst auftauchte', () => {
		const before = state({ items: [item('1', { firstSeen: NOW - 60 * MIN })] });
		const feed: ParsedFeed = {
			title: 'Feed',
			siteUrl: 'https://a.example.org/',
			language: 'de',
			items: [
				{ id: '2', title: 'Neu', url: null, published: null, summary: '', image: null },
				{ id: '1', title: 'Alt', url: null, published: null, summary: '', image: null }
			]
		};
		const next = applyFetched(before, feed, { etag: '"v2"', lastModified: null }, NOW);
		expect(next.items.map((i) => [i.id, i.firstSeen])).toEqual([
			['2', NOW],
			['1', NOW - 60 * MIN]
		]);
		expect(next).toMatchObject({ fetchedAt: NOW, checkedAt: NOW, etag: '"v2"', error: null });
	});

	it('zählt Fehlversuche und setzt sie bei Erfolg zurück', () => {
		const once = applyFailure(state({ items: [item('1')] }), { code: 'network' }, NOW);
		const twice = applyFailure(once, { code: 'http', status: 429, retryAt: NOW + MIN }, NOW + 1);
		expect(twice.items).toHaveLength(1);
		expect(twice.error).toEqual({ code: 'http', status: 429, at: NOW + 1, attempts: 2 });
		expect(twice.retryAt).toBe(NOW + MIN);
		expect(applyNotModified(twice, NOW + 2)).toMatchObject({
			error: null,
			retryAt: null,
			fetchedAt: NOW + 2,
			items: twice.items
		});
	});

	it('räumt Cache und Gelesen-Status nicht mehr gebrauchter Feeds auf', () => {
		const cache = { [A]: state({ items: [item('1')] }), [B]: state() };
		const used = new Set([A]);
		expect(Object.keys(pruneCache(cache, used))).toEqual([A]);
		expect(pruneCache(cache, new Set([A, B]))).toBe(cache);
		const reads = { [A]: ['1', 'weg'], [B]: ['x'] };
		expect(pruneReads(reads, cache, used)).toEqual({ [A]: ['1'] });
		// Ohne Cache-Eintrag bleibt der Status stehen, bis der Feed geladen ist
		expect(pruneReads({ [A]: ['1'], [B]: ['y'] }, { [A]: cache[A] })).toEqual({
			[A]: ['1'],
			[B]: ['y']
		});
		const unchanged = { [A]: ['1'] };
		expect(pruneReads(unchanged, cache)).toBe(unchanged);
	});
});

describe('Zeitplan', () => {
	it('nimmt pro Feed das kürzeste Intervall aller Widgets', () => {
		const intervals = feedIntervals([widget([A, B], 60), widget([A], 15)]);
		expect(intervals.get(A)).toBe(15 * MIN);
		expect(intervals.get(B)).toBe(60 * MIN);
	});

	it('ruft neue Feeds sofort und sonst nach dem Intervall ab', () => {
		expect(isDue(undefined, 30 * MIN, NOW)).toBe(true);
		const fresh = state({ checkedAt: NOW - 10 * MIN, fetchedAt: NOW - 10 * MIN });
		expect(isDue(fresh, 30 * MIN, NOW)).toBe(false);
		expect(nextDue(fresh, 30 * MIN)).toBe(NOW + 20 * MIN);
		expect(isDue(fresh, 30 * MIN, NOW, true)).toBe(true);
	});

	it('wartet nach Fehlern länger, höchstens 24 Stunden', () => {
		expect(backoff(30 * MIN, 1)).toBe(60 * MIN);
		expect(backoff(30 * MIN, 3)).toBe(240 * MIN);
		expect(backoff(360 * MIN, 5)).toBe(MAX_BACKOFF_MS);
		const failed = state({
			checkedAt: NOW - 45 * MIN,
			error: { code: 'network', at: NOW - 45 * MIN, attempts: 1 }
		});
		expect(isDue(failed, 30 * MIN, NOW)).toBe(false);
		expect(isDue(failed, 30 * MIN, NOW + 15 * MIN)).toBe(true);
	});

	it('beachtet Retry-After und die Sperre anderer Tabs, auch beim Aktualisieren', () => {
		const limited = state({ checkedAt: NOW - 60 * MIN, retryAt: NOW + 5 * MIN });
		expect(isDue(limited, 30 * MIN, NOW)).toBe(false);
		expect(isDue(limited, 30 * MIN, NOW, true)).toBe(false);
		const locked = state({ lockUntil: NOW + LOCK_MS });
		expect(isDue(locked, 30 * MIN, NOW, true)).toBe(false);
		expect(isDue(locked, 30 * MIN, NOW + LOCK_MS)).toBe(true);
	});

	it('findet den nächsten Weckzeitpunkt', () => {
		const intervals = feedIntervals([widget([A, B], 30)]);
		const cache = {
			[A]: state({ checkedAt: NOW - 10 * MIN }),
			[B]: state({ checkedAt: NOW - 25 * MIN })
		};
		expect(nextWake(cache, intervals, NOW)).toBe(NOW + 5 * MIN);
		expect(nextWake({}, new Map(), NOW)).toBeNull();
		const locked = { [A]: state({ checkedAt: NOW - 60 * MIN, lockUntil: NOW + LOCK_MS }) };
		expect(nextWake(locked, new Map([[A, 30 * MIN]]), NOW)).toBe(NOW + LOCK_MS);
	});
});

describe('Liste im Widget', () => {
	const cache = {
		[A]: state({
			items: [
				item('a1', { published: NOW - 1 * MIN }),
				item('a2', { published: null, firstSeen: NOW - 5 * MIN }),
				item('gleich', { published: NOW - 30 * MIN, url: 'https://gleich.example.org/' })
			]
		}),
		[B]: state({
			items: [
				item('b1', { published: NOW - 2 * MIN, url: 'https://b.example.org/1' }),
				item('gleich', { published: NOW - 20 * MIN, url: 'https://gleich.example.org/' })
			]
		})
	};

	it('mischt nach Datum, nutzt sonst den ersten Abruf und zeigt gleiche Links einmal', () => {
		const list = listItems([A, B], cache, { [A]: ['a1'] }, { maxItems: 10, hideRead: false });
		expect(
			list.map((entry) => [entry.item.id, entry.feedUrl === A ? 'A' : 'B', entry.read])
		).toEqual([
			['a1', 'A', true],
			['b1', 'B', false],
			['a2', 'A', false],
			['gleich', 'B', false]
		]);
		expect(list[2].date).toBe(NOW - 5 * MIN);
	});

	it('blendet Gelesenes aus und begrenzt die Anzahl', () => {
		const options = { maxItems: 2, hideRead: true };
		const list = listItems([A, B], cache, { [A]: ['a1'] }, options);
		expect(list.map((entry) => entry.item.id)).toEqual(['b1', 'a2']);
		expect(listItems([], cache, {}, options)).toEqual([]);
	});
});
