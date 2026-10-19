import { describe, expect, it } from 'vitest';
import { fitCount, listSpace } from './window-fit';

/** Einträge von 50 px mit 2 px Abstand */
const bottoms = Array.from({ length: 10 }, (_, i) => i * 52 + 50);

describe('Einträge bis zum Fensterende', () => {
	it('zeigt alle, wenn alle passen, ohne Platz für „Weitere anzeigen“', () => {
		expect(fitCount(bottoms, 518, 36)).toBe(10);
		expect(fitCount(bottoms, 2000, 36)).toBe(10);
	});

	it('zeigt nur ganze Einträge und lässt Platz für den Knopf', () => {
		// 300 px − 36 px Knopf: Einträge bis 264 → 5 (Unterkante 258)
		expect(fitCount(bottoms, 300, 36)).toBe(5);
		// Ein Eintrag, der knapp nicht mehr passt, fällt ganz weg
		expect(fitCount(bottoms, 257 + 36, 36)).toBe(4);
		expect(fitCount(bottoms, 258 + 36, 36)).toBe(5);
	});

	it('zeigt mindestens drei, auch ohne Platz', () => {
		expect(fitCount(bottoms, 40, 36)).toBe(3);
		expect(fitCount(bottoms, -200, 36)).toBe(3);
		expect(fitCount(bottoms.slice(0, 2), -200, 36)).toBe(2);
	});

	it('kommt mit verschieden hohen Einträgen zurecht', () => {
		const mixed = [40, 120, 160, 260, 300];
		expect(fitCount(mixed, 200, 30)).toBe(3);
		expect(fitCount(mixed, 299, 30)).toBe(4);
		expect(fitCount(mixed, 300, 30)).toBe(5);
	});

	it('gibt ohne Einträge null zurück', () => {
		expect(fitCount([], 100, 36)).toBe(0);
	});

	it('rechnet den Platz von der Oberkante auf der nicht gescrollten Page', () => {
		expect(listSpace({ viewport: 800, listTop: 300, below: 60, bottomPad: 32 })).toBe(408);
	});
});
