import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';
import { migrate, rawVersion, type Migration } from './migrate';

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
		expect(config.version).toBe(1);
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
			// v2 hatte die Spaltenzahl als String
			2: (raw) => {
				calls.push(2);
				const layout = raw.layout as { columns: string };
				return { ...raw, layout: { ...layout, columns: Number(layout.columns) } };
			}
		};
		const config = migrate(
			{ version: 1, lang: 'de', layout: { columns: '2', columnItems: [] } },
			'en',
			migrations,
			3
		);
		expect(calls).toEqual([1, 2]);
		expect(config.language).toBe('de');
		expect(config.layout.columns).toBe(2);
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
