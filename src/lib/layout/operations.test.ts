import { describe, expect, it } from 'vitest';
import {
	collapseColumns,
	findWidget,
	insertWidget,
	equalSpans,
	mirrorSpans,
	moveWidget,
	normalizeColumnWidths,
	removeWidget,
	resizePair,
	setColumnCount,
	stepPosition,
	visibleColumnCount
} from './operations';

const layout = () => [['a', 'b'], ['c'], ['d', 'e', 'f']];

describe('Widgets verschieben', () => {
	it('verschiebt innerhalb einer Spalte', () => {
		expect(moveWidget(layout(), 'd', { column: 2, index: 2 })).toEqual([
			['a', 'b'],
			['c'],
			['e', 'f', 'd']
		]);
	});

	it('verschiebt zwischen Spalten', () => {
		expect(moveWidget(layout(), 'a', { column: 1, index: 0 })).toEqual([
			['b'],
			['a', 'c'],
			['d', 'e', 'f']
		]);
	});

	it('begrenzt den Zielindex', () => {
		expect(moveWidget(layout(), 'a', { column: 1, index: 99 })[1]).toEqual(['c', 'a']);
		expect(moveWidget(layout(), 'f', { column: 0, index: -3 })[0]).toEqual(['f', 'a', 'b']);
	});

	it('ändert bei unbekannten Widgets oder Spalten nichts', () => {
		const original = layout();
		expect(moveWidget(original, 'x', { column: 0, index: 0 })).toBe(original);
		expect(moveWidget(original, 'a', { column: 5, index: 0 })).toBe(original);
	});

	it('verändert die Eingabe nicht', () => {
		const original = layout();
		moveWidget(original, 'a', { column: 2, index: 0 });
		expect(original).toEqual(layout());
	});

	it('fügt ein, entfernt und findet Widgets', () => {
		expect(insertWidget(layout(), 'x', { column: 1, index: 1 })).toEqual([
			['a', 'b'],
			['c', 'x'],
			['d', 'e', 'f']
		]);
		expect(removeWidget(layout(), 'e')).toEqual([['a', 'b'], ['c'], ['d', 'f']]);
		expect(findWidget(layout(), 'e')).toEqual({ column: 2, index: 1 });
		expect(findWidget(layout(), 'x')).toBeNull();
	});
});

describe('Spaltenanzahl ändern', () => {
	it('legt neue Spalten leer an', () => {
		expect(setColumnCount([['a'], ['b']], 4)).toEqual([['a'], ['b'], [], []]);
	});

	it('hängt Widgets wegfallender Spalten an die letzte verbleibende an', () => {
		expect(setColumnCount(layout(), 2)).toEqual([
			['a', 'b'],
			['c', 'd', 'e', 'f']
		]);
		expect(setColumnCount(layout(), 1)).toEqual([['a', 'b', 'c', 'd', 'e', 'f']]);
	});
});

describe('Tastatur-Verschiebung', () => {
	it('bewegt hoch und runter innerhalb der Spalte', () => {
		expect(stepPosition(layout(), { column: 2, index: 1 }, 'up')).toEqual({ column: 2, index: 0 });
		expect(stepPosition(layout(), { column: 2, index: 1 }, 'down')).toEqual({
			column: 2,
			index: 2
		});
		expect(stepPosition(layout(), { column: 2, index: 0 }, 'up')).toBeNull();
		expect(stepPosition(layout(), { column: 2, index: 2 }, 'down')).toBeNull();
	});

	it('wechselt die Spalte an dieselbe Position, begrenzt auf die Länge', () => {
		expect(stepPosition(layout(), { column: 2, index: 2 }, 'left')).toEqual({
			column: 1,
			index: 1
		});
		expect(stepPosition(layout(), { column: 0, index: 1 }, 'right')).toEqual({
			column: 1,
			index: 1
		});
		expect(stepPosition(layout(), { column: 0, index: 0 }, 'left')).toBeNull();
		expect(stepPosition(layout(), { column: 2, index: 0 }, 'right')).toBeNull();
	});
});

describe('Responsives Zusammenlegen', () => {
	it('berechnet, wie viele Spalten nebeneinander passen', () => {
		// 20 rem à 16 px = 320 px pro Spalte
		expect(visibleColumnCount(4, 1400)).toBe(4);
		expect(visibleColumnCount(4, 1000)).toBe(3);
		expect(visibleColumnCount(3, 700)).toBe(2);
		expect(visibleColumnCount(3, 200)).toBe(1);
		expect(visibleColumnCount(2, 5000)).toBe(2);
		// Abstände zwischen den Spalten zählen mit
		expect(visibleColumnCount(3, 990, 16, 24)).toBe(2);
	});

	it('fasst benachbarte Spalten zusammen, ohne die Reihenfolge zu ändern', () => {
		expect(collapseColumns(3, 3)).toEqual([[0], [1], [2]]);
		expect(collapseColumns(3, 2)).toEqual([[0, 1], [2]]);
		expect(collapseColumns(4, 2)).toEqual([
			[0, 1],
			[2, 3]
		]);
		expect(collapseColumns(4, 3)).toEqual([[0, 1], [2], [3]]);
		expect(collapseColumns(4, 1)).toEqual([[0, 1, 2, 3]]);
	});
});

describe('Spaltenbreiten im 12er-Raster', () => {
	it('verteilt Spalten gleichmäßig, wenn nichts Gültiges gespeichert ist', () => {
		expect(normalizeColumnWidths(undefined, 3)).toEqual([4, 4, 4]);
		expect(normalizeColumnWidths([1, 'x'], 2)).toEqual([6, 6]);
		expect(normalizeColumnWidths([5, 5, 2], 4)).toEqual([3, 3, 3, 3]);
		expect(equalSpans(1)).toEqual([12]);
	});

	it('übernimmt gültige Raster-Breiten unverändert', () => {
		expect(normalizeColumnWidths([3, 6, 3], 3)).toEqual([3, 6, 3]);
		expect(normalizeColumnWidths([2, 8, 2], 3)).toEqual([2, 8, 2]);
	});

	it('rastert ältere relative Breiten auf 12 Einheiten', () => {
		expect(normalizeColumnWidths([0.79, 1.44, 0.77], 3)).toEqual([3, 6, 3]);
		expect(normalizeColumnWidths([1, 1, 1], 3)).toEqual([4, 4, 4]);
		expect(normalizeColumnWidths([1, 2], 2)).toEqual([4, 8]);
	});

	it('hebt zu schmale Spalten auf das Minimum', () => {
		expect(normalizeColumnWidths([0.1, 10, 0.1], 3)).toEqual([2, 8, 2]);
		expect(normalizeColumnWidths([1, 100, 1, 1], 4)).toEqual([2, 6, 2, 2]);
	});

	it('verschiebt einen Trenner in ganzen Einheiten und hält die Summe', () => {
		expect(resizePair([4, 4, 4], 0, 3)).toEqual([3, 5, 4]);
		expect(resizePair([4, 4, 4], 1, 5.4)).toEqual([4, 5, 3]);
		// mindestens zwei Einheiten pro Spalte
		expect(resizePair([4, 4, 4], 0, 0)).toEqual([2, 6, 4]);
		expect(resizePair([4, 4, 4], 0, 99)).toEqual([6, 2, 4]);
		expect(resizePair([6, 6], 1, 3)).toEqual([6, 6]);
	});

	it('spiegelt die Außenspalten für symmetrische Layouts', () => {
		expect(mirrorSpans([3, 5, 4], 0)).toEqual([3, 6, 3]);
		expect(mirrorSpans([4, 6, 2], 1)).toEqual([2, 8, 2]);
		expect(mirrorSpans([2, 4, 3, 3], 0)).toEqual([2, 4, 4, 2]);
		// mittlerer Trenner bei 4 Spalten hat kein Gegenstück
		expect(mirrorSpans([2, 4, 3, 3], 1)).toEqual([2, 4, 3, 3]);
		// geht nicht auf: Mitte wäre zu schmal
		expect(mirrorSpans([6, 2, 4], 0)).toEqual([6, 2, 4]);
	});

	it('legt Spalten zusammen, wenn die schmalste Spalte zu schmal würde', () => {
		// 3·6·3 bei 1100 px: schmalste Spalte ≈ 263 px > 224 px → passt
		expect(visibleColumnCount(3, 1100, 16, 24, [3, 6, 3])).toBe(3);
		// 2·8·2 bei 1100 px: schmalste Spalte ≈ 175 px < 224 px → eine Spalte weniger
		expect(visibleColumnCount(3, 1100, 16, 24, [2, 8, 2])).toBe(2);
		expect(visibleColumnCount(3, 1100, 16, 24, [4, 4, 4])).toBe(3);
	});
});
