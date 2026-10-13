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
import type { Config, LinkStats } from '$lib/config/types';
import { detectLanguage, i18n, t } from '$lib/i18n/index.svelte';
import { createKeyValueStore, createMemoryStore, type KeyValueStore } from '$lib/storage/kv';
import { hasMedia } from '$lib/storage/media';
import { SyncedValue } from './synced.svelte';
import { toasts } from './toasts.svelte';

export const CONFIG_KEY = 'config';
export const STATS_KEY = 'stats';
export const BACKUPS_KEY = 'backups';

/**
 * Zentraler Zustand der Page: Config und Statistik (beide gespeichert und zwischen Tabs
 * synchronisiert) sowie Aktionen für Import, Backups und Zurücksetzen.
 */
export class AppState {
	readonly kv: KeyValueStore;
	readonly config: SyncedValue<Config>;
	readonly stats: SyncedValue<LinkStats>;
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
	}

	/** Lädt alles und startet Autosave + Sync; liefert eine Aufräumfunktion */
	async init(): Promise<() => void> {
		const [configOk, statsOk] = await Promise.all([this.config.load(), this.stats.load()]);
		if (!configOk || !statsOk) toasts.show(t('storage.loadFailed'), { tone: 'error' });
		const stopConfig = this.config.start();
		const stopStats = this.stats.start();
		const flush = () => {
			void this.config.save();
			void this.stats.save();
		};
		window.addEventListener('pagehide', flush);
		this.ready = true;
		return () => {
			window.removeEventListener('pagehide', flush);
			stopConfig();
			stopStats();
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

	/** Setzt Config und Statistik zurück (vorher Backup). Medien bleiben erhalten. */
	async resetAll(): Promise<void> {
		await this.backup('reset');
		await this.config.replace(createDefaultConfig(i18n.detected));
		await this.stats.replace({});
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
