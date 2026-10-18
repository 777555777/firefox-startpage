// @vitest-environment jsdom
// Die Feed-Suche nutzt `DOMParser`, den es in Node nicht gibt.
import { describe, expect, it, vi } from 'vitest';
import type { FetchResult } from '$lib/net/fetch-feed';
import { probeFeed } from './add-feed';

const RSS =
	'<rss version="2.0"><channel><title>Blog</title><item><title>Eins</title></item></channel></rss>';
const page = (links: string) => `<!doctype html><html><head>${links}</head><body></body></html>`;
const alternate = (href: string, title = '') =>
	`<link rel="alternate" type="application/rss+xml" title="${title}" href="${href}">`;
const ok = (url: string, body: string): FetchResult => ({
	kind: 'ok',
	url,
	body,
	contentType: null,
	etag: '"e"',
	lastModified: null
});

function deps(pages: Record<string, string>, missing: string[] = []) {
	return {
		fetch: vi.fn(async (url: string): Promise<FetchResult> =>
			url in pages ? ok(url, pages[url]) : { kind: 'error', error: { code: 'http', status: 404 } }
		),
		missingAccess: vi.fn(async (patterns: string[]) => patterns.filter((p) => missing.includes(p)))
	};
}

describe('Feed hinzufügen', () => {
	it('übernimmt einen Feed direkt', async () => {
		const result = await probeFeed(
			'https://blog.example.org/feed',
			deps({ 'https://blog.example.org/feed': RSS })
		);
		expect(result).toMatchObject({
			kind: 'feed',
			url: 'https://blog.example.org/feed',
			etag: '"e"'
		});
		expect(result.kind === 'feed' && result.feed.title).toBe('Blog');
	});

	it('folgt dem einzigen Feed einer Webseite auf derselben Domain', async () => {
		const d = deps({
			'https://www.example.org/': page(alternate('/feed.xml')),
			'https://www.example.org/feed.xml': RSS
		});
		const result = await probeFeed('https://www.example.org/', d);
		expect(result).toMatchObject({ kind: 'feed', url: 'https://www.example.org/feed.xml' });
	});

	it('meldet einen Feed auf einer Domain ohne Recht, statt ihn abzurufen', async () => {
		const d = deps({ 'https://www.example.org/': page(alternate('http://feeds.other.net/x')) }, [
			'https://*.feeds.other.net/*'
		]);
		expect(await probeFeed('https://www.example.org/', d)).toEqual({
			kind: 'needsAccess',
			url: 'https://feeds.other.net/x',
			pattern: 'https://*.feeds.other.net/*'
		});
		expect(d.fetch).toHaveBeenCalledTimes(1);
	});

	it('bietet mehrere Feeds zur Auswahl an, auf https und ohne Dopplungen', async () => {
		const d = deps({
			'https://www.example.org/': page(
				alternate('/feed/', 'Beiträge') +
					alternate('/comments/feed/', 'Kommentare') +
					alternate('http://www.example.org/feed/')
			)
		});
		expect(await probeFeed('https://www.example.org/', d)).toEqual({
			kind: 'choose',
			links: [
				{ url: 'https://www.example.org/feed/', title: 'Beiträge', format: 'rss' },
				{ url: 'https://www.example.org/comments/feed/', title: 'Kommentare', format: 'rss' }
			]
		});
	});

	it('meldet Seiten ohne Feed, Fehler und Unlesbares', async () => {
		const d = deps({
			'https://a.example.org/': page(''),
			'https://b.example.org/': '<note/>',
			'https://c.example.org/': page(alternate('/kein-feed')),
			'https://c.example.org/kein-feed': page(alternate('/noch-tiefer'))
		});
		expect(await probeFeed('https://a.example.org/', d)).toEqual({
			kind: 'error',
			code: 'notFound'
		});
		expect(await probeFeed('https://b.example.org/', d)).toEqual({ kind: 'error', code: 'parse' });
		expect(await probeFeed('https://x.example.org/', d)).toEqual({
			kind: 'error',
			code: 'http',
			status: 404
		});
		// Eine gefundene Seite wird nicht erneut durchsucht
		expect(await probeFeed('https://c.example.org/', d)).toEqual({ kind: 'error', code: 'parse' });
	});
});
