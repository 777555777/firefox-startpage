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

/** Mindestbreite einer Spalte in rem, bevor Spalten zusammengelegt werden */
export const MIN_COLUMN_REM = 20;

/** Wie viele Spalten bei der verfügbaren Breite tatsächlich nebeneinander passen */
export function visibleColumnCount(
	columns: number,
	availableWidthPx: number,
	remPx = 16,
	gapPx = 0
): number {
	const fit = Math.floor((availableWidthPx + gapPx) / (MIN_COLUMN_REM * remPx + gapPx));
	return Math.max(1, Math.min(columns, fit));
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
