import { describe, expect, it, vi } from 'vitest';
import { decodeBody, detectCharset } from './charset';
import { fetchFeed, parseRetryAfter, type FetchOptions } from './fetch-feed';

const URL = 'https://example.org/feed.xml';
const NOW = Date.UTC(2026, 9, 18, 12);
const bytes = (...values: number[]) => new Uint8Array(values);
const latin1 = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

/** Gefälschtes `fetch` mit den Parametern des echten, damit die Aufrufe typisiert sind */
const fake = (handler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
	vi.fn(handler);

/** Optionen ohne Netz: feste Zeit, online, Adresse unverändert */
function options(fetch: FetchOptions['fetch'], extra: FetchOptions = {}): FetchOptions {
	return { fetch, now: () => NOW, online: () => true, route: (url) => url, ...extra };
}

describe('Zeichensatz', () => {
	it('folgt BOM vor Header vor Angabe im Dokument', () => {
		const xml = latin1('<?xml version="1.0" encoding="ISO-8859-1"?><rss/>');
		expect(detectCharset(null, xml)).toBe('windows-1252');
		expect(detectCharset('application/rss+xml; charset=utf-8', xml)).toBe('utf-8');
		expect(detectCharset('text/xml; charset=iso-8859-1', bytes(0xef, 0xbb, 0xbf, 0x3c))).toBe(
			'utf-8'
		);
		expect(detectCharset(null, latin1('<html><meta charset="windows-1252">'))).toBe('windows-1252');
	});

	it('fällt bei Unbekanntem auf UTF-8 zurück', () => {
		expect(detectCharset('text/xml; charset=klingonisch', bytes(0x3c))).toBe('utf-8');
		expect(detectCharset(null, bytes())).toBe('utf-8');
	});

	it('dekodiert Umlaute aus ISO-8859-1', () => {
		const body = latin1('<?xml version="1.0" encoding="iso-8859-1"?><t>Grüße</t>');
		expect(decodeBody(body, 'text/xml')).toContain('<t>Grüße</t>');
	});
});

describe('Retry-After', () => {
	it('liest Sekunden und HTTP-Datum', () => {
		expect(parseRetryAfter('120', NOW)).toBe(NOW + 120_000);
		expect(parseRetryAfter(new Date(NOW + 60_000).toUTCString(), NOW)).toBe(NOW + 60_000);
		expect(parseRetryAfter('gestern', NOW)).toBeNull();
		expect(parseRetryAfter(null, NOW)).toBeNull();
	});
});

describe('Feed abrufen', () => {
	it('liefert den dekodierten Inhalt mit Cache-Angaben', async () => {
		const fetch = fake(
			async () =>
				new Response(latin1('<?xml version="1.0" encoding="iso-8859-1"?><rss>Bär</rss>'), {
					headers: { 'content-type': 'application/rss+xml', etag: '"v1"' }
				})
		);
		const result = await fetchFeed(URL, options(fetch));
		expect(result).toMatchObject({ kind: 'ok', url: URL, etag: '"v1"', lastModified: null });
		expect(result.kind === 'ok' && result.body).toContain('<rss>Bär</rss>');
		const init = fetch.mock.calls[0][1] as RequestInit;
		expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
	});

	it('fragt bedingt an und erkennt „nicht geändert“', async () => {
		const fetch = fake(async () => new Response(null, { status: 304 }));
		const result = await fetchFeed(
			URL,
			options(fetch, { etag: '"v1"', lastModified: 'Sat, 17 Oct 2026 10:00:00 GMT' })
		);
		expect(result).toEqual({ kind: 'notModified' });
		const headers = (fetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
		expect(headers['If-None-Match']).toBe('"v1"');
		expect(headers['If-Modified-Since']).toBe('Sat, 17 Oct 2026 10:00:00 GMT');
	});

	it('meldet HTTP-Fehler samt Retry-After', async () => {
		const fetch = fake(
			async () => new Response('', { status: 429, headers: { 'retry-after': '600' } })
		);
		expect(await fetchFeed(URL, options(fetch))).toEqual({
			kind: 'error',
			error: { code: 'http', status: 429, retryAt: NOW + 600_000 }
		});
	});

	it('bricht zu große Antworten ab, auch ohne Content-Length', async () => {
		const big = new Uint8Array(2048);
		const stream = () =>
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(big);
					controller.enqueue(big);
					controller.close();
				}
			});
		const fetch = fake(async () => new Response(stream()));
		expect(await fetchFeed(URL, options(fetch, { maxBytes: 3000 }))).toEqual({
			kind: 'error',
			error: { code: 'tooLarge' }
		});
		const declared = fake(
			async () => new Response('x', { headers: { 'content-length': '999999' } })
		);
		expect(await fetchFeed(URL, options(declared, { maxBytes: 3000 }))).toMatchObject({
			error: { code: 'tooLarge' }
		});
	});

	it('ruft offline gar nicht erst ab', async () => {
		const fetch = vi.fn();
		const result = await fetchFeed(URL, options(fetch, { online: () => false }));
		expect(result).toEqual({ kind: 'error', error: { code: 'offline' } });
		expect(fetch).not.toHaveBeenCalled();
	});

	it('bricht nach dem Zeitlimit ab', async () => {
		const fetch = fake(
			(_url: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new Error('abgebrochen')));
				})
		);
		const result = await fetchFeed(URL, options(fetch, { timeoutMs: 10 }));
		expect(result).toEqual({ kind: 'error', error: { code: 'timeout' } });
	});

	it('erkennt eine Umleitung auf eine Origin ohne Recht', async () => {
		const fetch = fake(async (_url: string | URL | Request, init?: RequestInit) => {
			if (init?.redirect !== 'manual') throw new TypeError('NetworkError');
			return { type: 'opaqueredirect', body: null } as unknown as Response;
		});
		expect(await fetchFeed(URL, options(fetch))).toEqual({
			kind: 'error',
			error: { code: 'redirect' }
		});
	});

	it('meldet sonst einen Netzwerkfehler', async () => {
		const fetch = fake(async () => {
			throw new TypeError('NetworkError');
		});
		expect(await fetchFeed(URL, options(fetch))).toEqual({
			kind: 'error',
			error: { code: 'network' }
		});
	});

	it('übernimmt die endgültige Adresse der Dev-Weiterleitung', async () => {
		const fetch = fake(
			async () =>
				new Response('<rss/>', { headers: { 'x-feed-url': 'https://example.org/neu.xml' } })
		);
		const result = await fetchFeed(
			URL,
			options(fetch, { route: (url) => `/__dev/feed?url=${encodeURIComponent(url)}` })
		);
		expect(fetch.mock.calls[0][0]).toBe('/__dev/feed?url=https%3A%2F%2Fexample.org%2Ffeed.xml');
		expect(result).toMatchObject({ kind: 'ok', url: 'https://example.org/neu.xml' });
	});
});
