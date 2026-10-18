import { createDefaultConfig } from '$lib/config/defaults';
import { migrate } from '$lib/config/migrate';
import {
	addBackup,
	findMissingMedia,
	parseBackups,
	parseImport,
	parseStats,
	type Backup,
	type BackupReason,
	type ImportResult
} from '$lib/config/transfer';
import type { Config, LinkStats, MediaRef } from '$lib/config/types';
import { collectMediaRefs } from '$lib/config/validate';
import { mediaKindOf, refOf, unusedMedia, type BackgroundSlot } from '$lib/background/media-utils';
import { detectLanguage, i18n, t } from '$lib/i18n/index.svelte';
import { createKeyValueStore, createMemoryStore, type KeyValueStore } from '$lib/storage/kv';
import { deleteMedia, hasMedia, listMediaIds, putMedia } from '$lib/storage/media';
import { TimeOfDay } from '$lib/theme/time-of-day.svelte';
import {
	parseFeedCache,
	parseFeedReads,
	type FeedCache,
	type FeedReads
} from '$lib/widgets/rss/cache';
import { FeedService } from '$lib/widgets/rss/service.svelte';
import type { RssSettings } from '$lib/widgets/rss/settings';
import { SyncedValue } from './synced.svelte';
import { toasts } from './toasts.svelte';

export const CONFIG_KEY = 'config';
export const STATS_KEY = 'stats';
export const BACKUPS_KEY = 'backups';
/** Cache und Gelesen-Status der RSS-Feeds; nicht in Export und Backups */
export const FEEDS_KEY = 'feeds';
export const FEED_READS_KEY = 'feedReads';

/**
 * Zentraler Zustand der Page: Config und Statistik (beide gespeichert und zwischen Tabs
 * synchronisiert) sowie Aktionen für Import, Backups und Zurücksetzen.
 */
export class AppState {
	readonly kv: KeyValueStore;
	readonly config: SyncedValue<Config>;
	readonly stats: SyncedValue<LinkStats>;
	readonly feeds: SyncedValue<FeedCache>;
	readonly feedReads: SyncedValue<FeedReads>;
	readonly rss: FeedService;
	readonly timeOfDay: TimeOfDay;
	ready = $state(false);

	#saveFailedShown = false;

	constructor(kv: KeyValueStore) {
		this.kv = kv;
		const language = detectLanguage();
		const onSaveResult = (ok: boolean) => this.#onSaveResult(ok);
		this.config = new SyncedValue(kv, createDefaultConfig(language), {
			key: CONFIG_KEY,
			parse: (raw) => migrate(raw, language),
			onSaveResult
		});
		this.stats = new SyncedValue<LinkStats>(
			kv,
			{},
			{ key: STATS_KEY, parse: parseStats, onSaveResult }
		);
		this.feeds = new SyncedValue<FeedCache>(
			kv,
			{},
			{ key: FEEDS_KEY, parse: parseFeedCache, onSaveResult }
		);
		this.feedReads = new SyncedValue<FeedReads>(
			kv,
			{},
			{ key: FEED_READS_KEY, parse: parseFeedReads, onSaveResult }
		);
		this.rss = new FeedService({
			widgets: () =>
				Object.values(this.config.value.widgets).flatMap((widget) =>
					widget.type === 'rss' ? [widget.settings as RssSettings] : []
				),
			cache: this.feeds,
			reads: this.feedReads,
			canPrune: () => !this.config.readonly
		});
		this.timeOfDay = new TimeOfDay(() => this.config.value.appearance.timeOfDay);
	}

	/** Lädt alles und startet Autosave + Sync; liefert eine Aufräumfunktion */
	async init(): Promise<() => void> {
		const [configOk, statsOk] = await Promise.all([this.config.load(), this.stats.load()]);
		if (!configOk || !statsOk) toasts.show(t('storage.loadFailed'), { tone: 'error' });
		// Ein unlesbarer Feed-Cache ist kein Datenverlust: er füllt sich beim nächsten Abruf neu
		await Promise.all([this.feeds.load(), this.feedReads.load()]);
		const stopConfig = this.config.start();
		const stopStats = this.stats.start();
		const stopFeeds = this.feeds.start();
		const stopReads = this.feedReads.start();
		const stopRss = this.rss.start();
		const flush = () => {
			void this.config.save();
			void this.stats.save();
			void this.feeds.save();
			void this.feedReads.save();
		};
		window.addEventListener('pagehide', flush);
		this.ready = true;
		return () => {
			window.removeEventListener('pagehide', flush);
			stopRss();
			stopConfig();
			stopStats();
			stopFeeds();
			stopReads();
		};
	}

	/** Zählt das Öffnen eines Links; wird sofort gespeichert, weil die Seite gleich wechselt */
	recordOpen(url: string, now = Date.now()) {
		const previous = this.stats.value[url];
		this.stats.value[url] = { count: (previous?.count ?? 0) + 1, lastOpened: now };
		void this.stats.save();
	}

	async loadBackups(): Promise<Backup[]> {
		const result = await this.kv.get(BACKUPS_KEY);
		return result.ok ? parseBackups(result.value) : [];
	}

	async backup(reason: BackupReason): Promise<void> {
		const backups = await this.loadBackups();
		const snapshot = $state.snapshot(this.config.value) as Config;
		await this.kv.set(BACKUPS_KEY, addBackup(backups, snapshot, reason));
	}

	/** Liest eine Export-Datei, ohne etwas zu ändern; wirft `ImportError` */
	readImport(json: string): ImportResult {
		return parseImport(json, i18n.detected);
	}

	/** Ersetzt die Config durch den Import (vorher Backup); liefert fehlende Medien */
	async applyImport(result: ImportResult): Promise<string[]> {
		await this.backup('import');
		await this.config.replace(result.config);
		if (result.stats) await this.stats.replace(result.stats);
		const missing = await findMissingMedia(result.media, hasMedia);
		return missing.map((ref) => ref.name || ref.id);
	}

	async restoreBackup(id: string): Promise<boolean> {
		const backup = (await this.loadBackups()).find((b) => b.id === id);
		if (!backup) return false;
		await this.backup('restore');
		await this.config.replace(migrate(backup.config, i18n.detected));
		return true;
	}

	/**
	 * Setzt Config, Statistik und Feed-Cache samt Gelesen-Status zurück (vorher Backup der
	 * Config). Medien bleiben erhalten.
	 */
	async resetAll(): Promise<void> {
		await this.backup('reset');
		await this.config.replace(createDefaultConfig(i18n.detected));
		await this.stats.replace({});
		await this.feeds.replace({});
		await this.feedReads.replace({});
	}

	/**
	 * Speichert eine Datei als Hintergrund für den Slot. Das vorige Medium wird gelöscht, wenn
	 * nichts mehr darauf verweist. Liefert, was schiefging, oder die neue Referenz.
	 */
	async setBackground(slot: BackgroundSlot, file: File): Promise<MediaRef | 'type' | 'failed'> {
		const kind = mediaKindOf(file);
		if (!kind) return 'type';
		const ref = await putMedia(file, kind);
		if (!ref) return 'failed';
		const background = this.config.value.appearance.background;
		if (slot === 'main') background.main = ref;
		else background.slots[slot] = ref;
		await this.collectMedia();
		return ref;
	}

	async clearBackground(slot: BackgroundSlot): Promise<void> {
		const background = this.config.value.appearance.background;
		if (!refOf(background, slot)) return;
		if (slot === 'main') background.main = null;
		else delete background.slots[slot];
		await this.collectMedia();
	}

	/** Löscht Medien, auf die weder die Config noch ein Backup verweist */
	async collectMedia(): Promise<void> {
		await this.config.save();
		const backups = (await this.loadBackups()).map((b) => migrate(b.config, i18n.detected));
		const configs = [this.config.value, ...backups];
		const referenced = configs.flatMap((config) => collectMediaRefs(config).map((r) => r.id));
		for (const id of unusedMedia(await listMediaIds(), referenced)) await deleteMedia(id);
	}

	#onSaveResult(ok: boolean) {
		// Den Hinweis nur einmal zeigen, bis Speichern wieder klappt
		if (!ok && !this.#saveFailedShown) {
			toasts.show(t('storage.saveFailed'), { tone: 'error', duration: 10000 });
		}
		this.#saveFailedShown = !ok;
	}
}

export function createAppState(kv: KeyValueStore = createKeyValueStore()) {
	return new AppState(kv);
}

/** Für Tests und Vorschauen: flüchtiger Zustand ohne Persistenz */
export function createMemoryAppState(initial: Record<string, unknown> = {}) {
	return new AppState(createMemoryStore(initial));
}
