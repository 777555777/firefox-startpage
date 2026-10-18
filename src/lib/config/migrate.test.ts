import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, createDefaultConfig } from './defaults';
import { MIGRATIONS, migrate, rawVersion, type Migration } from './migrate';

describe('migrate', () => {
	it('liest die aktuelle Version unverändert', () => {
		const config = createDefaultConfig('en');
		expect(migrate(structuredClone(config))).toEqual(config);
	});

	it('behandelt fehlende Versionen als Version 1', () => {
		expect(rawVersion({})).toBe(1);
		expect(rawVersion({ version: 'zwei' })).toBe(1);
		expect(rawVersion({ version: 3 })).toBe(3);
	});

	it('liefert für Nicht-Objekte die Default-Config in der Fallback-Sprache', () => {
		const config = migrate('kaputt', 'de');
		expect(config.version).toBe(CONFIG_VERSION);
		expect(Object.keys(config.widgets)).toHaveLength(5);
	});

	it('wendet Migrationen der Reihe nach an (v1 → v2 → v3)', () => {
		const calls: number[] = [];
		const migrations: Record<number, Migration> = {
			// v1 hatte die Sprache unter `lang`
			1: (raw) => {
				calls.push(1);
				const { lang, ...rest } = raw;
				return { ...rest, language: lang };
			},
			// v2 hatte die Breite der Mitte als String
			2: (raw) => {
				calls.push(2);
				const layout = raw.layout as { centerSpan: string };
				return { ...raw, layout: { ...layout, centerSpan: Number(layout.centerSpan) } };
			}
		};
		const config = migrate(
			{ version: 1, lang: 'de', layout: { centerSpan: '10' } },
			'en',
			migrations,
			3
		);
		expect(calls).toEqual([1, 2]);
		expect(config.language).toBe('de');
		expect(config.layout.centerSpan).toBe(10);
	});

	it('v1 → v3: jedes Widget wird zur eigenen Zeile, die erste von zwei Spalten zur Mitte', () => {
		const config = migrate({
			version: 1,
			widgets: { a: { type: 'clock' }, b: { type: 'calendar' }, c: { type: 'search' } },
			layout: { columns: 2, columnItems: [['a', 'b'], ['c']], columnWidths: [4, 8], gap: 32 }
		});
		expect(config.version).toBe(CONFIG_VERSION);
		expect(config.layout.columnRows).toEqual([
			[
				{ items: ['a'], spans: [8] },
				{ items: ['b'], spans: [8] }
			],
			[{ items: ['c'], spans: [8] }],
			[]
		]);
		expect(config.layout.sides).toEqual({ left: false, right: true });
		// Die Mitte war schmaler als die Seite, das kleinste Maß ist 8
		expect(config.layout.centerSpan).toBe(8);
		expect(config.layout.columnGap).toBe(32);
		expect(config.layout.panelGap).toBe(32);
		expect('columnItems' in config.layout).toBe(false);
		expect('columns' in config.layout).toBe(false);
	});

	it('v2 → v3: bei drei Spalten wird die mittlere zur Mitte', () => {
		const one = (id: string, span: number) => ({ items: [id], spans: [span] });
		const config = migrate({
			version: 2,
			widgets: { a: { type: 'clock' }, b: { type: 'search' }, c: { type: 'calendar' } },
			layout: {
				columns: 3,
				columnRows: [[], [one('a', 14), one('b', 14)], [one('c', 5)]],
				columnWidths: [5, 14, 5]
			}
		});
		expect(config.layout.columnRows).toEqual([[one('a', 14), one('b', 14)], [one('c', 5)], []]);
		expect(config.layout.sides).toEqual({ left: true, right: true });
		expect(config.layout.centerSpan).toBe(14);
		expect('columnWidths' in config.layout).toBe(false);
	});

	it('v2 → v3: bei vier Spalten teilen sich die beiden mittleren die Mitte', () => {
		const one = (id: string) => ({ items: [id], spans: [6] });
		const config = migrate({
			version: 2,
			widgets: Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [id, { type: 'clock' }])),
			layout: {
				columns: 4,
				columnRows: [[one('a')], [one('b')], [one('c')], [one('d')]],
				columnWidths: [6, 6, 6, 6]
			}
		});
		const items = config.layout.columnRows.map((rows) => rows.map((row) => row.items[0]));
		expect(items).toEqual([['b', 'c'], ['d'], ['a']]);
		expect(config.layout.centerSpan).toBe(12);
	});

	it('v3 → v4: Termine und freie Tage starten leer', () => {
		const config = createDefaultConfig('de');
		const { agenda: _agenda, ...v3 } = structuredClone(config);
		const migrated = migrate({ ...v3, version: 3 });
		expect(migrated.version).toBe(4);
		expect(migrated.agenda).toEqual({ events: [], offDays: [] });
		// Alles andere bleibt unverändert
		expect({ ...migrated, agenda: undefined }).toEqual({ ...config, agenda: undefined });
	});

	it('v3 → v4: ein schon vorhandenes `agenda` bleibt erhalten und wird validiert', () => {
		const migrated = migrate({
			version: 3,
			agenda: {
				events: [
					{ id: 'e', date: '2026-10-21', time: '9:30', title: ' Zahnarzt ' },
					{ id: 'x', date: '2026-02-30', title: 'Gibt es nicht' }
				],
				offDays: [{ id: 'u', start: '2026-12-31', end: '2026-12-24', label: 'Urlaub' }]
			}
		});
		expect(migrated.agenda).toEqual({
			events: [{ id: 'e', date: '2026-10-21', time: '09:30', title: 'Zahnarzt' }],
			offDays: [{ id: 'u', start: '2026-12-24', end: '2026-12-31', label: 'Urlaub' }]
		});
	});

	it('v3 → v4: Migration allein ergänzt `agenda`', () => {
		expect(MIGRATIONS[3]({ version: 3 })).toEqual({
			version: 3,
			agenda: { events: [], offDays: [] }
		});
		expect(MIGRATIONS[3]({ agenda: 'kaputt' }).agenda).toEqual({ events: [], offDays: [] });
	});

	it('überspringt bereits erreichte Versionen', () => {
		const calls: number[] = [];
		const migrations: Record<number, Migration> = {
			1: (raw) => (calls.push(1), raw),
			2: (raw) => (calls.push(2), raw)
		};
		migrate({ version: 2 }, 'en', migrations, 3);
		expect(calls).toEqual([2]);
	});

	it('übersteht eine werfende Migration', () => {
		const migrations: Record<number, Migration> = {
			1: () => {
				throw new Error('kaputt');
			}
		};
		const config = migrate({ version: 1, language: 'de' }, 'en', migrations, 2);
		expect(config.language).toBe('de');
	});

	it('liest Daten einer neueren Version so gut wie möglich', () => {
		const config = migrate({ version: 99, language: 'de', unbekannt: true });
		expect(config.language).toBe('de');
		expect(config).not.toHaveProperty('unbekannt');
	});
});
