import type { Side } from './operations';

/**
 * Zustand der Sidebar in der mittleren Stufe. Er gehört zum Rechner (Bildschirmbreite), deshalb
 * liegt er in `localStorage` und nicht in der exportierbaren Config. Offene Tabs gleichen ihn
 * nicht ab; ein neuer Tab startet mit dem zuletzt gespeicherten.
 */
export type SidebarState = {
	/** Offene Seite; null = zu */
	open: Side | null;
	/** Zuletzt geöffnete Seite, für `S` bei geschlossener Sidebar */
	last: Side;
};

export const SIDEBAR_KEY = 'startpage:sidebar';

export const DEFAULT_SIDEBAR_STATE: SidebarState = { open: null, last: 'left' };

const isSide = (value: unknown): value is Side => value === 'left' || value === 'right';

/** Liest einen gespeicherten Wert; Ungültiges wird zum Standard (zu), wirft nie */
export function parseSidebarState(raw: unknown): SidebarState {
	if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SIDEBAR_STATE };
	const { open, last } = raw as Record<string, unknown>;
	const validOpen = isSide(open) ? open : null;
	return { open: validOpen, last: isSide(last) ? last : (validOpen ?? DEFAULT_SIDEBAR_STATE.last) };
}

export function loadSidebarState(storage: Pick<Storage, 'getItem'> = localStorage): SidebarState {
	try {
		const value = storage.getItem(SIDEBAR_KEY);
		return parseSidebarState(value === null ? null : JSON.parse(value));
	} catch {
		// ohne localStorage oder bei kaputtem Wert ist die Sidebar eben zu
		return { ...DEFAULT_SIDEBAR_STATE };
	}
}

export function saveSidebarState(
	state: SidebarState,
	storage: Pick<Storage, 'setItem'> = localStorage
) {
	try {
		storage.setItem(SIDEBAR_KEY, JSON.stringify(state));
	} catch {
		// ohne localStorage merkt sich die Sidebar ihren Zustand nur bis zum Schließen des Tabs
	}
}

/** Tatsächlich offene Seite: nur, wenn sie gerade einen Tab hat */
export function effectiveSide(state: SidebarState, tabs: readonly Side[]): Side | null {
	return state.open && tabs.includes(state.open) ? state.open : null;
}

/** Klick auf einen Tab: öffnet seine Seite, der aktive Tab schließt */
export function toggleSide(state: SidebarState, tabs: readonly Side[], side: Side): SidebarState {
	if (!tabs.includes(side)) return state;
	return effectiveSide(state, tabs) === side
		? { open: null, last: side }
		: { open: side, last: side };
}

/** `S`: schließt die offene Seite, sonst öffnet es die zuletzt offene (oder die erste mit Tab) */
export function toggleLast(state: SidebarState, tabs: readonly Side[]): SidebarState {
	const open = effectiveSide(state, tabs);
	if (open) return { open: null, last: open };
	const side = tabs.includes(state.last) ? state.last : tabs[0];
	return side ? { open: side, last: side } : state;
}

/**
 * `Umschalt+S`: wechselt zur anderen Seite. Ist die Sidebar zu, öffnet es die Seite, die nicht
 * zuletzt offen war; gibt es nur eine Seite mit Tab, diese.
 */
export function switchSide(state: SidebarState, tabs: readonly Side[]): SidebarState {
	const current = effectiveSide(state, tabs) ?? state.last;
	const side = tabs.find((tab) => tab !== current) ?? tabs[0];
	return side ? { open: side, last: side } : state;
}
