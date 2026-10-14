import type { LayoutConfig } from '$lib/config/types';
import {
	CENTER,
	enabledAreas,
	fitsSideBySide,
	GRID_UNITS,
	hasSides,
	LEFT,
	RIGHT,
	sideSpan,
	SINGLE_COLUMN_MAX_REM,
	visualOrder
} from './operations';

/** Eine gerenderte Spalte: welche Bereiche untereinander in ihr stehen und ihre Spur im Grid */
export type ArrangedColumn = { areas: number[]; track: number };

export type Arrangement = {
	/** Mitte und Seiten stehen nebeneinander */
	sideBySide: boolean;
	/** Breite des Boards in px (Infinity = ganze verfügbare Breite) */
	width: number;
	/**
	 * Spalten in DOM-Reihenfolge: Mitte, rechts, links. So stimmen Lese- und Tab-Reihenfolge
	 * mit dem Untereinanderstellen überein. Nebeneinander liegen sie auf den Spuren 1 (links),
	 * 3 (Mitte) und 5 (rechts), dazwischen die Abstände.
	 */
	columns: ArrangedColumn[];
	/** `grid-template-columns` */
	template: string;
	/** Reihenfolge für Pfeiltasten links/rechts: so, wie die Spalten zu sehen sind */
	order: number[];
};

/**
 * Ordnet Mitte und Seiten für die verfügbare Breite an. Passen sie nicht nebeneinander, steht
 * alles in einer Spalte, schmaler und mittig, sonst würden die Panels riesig.
 */
export function arrange(
	layout: Pick<LayoutConfig, 'sides' | 'centerSpan' | 'columnGap' | 'maxWidth'>,
	availablePx: number,
	remPx = 16
): Arrangement {
	const limit = layout.maxWidth ? layout.maxWidth * remPx : Infinity;
	const anySide = hasSides(layout.sides);
	const sideBySide =
		anySide &&
		fitsSideBySide(layout.centerSpan, Math.min(availablePx, limit), layout.columnGap, remPx);

	if (!sideBySide) {
		return {
			sideBySide,
			width: Math.min(availablePx, limit, anySide ? SINGLE_COLUMN_MAX_REM * remPx : Infinity),
			columns: [{ areas: enabledAreas(layout.sides), track: 1 }],
			template: 'minmax(0, 1fr)',
			order: enabledAreas(layout.sides)
		};
	}

	const side = sideSpan(layout.centerSpan);
	return {
		sideBySide,
		width: Math.min(availablePx, limit),
		columns: [
			{ areas: [CENTER], track: 3 },
			...(layout.sides.right ? [{ areas: [RIGHT], track: 5 }] : []),
			...(layout.sides.left ? [{ areas: [LEFT], track: 1 }] : [])
		],
		template: [side, layout.centerSpan, side]
			.map((span) => `minmax(0, ${span}fr)`)
			.join(` ${layout.columnGap}px `),
		order: visualOrder(layout.sides)
	};
}

/** Breite eines Bereichs in px bei dieser Anordnung, für das Untereinanderstellen von Zeilen */
export function areaPx(
	arrangement: Pick<Arrangement, 'sideBySide' | 'width'>,
	areaSpans: number[],
	area: number,
	gapPx: number
): number {
	if (!arrangement.sideBySide) return arrangement.width;
	return ((arrangement.width - 2 * gapPx) * areaSpans[area]) / GRID_UNITS;
}
