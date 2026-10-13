import { describe, expect, it } from 'vitest';
import { digitOf, nextIndex } from './nav';

const box = (left: number, top: number, width = 80, height = 80) => ({
	left,
	top,
	width,
	height,
	right: left + width,
	bottom: top + height
});

// Raster 3 × 2, letzte Zeile unvollständig: 0 1 2 / 3 4
const grid = [box(0, 0), box(90, 0), box(180, 0), box(0, 90), box(90, 90)];

describe('nextIndex', () => {
	it('folgt links/rechts der Lesereihenfolge und bleibt an den Enden stehen', () => {
		expect(nextIndex(grid, 2, 'ArrowRight')).toBe(3);
		expect(nextIndex(grid, 3, 'ArrowLeft')).toBe(2);
		expect(nextIndex(grid, 0, 'ArrowLeft')).toBe(0);
		expect(nextIndex(grid, 4, 'ArrowRight')).toBe(4);
	});

	it('springt hoch/runter in die Spalte darüber bzw. darunter', () => {
		expect(nextIndex(grid, 1, 'ArrowDown')).toBe(4);
		expect(nextIndex(grid, 4, 'ArrowUp')).toBe(1);
		expect(nextIndex(grid, 3, 'ArrowUp')).toBe(0);
	});

	it('nimmt das nächstgelegene Element, wenn die Zeile darunter kürzer ist', () => {
		expect(nextIndex(grid, 2, 'ArrowDown')).toBe(4);
	});

	it('bleibt stehen, wenn es in der Richtung nichts gibt', () => {
		expect(nextIndex(grid, 0, 'ArrowUp')).toBe(0);
		expect(nextIndex(grid, 4, 'ArrowDown')).toBe(4);
	});

	it('funktioniert in Listen und mit unterschiedlich breiten Kapseln', () => {
		const list = [box(0, 0, 300, 30), box(0, 34, 300, 30), box(0, 68, 300, 30)];
		expect(nextIndex(list, 0, 'ArrowDown')).toBe(1);
		expect(nextIndex(list, 2, 'ArrowUp')).toBe(1);
		const capsules = [
			box(0, 0, 150, 36),
			box(160, 0, 60, 36),
			box(0, 44, 60, 36),
			box(70, 44, 200, 36)
		];
		expect(nextIndex(capsules, 1, 'ArrowDown')).toBe(3);
	});

	it('kennt Home und End', () => {
		expect(nextIndex(grid, 3, 'Home')).toBe(0);
		expect(nextIndex(grid, 0, 'End')).toBe(4);
		expect(nextIndex([], 0, 'End')).toBe(-1);
	});
});

describe('digitOf', () => {
	it('liest Ziffern unabhängig vom Tastaturlayout', () => {
		expect(digitOf({ code: 'Digit3', key: '§' })).toBe(3);
		expect(digitOf({ code: 'Numpad9', key: '9' })).toBe(9);
		expect(digitOf({ code: '', key: '5' })).toBe(5);
		expect(digitOf({ code: 'Digit0', key: '0' })).toBeNull();
		expect(digitOf({ code: 'KeyA', key: 'a' })).toBeNull();
	});
});
