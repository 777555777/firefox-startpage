import { describe, expect, it } from 'vitest';
import { areaPx, arrange } from './arrangement';

const both = { left: true, right: true };
const layout = (overrides = {}) => ({ sides: both, centerSpan: 12, columnGap: 24, ...overrides });

describe('Anordnung von Mitte und Seiten', () => {
	it('stellt Mitte und Seiten nebeneinander, die Mitte im DOM zuerst', () => {
		const result = arrange(layout(), 1400);
		expect(result.sideBySide).toBe(true);
		expect(result.width).toBe(1400);
		expect(result.columns).toEqual([
			{ areas: [0], track: 3 },
			{ areas: [1], track: 5 },
			{ areas: [2], track: 1 }
		]);
		expect(result.template).toBe('minmax(0, 6fr) 24px minmax(0, 12fr) 24px minmax(0, 6fr)');
		expect(result.order).toEqual([2, 0, 1]);
	});

	it('lässt ausgeschaltete Seiten frei, damit die Mitte mittig bleibt', () => {
		const result = arrange(layout({ sides: { left: false, right: true } }), 1400);
		expect(result.columns.map((column) => column.track)).toEqual([3, 5]);
		expect(result.template).toContain('6fr');
		expect(result.order).toEqual([0, 1]);
	});

	it('stellt bei schmalem Fenster alles untereinander: Mitte, rechts, links', () => {
		const result = arrange(layout(), 900);
		expect(result.sideBySide).toBe(false);
		expect(result.columns).toEqual([{ areas: [0, 1, 2], track: 1 }]);
		expect(result.width).toBe(768);
		expect(result.order).toEqual([0, 1, 2]);
	});

	it('richtet sich nach der Maximalbreite', () => {
		expect(arrange(layout({ maxWidth: 80 }), 2400).width).toBe(1280);
		// 56 rem reichen nicht für Seiten von 14 rem bei einer Mitte von 12/24
		expect(arrange(layout({ maxWidth: 56 }), 2400).sideBySide).toBe(false);
	});

	it('gibt der Mitte ohne Seiten die ganze Breite', () => {
		const result = arrange(layout({ sides: { left: false, right: false } }), 2000);
		expect(result.sideBySide).toBe(false);
		expect(result.width).toBe(2000);
		expect(result.columns).toEqual([{ areas: [0], track: 1 }]);
	});

	it('rechnet die Breite eines Bereichs in px', () => {
		const result = arrange(layout(), 1248);
		expect(areaPx(result, [12, 6, 6], 0, 24)).toBe(600);
		expect(areaPx(result, [12, 6, 6], 2, 24)).toBe(300);
		expect(areaPx(arrange(layout(), 900), [12, 6, 6], 2, 24)).toBe(768);
	});
});
