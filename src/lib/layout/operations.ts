import type { LayoutArea, LayoutConfig, LayoutRow } from '$lib/config/types';

/**
 * Reine Funktionen auf dem Layout. Sie verändern die Eingabe nie, sondern liefern eine neue
 * Aufteilung. Das Layout besteht aus einer Mittelspalte und zwei Seitenspalten, jede Spalte
 * aus Zeilen, jede Zeile aus 1 bis 3 Widgets nebeneinander. Alle Breiten folgen einem
 * 24er-Raster.
 */

/** Bereiche in gespeicherter Reihenfolge, zugleich Lese- und Stapelreihenfolge */
export const LAYOUT_AREAS: readonly LayoutArea[] = ['center', 'right', 'left'];
export const CENTER = 0;
export const RIGHT = 1;
export const LEFT = 2;

export const GRID_UNITS = 24;
/** Mindestbreite einer Spalte in Raster-Einheiten */
export const MIN_SPAN = 4;
/** Mindestbreite eines Widgets in einer Zeile */
export const MIN_ITEM_SPAN = 3;
/** Höchstens so viele Widgets nebeneinander */
export const MAX_ROW_ITEMS = 3;

export const COLUMN_GAP_MIN = 0;
export const COLUMN_GAP_MAX = 128;
export const PANEL_GAP_MIN = 4;
export const PANEL_GAP_MAX = 64;

/** Grenzen für die maximale Gesamtbreite in rem; fehlt der Wert, gilt die volle Breite */
export const MAX_WIDTH_MIN = 48;
export const MAX_WIDTH_MAX = 160;
export const MAX_WIDTH_STEP = 8;

/** Breite der Mitte im Raster; gerade, damit beide Seiten ganze Einheiten bekommen */
export const DEFAULT_CENTER_SPAN = 12;
export const CENTER_SPAN_MIN = 8;
export const CENTER_SPAN_MAX = GRID_UNITS - 2 * MIN_SPAN;

/** Grenzen der Höchsthöhe einer Zeile in rem; fehlt der Wert, gilt „Automatisch“ */
export const ROW_HEIGHT_MIN = 12;
export const ROW_HEIGHT_MAX = 80;
export const ROW_HEIGHT_STEP = 2;

/** Mindestbreite der Mitte in rem, nebeneinander wie neben der Sidebar */
export const MIN_CENTER_REM = 20;
/** Mindestbreite einer Seitenspalte in rem für drei Spalten nebeneinander, sonst Sidebar */
export const MIN_SIDE_WIDE_REM = 20;
/** Breite der Spalte in der Sidebar (mittlere Stufe) in rem */
export const SIDEBAR_REM = 22;
/** Breite der Tabs am Rand der Sidebar in px */
export const EDGE_TAB_PX = 36;
/** Freiraum zwischen Tabs und Mitte in px */
export const EDGE_TAB_CLEARANCE_PX = 8;
/** Mindestbreite eines Widgets in einer Zeile, sonst stehen die Widgets untereinander */
export const MIN_ITEM_REM = 13;
/** Größte Breite, wenn alle Spalten untereinander stehen */
export const SINGLE_COLUMN_MAX_REM = 48;

export type Rows = LayoutRow[][];
export type Sides = LayoutConfig['sides'];
export type Side = keyof Sides;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// --- Breiten -------------------------------------------------------------------------------

/** `count` ganzzahlige Breiten, zusammen `total`; der Rest geht an die vorderen */
export function equalSpans(count: number, total = GRID_UNITS): number[] {
	const base = Math.floor(total / count);
	return Array.from({ length: count }, (_, i) => base + (i < total % count ? 1 : 0));
}

/**
 * Bringt beliebige Breiten auf `count` ganze Einheiten mit Summe `total`: proportional skaliert,
 * nach größtem Rest gerundet und mit mindestens `min` pro Eintrag (sofern das aufgeht).
 * Unbrauchbare Werte ergeben gleich breite Einträge.
 */
export function fitSpans(raw: unknown, count: number, total: number, min: number): number[] {
	if (count <= 0) return [];
	const list = Array.isArray(raw) ? raw : [];
	const weights = Array.from({ length: count }, (_, i) => {
		const value = list[i];
		return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
	});
	if (weights.some((w) => w === null)) return equalSpans(count, total);

	const weightSum = sum(weights as number[]);
	const exact = (weights as number[]).map((w) => (w / weightSum) * total);
	const spans = exact.map(Math.floor);
	const byRemainder = exact
		.map((value, i) => ({ i, rest: value - Math.floor(value) }))
		.sort((a, b) => b.rest - a.rest);
	for (let k = 0; sum(spans) < total; k++) spans[byRemainder[k % count].i]++;

	// Zu schmale Einträge auf das Minimum heben, die Einheiten vom breitesten nehmen
	if (count * min <= total) {
		for (let i = 0; i < count; i++) {
			while (spans[i] < min) {
				const widest = spans.indexOf(Math.max(...spans));
				spans[widest]--;
				spans[i]++;
			}
		}
	}
	return spans;
}

/**
 * Setzt den linken Eintrag eines Nachbarpaars auf `left` Einheiten (gerastert und begrenzt).
 * Die Summe des Paars bleibt gleich. `min` gilt für beide Seiten oder getrennt [links, rechts].
 */
export function resizePair(
	spans: number[],
	index: number,
	left: number,
	min: number | [number, number] = MIN_SPAN
): number[] {
	if (index < 0 || index + 1 >= spans.length) return spans;
	const [minLeft, minRight] = typeof min === 'number' ? [min, min] : min;
	const pair = spans[index] + spans[index + 1];
	if (minLeft + minRight > pair) return spans;
	const clamped = Math.min(pair - minRight, Math.max(minLeft, Math.round(left)));
	const next = [...spans];
	next[index] = clamped;
	next[index + 1] = pair - clamped;
	return next;
}

/**
 * Spiegelt die Außenspalten der Seite, an der Trenner `index` liegt, auf die andere Seite
 * (symmetrisches Layout, z. B. 6·12·6). Die Einträge dazwischen teilen sich den Rest.
 * Liefert die Eingabe unverändert, wenn das nicht aufgeht.
 */
export function mirrorSpans(spans: number[], index: number, min = MIN_SPAN): number[] {
	const n = spans.length;
	const total = sum(spans);
	const mirrored = n - 2 - index;
	if (n < 3 || mirrored === index) return spans;
	const next = [...spans];
	// Die Seite des gezogenen Trenners gibt die Außenspalten vor
	const fromLeft = index < mirrored;
	const outer = fromLeft ? index + 1 : n - 1 - index;
	for (let k = 0; k < outer; k++) {
		if (fromLeft) next[n - 1 - k] = next[k];
		else next[k] = next[n - 1 - k];
	}
	const middle = n - 2 * outer;
	const rest = total - 2 * sum(next.slice(0, outer));
	if (middle <= 0 || rest < middle * min) return spans;
	for (let k = 0; k < middle; k++) {
		next[outer + k] = Math.floor(rest / middle) + (k < rest % middle ? 1 : 0);
	}
	return next;
}

/** Kleinste Breite, die eine Spalte mit diesen Zeilen haben darf */
export function minColumnSpan(rows: LayoutRow[]): number {
	return Math.max(MIN_SPAN, ...rows.map((row) => row.items.length * MIN_ITEM_SPAN));
}

/** Passt die Breiten aller Zeilen an die Breiten ihrer Spalten an */
export function fitRows(columnRows: Rows, columnWidths: number[]): Rows {
	return columnRows.map((rows, column) =>
		rows.map((row) => {
			const spans = fitSpans(row.spans, row.items.length, columnWidths[column], MIN_ITEM_SPAN);
			return spans.every((span, i) => span === row.spans[i]) ? row : { ...row, spans };
		})
	);
}

// --- Mitte und Seiten ---------------------------------------------------------------------------

export const hasSides = (sides: Sides) => sides.left || sides.right;

/** Breite einer Seitenspalte im Raster */
export const sideSpan = (centerSpan: number) => (GRID_UNITS - centerSpan) / 2;

/** Auf eine gerade Zahl im erlaubten Bereich bringen */
export function clampCenterSpan(value: number): number {
	const even = Math.round(value / 2) * 2;
	return Math.min(CENTER_SPAN_MAX, Math.max(CENTER_SPAN_MIN, even));
}

/**
 * Breite pro Bereich (Mitte, rechts, links). Ohne Seitenspalten nimmt die Mitte die volle
 * Breite ein; ausgeschaltete Seiten behalten ihren Platz, damit die Mitte mittig bleibt.
 */
export function areaWidths(centerSpan: number, sides: Sides): number[] {
	const side = sideSpan(centerSpan);
	return [hasSides(sides) ? centerSpan : GRID_UNITS, side, side];
}

/** Eingeschaltete Bereiche in Stapelreihenfolge: Mitte, rechts, links */
export function enabledAreas(sides: Sides): number[] {
	return [CENTER, ...(sides.right ? [RIGHT] : []), ...(sides.left ? [LEFT] : [])];
}

/** Eingeschaltete Bereiche von links nach rechts, wie sie nebeneinander stehen */
export function visualOrder(sides: Sides): number[] {
	return [...(sides.left ? [LEFT] : []), CENTER, ...(sides.right ? [RIGHT] : [])];
}

/** Erlaubte Breiten der Mitte, so dass jede Spalte ihre Zeilen noch fasst */
export function centerSpanRange(columnRows: Rows, sides: Sides): [min: number, max: number] {
	const centerMin = Math.max(CENTER_SPAN_MIN, minColumnSpan(columnRows[CENTER] ?? []));
	const sideMin = Math.max(
		MIN_SPAN,
		...(sides.right ? [minColumnSpan(columnRows[RIGHT] ?? [])] : []),
		...(sides.left ? [minColumnSpan(columnRows[LEFT] ?? [])] : [])
	);
	const min = Math.ceil(centerMin / 2) * 2;
	const max = Math.min(CENTER_SPAN_MAX, GRID_UNITS - 2 * sideMin);
	return [min, Math.max(min, max)];
}

/** Nächste erlaubte Breite der Mitte */
export function fitCenterSpan(centerSpan: number, columnRows: Rows, sides: Sides): number {
	const [min, max] = centerSpanRange(columnRows, sides);
	return Math.min(max, Math.max(min, clampCenterSpan(centerSpan)));
}

/**
 * Ob Seiten und Mitte bei der verfügbaren Breite nebeneinander passen. Sonst wandern die Seiten
 * in die Sidebar oder stehen unter der Mitte (siehe `layoutStage`).
 */
export function fitsSideBySide(
	centerSpan: number,
	availablePx: number,
	gapPx: number,
	remPx = 16
): boolean {
	const content = availablePx - 2 * gapPx;
	const center = (content * centerSpan) / GRID_UNITS;
	const side = (content * sideSpan(centerSpan)) / GRID_UNITS;
	return center >= MIN_CENTER_REM * remPx && side >= MIN_SIDE_WIDE_REM * remPx;
}

/** Ob die Widgets einer Zeile bei dieser Spaltenbreite nebeneinander passen */
export function rowFits(spans: number[], columnPx: number, gapPx: number, remPx = 16): boolean {
	if (spans.length < 2) return true;
	const content = columnPx - gapPx * (spans.length - 1);
	return (content * Math.min(...spans)) / sum(spans) >= MIN_ITEM_REM * remPx;
}

/** Hängt die Zeilen ausgeschalteter Seiten an die Mitte an */
export function foldDisabledSides(columnRows: Rows, sides: Sides, widths: number[]): Rows {
	const folded = (
		[
			[LEFT, sides.left],
			[RIGHT, sides.right]
		] as const
	).filter(([area, on]) => !on && (columnRows[area]?.length ?? 0) > 0);
	if (folded.length === 0) return columnRows;
	const next = cloneRows(columnRows);
	// Erst rechts, dann links: wie beim Untereinanderstellen
	for (const [area] of folded.reverse()) {
		next[CENTER].push(...next[area]);
		next[area] = [];
	}
	return fitRows(next, widths);
}

/**
 * Schaltet eine Seitenspalte ein oder aus. Ihre Widgets wandern ans Ende der Mitte. Die Mitte
 * wird bei Bedarf so breit, dass ihre Zeilen weiter hineinpassen.
 */
export function setSide(
	layout: Pick<LayoutConfig, 'columnRows' | 'sides' | 'centerSpan'>,
	side: Side,
	on: boolean
): Pick<LayoutConfig, 'columnRows' | 'sides' | 'centerSpan'> {
	const sides = { ...layout.sides, [side]: on };
	const rows = foldDisabledSides(layout.columnRows, sides, areaWidths(layout.centerSpan, sides));
	const centerSpan = fitCenterSpan(layout.centerSpan, rows, sides);
	return { sides, centerSpan, columnRows: fitRows(rows, areaWidths(centerSpan, sides)) };
}

// --- Widgets in Zeilen -------------------------------------------------------------------------

export type WidgetPosition = { column: number; row: number; index: number };

/**
 * Ziel beim Verschieben:
 * - `row`: als eigene Zeile an Position `index` der Spalte (gezählt ohne das verschobene Widget)
 * - `beside`: in die Zeile von `target`, links (`before`) oder rechts (`after`) davon
 */
export type Placement =
	| {
			kind: 'row';
			column: number;
			index: number;
			/** Höchsthöhe der neuen Zeile, z. B. beim Wiederherstellen eines entfernten Widgets */
			maxHeight?: number;
	  }
	| { kind: 'beside'; target: string; side: 'before' | 'after' };

export function findWidget(columnRows: Rows, id: string): WidgetPosition | null {
	for (let column = 0; column < columnRows.length; column++) {
		const rows = columnRows[column];
		for (let row = 0; row < rows.length; row++) {
			const index = rows[row].items.indexOf(id);
			if (index !== -1) return { column, row, index };
		}
	}
	return null;
}

/** Alle Widget-IDs in Lesereihenfolge (Spalte für Spalte, Zeile für Zeile) */
export function widgetOrder(columnRows: Rows): string[] {
	return columnRows.flatMap((rows) => rows.flatMap((row) => row.items));
}

const cloneRows = (columnRows: Rows): Rows =>
	columnRows.map((rows) =>
		rows.map((row) => ({ ...row, items: [...row.items], spans: [...row.spans] }))
	);

/** Neue Zeile mit einem Widget, auf Wunsch mit Höchsthöhe */
const singleRow = (id: string, span: number, maxHeight?: number): LayoutRow => ({
	items: [id],
	spans: [span],
	...(maxHeight !== undefined && { maxHeight })
});

/**
 * Nimmt ein Widget heraus. Die übrigen Widgets der Zeile teilen sich seine Breite
 * anteilig, eine leere Zeile verschwindet.
 */
export function removeWidget(columnRows: Rows, id: string): Rows {
	const position = findWidget(columnRows, id);
	if (!position) return columnRows;
	const next = cloneRows(columnRows);
	const rows = next[position.column];
	const row = rows[position.row];
	const total = sum(row.spans);
	row.items.splice(position.index, 1);
	row.spans.splice(position.index, 1);
	if (row.items.length === 0) rows.splice(position.row, 1);
	else row.spans = fitSpans(row.spans, row.items.length, total, MIN_ITEM_SPAN);
	return next;
}

/** Ob `id` neben `target` passt: höchstens drei pro Zeile, jedes mindestens `MIN_ITEM_SPAN` breit */
export function canJoin(columnRows: Rows, id: string, target: string, columnWidths: number[]) {
	const position = findWidget(columnRows, target);
	if (!position || id === target) return false;
	const row = columnRows[position.column][position.row];
	if (row.items.includes(id)) return true;
	const count = row.items.length + 1;
	return count <= MAX_ROW_ITEMS && count * MIN_ITEM_SPAN <= columnWidths[position.column];
}

/**
 * Verschiebt (oder fügt neu ein) ein Widget an eine Position. Liefert die Eingabe unverändert,
 * wenn das Ziel ungültig ist. Innerhalb derselben Zeile behält das Widget seine Breite, beim
 * Wechsel in eine andere Zeile werden die Breiten dort gleichmäßig verteilt.
 *
 * Höhen: Eine Zeile behält ihre Höchsthöhe, wenn Widgets dazukommen oder gehen. Stand das
 * Widget allein in seiner Zeile und wird wieder eine eigene Zeile, nimmt es die Höhe mit (die
 * Zeile wandert also als Ganzes). Löst es sich aus einer geteilten Zeile, startet die neue Zeile
 * mit „Automatisch“.
 */
export function placeWidget(
	columnRows: Rows,
	id: string,
	placement: Placement,
	columnWidths: number[]
): Rows {
	if (placement.kind === 'row') {
		if (placement.column < 0 || placement.column >= columnRows.length) return columnRows;
		const from = findWidget(columnRows, id);
		const source = from && columnRows[from.column][from.row];
		const carried = source?.items.length === 1 ? source.maxHeight : undefined;
		const next = removeWidget(columnRows, id);
		const rows = next[placement.column];
		const index = Math.max(0, Math.min(placement.index, rows.length));
		const span = columnWidths[placement.column];
		rows.splice(index, 0, singleRow(id, span, placement.maxHeight ?? carried));
		return next;
	}

	if (!canJoin(columnRows, id, placement.target, columnWidths)) return columnRows;
	const from = findWidget(columnRows, id);
	const to = findWidget(columnRows, placement.target);
	if (!to) return columnRows;

	// Umsortieren innerhalb der Zeile: Breiten wandern mit
	if (from && from.column === to.column && from.row === to.row) {
		const next = cloneRows(columnRows);
		const row = next[to.column][to.row];
		const [span] = row.spans.splice(from.index, 1);
		row.items.splice(from.index, 1);
		const targetIndex = row.items.indexOf(placement.target);
		const index = targetIndex + (placement.side === 'after' ? 1 : 0);
		row.items.splice(index, 0, id);
		row.spans.splice(index, 0, span);
		return next;
	}

	const next = removeWidget(columnRows, id);
	const target = findWidget(next, placement.target);
	if (!target) return columnRows;
	const row = next[target.column][target.row];
	row.items.splice(target.index + (placement.side === 'after' ? 1 : 0), 0, id);
	row.spans = equalSpans(row.items.length, columnWidths[target.column]);
	return next;
}

/**
 * Rechnet einen Zeilenindex aus der aktuellen Darstellung (mit dem verschobenen Widget) in den
 * Index nach dem Herausnehmen um, wie ihn `placeWidget` erwartet.
 */
export function rowIndexWithout(
	columnRows: Rows,
	id: string,
	column: number,
	index: number
): number {
	const from = findWidget(columnRows, id);
	const alone = from && columnRows[from.column][from.row].items.length === 1;
	return alone && from.column === column && from.row < index ? index - 1 : index;
}

/** Zeile `row` in Spalte `column`: linkes Widget des Paars `index` auf `left` Einheiten */
export function resizeRowPair(
	columnRows: Rows,
	column: number,
	row: number,
	index: number,
	left: number,
	mirror = false
): Rows {
	const current = columnRows[column]?.[row];
	if (!current) return columnRows;
	let spans = resizePair(current.spans, index, left, MIN_ITEM_SPAN);
	if (mirror) spans = mirrorSpans(spans, index, MIN_ITEM_SPAN);
	if (spans.every((span, i) => span === current.spans[i])) return columnRows;
	const next = cloneRows(columnRows);
	next[column][row].spans = spans;
	return next;
}

export function equalizeRow(columnRows: Rows, column: number, row: number): Rows {
	const current = columnRows[column]?.[row];
	if (!current) return columnRows;
	const next = cloneRows(columnRows);
	next[column][row].spans = equalSpans(current.items.length, sum(current.spans));
	return next;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Tastatur-Verschiebung. Hoch/runter wechselt die Zeile (ein Widget aus einer geteilten Zeile
 * wird dabei zur eigenen Zeile), links/rechts tauscht innerhalb der Zeile und wechselt am Rand
 * in die Nachbarspalte (in der Reihenfolge `order`). Mit `join` legt hoch/runter das Widget neben die Zeile darüber bzw.
 * darunter. Liefert das Ziel oder null, wenn es nicht weitergeht.
 */
export function stepPlacement(
	columnRows: Rows,
	id: string,
	direction: Direction,
	columnWidths: number[],
	join = false,
	order: number[] = columnRows.map((_, i) => i)
): Placement | null {
	const from = findWidget(columnRows, id);
	if (!from) return null;
	const rows = columnRows[from.column];
	const row = rows[from.row];
	const alone = row.items.length === 1;

	if (join && (direction === 'up' || direction === 'down')) {
		const neighbor = rows[from.row + (direction === 'up' ? -1 : 1)];
		if (!neighbor) return null;
		const target = direction === 'up' ? neighbor.items.at(-1)! : neighbor.items[0];
		if (!canJoin(columnRows, id, target, columnWidths)) return null;
		return { kind: 'beside', target, side: direction === 'up' ? 'after' : 'before' };
	}

	switch (direction) {
		case 'up':
			if (!alone) return { kind: 'row', column: from.column, index: from.row };
			return from.row > 0 ? { kind: 'row', column: from.column, index: from.row - 1 } : null;
		case 'down':
			if (!alone) return { kind: 'row', column: from.column, index: from.row + 1 };
			return from.row < rows.length - 1
				? { kind: 'row', column: from.column, index: from.row + 1 }
				: null;
		case 'left':
		case 'right': {
			const step = direction === 'left' ? -1 : 1;
			const neighbor = row.items[from.index + step];
			if (neighbor) {
				return {
					kind: 'beside',
					target: neighbor,
					side: direction === 'left' ? 'before' : 'after'
				};
			}
			// Nachbarspalte in der Reihenfolge, in der die Spalten zu sehen sind
			const column = order[order.indexOf(from.column) + step];
			if (column === undefined || order.indexOf(from.column) === -1) return null;
			return { kind: 'row', column, index: Math.min(from.row, columnRows[column].length) };
		}
	}
}

/**
 * Platzierung, mit der sich ein entferntes Widget wieder an seinen Platz bringen lässt:
 * neben seinen bisherigen Nachbarn oder als eigene Zeile an der alten Position.
 */
export function restorePlacement(columnRows: Rows, id: string): Placement | null {
	const position = findWidget(columnRows, id);
	if (!position) return null;
	const row = columnRows[position.column][position.row];
	if (row.items.length > 1) {
		return position.index > 0
			? { kind: 'beside', target: row.items[position.index - 1], side: 'after' }
			: { kind: 'beside', target: row.items[1], side: 'before' };
	}
	return {
		kind: 'row',
		column: position.column,
		index: position.row,
		...(row.maxHeight !== undefined && { maxHeight: row.maxHeight })
	};
}

// --- Höhe einer Zeile ---------------------------------------------------------------------------

/** Rastet eine Höchsthöhe ein und begrenzt sie; Unbrauchbares ergibt „Automatisch“ (`undefined`) */
export function clampRowHeight(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
	const snapped = Math.round(value / ROW_HEIGHT_STEP) * ROW_HEIGHT_STEP;
	return Math.min(ROW_HEIGHT_MAX, Math.max(ROW_HEIGHT_MIN, snapped));
}

/**
 * Höhe beim Ziehen am Griff: Ausgangshöhe plus Zeigerweg, eingerastet. Über die Obergrenze
 * hinaus gezogen heißt „Automatisch“.
 */
export function draggedRowHeight(startRem: number, deltaPx: number, remPx = 16) {
	const value = startRem + deltaPx / remPx;
	return value > ROW_HEIGHT_MAX + ROW_HEIGHT_STEP / 2 ? undefined : clampRowHeight(value);
}

/**
 * Höhe nach einem Tastendruck am Griff. `shownRem` ist die gerade gezeigte Höhe; von
 * „Automatisch“ aus wird von dort gerechnet. Über die Obergrenze hinaus heißt „Automatisch“.
 */
export function steppedRowHeight(
	current: number | undefined,
	shownRem: number,
	step: -1 | 1
): number | undefined {
	const base = current ?? clampRowHeight(shownRem) ?? ROW_HEIGHT_MIN;
	const value = base + step * ROW_HEIGHT_STEP;
	return value > ROW_HEIGHT_MAX ? undefined : clampRowHeight(value);
}

/** Setzt die Höchsthöhe einer Zeile; `undefined` = „Automatisch“ */
export function setRowHeight(
	columnRows: Rows,
	column: number,
	row: number,
	maxHeight: number | undefined
): Rows {
	const current = columnRows[column]?.[row];
	if (!current) return columnRows;
	const value = maxHeight === undefined ? undefined : clampRowHeight(maxHeight);
	if (value === current.maxHeight) return columnRows;
	const next = cloneRows(columnRows);
	const { maxHeight: _previous, ...rest } = next[column][row];
	next[column][row] = value === undefined ? rest : { ...rest, maxHeight: value };
	return next;
}

// --- Validierung ------------------------------------------------------------------------------

/**
 * Normalisiert die Zeilen gegenüber der Liste vorhandener Widgets: unbekannte und doppelte IDs
 * fallen weg, leere Zeilen auch, zu volle Zeilen werden aufgeteilt. Überzählige Spalten und
 * Widgets ohne Platz landen als eigene Zeilen in der Mitte. Breiten passen danach zur
 * jeweiligen Spalte; es gibt so viele Spalten wie `columnWidths` Einträge hat.
 */
export function normalizeColumnRows(
	raw: unknown,
	widgetIds: string[],
	columnWidths: number[]
): Rows {
	const columns = columnWidths.length;
	const known = new Set(widgetIds);
	const seen = new Set<string>();
	const parsed: Rows = (Array.isArray(raw) ? raw : []).map((column) => {
		const rows: LayoutRow[] = [];
		for (const value of Array.isArray(column) ? column : []) {
			const record = typeof value === 'object' && value !== null ? value : {};
			const items = 'items' in record && Array.isArray(record.items) ? record.items : [];
			const spans = 'spans' in record && Array.isArray(record.spans) ? record.spans : [];
			const maxHeight = clampRowHeight('maxHeight' in record ? record.maxHeight : undefined);
			const kept: { id: string; span: unknown }[] = [];
			items.forEach((id: unknown, i: number) => {
				if (typeof id !== 'string' || !known.has(id) || seen.has(id)) return;
				seen.add(id);
				kept.push({ id, span: spans[i] });
			});
			for (let start = 0; start < kept.length; start += MAX_ROW_ITEMS) {
				const chunk = kept.slice(start, start + MAX_ROW_ITEMS);
				rows.push({
					items: chunk.map((k) => k.id),
					spans: chunk.map((k) => k.span as number),
					...(maxHeight !== undefined && { maxHeight })
				});
			}
		}
		return rows;
	});

	const next: Rows = Array.from({ length: columns }, (_, i) => parsed[i] ?? []);
	for (const rows of parsed.slice(columns)) next[CENTER].push(...rows);
	for (const id of widgetIds) {
		if (!seen.has(id)) next[CENTER].push({ items: [id], spans: [] });
	}
	return fitRows(next, columnWidths);
}
