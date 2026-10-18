import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';
import {
	addBackup,
	createExport,
	EXPORT_APP,
	exportFileName,
	findMissingMedia,
	ImportError,
	MAX_BACKUPS,
	parseBackups,
	parseImport,
	parseStats
} from './transfer';

const now = new Date('2026-03-01T12:00:00Z');

function configWithMedia() {
	const config = createDefaultConfig('de');
	config.appearance.background.main = { id: 'm1', kind: 'image', name: 'berge.jpg' };
	config.appearance.background.slots.night = { id: 'm2', kind: 'video', name: 'nacht.mp4' };
	config.agenda.events.push({ id: 'e1', date: '2026-03-04', time: '14:00', title: 'Zahnarzt' });
	config.agenda.offDays.push({ id: 'o1', start: '2026-03-30', end: '2026-04-10', label: 'Urlaub' });
	return config;
}

describe('Export', () => {
	it('enthält Config, Medienliste und optional die Statistik', () => {
		const config = configWithMedia();
		const file = createExport(config, null, now);
		expect(file).toMatchObject({ app: EXPORT_APP, exportVersion: 1 });
		expect(file.exportedAt).toBe('2026-03-01T12:00:00.000Z');
		expect(file.media.map((m) => m.name)).toEqual(['berge.jpg', 'nacht.mp4']);
		expect(file).not.toHaveProperty('stats');

		const withStats = createExport(config, { 'https://a.de': { count: 2, lastOpened: 5 } }, now);
		expect(withStats.stats).toEqual({ 'https://a.de': { count: 2, lastOpened: 5 } });
	});

	it('benennt die Datei nach dem Datum', () => {
		expect(exportFileName(now)).toBe('startpage-2026-03-01.json');
	});
});

describe('Import', () => {
	it('liest einen eigenen Export verlustfrei zurück', () => {
		const config = configWithMedia();
		const stats = { 'https://github.com': { count: 3, lastOpened: 1000 } };
		const result = parseImport(JSON.stringify(createExport(config, stats, now)));
		expect(result.config).toEqual(config);
		expect(result.stats).toEqual(stats);
		expect(result.media.map((m) => m.id)).toEqual(['m1', 'm2']);
	});

	it('lehnt kein JSON und fremde Dateien ab', () => {
		expect(() => parseImport('{kaputt')).toThrow(ImportError);
		try {
			parseImport('{"foo": 1}');
		} catch (error) {
			expect((error as ImportError).code).toBe('format');
		}
		expect(() => parseImport(JSON.stringify({ app: EXPORT_APP, config: 'x' }))).toThrow(
			ImportError
		);
	});

	it('validiert den Inhalt, statt ihn abzulehnen', () => {
		const result = parseImport(
			JSON.stringify({
				app: EXPORT_APP,
				config: { version: 3, language: 'de', layout: { centerSpan: 99 } },
				stats: { 'https://a.de': { count: 'viele' }, 'https://b.de': { count: 2, lastOpened: 1 } }
			})
		);
		expect(result.config.language).toBe('de');
		expect(result.config.layout.centerSpan).toBe(16);
		expect(result.stats).toEqual({ 'https://b.de': { count: 2, lastOpened: 1 } });
	});

	it('findet fehlende Medien', async () => {
		const media = createExport(configWithMedia(), null).media;
		const missing = await findMissingMedia(media, async (id) => id === 'm1');
		expect(missing.map((m) => m.name)).toEqual(['nacht.mp4']);
	});
});

describe('Statistik', () => {
	it('verwirft ungültige Einträge', () => {
		expect(
			parseStats({
				'https://a.de': { count: 0, lastOpened: 1 },
				'https://b.de': { count: 2.4, lastOpened: 'gestern' },
				'https://c.de': 'x'
			})
		).toEqual({ 'https://b.de': { count: 2, lastOpened: 0 } });
		expect(parseStats(null)).toEqual({});
	});
});

describe('Backups', () => {
	it('behält nur die letzten drei, neueste zuerst', () => {
		const config = createDefaultConfig('en');
		let backups = parseBackups(undefined);
		for (let i = 1; i <= 5; i++) backups = addBackup(backups, config, 'import', i);
		expect(backups).toHaveLength(MAX_BACKUPS);
		expect(backups.map((b) => b.createdAt)).toEqual([5, 4, 3]);
	});

	it('speichert eine Kopie, keine Referenz', () => {
		const config = createDefaultConfig('en');
		const [backup] = addBackup([], config, 'reset');
		config.language = 'de';
		expect((backup.config as { language: string }).language).toBe('auto');
	});

	it('verwirft kaputte Backups beim Lesen', () => {
		const parsed = parseBackups([
			{ id: 'a', createdAt: 1, reason: 'import', config: {} },
			{ id: 'b', config: 'x' },
			'kaputt',
			{ id: 'c', createdAt: 'x', reason: 'unsinn', config: {} }
		]);
		expect(parsed.map((b) => [b.id, b.reason, b.createdAt])).toEqual([
			['a', 'import', 1],
			['c', 'import', 0]
		]);
	});
});
