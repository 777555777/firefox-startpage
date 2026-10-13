import { describe, expect, it } from 'vitest';
import { insertionIndex } from './sortable.svelte';

const rect = (left: number, top: number, width: number, height: number) =>
	({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

describe('insertionIndex', () => {
	const column = [rect(0, 0, 100, 50), rect(0, 60, 100, 200), rect(0, 270, 100, 50)];

	it('zählt in vertikalen Listen nach der Mitte', () => {
		expect(insertionIndex(column, { x: 50, y: 10 }, 'vertical')).toBe(0);
		expect(insertionIndex(column, { x: 50, y: 30 }, 'vertical')).toBe(1);
		expect(insertionIndex(column, { x: 50, y: 150 }, 'vertical')).toBe(1);
		expect(insertionIndex(column, { x: 50, y: 170 }, 'vertical')).toBe(2);
		expect(insertionIndex(column, { x: 50, y: 999 }, 'vertical')).toBe(3);
	});

	it('zählt in horizontalen Listen nach x', () => {
		const row = [rect(0, 0, 80, 30), rect(90, 0, 80, 30)];
		expect(insertionIndex(row, { x: 30, y: 10 }, 'horizontal')).toBe(0);
		expect(insertionIndex(row, { x: 60, y: 10 }, 'horizontal')).toBe(1);
		expect(insertionIndex(row, { x: 200, y: 10 }, 'horizontal')).toBe(2);
	});

	it('folgt im Raster der Lesereihenfolge', () => {
		// 3 Spalten à 100 px, 2 Zeilen à 100 px
		const grid = [0, 1, 2, 3, 4].map((i) => rect((i % 3) * 110, Math.floor(i / 3) * 110, 100, 100));
		expect(insertionIndex(grid, { x: 10, y: 10 }, 'grid')).toBe(0);
		expect(insertionIndex(grid, { x: 70, y: 50 }, 'grid')).toBe(1);
		expect(insertionIndex(grid, { x: 300, y: 50 }, 'grid')).toBe(3);
		expect(insertionIndex(grid, { x: 10, y: 150 }, 'grid')).toBe(3);
		expect(insertionIndex(grid, { x: 170, y: 150 }, 'grid')).toBe(5);
		expect(insertionIndex(grid, { x: 10, y: 400 }, 'grid')).toBe(5);
	});

	it('liefert in leeren Listen 0', () => {
		expect(insertionIndex([], { x: 0, y: 0 }, 'grid')).toBe(0);
	});
});
