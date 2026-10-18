import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FetchOptions, FetchResult } from '$lib/net/fetch-feed';
import { createAppState } from '$lib/state/app.svelte';
import { SyncedValue } from '$lib/state/synced.svelte';
import { createMemoryStore } from '$lib/storage/kv';
import { emptyFeedState, type FeedCache, type FeedReads } from './cache';
import { LOCK_MS } from './schedule';
import { FeedService } from './service.svelte';
import { parseRssSettings, type RssSettings } from './settings';

const A = 'https://a.example.org/feed';
const B = 'https://b.example.org/feed';
const MIN = 60_000;

const rss = (titles: string[]) =>
	`<rss version="2.0"><channel><title>Feed</title>${titles
		.map((title) => `<item><title>${title}</title><guid>${title}</guid></item>`)
		.join('')}</channel></rss>`;

const ok = (url: string, body: string, etag: string | null = null): FetchResult => ({
	kind: 'ok',
	url,
	body,
	contentType: 'application/rss+xml',
	etag,
	lastModified: null
});

function setup(urls: string[], respond: (url: string, options: FetchOptions) => FetchResult) {
	let now = Date.UTC(2026, 9, 18, 12);
	let online = true;
	const kv = createMemoryStore();
	const widgets = $state<RssSettings[]>([
		parseRssSettings({ feeds: urls.map((url) => ({ url })), intervalMinutes: 30 })
	]);
	const cache = new SyncedValue<FeedCache>(
		kv,
		{},
		{ key: 'feeds', parse: (raw) => raw as FeedCache }
	);
	const reads = new SyncedValue<FeedReads>(
		kv,
		{},
		{ key: 'feedReads', parse: (raw) => raw as FeedReads }
	);
	const fetch = vi.fn(async (url: string, options: FetchOptions) => respond(url, options));
	const service = new FeedService({
		widgets: () => widgets,
		cache,
		reads,
		fetch,
		now: () => now,
		online: () => online
	});
	return {
		service,
		cache,
		reads,
		fetch,
		widgets,
		advance: (ms: number) => (now += ms),
		setOnline: (value: boolean) => (online = value),
		now: () => now
	};
}

describe('Abruf-Dienst', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('ruft fällige Feeds ab und dann erst wieder nach dem Intervall', async () => {
		const { service, cache, fetch, advance } = setup([A, B], (url) =>
			ok(url, rss(['eins', 'zwei']), '"v1"')
		);
		await service.tick();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(cache.value[A].items.map((item) => item.id)).toEqual(['eins', 'zwei']);
		expect(cache.value[A]).toMatchObject({ etag: '"v1"', lockUntil: null, error: null });

		advance(10 * MIN);
		await service.tick();
		expect(fetch).toHaveBeenCalledTimes(2);

		advance(25 * MIN);
		await service.tick();
		expect(fetch).toHaveBeenCalledTimes(4);
		// Bedingte Anfrage mit dem gespeicherten ETag
		expect(fetch.mock.calls[2][1]).toMatchObject({ etag: '"v1"' });
	});

	it('behält Einträge bei „nicht geändert“ und bei Fehlern', async () => {
		let next: FetchResult = ok(A, rss(['eins']));
		const { service, cache, advance } = setup([A], () => next);
		await service.tick();
		next = { kind: 'notModified' };
		advance(31 * MIN);
		await service.tick();
		expect(cache.value[A].items).toHaveLength(1);
		next = { kind: 'error', error: { code: 'http', status: 500 } };
		advance(31 * MIN);
		await service.tick();
		expect(cache.value[A].items).toHaveLength(1);
		expect(cache.value[A].error).toMatchObject({ code: 'http', status: 500, attempts: 1 });
	});

	it('wertet Webseiten und Unlesbares als Parse-Fehler', async () => {
		const { service, cache } = setup([A], (url) => ok(url, '<!doctype html><html></html>'));
		await service.tick();
		expect(cache.value[A].error?.code).toBe('parse');
	});

	it('übergeht mit „Aktualisieren“ Intervall und Backoff', async () => {
		const { service, fetch } = setup([A], () => ({
			kind: 'error',
			error: { code: 'network' }
		}));
		await service.tick();
		await service.tick();
		expect(fetch).toHaveBeenCalledTimes(1);
		await service.refresh([A]);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('ruft nicht ab, solange ein anderer Tab den Feed gesperrt hat', async () => {
		const { service, cache, fetch, now, advance } = setup([A], (url) => ok(url, rss(['eins'])));
		cache.value[A] = { ...emptyFeedState(), lockUntil: now() + LOCK_MS };
		await service.refresh([A]);
		expect(fetch).not.toHaveBeenCalled();
		advance(LOCK_MS);
		await service.tick();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('ruft offline nicht ab und zählt das nicht als Fehler', async () => {
		const { service, cache, fetch, setOnline } = setup([A], () => ({
			kind: 'error',
			error: { code: 'offline' }
		}));
		setOnline(false);
		await service.tick();
		expect(fetch).not.toHaveBeenCalled();
		setOnline(true);
		await service.tick();
		expect(cache.value[A].error).toBeNull();
	});

	it('ruft ohne Host-Recht nicht ab und meldet das fehlende Recht', async () => {
		vi.stubGlobal('browser', {
			runtime: { id: 'test' },
			permissions: {
				contains: async ({ origins }: { origins: string[] }) => origins[0].includes('a.')
			}
		});
		const { service, fetch } = setup([A, B], (url) => ok(url, rss(['eins'])));
		await service.checkAccess();
		expect(service.missing).toEqual(['https://*.b.example.org/*']);
		expect(service.lacksAccess(B)).toBe(true);
		await service.tick();
		expect(fetch.mock.calls.map(([url]) => url)).toEqual([A]);
	});

	it('merkt sich Gelesenes und vergisst es, wenn der Eintrag verschwindet', async () => {
		let titles = ['eins', 'zwei'];
		const { service, reads, advance } = setup([A], (url) => ok(url, rss(titles)));
		await service.tick();
		service.setRead(A, ['eins', 'zwei'], true);
		service.setRead(A, ['zwei'], false);
		expect(service.isRead(A, 'eins')).toBe(true);
		expect(service.isRead(A, 'zwei')).toBe(false);
		titles = ['drei'];
		advance(31 * MIN);
		await service.tick();
		expect(reads.value).toEqual({});
	});

	it('räumt Cache und Gelesen-Status auf, wenn ein Feed aus allen Widgets verschwindet', async () => {
		const { service, cache, reads, widgets } = setup([A, B], (url) => ok(url, rss(['eins'])));
		await service.tick();
		service.setRead(B, ['eins'], true);
		widgets[0] = parseRssSettings({ feeds: [{ url: A }] });
		service.prune();
		expect(Object.keys(cache.value)).toEqual([A]);
		expect(reads.value).toEqual({});
	});
});

describe('RSS im App-Zustand', () => {
	it('lädt den Cache und leert ihn bei „Alles zurücksetzen“', async () => {
		const app = createAppState(
			createMemoryStore({
				feeds: { [A]: { ...emptyFeedState(), items: [], fetchedAt: 1 } },
				feedReads: { [A]: ['x'] }
			})
		);
		const stop = await app.init();
		flushSync();
		// Ohne RSS-Widget in der Default-Config wird der Cache beim Start aufgeräumt
		expect(app.feeds.value).toEqual({});
		app.feeds.value[B] = emptyFeedState();
		await app.resetAll();
		expect(app.feeds.value).toEqual({});
		expect(app.feedReads.value).toEqual({});
		stop();
	});
});
