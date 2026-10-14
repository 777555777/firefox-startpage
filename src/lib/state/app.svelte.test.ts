import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '$lib/config/defaults';
import { createExport } from '$lib/config/transfer';
import { createMemoryAppState } from './app.svelte';

describe('AppState', () => {
	it('legt vor dem Import ein Backup an und ersetzt die Config', async () => {
		const app = createMemoryAppState();
		const stop = await app.init();
		const before = app.config.value.layout.centerSpan;

		const imported = createDefaultConfig('de');
		imported.layout.centerSpan = 10;
		const result = app.readImport(JSON.stringify(createExport(imported, null)));
		const missing = await app.applyImport(result);

		expect(missing).toEqual([]);
		expect(app.config.value.layout.centerSpan).toBe(10);
		const backups = await app.loadBackups();
		expect(backups).toHaveLength(1);
		expect(backups[0].reason).toBe('import');
		expect((backups[0].config as { layout: { centerSpan: number } }).layout.centerSpan).toBe(
			before
		);

		expect(await app.restoreBackup(backups[0].id)).toBe(true);
		expect(app.config.value.layout.centerSpan).toBe(before);
		expect((await app.loadBackups()).map((b) => b.reason)).toEqual(['restore', 'import']);
		stop();
	});

	it('zählt Link-Klicks', async () => {
		const app = createMemoryAppState();
		const stop = await app.init();
		app.recordOpen('https://a.de', 10);
		app.recordOpen('https://a.de', 20);
		expect(app.stats.value['https://a.de']).toEqual({ count: 2, lastOpened: 20 });
		stop();
	});

	it('setzt alles zurück', async () => {
		const app = createMemoryAppState();
		const stop = await app.init();
		app.config.value.layout.centerSpan = 8;
		app.recordOpen('https://a.de');
		await app.resetAll();
		expect(app.config.value.layout.centerSpan).toBe(12);
		expect(app.stats.value).toEqual({});
		expect((await app.loadBackups())[0].reason).toBe('reset');
		stop();
	});
});
