import { extensionApi } from '$lib/storage/extension';
import { decodeBody } from './charset';

/**
 * Lädt einen Feed (oder die Website für die Feed-Suche) aus der Newtab-Page. In der Extension
 * gilt mit Host-Recht kein CORS; ob das Recht da ist, prüft der Aufrufer vorher. Auf dem
 * Dev-Server läuft der Abruf über eine Weiterleitung des Vite-Servers (`/__dev/feed`).
 *
 * Wirft nie: Jeder Fehler wird zu einem `FetchError` mit Code.
 */

export const FETCH_TIMEOUT_MS = 20_000;
export const MAX_FEED_BYTES = 5 * 1024 * 1024;

export type FetchErrorCode = 'offline' | 'network' | 'redirect' | 'http' | 'tooLarge' | 'timeout';

export type FetchError = {
	code: FetchErrorCode;
	/** HTTP-Status bei `http` */
	status?: number;
	/** Frühester nächster Versuch (ms seit Epoche), aus `Retry-After` */
	retryAt?: number;
};

export type FetchResult =
	| {
			kind: 'ok';
			/** Endgültige Adresse nach Umleitungen (auf derselben Origin bzw. mit Recht) */
			url: string;
			body: string;
			contentType: string | null;
			etag: string | null;
			lastModified: string | null;
	  }
	| { kind: 'notModified' }
	| { kind: 'error'; error: FetchError };

export type FetchOptions = {
	/** Aus dem Cache, für bedingte Anfragen */
	etag?: string | null;
	lastModified?: string | null;
	timeoutMs?: number;
	maxBytes?: number;
	fetch?: typeof fetch;
	now?: () => number;
	online?: () => boolean;
	/** Baut die tatsächlich abgerufene Adresse; Standard: Weiterleitung nur auf dem Dev-Server */
	route?: (url: string) => string;
};

const ACCEPT = [
	'application/rss+xml',
	'application/atom+xml',
	'application/feed+json',
	'application/json;q=0.9',
	'application/xml;q=0.9',
	'text/xml;q=0.9',
	'text/html;q=0.8',
	'*/*;q=0.5'
].join(', ');

/** Auf dem Dev-Server gibt es keine Host-Rechte; dort leitet Vite den Abruf weiter */
function defaultRoute(url: string): string {
	return import.meta.env.DEV && !extensionApi()
		? `/__dev/feed?url=${encodeURIComponent(url)}`
		: url;
}

/** `Retry-After` als Sekunden oder HTTP-Datum; liefert den Zeitpunkt in ms oder `null` */
export function parseRetryAfter(value: string | null, now: number): number | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (/^\d+$/.test(trimmed)) return now + Number(trimmed) * 1000;
	const date = Date.parse(trimmed);
	return Number.isNaN(date) ? null : Math.max(now, date);
}

/** Liest den Inhalt höchstens bis `maxBytes`; liefert `null`, wenn er größer ist */
async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array | null> {
	const length = Number(response.headers.get('content-length'));
	if (Number.isFinite(length) && length > maxBytes) {
		await response.body?.cancel().catch(() => {});
		return null;
	}
	if (!response.body) return new Uint8Array(await response.arrayBuffer());
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel().catch(() => {});
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export async function fetchFeed(url: string, options: FetchOptions = {}): Promise<FetchResult> {
	const {
		timeoutMs = FETCH_TIMEOUT_MS,
		maxBytes = MAX_FEED_BYTES,
		fetch: request = globalThis.fetch.bind(globalThis),
		now = Date.now,
		online = () => globalThis.navigator?.onLine ?? true,
		route = defaultRoute
	} = options;
	const error = (code: FetchErrorCode, extra: Omit<FetchError, 'code'> = {}): FetchResult => ({
		kind: 'error',
		error: { code, ...extra }
	});

	if (!online()) return error('offline');

	const headers: Record<string, string> = { Accept: ACCEPT };
	if (options.etag) headers['If-None-Match'] = options.etag;
	if (options.lastModified) headers['If-Modified-Since'] = options.lastModified;
	const init: RequestInit = {
		headers,
		// Keine Cookies der Seite, kein Referrer: der Abruf verrät nichts über die Person
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
		// Bedingte Anfrage selbst steuern statt einer alten Antwort aus dem HTTP-Cache
		cache: 'no-cache'
	};

	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);

	try {
		let response: Response;
		try {
			response = await request(route(url), { ...init, signal: controller.signal });
		} catch {
			if (timedOut) return error('timeout');
			if (!online()) return error('offline');
			// Eine Umleitung auf eine Origin ohne Recht scheitert wie ein Netzwerkfehler. Ohne
			// Folgen der Umleitung lässt sie sich erkennen, das Ziel bleibt aber verborgen.
			try {
				const probe = await request(route(url), {
					...init,
					redirect: 'manual',
					signal: controller.signal
				});
				await probe.body?.cancel().catch(() => {});
				if (probe.type === 'opaqueredirect') return error('redirect');
			} catch {
				// bleibt ein Netzwerkfehler
			}
			return timedOut ? error('timeout') : error('network');
		}

		if (response.status === 304) {
			await response.body?.cancel().catch(() => {});
			return { kind: 'notModified' };
		}
		if (!response.ok) {
			await response.body?.cancel().catch(() => {});
			const retryAt = parseRetryAfter(response.headers.get('retry-after'), now());
			return error('http', { status: response.status, ...(retryAt !== null && { retryAt }) });
		}

		const bytes = await readLimited(response, maxBytes);
		if (!bytes) return error('tooLarge');
		const contentType = response.headers.get('content-type');
		return {
			kind: 'ok',
			// Über die Dev-Weiterleitung meldet Vite die endgültige Adresse im Header
			url: response.headers.get('x-feed-url') ?? (response.url || url),
			body: decodeBody(bytes, contentType),
			contentType,
			etag: response.headers.get('etag'),
			lastModified: response.headers.get('last-modified')
		};
	} catch {
		return timedOut ? error('timeout') : error('network');
	} finally {
		clearTimeout(timer);
	}
}
