import { untrack } from 'svelte';
import { fetchFeed, type FetchOptions, type FetchResult } from '$lib/net/fetch-feed';
import {
	missingAccess,
	onAccessChange,
	originPattern,
	patternsFor,
	releaseUnusedAccess
} from '$lib/net/permissions';
import type { SyncedValue } from '$lib/state/synced.svelte';
import {
	applyFailure,
	applyFetched,
	applyNotModified,
	emptyFeedState,
	pruneCache,
	pruneReads,
	toggleReads,
	type FeedCache,
	type FeedReads,
	type FeedState
} from './cache';
import { parseFeed } from './parse';
import { feedIntervals, filterIntervals, isDue, LOCK_MS, nextWake } from './schedule';
import type { RssSettings } from './settings';

/** Höchstens so viele Abrufe gleichzeitig */
const CONCURRENCY = 4;
/** Kürzeste Wartezeit des Timers, damit nichts im Kreis läuft */
const MIN_WAKE_MS = 1000;

type Deps = {
	/** Einstellungen aller RSS-Widgets der aktuellen Config */
	widgets: () => RssSettings[];
	cache: SyncedValue<FeedCache>;
	reads: SyncedValue<FeedReads>;
	/** Ob Cache und Rechte aufgeräumt werden dürfen (nicht, wenn die Config nicht lesbar war) */
	canPrune?: () => boolean;
	fetch?: (url: string, options: FetchOptions) => Promise<FetchResult>;
	now?: () => number;
	online?: () => boolean;
};

/**
 * Hält die Feeds aller RSS-Widgets aktuell. Abgerufen wird nur, solange die Page sichtbar ist:
 * beim Öffnen, wenn etwas veraltet ist, dann per Timer zum nächsten fälligen Feed, beim
 * Zurückkehren in den Tab und wenn die Verbindung wiederkommt. Ein Tab sperrt einen Feed kurz,
 * während er ihn abruft, damit andere offene Tabs nicht doppelt abrufen.
 */
export class FeedService {
	/** Feeds, die dieser Tab gerade abruft */
	loading = $state<string[]>([]);
	/** Rechte-Muster, für die das Host-Recht fehlt */
	missing = $state<string[]>([]);

	#deps: Deps;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#started = false;

	constructor(deps: Deps) {
		this.#deps = deps;
	}

	get #now() {
		return this.#deps.now ?? Date.now;
	}

	#online() {
		return this.#deps.online?.() ?? globalThis.navigator?.onLine ?? true;
	}

	#visible() {
		return typeof document === 'undefined' || document.visibilityState !== 'hidden';
	}

	#intervals() {
		return feedIntervals(this.#deps.widgets());
	}

	/** Startet Abruf und Aufräumen; liefert eine Aufräumfunktion */
	start(): () => void {
		this.#started = true;
		const onVisibility = () => {
			if (this.#visible()) void this.tick();
			else clearTimeout(this.#timer);
		};
		const onOnline = () => void this.tick();
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('online', onOnline);
		const stopAccess = onAccessChange(() => void this.checkAccess().then(() => this.tick()));

		// Ändern sich die Feeds (Widget hinzugefügt, Feed entfernt, Import …), wird aufgeräumt,
		// die Rechte neu geprüft und abgerufen, was fällig ist
		let lastKey: string | null = null;
		const stopEffect = $effect.root(() => {
			$effect(() => {
				const key = JSON.stringify([...this.#intervals()]);
				if (key === lastKey) return;
				lastKey = key;
				untrack(() => {
					this.prune();
					void this.checkAccess().then(() => this.tick());
				});
			});
		});

		// Rechte nur beim Laden abgeben, damit „Rückgängig“ nach dem Entfernen ohne neue
		// Abfrage auskommt
		if (this.#deps.canPrune?.() ?? true) {
			void releaseUnusedAccess(patternsFor(this.#intervals().keys()));
		}

		return () => {
			this.#started = false;
			clearTimeout(this.#timer);
			stopEffect();
			stopAccess();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('online', onOnline);
		};
	}

	/** Entfernt Cache und Gelesen-Status von Feeds, die in keinem Widget mehr stehen */
	prune() {
		if (!(this.#deps.canPrune?.() ?? true)) return;
		// Die Intervalle enthalten genau die gebrauchten Feeds
		const used = this.#intervals();
		const { cache, reads } = this.#deps;
		const nextCache = pruneCache(cache.value, used);
		if (nextCache !== cache.value) cache.value = nextCache;
		const nextReads = pruneReads(reads.value, cache.value, used);
		if (nextReads !== reads.value) reads.value = nextReads;
	}

	/** Prüft, für welche Feeds das Host-Recht fehlt */
	async checkAccess(): Promise<void> {
		const missing = await missingAccess(patternsFor(this.#intervals().keys()));
		if (JSON.stringify(missing) !== JSON.stringify(this.missing)) this.missing = missing;
	}

	/** Ob für diesen Feed das Host-Recht fehlt */
	lacksAccess(url: string): boolean {
		const pattern = originPattern(url);
		return pattern !== null && this.missing.includes(pattern);
	}

	/**
	 * Ruft fällige Feeds ab und stellt den Timer auf den nächsten. Mit `force` („Aktualisieren“)
	 * zählen Intervall und Backoff nicht, optional nur für `only`.
	 */
	async tick(force = false, only?: string[]): Promise<void> {
		clearTimeout(this.#timer);
		if (!this.#visible()) return;
		const intervals = this.#intervals();
		if (this.#online()) {
			const now = this.#now();
			const due = [...intervals]
				.filter(([url, ms]) => {
					if (only && !only.includes(url)) return false;
					if (this.loading.includes(url) || this.lacksAccess(url)) return false;
					return isDue(this.#deps.cache.value[url], ms, now, force);
				})
				.map(([url]) => url);
			await this.#pool(due, (url) => this.#fetchOne(url));
		}
		this.#schedule(intervals);
	}

	/** „Aktualisieren“ im Widget */
	refresh(urls: string[]): Promise<void> {
		return this.tick(true, urls);
	}

	#schedule(intervals: Map<string, number>) {
		clearTimeout(this.#timer);
		if (!this.#started || !this.#visible() || !this.#online()) return;
		const now = this.#now();
		const reachable = filterIntervals(intervals, (url) => !this.lacksAccess(url));
		const wake = nextWake(this.#deps.cache.value, reachable, now);
		if (wake === null) return;
		this.#timer = setTimeout(() => void this.tick(), Math.max(MIN_WAKE_MS, wake - now));
	}

	async #pool(urls: string[], run: (url: string) => Promise<void>) {
		const queue = [...urls];
		const worker = async () => {
			for (let url = queue.shift(); url !== undefined; url = queue.shift()) await run(url);
		};
		await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
	}

	async #fetchOne(url: string): Promise<void> {
		const { cache, reads } = this.#deps;
		const lockedAt = this.#now();
		// Sperre sofort speichern, damit andere Tabs sie sehen
		cache.value[url] = { ...(cache.value[url] ?? emptyFeedState()), lockUntil: lockedAt + LOCK_MS };
		await cache.save();
		this.loading = [...this.loading, url];
		try {
			const before: FeedState | undefined = cache.value[url];
			const request = this.#deps.fetch ?? fetchFeed;
			const result = await request(url, {
				etag: before?.etag,
				lastModified: before?.lastModified
			});
			const now = this.#now();
			const current = cache.value[url];
			let next: FeedState;
			if (result.kind === 'notModified') {
				next = applyNotModified(current, now);
			} else if (result.kind === 'error') {
				// Offline ist kein Fehler des Feeds und soll keinen Backoff auslösen
				next =
					result.error.code === 'offline'
						? { ...(current ?? emptyFeedState()), lockUntil: null }
						: applyFailure(current, result.error, now);
			} else {
				const parsed = parseFeed(result.body, result.url);
				next =
					parsed.kind === 'feed'
						? applyFetched(current, parsed.feed, result, now)
						: applyFailure(current, { code: 'parse' }, now);
			}
			cache.value[url] = next;
			const nextReads = pruneReads(reads.value, cache.value);
			if (nextReads !== reads.value) reads.value = nextReads;
			await cache.save();
		} finally {
			this.loading = this.loading.filter((loading) => loading !== url);
		}
	}

	// --- Gelesen ---------------------------------------------------------------------------------

	isRead(feedUrl: string, id: string): boolean {
		return this.#deps.reads.value[feedUrl]?.includes(id) ?? false;
	}

	/** Markiert Einträge eines Feeds als gelesen bzw. ungelesen */
	setRead(feedUrl: string, ids: string[], read: boolean) {
		const reads = this.#deps.reads.value;
		const next = toggleReads(reads[feedUrl], ids, read);
		if (next.length > 0) reads[feedUrl] = next;
		else delete reads[feedUrl];
	}
}
