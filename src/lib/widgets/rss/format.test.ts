import { describe, expect, it } from 'vitest';
import { emptyFeedState } from './cache';
import { feedProblems, lastFetched, relativeTime, sourceName } from './format';

const NOW = Date.UTC(2026, 9, 18, 12);
const MIN = 60_000;
const A = 'https://www.a.example.org/feed';
const B = 'https://b.example.org/feed';
const feed = (url: string, name = '') => ({ id: url, url, name });

describe('Darstellung im RSS-Widget', () => {
	it('zeigt relative Zeiten und ab einer Woche das Datum', () => {
		expect(relativeTime(NOW - 10_000, NOW, 'de')).toBe('jetzt');
		expect(relativeTime(NOW + 5 * MIN, NOW, 'de')).toBe('jetzt');
		expect(relativeTime(NOW - 5 * MIN, NOW, 'de')).toBe('vor 5 Min.');
		expect(relativeTime(NOW - 3 * 60 * MIN, NOW, 'en')).toBe('3 hr. ago');
		expect(relativeTime(NOW - 26 * 60 * MIN, NOW, 'de')).toBe('gestern');
		expect(relativeTime(Date.UTC(2026, 8, 1, 12), NOW, 'de')).toBe('1. Sept.');
		expect(relativeTime(Date.UTC(2025, 8, 1, 12), NOW, 'de')).toBe('1. Sept. 2025');
	});

	it('benennt Quellen nach eigenem Namen, Feed-Titel oder Host', () => {
		expect(sourceName(feed(A, 'Mein Name'), { ...emptyFeedState(), title: 'Titel' })).toBe(
			'Mein Name'
		);
		expect(sourceName(feed(A), { ...emptyFeedState(), title: 'Titel' })).toBe('Titel');
		expect(sourceName(feed(A))).toBe('a.example.org');
	});

	it('listet fehlende Rechte vor Abruf-Fehlern und übergeht offline', () => {
		const cache = {
			[A]: { ...emptyFeedState(), error: { code: 'network' as const, at: NOW, attempts: 1 } },
			[B]: { ...emptyFeedState(), error: { code: 'offline' as const, at: NOW, attempts: 1 } }
		};
		expect(feedProblems([feed(A), feed(B)], cache, [])).toEqual([
			{ feed: feed(A), code: 'network' }
		]);
		expect(feedProblems([feed(A)], cache, ['https://*.a.example.org/*'])).toEqual([
			{ feed: feed(A), code: 'permission' }
		]);
	});

	it('findet den jüngsten Abruf', () => {
		const cache = {
			[A]: { ...emptyFeedState(), fetchedAt: NOW - MIN },
			[B]: { ...emptyFeedState(), fetchedAt: NOW }
		};
		expect(lastFetched([feed(A), feed(B)], cache)).toBe(NOW);
		expect(lastFetched([feed(A)], {})).toBeNull();
	});
});
