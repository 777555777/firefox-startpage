import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { webOrigin } from './link-utils';

/**
 * Favicons pro Origin, ohne Drittanbieter und ohne Host-Rechte: Gesucht wird einmal unter den
 * üblichen Pfaden der Seite selbst, das Ergebnis (welche URL, wie groß, oder dass es keins
 * gibt) wird in `localStorage` gemerkt. Danach lädt jeder Tab nur noch die eine bekannte URL,
 * die meist direkt aus dem HTTP-Cache kommt, statt bei jedem Öffnen Fehlversuche zu machen.
 */

const STORAGE_KEY = 'startpage:favicons';
const DAY = 24 * 60 * 60 * 1000;
/** Gefundene Icons gelten 30 Tage, „keins gefunden“ nur einen Tag */
const FOUND_TTL = 30 * DAY;
const MISSING_TTL = DAY;
/** Nach einem Ladefehler eines gemerkten Icons wird frühestens so spät erneut gesucht */
const RETRY_AFTER_FAILURE = 10 * 60 * 1000;
/** Wie lange ein einzelner Versuch dauern darf */
const PROBE_TIMEOUT = 8000;

/**
 * Kandidaten in absteigender Vorliebe: `apple-touch-icon` ist meist 180 px groß und damit
 * scharf, SVG skaliert beliebig, `favicon.ico` ist oft nur 16 oder 32 px.
 */
const CANDIDATES = ['/apple-touch-icon.png', '/favicon.svg', '/favicon.ico'];

export type Favicon = {
	src: string;
	/** Breite in px; SVG gilt als beliebig groß */
	size: number;
};

type Entry = { icon: Favicon | null; checked: number };

/** Bestes Ergebnis: das erste Kandidaten-Icon, das mindestens 32 px hat, sonst das größte */
export function pickFavicon(results: (Favicon | null)[]): Favicon | null {
	const found = results.filter((result): result is Favicon => result !== null);
	return found.find((icon) => icon.size >= 32) ?? found.sort((a, b) => b.size - a.size)[0] ?? null;
}

export function isFresh(entry: Entry, now = Date.now()): boolean {
	return now - entry.checked < (entry.icon ? FOUND_TTL : MISSING_TTL);
}

function probe(src: string): Promise<Favicon | null> {
	return new Promise((resolve) => {
		const image = new Image();
		image.referrerPolicy = 'no-referrer';
		const done = (result: Favicon | null) => {
			clearTimeout(timer);
			image.onload = image.onerror = null;
			resolve(result);
		};
		const timer = setTimeout(() => done(null), PROBE_TIMEOUT);
		image.onload = () => {
			const size = src.endsWith('.svg') ? 512 : image.naturalWidth;
			done(size > 0 ? { src, size } : null);
		};
		image.onerror = () => done(null);
		image.src = src;
	});
}

function load(): [string, Entry][] {
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Entry>;
		return Object.entries(raw).filter(
			([, entry]) => typeof entry?.checked === 'number' && isFresh(entry)
		);
	} catch {
		return [];
	}
}

class FaviconCache {
	#entries = new SvelteMap<string, Entry>(load());
	#pending = new Set<string>();

	/**
	 * Icon für einen Link: `undefined` solange noch gesucht wird, `null` wenn es keins gibt.
	 * Ein abgelaufenes Ergebnis bleibt sichtbar, bis das neue da ist.
	 */
	get(url: string): Favicon | null | undefined {
		const origin = webOrigin(url);
		if (!origin) return null;
		const entry = this.#entries.get(origin);
		if (!entry || !isFresh(entry)) untrack(() => void this.#resolve(origin));
		return entry ? entry.icon : undefined;
	}

	/** Das gemerkte Icon lädt nicht mehr (Seite umgebaut, offline …): beim nächsten Mal neu suchen */
	failed(url: string) {
		const origin = webOrigin(url);
		const entry = origin ? this.#entries.get(origin) : undefined;
		if (!origin || !entry?.icon) return;
		this.#set(origin, { icon: null, checked: Date.now() - MISSING_TTL + RETRY_AFTER_FAILURE });
	}

	async #resolve(origin: string) {
		if (this.#pending.has(origin)) return;
		this.#pending.add(origin);
		try {
			const results = await Promise.all(CANDIDATES.map((path) => probe(origin + path)));
			const icon = pickFavicon(results);
			// Offline sagt nichts darüber, ob es ein Icon gibt
			if (!icon && !navigator.onLine) return;
			this.#set(origin, { icon, checked: Date.now() });
		} finally {
			this.#pending.delete(origin);
		}
	}

	#set(origin: string, entry: Entry) {
		this.#entries.set(origin, entry);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.#entries)));
		} catch {
			// ohne localStorage wird eben bei jedem Öffnen neu gesucht
		}
	}
}

export const favicons = new FaviconCache();
