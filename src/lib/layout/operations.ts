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

/** Grenzen für relative Spaltenbreiten (wie `fr`) */
export const WIDTH_MIN = 0.5;
export const WIDTH_MAX = 3;

export const GAP_MIN = 8;
export const GAP_MAX = 64;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Wie viele Spalten bei der verfügbaren Breite tatsächlich nebeneinander passen. Mit
 * `weights` wird zusätzlich geprüft, ob die schmalste Spalte noch breit genug ist.
 */
export function visibleColumnCount(
	columns: number,
	availableWidthPx: number,
	remPx = 16,
	gapPx = 0,
	weights?: number[]
): number {
	const fit = Math.floor((availableWidthPx + gapPx) / (MIN_COLUMN_REM * remPx + gapPx));
	const count = Math.max(1, Math.min(columns, fit));
	if (count === columns && columns > 1 && weights) {
		const used = weights.slice(0, columns);
		const content = availableWidthPx - gapPx * (columns - 1);
		const narrowest = (content * Math.min(...used)) / used.reduce((a, b) => a + b, 0);
		if (narrowest < MIN_NARROW_COLUMN_REM * remPx) return columns - 1;
	}
	return count;
}

/** Bringt relative Breiten auf die Spaltenzahl; fehlende Spalten bekommen 1 */
export function normalizeColumnWidths(raw: unknown, columns: number): number[] {
	const list = Array.isArray(raw) ? raw : [];
	return Array.from({ length: columns }, (_, i) => {
		const value = list[i];
		return typeof value === 'number' && Number.isFinite(value)
			? round2(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, value)))
			: 1;
	});
}

/**
 * Verteilt die Breite zweier benachbarter Spalten neu. `share` ist der Anteil der linken
 * Spalte an beiden (0…1). Die Summe des Paars bleibt gleich, die Grenzen werden eingehalten.
 */
export function resizePair(widths: number[], index: number, share: number): number[] {
	if (index < 0 || index + 1 >= widths.length) return widths;
	const pair = widths[index] + widths[index + 1];
	const low = Math.max(WIDTH_MIN, pair - WIDTH_MAX);
	const high = Math.min(WIDTH_MAX, pair - WIDTH_MIN);
	const left = round2(Math.min(high, Math.max(low, pair * share)));
	const next = [...widths];
	next[index] = left;
	next[index + 1] = round2(pair - left);
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
