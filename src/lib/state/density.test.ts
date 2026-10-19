import { describe, expect, it } from 'vitest';
import {
	COMPACT_BELOW_PX,
	DENSITY_KEY,
	loadDensitySetting,
	parseDensitySetting,
	resolveDensity,
	saveDensitySetting
} from './density';

describe('Dichte', () => {
	it('wird automatisch unterhalb der Schwelle kompakt', () => {
		expect(resolveDensity('auto', COMPACT_BELOW_PX - 1)).toBe('compact');
		expect(resolveDensity('auto', COMPACT_BELOW_PX)).toBe('normal');
		// Laptop (MacBook ~860 px), Full-HD-Monitor (~950 px), großer Monitor
		expect(resolveDensity('auto', 860)).toBe('compact');
		expect(resolveDensity('auto', 950)).toBe('normal');
		expect(resolveDensity('auto', 1100)).toBe('normal');
	});

	it('folgt einer festen Wahl unabhängig von der Höhe', () => {
		expect(resolveDensity('normal', 600)).toBe('normal');
		expect(resolveDensity('compact', 1400)).toBe('compact');
	});

	it('macht aus Unbekanntem „Automatisch“', () => {
		expect(parseDensitySetting('compact')).toBe('compact');
		expect(parseDensitySetting('dicht')).toBe('auto');
		expect(parseDensitySetting(null)).toBe('auto');
	});

	it('liest und schreibt pro Rechner, ohne zu werfen', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => void values.set(key, value)
		};
		expect(loadDensitySetting(storage)).toBe('auto');
		saveDensitySetting('compact', storage);
		expect(values.get(DENSITY_KEY)).toBe('compact');
		expect(loadDensitySetting(storage)).toBe('compact');
		const throwing = {
			getItem: () => {
				throw new Error('gesperrt');
			},
			setItem: () => {
				throw new Error('gesperrt');
			}
		};
		expect(loadDensitySetting(throwing)).toBe('auto');
		expect(() => saveDensitySetting('normal', throwing)).not.toThrow();
	});
});
