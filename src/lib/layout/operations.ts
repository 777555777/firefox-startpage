import type { ColumnCount } from '$lib/config/types';

/**
 * Reine Funktionen auf dem Layout. Sie verändern die Eingabe nie, sondern liefern
 * eine neue Spaltenaufteilung.
 */

export const COLUMN_COUNTS: readonly ColumnCount[] = [1, 2, 3, 4];

export type Position = { column: number; index: number };

export function clampColumns(value: number): ColumnCount {
	return Math.min(4, Math.max(1, Math.round(value))) as ColumnCount;
}

/**
 * Ändert die Spaltenzahl. Neue Spalten sind leer. Fallen Spalten weg, landen ihre Widgets
 * in Reihenfolge am Ende der letzten verbleibenden Spalte.
 */
export function setColumnCount(columnItems: string[][], count: ColumnCount): string[][] {
	const next = Array.from({ length: count }, (_, i) => [...(columnItems[i] ?? [])]);
	for (const column of columnItems.slice(count)) next[count - 1].push(...column);
	return next;
}

export function findWidget(columnItems: string[][], id: string): Position | null {
	for (let column = 0; column < columnItems.length; column++) {
		const index = columnItems[column].indexOf(id);
		if (index !== -1) return { column, index };
	}
	return null;
}

/**
 * Verschiebt ein Widget an eine Zielposition. `to.index` bezieht sich auf die Zielspalte
 * nach dem Herausnehmen und wird auf den gültigen Bereich begrenzt.
 */
export function moveWidget(columnItems: string[][], id: string, to: Position): string[][] {
	const from = findWidget(columnItems, id);
	if (!from || to.column < 0 || to.column >= columnItems.length) return columnItems;
	const next = columnItems.map((column) => [...column]);
	next[from.column].splice(from.index, 1);
	const target = next[to.column];
	target.splice(Math.max(0, Math.min(to.index, target.length)), 0, id);
	return next;
}

export function insertWidget(columnItems: string[][], id: string, to: Position): string[][] {
	const next = columnItems.map((column) => column.filter((item) => item !== id));
	const target = next[Math.max(0, Math.min(to.column, next.length - 1))];
	target.splice(Math.max(0, Math.min(to.index, target.length)), 0, id);
	return next;
}

export function removeWidget(columnItems: string[][], id: string): string[][] {
	return columnItems.map((column) => column.filter((item) => item !== id));
}

/**
 * Tastatur-Verschiebung: hoch/runter innerhalb der Spalte, links/rechts in die Nachbarspalte
 * an dieselbe Position (begrenzt). Liefert die neue Position oder null, wenn es nicht weitergeht.
 */
export function stepPosition(
	columnItems: string[][],
	from: Position,
	direction: 'up' | 'down' | 'left' | 'right'
): Position | null {
	const length = columnItems[from.column]?.length ?? 0;
	switch (direction) {
		case 'up':
			return from.index > 0 ? { column: from.column, index: from.index - 1 } : null;
		case 'down':
			return from.index < length - 1 ? { column: from.column, index: from.index + 1 } : null;
		case 'left':
		case 'right': {
			const column = from.column + (direction === 'left' ? -1 : 1);
			if (column < 0 || column >= columnItems.length) return null;
			// Zielspalte hat nach dem Einfügen ein Element mehr
			return { column, index: Math.min(from.index, columnItems[column].length) };
		}
	}
}

/** Mindestbreite einer Spalte in rem (im Mittel), bevor Spalten zusammengelegt werden */
export const MIN_COLUMN_REM = 20;
/** Mindestbreite der schmalsten Spalte bei unterschiedlichen Breiten */
export const MIN_NARROW_COLUMN_REM = 14;

/**
 * Spaltenbreiten folgen einem 12er-Raster: Jede Spalte belegt ganze Einheiten, zusammen immer 12.
 * 12 ist durch 1–4 teilbar, gleich breite Spalten gehen also immer auf.
 */
export const GRID_UNITS = 12;
/** Mindestbreite einer Spalte in Raster-Einheiten */
export const MIN_SPAN = 2;

export const GAP_MIN = 8;
export const GAP_MAX = 64;

/** Grenzen für die maximale Gesamtbreite in rem; fehlt der Wert, gilt die volle Breite */
export const MAX_WIDTH_MIN = 48;
export const MAX_WIDTH_MAX = 160;
export const MAX_WIDTH_STEP = 8;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Wie viele Spalten bei der verfügbaren Breite tatsächlich nebeneinander passen. Mit
 * `spans` wird zusätzlich geprüft, ob die schmalste Spalte noch breit genug ist.
 */
export function visibleColumnCount(
	columns: number,
	availableWidthPx: number,
	remPx = 16,
	gapPx = 0,
	spans?: number[]
): number {
	const fit = Math.floor((availableWidthPx + gapPx) / (MIN_COLUMN_REM * remPx + gapPx));
	const count = Math.max(1, Math.min(columns, fit));
	if (count === columns && columns > 1 && spans) {
		const used = spans.slice(0, columns);
		const content = availableWidthPx - gapPx * (columns - 1);
		const narrowest = (content * Math.min(...used)) / sum(used);
		if (narrowest < MIN_NARROW_COLUMN_REM * remPx) return columns - 1;
	}
	return count;
}

export function equalSpans(columns: number): number[] {
	return Array.from({ length: columns }, () => GRID_UNITS / columns);
}

/**
 * Bringt beliebige Breiten auf das Raster: proportional auf 12 Einheiten skaliert, ganzzahlig
 * gerundet (größter Rest zuerst) und mit mindestens `MIN_SPAN` pro Spalte. Ältere relative
 * Breiten wie `[0.8, 1.4, 0.8]` werden so zu `[3, 6, 3]`.
 */
export function normalizeColumnWidths(raw: unknown, columns: number): number[] {
	const list = Array.isArray(raw) ? raw : [];
	const weights = Array.from({ length: columns }, (_, i) => {
		const value = list[i];
		return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
	});
	if (weights.some((w) => w === null)) return equalSpans(columns);

	const total = sum(weights as number[]);
	const exact = (weights as number[]).map((w) => (w / total) * GRID_UNITS);
	const spans = exact.map(Math.floor);
	const byRemainder = exact
		.map((value, i) => ({ i, rest: value - Math.floor(value) }))
		.sort((a, b) => b.rest - a.rest);
	for (let k = 0; sum(spans) < GRID_UNITS; k++) spans[byRemainder[k % columns].i]++;

	// Zu schmale Spalten auf das Minimum heben, die Einheiten von der breitesten nehmen
	for (let i = 0; i < columns; i++) {
		while (spans[i] < MIN_SPAN) {
			const widest = spans.indexOf(Math.max(...spans));
			if (spans[widest] <= MIN_SPAN) break;
			spans[widest]--;
			spans[i]++;
		}
	}
	return spans;
}

/**
 * Setzt die linke Spalte eines Nachbarpaars auf `left` Einheiten (gerastert und begrenzt).
 * Die Summe des Paars bleibt gleich.
 */
export function resizePair(spans: number[], index: number, left: number): number[] {
	if (index < 0 || index + 1 >= spans.length) return spans;
	const pair = spans[index] + spans[index + 1];
	const clamped = Math.min(pair - MIN_SPAN, Math.max(MIN_SPAN, Math.round(left)));
	const next = [...spans];
	next[index] = clamped;
	next[index + 1] = pair - clamped;
	return next;
}

/**
 * Spiegelt die Außenspalten der Seite, an der Trenner `index` liegt, auf die andere Seite
 * (symmetrisches Layout, z. B. 3·6·3). Die Spalten dazwischen teilen sich den Rest.
 * Liefert die Eingabe unverändert, wenn das nicht aufgeht.
 */
export function mirrorSpans(spans: number[], index: number): number[] {
	const n = spans.length;
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
	const rest = GRID_UNITS - 2 * sum(next.slice(0, outer));
	if (middle <= 0 || rest < middle * MIN_SPAN) return spans;
	for (let k = 0; k < middle; k++) {
		next[outer + k] = Math.floor(rest / middle) + (k < rest % middle ? 1 : 0);
	}
	return next;
}

export function equalWidths(widths: number[]): boolean {
	return widths.every((width) => width === widths[0]);
}

/**
 * Responsives Zusammenlegen nur für die Darstellung: Liefert für jede sichtbare Spalte die
 * Indizes der gespeicherten Spalten, die in ihr untereinander stehen. Benachbarte Spalten
 * werden zusammengefasst, die gespeicherte Zuordnung bleibt unverändert.
 */
export function collapseColumns(columns: number, visible: number): number[][] {
	const groups: number[][] = Array.from({ length: Math.max(1, visible) }, () => []);
	for (let column = 0; column < columns; column++) {
		groups[Math.floor((column * groups.length) / columns)].push(column);
	}
	return groups;
}

/** Normalisiert die Spaltenaufteilung gegenüber der Liste vorhandener Widgets */
export function normalizeColumnItems(
	raw: unknown,
	columns: ColumnCount,
	widgetIds: string[]
): string[][] {
	const known = new Set(widgetIds);
	const seen = new Set<string>();
	const parsed = (Array.isArray(raw) ? raw : []).map((column) =>
		(Array.isArray(column) ? column : []).filter((id): id is string => {
			if (typeof id !== 'string' || !known.has(id) || seen.has(id)) return false;
			seen.add(id);
			return true;
		})
	);
	const next = setColumnCount(parsed, columns);
	// Widgets ohne Platz im Layout gehen nicht verloren, sondern landen in der letzten Spalte
	for (const id of widgetIds) if (!seen.has(id)) next[columns - 1].push(id);
	return next;
}
