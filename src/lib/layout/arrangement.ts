import type { LayoutConfig } from '$lib/config/types';
import {
	CENTER,
	EDGE_TAB_CLEARANCE_PX,
	EDGE_TAB_PX,
	enabledAreas,
	fitsSideBySide,
	GRID_UNITS,
	hasSides,
	LEFT,
	MIN_CENTER_REM,
	RIGHT,
	SIDEBAR_REM,
	sideSpan,
	SINGLE_COLUMN_MAX_REM,
	CENTER_MAX_REM,
	visualOrder,
	type Side
} from './operations';

/**
 * Darstellungsstufe für die verfügbare Breite: drei Spalten nebeneinander, Mitte mit Sidebar
 * am linken Rand oder alles untereinander in einer Spalte
 */
export type LayoutStage = 'wide' | 'sidebar' | 'stacked';

/** Eine gerenderte Spalte: welche Bereiche untereinander in ihr stehen und ihre Spur im Grid */
export type ArrangedColumn = { areas: number[]; track: number };

/** Sidebar der mittleren Stufe; Lage in px relativ zur linken Kante des Rahmens */
export type SidebarArrangement = {
	/** Bereiche in der Sidebar in Reihenfolge der Tabs: links, dann rechts */
	areas: number[];
	/** Seiten mit Tab, in derselben Reihenfolge */
	tabs: Side[];
	/** Gezeigte Seite; null = die Sidebar ist zu */
	open: Side | null;
	/** Breite der Spalte in der Sidebar */
	width: number;
	/** Abstand zwischen Sidebar und Mitte, in ihm sitzen die Tabs */
	gap: number;
};

export type Arrangement = {
	stage: LayoutStage;
	/** Mitte und Seiten stehen nebeneinander */
	sideBySide: boolean;
	/** Breite des Boards in px (Infinity = ganze verfügbare Breite) */
	width: number;
	/** Abstand des Boards von der linken Kante des Rahmens; null = mittig */
	offset: number | null;
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
	/** Nur in der mittleren Stufe, und nur, wenn mindestens eine Seite einen Tab hat */
	sidebar: SidebarArrangement | null;
};

/** Was die Sidebar über Inhalt und Zustand wissen muss */
export type SidebarInput = {
	/** Seiten mit Tab (`sidebarTabs`) */
	tabs: Side[];
	/** Offene Seite laut gespeichertem Zustand; zählt nur, wenn sie einen Tab hat */
	open: Side | null;
	/** Platz links, den die Tabs bei geschlossener Sidebar zusätzlich zum Seitenrand brauchen */
	edgePx?: number;
};

type LayoutInput = Pick<LayoutConfig, 'sides' | 'centerSpan' | 'columnGap' | 'maxWidth'>;

const SIDE_AREA: Record<Side, number> = { left: LEFT, right: RIGHT };

/**
 * Abstand zwischen Sidebar und Mitte: mindestens so breit, dass die Tab-Leiste mit Freiraum auf
 * beiden Seiten hineinpasst
 */
export const sidebarGap = (columnGap: number) =>
	Math.max(columnGap, EDGE_TAB_PX + 2 * EDGE_TAB_CLEARANCE_PX);

/** Platz, den die Tab-Leiste bei geschlossener Sidebar vom Fensterrand aus braucht */
export const EDGE_RESERVE_PX = EDGE_TAB_PX + 2 * EDGE_TAB_CLEARANCE_PX;

const limitOf = (layout: LayoutInput, remPx: number) =>
	layout.maxWidth ? layout.maxWidth * remPx : Infinity;

/**
 * Stufe für die verfügbare Breite. Breit, wenn Mitte und Seiten nebeneinander ihre
 * Mindestbreiten erreichen (die Seiten 20 rem), sonst Sidebar, solange die Mitte neben der
 * **offenen** Sidebar noch 20 rem breit ist, sonst untereinander. Weil immer vom offenen Zustand
 * aus gerechnet wird, wechselt das Öffnen oder Schließen die Stufe nie.
 *
 * `availablePx` ist die Breite ohne Sidebar. Ohne Seiten gibt es nur die Mitte; das gilt als
 * eine Spalte (`stacked`).
 */
export function layoutStage(layout: LayoutInput, availablePx: number, remPx = 16): LayoutStage {
	if (!hasSides(layout.sides)) return 'stacked';
	const width = Math.min(availablePx, limitOf(layout, remPx));
	if (fitsSideBySide(layout.centerSpan, width, layout.columnGap, remPx)) return 'wide';
	const center = availablePx - SIDEBAR_REM * remPx - sidebarGap(layout.columnGap);
	return center >= MIN_CENTER_REM * remPx ? 'sidebar' : 'stacked';
}

/**
 * Seiten mit Tab in der mittleren Stufe: eingeschaltete Seiten mit Widgets, im Edit-Modus auch
 * leere, damit man etwas hineinlegen kann. Reihenfolge wie nebeneinander: links, dann rechts.
 */
export function sidebarTabs(
	layout: Pick<LayoutConfig, 'sides' | 'columnRows'>,
	editing: boolean
): Side[] {
	return (['left', 'right'] as const).filter(
		(side) =>
			layout.sides[side] && (editing || (layout.columnRows[SIDE_AREA[side]]?.length ?? 0) > 0)
	);
}

function wide(layout: LayoutInput, width: number): Arrangement {
	const side = sideSpan(layout.centerSpan);
	return {
		stage: 'wide',
		sideBySide: true,
		width,
		offset: null,
		columns: [
			{ areas: [CENTER], track: 3 },
			...(layout.sides.right ? [{ areas: [RIGHT], track: 5 }] : []),
			...(layout.sides.left ? [{ areas: [LEFT], track: 1 }] : [])
		],
		template: [side, layout.centerSpan, side]
			.map((span) => `minmax(0, ${span}fr)`)
			.join(` ${layout.columnGap}px `),
		order: visualOrder(layout.sides),
		sidebar: null
	};
}

/** Alles in einer Spalte, schmaler und mittig, sonst würden die Panels riesig */
function stacked(layout: LayoutInput, width: number, remPx: number): Arrangement {
	return {
		stage: 'stacked',
		sideBySide: false,
		width: Math.min(
			width,
			(hasSides(layout.sides) ? SINGLE_COLUMN_MAX_REM : CENTER_MAX_REM) * remPx
		),
		offset: null,
		columns: [{ areas: enabledAreas(layout.sides), track: 1 }],
		template: 'minmax(0, 1fr)',
		order: enabledAreas(layout.sides),
		sidebar: null
	};
}

/**
 * Mitte neben der Sidebar. Sie ist höchstens `CENTER_MAX_REM` (und die Maximalbreite) breit und
 * steht mittig im verbleibenden Platz: bei geschlossener Sidebar fast die ganze Breite (nur die
 * Tabs brauchen links Platz), bei offener von der Sidebar bis zum rechten Rand.
 */
function withSidebar(
	layout: LayoutInput,
	availablePx: number,
	remPx: number,
	input: SidebarInput
): Arrangement {
	const limit = limitOf(layout, remPx);
	const tabs = input.tabs.filter((side) => layout.sides[side]);
	const base: Pick<Arrangement, 'stage' | 'sideBySide' | 'columns' | 'template'> = {
		stage: 'sidebar',
		sideBySide: false,
		columns: [{ areas: [CENTER], track: 1 }],
		template: 'minmax(0, 1fr)'
	};
	// Ohne Tab keine Sidebar: Die Mitte steht allein wie ohne Seiten
	if (tabs.length === 0) {
		return {
			...base,
			width: Math.min(availablePx, limit, CENTER_MAX_REM * remPx),
			offset: null,
			order: [CENTER],
			sidebar: null
		};
	}
	const open = input.open && tabs.includes(input.open) ? input.open : null;
	const sidebarWidth = SIDEBAR_REM * remPx;
	const gap = sidebarGap(layout.columnGap);
	const start = open ? sidebarWidth + gap : (input.edgePx ?? 0);
	const width = Math.min(limit, CENTER_MAX_REM * remPx, availablePx - start);
	const areas = tabs.map((side) => SIDE_AREA[side]);
	return {
		...base,
		width,
		offset: start + (availablePx - start - width) / 2,
		order: [...areas, CENTER],
		sidebar: { areas, tabs, open, width: sidebarWidth, gap }
	};
}

/** Ordnet Mitte und Seiten für die verfügbare Breite in einer der drei Stufen an */
export function arrange(
	layout: LayoutInput,
	availablePx: number,
	remPx: number,
	sidebar: SidebarInput
): Arrangement {
	const width = Math.min(availablePx, limitOf(layout, remPx));
	const stage = layoutStage(layout, availablePx, remPx);
	if (stage === 'wide') return wide(layout, width);
	if (stage === 'stacked') return stacked(layout, width, remPx);
	return withSidebar(layout, availablePx, remPx, sidebar);
}

/** Breite eines Bereichs in px bei dieser Anordnung, für das Untereinanderstellen von Zeilen */
export function areaPx(
	arrangement: Pick<Arrangement, 'sideBySide' | 'width' | 'sidebar'>,
	areaSpans: number[],
	area: number,
	gapPx: number
): number {
	if (arrangement.sidebar && area !== CENTER) return arrangement.sidebar.width;
	if (!arrangement.sideBySide) return arrangement.width;
	return ((arrangement.width - 2 * gapPx) * areaSpans[area]) / GRID_UNITS;
}
