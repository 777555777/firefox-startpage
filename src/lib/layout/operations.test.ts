import { describe, expect, it } from 'vitest';
import type { LayoutRow } from '$lib/config/types';
import {
	areaWidths,
	canJoin,
	centerSpanRange,
	clampCenterSpan,
	clampRowHeight,
	draggedRowHeight,
	enabledAreas,
	equalSpans,
	findWidget,
	fitCenterSpan,
	fitsSideBySide,
	fitSpans,
	foldDisabledSides,
	minColumnSpan,
	mirrorSpans,
	normalizeColumnRows,
	placeWidget,
	removeWidget,
	resizePair,
	resizeRowPair,
	restorePlacement,
	rowFits,
	rowIndexWithout,
	setRowHeight,
	setSide,
	steppedRowHeight,
	stepPlacement,
	visualOrder,
	widgetOrder,
	type Rows
} from './operations';

const row = (items: string[], spans?: number[]): LayoutRow => ({
	items,
	spans: spans ?? equalSpans(items.length, 8)
});

/** Drei Spalten à 8 Einheiten: [a] [b c] | [d] | [e] [f] */
const widths = [8, 8, 8];
const layout = (): Rows => [[row(['a']), row(['b', 'c'])], [row(['d'])], [row(['e']), row(['f'])]];
const items = (rows: Rows) => rows.map((column) => column.map((r) => r.items.join('+')));

describe('Raster-Breiten', () => {
	it('verteilt gleichmäßig, auch wenn es nicht aufgeht', () => {
		expect(equalSpans(3)).toEqual([8, 8, 8]);
		expect(equalSpans(3, 10)).toEqual([4, 3, 3]);
		expect(equalSpans(1)).toEqual([24]);
	});

	it('rastert beliebige Breiten proportional und hält das Minimum', () => {
		expect(fitSpans([6, 12, 6], 3, 24, 4)).toEqual([6, 12, 6]);
		expect(fitSpans([3, 6, 3], 3, 24, 4)).toEqual([6, 12, 6]);
		expect(fitSpans([0.79, 1.44, 0.77], 3, 24, 4)).toEqual([6, 12, 6]);
		expect(fitSpans([0.1, 10, 0.1], 3, 24, 4)).toEqual([4, 16, 4]);
		expect(fitSpans(undefined, 4, 24, 4)).toEqual([6, 6, 6, 6]);
		expect(fitSpans([1, 'x'], 2, 10, 3)).toEqual([5, 5]);
		// Minimum geht nicht auf: trotzdem eine gültige Summe
		expect(fitSpans([1, 1, 1], 3, 6, 3)).toEqual([2, 2, 2]);
	});

	it('verschiebt einen Trenner in ganzen Einheiten', () => {
		expect(resizePair([8, 8, 8], 0, 6)).toEqual([6, 10, 8]);
		expect(resizePair([8, 8, 8], 0, 0)).toEqual([4, 12, 8]);
		expect(resizePair([8, 8, 8], 0, 99)).toEqual([12, 4, 8]);
		// unterschiedliche Mindestbreiten links und rechts
		expect(resizePair([8, 8], 0, 2, [6, 4])).toEqual([6, 10]);
	});

	it('spiegelt die Außenspalten für symmetrische Layouts', () => {
		expect(mirrorSpans([6, 10, 8], 0)).toEqual([6, 12, 6]);
		expect(mirrorSpans([8, 12, 4], 1)).toEqual([4, 16, 4]);
		expect(mirrorSpans([12, 4, 8], 0)).toEqual([12, 4, 8]);
	});

	it('kennt die Mindestbreite einer Spalte aus ihren Zeilen', () => {
		expect(minColumnSpan([row(['a'])])).toBe(4);
		expect(minColumnSpan([row(['a']), row(['b', 'c', 'd'])])).toBe(9);
	});
});

describe('Widgets in Zeilen verschieben', () => {
	it('findet Widgets und liefert die Lesereihenfolge', () => {
		expect(findWidget(layout(), 'c')).toEqual({ column: 0, row: 1, index: 1 });
		expect(findWidget(layout(), 'x')).toBeNull();
		expect(widgetOrder(layout())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
	});

	it('entfernt ein Widget, die Nachbarn übernehmen die Breite', () => {
		const next = removeWidget(layout(), 'b');
		expect(items(next)[0]).toEqual(['a', 'c']);
		expect(next[0][1].spans).toEqual([8]);
		expect(items(removeWidget(layout(), 'd'))[1]).toEqual([]);
	});

	it('legt ein Widget als eigene Zeile ab', () => {
		const next = placeWidget(layout(), 'c', { kind: 'row', column: 1, index: 0 }, widths);
		expect(items(next)).toEqual([
			['a', 'b'],
			['c', 'd'],
			['e', 'f']
		]);
		expect(next[1][0].spans).toEqual([8]);
	});

	it('zählt den Zielindex ohne das verschobene Widget', () => {
		// e (Zeile 0) ans Ende der eigenen Spalte: nach dem Herausnehmen gibt es nur noch f
		const next = placeWidget(layout(), 'e', { kind: 'row', column: 2, index: 1 }, widths);
		expect(items(next)[2]).toEqual(['f', 'e']);
	});

	it('rechnet Zeilenindizes aus der Darstellung um', () => {
		// a steht allein in Zeile 0; „vor Zeile 2“ ist nach dem Herausnehmen Index 1
		expect(rowIndexWithout(layout(), 'a', 0, 2)).toBe(1);
		expect(rowIndexWithout(layout(), 'a', 0, 0)).toBe(0);
		// b teilt sich die Zeile, sie bleibt also bestehen
		expect(rowIndexWithout(layout(), 'b', 0, 2)).toBe(2);
		expect(rowIndexWithout(layout(), 'a', 1, 1)).toBe(1);
	});

	it('legt ein Widget neben ein anderes und verteilt die Breite', () => {
		const next = placeWidget(
			layout(),
			'd',
			{ kind: 'beside', target: 'a', side: 'before' },
			widths
		);
		expect(items(next)).toEqual([['d+a', 'b+c'], [], ['e', 'f']]);
		expect(next[0][0].spans).toEqual([4, 4]);
	});

	it('sortiert innerhalb der Zeile um und nimmt die Breite mit', () => {
		const start: Rows = [[row(['a', 'b', 'c'], [2, 3, 3])]];
		const next = placeWidget(start, 'a', { kind: 'beside', target: 'c', side: 'after' }, [8]);
		expect(next[0][0]).toEqual({ items: ['b', 'c', 'a'], spans: [3, 3, 2] });
	});

	it('lehnt volle oder zu schmale Zeilen ab', () => {
		const full: Rows = [[row(['a', 'b', 'c'], [8, 8, 8])], [row(['d'])]];
		expect(canJoin(full, 'd', 'a', [24, 8])).toBe(false);
		expect(placeWidget(full, 'd', { kind: 'beside', target: 'a', side: 'after' }, [24, 8])).toBe(
			full
		);
		// zwei Widgets à mindestens 3 Einheiten brauchen 6
		expect(canJoin([[row(['a'], [5])], [row(['b'])]], 'b', 'a', [5, 19])).toBe(false);
		expect(canJoin(layout(), 'a', 'a', widths)).toBe(false);
	});

	it('ändert Breiten innerhalb einer Zeile', () => {
		const start: Rows = [[row(['a', 'b', 'c'], [8, 8, 8])]];
		expect(resizeRowPair(start, 0, 0, 0, 5)[0][0].spans).toEqual([5, 11, 8]);
		expect(resizeRowPair(start, 0, 0, 0, 5, true)[0][0].spans).toEqual([5, 14, 5]);
		expect(resizeRowPair(start, 0, 0, 0, 0)[0][0].spans).toEqual([3, 13, 8]);
	});

	it('stellt ein entferntes Widget an seinen Platz zurück', () => {
		const before = layout();
		for (const id of ['a', 'b', 'c', 'f']) {
			const placement = restorePlacement(before, id)!;
			const removed = removeWidget(before, id);
			expect(items(placeWidget(removed, id, placement, widths))).toEqual(items(before));
		}
	});
});

describe('Tastatur-Verschiebung', () => {
	const step = (id: string, direction: 'up' | 'down' | 'left' | 'right', join = false) => {
		const placement = stepPlacement(layout(), id, direction, widths, join);
		return placement && items(placeWidget(layout(), id, placement, widths));
	};

	it('wechselt mit hoch/runter die Zeile', () => {
		expect(step('a', 'down')).toEqual([['b+c', 'a'], ['d'], ['e', 'f']]);
		expect(step('a', 'up')).toBeNull();
		expect(step('f', 'up')).toEqual([['a', 'b+c'], ['d'], ['f', 'e']]);
	});

	it('löst ein Widget aus einer geteilten Zeile als eigene Zeile', () => {
		expect(step('c', 'up')).toEqual([['a', 'c', 'b'], ['d'], ['e', 'f']]);
		expect(step('b', 'down')).toEqual([['a', 'c', 'b'], ['d'], ['e', 'f']]);
	});

	it('tauscht mit links/rechts in der Zeile und wechselt am Rand die Spalte', () => {
		expect(step('b', 'right')).toEqual([['a', 'c+b'], ['d'], ['e', 'f']]);
		expect(step('c', 'right')).toEqual([
			['a', 'b'],
			['d', 'c'],
			['e', 'f']
		]);
		expect(step('a', 'left')).toBeNull();
		expect(step('f', 'right')).toBeNull();
	});

	it('legt mit Umschalt neben die Zeile darüber oder darunter', () => {
		expect(step('f', 'up', true)).toEqual([['a', 'b+c'], ['d'], ['e+f']]);
		expect(step('e', 'down', true)).toEqual([['a', 'b+c'], ['d'], ['e+f']]);
		expect(step('a', 'up', true)).toBeNull();
		// drei Widgets brauchen 9 Einheiten, die Spalte hat nur 8
		expect(step('a', 'down', true)).toBeNull();
		const wide = [12, 6, 6];
		const placement = stepPlacement(layout(), 'a', 'down', wide, true)!;
		expect(items(placeWidget(layout(), 'a', placement, wide))[0]).toEqual(['a+b+c']);
	});

	it('wechselt links/rechts in der sichtbaren Reihenfolge der Spalten', () => {
		// Gespeichert Mitte, rechts, links; zu sehen links, Mitte, rechts
		const order = [2, 0, 1];
		const left = stepPlacement(layout(), 'a', 'left', widths, false, order);
		expect(left).toEqual({ kind: 'row', column: 2, index: 0 });
		expect(stepPlacement(layout(), 'e', 'left', widths, false, order)).toBeNull();
		expect(stepPlacement(layout(), 'd', 'right', widths, false, order)).toBeNull();
		expect(stepPlacement(layout(), 'e', 'right', widths, false, order)).toEqual({
			kind: 'row',
			column: 0,
			index: 0
		});
	});
});

describe('Mitte und Seiten', () => {
	const both = { left: true, right: true };
	const none = { left: false, right: false };

	it('teilt das Raster symmetrisch auf, ohne Seiten nimmt die Mitte alles', () => {
		expect(areaWidths(12, both)).toEqual([12, 6, 6]);
		expect(areaWidths(16, { left: false, right: true })).toEqual([16, 4, 4]);
		expect(areaWidths(12, none)).toEqual([24, 6, 6]);
	});

	it('hält die Mitte gerade und im erlaubten Bereich', () => {
		expect(clampCenterSpan(11)).toBe(12);
		expect(clampCenterSpan(13.2)).toBe(14);
		expect(clampCenterSpan(2)).toBe(8);
		expect(clampCenterSpan(30)).toBe(16);
	});

	it('richtet die erlaubte Breite nach den Zeilen', () => {
		// Drei Widgets in der Mitte brauchen 9 Einheiten, also mindestens 10
		const rows: Rows = [[row(['a', 'b', 'c'])], [], []];
		expect(centerSpanRange(rows, both)).toEqual([10, 16]);
		// Zwei Widgets in einer Seite brauchen 6 Einheiten, die Mitte höchstens 12
		const side: Rows = [[row(['a'])], [row(['b', 'c'])], []];
		expect(centerSpanRange(side, both)).toEqual([8, 12]);
		expect(fitCenterSpan(16, side, both)).toBe(12);
		// Ist die Seite aus, zählen ihre Zeilen nicht
		expect(centerSpanRange(side, { left: true, right: false })).toEqual([8, 16]);
	});

	it('stapelt Mitte, rechts, links und zeigt links, Mitte, rechts nebeneinander', () => {
		expect(enabledAreas(both)).toEqual([0, 1, 2]);
		expect(enabledAreas({ left: true, right: false })).toEqual([0, 2]);
		expect(visualOrder(both)).toEqual([2, 0, 1]);
		expect(visualOrder(none)).toEqual([0]);
	});

	it('stellt alles untereinander, sobald eine Spalte zu schmal würde', () => {
		// Seiten mindestens 14 rem, Mitte mindestens 20 rem
		// Seiten mindestens 20 rem: bei 12/24 ab (1328 − 2 · 24) · 6/24 = 320 px
		expect(fitsSideBySide(12, 1328, 24)).toBe(true);
		expect(fitsSideBySide(12, 1327, 24)).toBe(false);
		expect(fitsSideBySide(16, 1600, 24)).toBe(false);
		expect(fitsSideBySide(16, 1968, 24)).toBe(true);
		// Schmale Mitte: sie selbst braucht ebenfalls 20 rem
		expect(fitsSideBySide(8, 1008, 24)).toBe(true);
		expect(fitsSideBySide(8, 1007, 24)).toBe(false);
	});

	it('legt ausgeschaltete Seiten in der Mitte ab, erst rechts, dann links', () => {
		const rows = foldDisabledSides(layout(), none, areaWidths(12, none));
		expect(items(rows)).toEqual([['a', 'b+c', 'd', 'e', 'f'], [], []]);
		expect(rows[0][1].spans).toEqual([12, 12]);
	});

	it('schaltet eine Seite aus und wieder ein', () => {
		const start = { columnRows: layout(), sides: both, centerSpan: 8 };
		const off = setSide(start, 'right', false);
		expect(off.sides).toEqual({ left: true, right: false });
		expect(items(off.columnRows)).toEqual([['a', 'b+c', 'd'], [], ['e', 'f']]);
		const on = setSide(off, 'right', true);
		expect(items(on.columnRows)[1]).toEqual([]);
		// Ohne Seiten nimmt die Mitte die volle Breite ein
		const alone = setSide(setSide(start, 'right', false), 'left', false);
		expect(alone.columnRows[0][1].spans).toEqual([12, 12]);
	});

	it('stellt Widgets einer Zeile untereinander, wenn sie zu schmal würden', () => {
		// 13 rem = 208 px Mindestbreite
		expect(rowFits([4, 4], 440, 24)).toBe(true);
		expect(rowFits([4, 4], 400, 24)).toBe(false);
		expect(rowFits([8], 100, 24)).toBe(true);
	});
});

describe('Zeilen validieren', () => {
	const ids = ['a', 'b', 'c', 'd', 'e'];

	it('entfernt Unbekanntes und Doppeltes und ergänzt Fehlendes', () => {
		const rows = normalizeColumnRows(
			[[{ items: ['a', 'x', 'a'], spans: [8] }, { items: [] }, 'kaputt'], [{ items: ['b'] }]],
			ids,
			[12, 12]
		);
		// Fehlende Widgets kommen in die Mitte
		expect(items(rows)).toEqual([['a', 'c', 'd', 'e'], ['b']]);
		expect(rows[0][0].spans).toEqual([12]);
	});

	it('teilt zu volle Zeilen und passt die Breiten an', () => {
		const rows = normalizeColumnRows(
			[[{ items: ['a', 'b', 'c', 'd'], spans: [1, 1, 1, 1] }]],
			['a', 'b', 'c', 'd'],
			[24]
		);
		expect(items(rows)).toEqual([['a+b+c', 'd']]);
		expect(rows[0][0].spans).toEqual([8, 8, 8]);
		expect(rows[0][1].spans).toEqual([24]);
	});

	it('führt überzählige Spalten in der Mitte zusammen', () => {
		const rows = normalizeColumnRows(
			[[{ items: ['a'] }], [{ items: ['b'] }], [{ items: ['c'] }]],
			['a', 'b', 'c'],
			[24]
		);
		expect(items(rows)).toEqual([['a', 'b', 'c']]);
	});
});

describe('Höhe einer Zeile', () => {
	/** [a (20 rem)] [b c (30 rem)] | [d] | [e] [f] */
	const tall = (): Rows => {
		const rows = layout();
		rows[0][0].maxHeight = 20;
		rows[0][1].maxHeight = 30;
		return rows;
	};

	it('rastet ein, begrenzt und verwirft Unbrauchbares', () => {
		expect(clampRowHeight(21)).toBe(22);
		expect(clampRowHeight(20.9)).toBe(20);
		expect(clampRowHeight(4)).toBe(12);
		expect(clampRowHeight(500)).toBe(80);
		expect(clampRowHeight('20')).toBeUndefined();
		expect(clampRowHeight(Number.NaN)).toBeUndefined();
		expect(clampRowHeight(Infinity)).toBeUndefined();
		expect(clampRowHeight(undefined)).toBeUndefined();
	});

	it('setzt und entfernt die Höhe, ohne die Eingabe zu ändern', () => {
		const before = layout();
		const next = setRowHeight(before, 0, 1, 31);
		expect(next[0][1].maxHeight).toBe(32);
		expect(before[0][1].maxHeight).toBeUndefined();
		const auto = setRowHeight(next, 0, 1, undefined);
		expect(auto[0][1]).not.toHaveProperty('maxHeight');
		expect(setRowHeight(next, 0, 1, 32)).toBe(next);
		expect(setRowHeight(next, 5, 0, 20)).toBe(next);
	});

	it('rechnet Ziehen in Rastern, über die Obergrenze hinaus heißt automatisch', () => {
		expect(draggedRowHeight(20, 0)).toBe(20);
		expect(draggedRowHeight(20, 33)).toBe(22);
		expect(draggedRowHeight(20, -400)).toBe(12);
		expect(draggedRowHeight(20, (80 - 20) * 16)).toBe(80);
		expect(draggedRowHeight(20, (82 - 20) * 16)).toBeUndefined();
		expect(draggedRowHeight(20, 64, 32)).toBe(22);
	});

	it('rechnet Pfeiltasten von der gezeigten Höhe aus, wenn noch keine gesetzt ist', () => {
		expect(steppedRowHeight(undefined, 25.3, -1)).toBe(24);
		expect(steppedRowHeight(undefined, 25.3, 1)).toBe(28);
		expect(steppedRowHeight(20, 99, 1)).toBe(22);
		expect(steppedRowHeight(12, 12, -1)).toBe(12);
		expect(steppedRowHeight(80, 80, 1)).toBeUndefined();
		expect(steppedRowHeight(undefined, 200, -1)).toBe(78);
	});

	it('behält die Höhe einer Zeile, wenn Widgets dazukommen oder gehen', () => {
		const joined = placeWidget(tall(), 'd', { kind: 'beside', target: 'a', side: 'after' }, widths);
		expect(joined[0][0]).toMatchObject({ items: ['a', 'd'], maxHeight: 20 });
		const left = removeWidget(tall(), 'b');
		expect(left[0][1]).toMatchObject({ items: ['c'], maxHeight: 30 });
	});

	it('nimmt die Höhe mit, wenn ein Widget allein in seiner Zeile verschoben wird', () => {
		const moved = placeWidget(tall(), 'a', { kind: 'row', column: 0, index: 1 }, widths);
		expect(items(moved)[0]).toEqual(['b+c', 'a']);
		expect(moved[0][1].maxHeight).toBe(20);
		const across = placeWidget(tall(), 'a', { kind: 'row', column: 2, index: 0 }, widths);
		expect(across[2][0]).toMatchObject({ items: ['a'], maxHeight: 20 });
	});

	it('startet automatisch, wenn sich ein Widget aus einer geteilten Zeile löst', () => {
		const next = placeWidget(tall(), 'c', { kind: 'row', column: 0, index: 2 }, widths);
		expect(items(next)[0]).toEqual(['a', 'b', 'c']);
		expect(next[0][1].maxHeight).toBe(30);
		expect(next[0][2]).not.toHaveProperty('maxHeight');
	});

	it('stellt ein entferntes Widget mit seiner Höhe wieder her', () => {
		const rows = tall();
		const placement = restorePlacement(rows, 'a')!;
		expect(placement).toMatchObject({ kind: 'row', maxHeight: 20 });
		const restored = placeWidget(removeWidget(rows, 'a'), 'a', placement, widths);
		expect(restored[0][0]).toMatchObject({ items: ['a'], maxHeight: 20 });
	});

	it('behält die Höhe beim Ausschalten einer Seite', () => {
		const rows = tall();
		rows[2][0].maxHeight = 40;
		const folded = foldDisabledSides(rows, { left: false, right: true }, widths);
		expect(folded[0].at(-2)).toMatchObject({ items: ['e'], maxHeight: 40 });
	});

	it('wird beim Validieren gelesen und eingerastet', () => {
		const rows = normalizeColumnRows(
			[
				[
					{ items: ['a'], maxHeight: 33 },
					{ items: ['b'], maxHeight: 'hoch' },
					{ items: ['c', 'd', 'e', 'x', 'f'], maxHeight: 200 }
				]
			],
			['a', 'b', 'c', 'd', 'e', 'f'],
			[24]
		);
		expect(rows[0][0].maxHeight).toBe(34);
		expect(rows[0][1]).not.toHaveProperty('maxHeight');
		// Eine zu volle Zeile wird geteilt, beide Teile behalten die Höhe
		expect(items(rows)[0]).toEqual(['a', 'b', 'c+d+e', 'f']);
		expect(rows[0][2].maxHeight).toBe(80);
		expect(rows[0][3].maxHeight).toBe(80);
	});
});
