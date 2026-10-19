/**
 * Höhe „Bis Fensterende“: Ein Widget mit Liste zeigt so viele ganze Einträge, wie bis zum
 * unteren Fensterrand passen (bei nicht gescrollter Page), darunter „Weitere anzeigen“. Reine
 * Funktionen; das Messen steht in `window-fit.svelte.ts`.
 */

/** Höhe eines Widgets mit Liste: bis zum unteren Fensterrand oder so hoch wie der Inhalt */
export type HeightMode = 'window' | 'content';
export const HEIGHT_MODES: readonly HeightMode[] = ['window', 'content'];

/** So viele Einträge stehen immer da, auch wenn das Widget weit unten steht */
export const MIN_FIT_ENTRIES = 3;

/**
 * Platz für die Liste: Fensterhöhe abzüglich ihrer Oberkante auf der nicht gescrollten Page,
 * dessen, was im Panel unter ihr steht, und des unteren Seitenrands.
 */
export function listSpace(input: {
	viewport: number;
	/** Oberkante der Liste im Dokument (nicht im Fenster) */
	listTop: number;
	/** Alles unter der Liste bis zur Unterkante des Panels, ohne „Weitere anzeigen“ */
	below: number;
	bottomPad: number;
}): number {
	return input.viewport - input.listTop - input.below - input.bottomPad;
}

/**
 * Wie viele Einträge ganz passen. `bottoms[i]` ist die Unterkante von Eintrag i, gemessen von der
 * Oberkante der Liste. Passt alles, gibt es kein „Weitere anzeigen“; sonst braucht es `reserve`
 * Platz für den Knopf. Mindestens `min` (bzw. alle, wenn es weniger gibt).
 */
export function fitCount(
	bottoms: readonly number[],
	space: number,
	reserve: number,
	min = MIN_FIT_ENTRIES
): number {
	const total = bottoms.length;
	if (total === 0 || bottoms[total - 1] <= space) return total;
	let count = 0;
	while (count < total && bottoms[count] <= space - reserve) count++;
	return Math.min(total, Math.max(min, count));
}
