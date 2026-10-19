import { describe, expect, it } from 'vitest';
import {
	effectiveSide,
	loadSidebarState,
	parseSidebarState,
	saveSidebarState,
	SIDEBAR_KEY,
	switchSide,
	toggleLast,
	toggleSide
} from './sidebar-state';

const closed = { open: null, last: 'left' } as const;
const both = ['left', 'right'] as const;

describe('Zustand der Sidebar', () => {
	it('liest gültige Werte', () => {
		expect(parseSidebarState({ open: 'right', last: 'right' })).toEqual({
			open: 'right',
			last: 'right'
		});
		expect(parseSidebarState({ open: null, last: 'right' })).toEqual({ open: null, last: 'right' });
	});

	it('macht aus Ungültigem und Fehlendem „zu“', () => {
		expect(parseSidebarState(null)).toEqual(closed);
		expect(parseSidebarState('left')).toEqual(closed);
		expect(parseSidebarState({ open: 'top', last: 3 })).toEqual(closed);
		// Ohne `last` gilt die offene Seite als zuletzt offen
		expect(parseSidebarState({ open: 'right' })).toEqual({ open: 'right', last: 'right' });
	});

	it('lädt und speichert über localStorage, ohne zu werfen', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => void values.set(key, value)
		};
		expect(loadSidebarState(storage)).toEqual(closed);
		saveSidebarState({ open: 'right', last: 'right' }, storage);
		expect(JSON.parse(values.get(SIDEBAR_KEY) ?? '')).toEqual({ open: 'right', last: 'right' });
		expect(loadSidebarState(storage)).toEqual({ open: 'right', last: 'right' });

		values.set(SIDEBAR_KEY, '{kaputt');
		expect(loadSidebarState(storage)).toEqual(closed);

		const throwing = {
			getItem: () => {
				throw new Error('gesperrt');
			},
			setItem: () => {
				throw new Error('gesperrt');
			}
		};
		expect(loadSidebarState(throwing)).toEqual(closed);
		expect(() => saveSidebarState(closed, throwing)).not.toThrow();
	});

	it('zeigt eine Seite nur, wenn sie einen Tab hat', () => {
		expect(effectiveSide({ open: 'right', last: 'right' }, both)).toBe('right');
		expect(effectiveSide({ open: 'right', last: 'right' }, ['left'])).toBeNull();
		expect(effectiveSide(closed, both)).toBeNull();
	});
});

describe('Bedienung der Sidebar', () => {
	it('öffnet per Tab, der aktive Tab schließt', () => {
		const open = toggleSide(closed, both, 'right');
		expect(open).toEqual({ open: 'right', last: 'right' });
		expect(toggleSide(open, both, 'left')).toEqual({ open: 'left', last: 'left' });
		expect(toggleSide(open, both, 'right')).toEqual({ open: null, last: 'right' });
		// Ohne Tab passiert nichts
		expect(toggleSide(closed, ['left'], 'right')).toBe(closed);
	});

	it('S schließt oder öffnet die zuletzt offene Seite', () => {
		expect(toggleLast({ open: null, last: 'right' }, both)).toEqual({
			open: 'right',
			last: 'right'
		});
		expect(toggleLast({ open: 'right', last: 'right' }, both)).toEqual({
			open: null,
			last: 'right'
		});
		// Hat die zuletzt offene Seite keinen Tab mehr, öffnet die erste mit Tab
		expect(toggleLast({ open: null, last: 'left' }, ['right'])).toEqual({
			open: 'right',
			last: 'right'
		});
		expect(toggleLast(closed, [])).toBe(closed);
	});

	it('Umschalt+S wechselt die Seite', () => {
		expect(switchSide({ open: 'left', last: 'left' }, both)).toEqual({
			open: 'right',
			last: 'right'
		});
		expect(switchSide({ open: null, last: 'left' }, both)).toEqual({
			open: 'right',
			last: 'right'
		});
		// Nur eine Seite mit Tab: diese öffnen bzw. offen lassen
		expect(switchSide({ open: null, last: 'left' }, ['left'])).toEqual({
			open: 'left',
			last: 'left'
		});
		expect(switchSide(closed, [])).toBe(closed);
	});
});
