import { migrate } from './migrate';
import { array, int, isRecord, num, oneOf, record } from './parse';
import type { Config, Language, LinkStats, MediaRef } from './types';
import { collectMediaRefs } from './validate';

/** Kennung im Export, damit fremde JSON-Dateien erkannt werden */
export const EXPORT_APP = 'firefox-startpage';
export const EXPORT_VERSION = 1;

export type ExportFile = {
	app: typeof EXPORT_APP;
	exportVersion: typeof EXPORT_VERSION;
	exportedAt: string;
	config: Config;
	/** Optional mitexportierte Klick-Statistik */
	stats?: LinkStats;
	/** Medien werden nicht eingebettet, nur aufgelistet */
	media: MediaRef[];
};

export function createExport(
	config: Config,
	stats: LinkStats | null,
	now = new Date()
): ExportFile {
	return {
		app: EXPORT_APP,
		exportVersion: EXPORT_VERSION,
		exportedAt: now.toISOString(),
		config,
		...(stats && { stats }),
		media: collectMediaRefs(config)
	};
}

export function exportFileName(now = new Date()): string {
	return `startpage-${now.toISOString().slice(0, 10)}.json`;
}

export type ImportErrorCode = 'json' | 'format';

export class ImportError extends Error {
	constructor(readonly code: ImportErrorCode) {
		super(code);
	}
}

export type ImportResult = {
	config: Config;
	stats: LinkStats | null;
	/** Medien, auf die die Config verweist */
	media: MediaRef[];
};

/**
 * Liest eine Export-Datei. Wirft `ImportError`, wenn die Datei kein JSON oder kein Export ist.
 * Der Inhalt selbst wird validiert und migriert, Ungültiges also verworfen statt abgelehnt.
 */
export function parseImport(json: string, fallbackLanguage: Language = 'en'): ImportResult {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		throw new ImportError('json');
	}
	if (!isRecord(data) || data.app !== EXPORT_APP || !isRecord(data.config)) {
		throw new ImportError('format');
	}
	const config = migrate(data.config, fallbackLanguage);
	return {
		config,
		stats: data.stats === undefined ? null : parseStats(data.stats),
		media: collectMediaRefs(config)
	};
}

/** Prüft die Klick-Statistik; Unbrauchbares wird verworfen */
export function parseStats(raw: unknown): LinkStats {
	const stats: LinkStats = {};
	for (const [url, value] of Object.entries(record(raw))) {
		const r = record(value);
		const count = int(r.count, 0, 0);
		if (!url || count <= 0) continue;
		stats[url] = { count, lastOpened: num(r.lastOpened, 0, 0) };
	}
	return stats;
}

/** Medien aus der Config, die auf diesem Rechner nicht (mehr) in IndexedDB liegen */
export async function findMissingMedia(
	media: MediaRef[],
	has: (id: string) => Promise<boolean>
): Promise<MediaRef[]> {
	const present = await Promise.all(media.map((ref) => has(ref.id)));
	return media.filter((_, i) => !present[i]);
}

// --- Backups -----------------------------------------------------------------------------

export const MAX_BACKUPS = 3;

export type BackupReason = 'import' | 'reset' | 'restore';

export type Backup = {
	id: string;
	createdAt: number;
	reason: BackupReason;
	/** Rohdaten; werden beim Wiederherstellen wie ein Import migriert und validiert */
	config: unknown;
};

export function parseBackups(raw: unknown): Backup[] {
	return array(raw)
		.filter(isRecord)
		.filter((b) => typeof b.id === 'string' && isRecord(b.config))
		.map((b) => ({
			id: b.id as string,
			createdAt: num(b.createdAt, 0, 0),
			reason: oneOf(b.reason, ['import', 'reset', 'restore'], 'import'),
			config: b.config
		}))
		.slice(0, MAX_BACKUPS);
}

/** Legt ein Backup vorne an und behält nur die letzten drei */
export function addBackup(
	backups: Backup[],
	config: Config,
	reason: BackupReason,
	now = Date.now()
): Backup[] {
	const backup: Backup = {
		id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
		createdAt: now,
		reason,
		config: structuredClone(config)
	};
	return [backup, ...backups].slice(0, MAX_BACKUPS);
}
