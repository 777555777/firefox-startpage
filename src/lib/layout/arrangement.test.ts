import { describe, expect, it } from 'vitest';
import { areaPx, arrange, layoutStage, sidebarGap, sidebarTabs } from './arrangement';

const both = { left: true, right: true };
const layout = (overrides = {}) => ({ sides: both, centerSpan: 12, columnGap: 24, ...overrides });

/** Ohne Tabs, also ohne Sidebar */
const noSidebar = { tabs: [], open: null };

describe('Anordnung von Mitte und Seiten', () => {
	it('stellt Mitte und Seiten nebeneinander, die Mitte im DOM zuerst', () => {
		const result = arrange(layout(), 1400, 16, noSidebar);
		expect(result.stage).toBe('wide');
		expect(result.sideBySide).toBe(true);
		expect(result.width).toBe(1400);
		expect(result.columns).toEqual([
			{ areas: [0], track: 3 },
			{ areas: [1], track: 5 },
			{ areas: [2], track: 1 }
		]);
		expect(result.template).toBe('minmax(0, 6fr) 24px minmax(0, 12fr) 24px minmax(0, 6fr)');
		expect(result.order).toEqual([2, 0, 1]);
		expect(result.sidebar).toBeNull();
	});

	it('lässt ausgeschaltete Seiten frei, damit die Mitte mittig bleibt', () => {
		const result = arrange(layout({ sides: { left: false, right: true } }), 1400, 16, noSidebar);
		expect(result.columns.map((column) => column.track)).toEqual([3, 5]);
		expect(result.template).toContain('6fr');
		expect(result.order).toEqual([0, 1]);
	});

	it('stellt bei sehr schmalem Fenster alles untereinander: Mitte, rechts, links', () => {
		const result = arrange(layout(), 700, 16, noSidebar);
		expect(result.stage).toBe('stacked');
		expect(result.sideBySide).toBe(false);
		expect(result.columns).toEqual([{ areas: [0, 1, 2], track: 1 }]);
		expect(result.width).toBe(700);
		expect(result.order).toEqual([0, 1, 2]);
	});

	it('richtet sich nach der Maximalbreite', () => {
		expect(arrange(layout({ maxWidth: 88 }), 2400, 16, noSidebar).width).toBe(1408);
		// 80 rem reichen nicht für Seiten von 20 rem bei einer Mitte von 12/24
		expect(arrange(layout({ maxWidth: 80 }), 2400, 16, noSidebar).sideBySide).toBe(false);
	});

	it('gibt der Mitte ohne Seiten die ganze Breite', () => {
		const result = arrange(layout({ sides: { left: false, right: false } }), 2000, 16, noSidebar);
		expect(result.sideBySide).toBe(false);
		expect(result.width).toBe(2000);
		expect(result.columns).toEqual([{ areas: [0], track: 1 }]);
	});

	it('rechnet die Breite eines Bereichs in px', () => {
		const result = arrange(layout(), 1392, 16, noSidebar);
		expect(areaPx(result, [12, 6, 6], 0, 24)).toBe(672);
		expect(areaPx(result, [12, 6, 6], 2, 24)).toBe(336);
		expect(areaPx(arrange(layout(), 700, 16, noSidebar), [12, 6, 6], 2, 24)).toBe(700);
	});
});

describe('Stufen: breit, Sidebar, untereinander', () => {
	it('ist breit, solange die Seiten nebeneinander 20 rem erreichen', () => {
		// Mitte 12/24: Seite = (Breite − 2 · 24) · 6/24 ≥ 320 px ab 1328 px
		expect(layoutStage(layout(), 1328)).toBe('wide');
		expect(layoutStage(layout(), 1327)).toBe('sidebar');
		// Breitere Mitte → schmalere Seiten → die Sidebar kommt früher
		expect(layoutStage(layout({ centerSpan: 16 }), 1968)).toBe('wide');
		expect(layoutStage(layout({ centerSpan: 16 }), 1967)).toBe('sidebar');
		// Schmale Mitte: die Mitte selbst ist die Grenze (beide 8/24)
		expect(layoutStage(layout({ centerSpan: 8 }), 1008)).toBe('wide');
		expect(layoutStage(layout({ centerSpan: 8 }), 1007)).toBe('sidebar');
	});

	it('nimmt die Sidebar, solange die Mitte neben der offenen Sidebar 20 rem hat', () => {
		// 22 rem Sidebar + 60 px Abstand (Tab-Leiste mit Freiraum) + 20 rem Mitte
		expect(layoutStage(layout(), 732)).toBe('sidebar');
		expect(layoutStage(layout(), 731)).toBe('stacked');
		// Ein großer Spaltenabstand gilt auch zwischen Sidebar und Mitte
		expect(layoutStage(layout({ columnGap: 128 }), 1535)).toBe('sidebar');
		expect(layoutStage(layout({ columnGap: 128 }), 1536)).toBe('wide');
		expect(layoutStage(layout({ columnGap: 128 }), 800)).toBe('sidebar');
		expect(layoutStage(layout({ columnGap: 128 }), 799)).toBe('stacked');
	});

	it('entscheidet über breit innerhalb der Maximalbreite', () => {
		expect(layoutStage(layout({ maxWidth: 80 }), 2400)).toBe('sidebar');
		expect(layoutStage(layout({ maxWidth: 88 }), 2400)).toBe('wide');
	});

	it('kennt ohne Seiten nur die Mitte', () => {
		expect(layoutStage(layout({ sides: { left: false, right: false } }), 1000)).toBe('stacked');
	});

	it('hält den Abstand zur Mitte frei für die Tabs', () => {
		expect(sidebarGap(0)).toBe(60);
		expect(sidebarGap(24)).toBe(60);
		expect(sidebarGap(64)).toBe(64);
	});
});

describe('Anordnung mit Sidebar', () => {
	const tabs = ['left', 'right'] as const;
	const sidebar = (open: 'left' | 'right' | null, overrides = {}) => ({
		tabs: [...tabs],
		open,
		...overrides
	});

	it('gibt der Mitte bei geschlossener Sidebar die ganze Breite bis auf die Tabs', () => {
		const result = arrange(layout(), 1200, 16, sidebar(null, { edgePx: 10 }));
		expect(result.stage).toBe('sidebar');
		expect(result.sideBySide).toBe(false);
		expect(result.width).toBe(1190);
		expect(result.offset).toBe(10);
		expect(result.columns).toEqual([{ areas: [0], track: 1 }]);
		expect(result.template).toBe('minmax(0, 1fr)');
		expect(result.sidebar).toEqual({
			areas: [2, 1],
			tabs: ['left', 'right'],
			open: null,
			width: 352,
			gap: 60
		});
	});

	it('rückt die Mitte bei offener Sidebar neben sie', () => {
		const result = arrange(layout(), 1200, 16, sidebar('right', { edgePx: 10 }));
		expect(result.width).toBe(1200 - 352 - 60);
		expect(result.offset).toBe(412);
		expect(result.sidebar?.open).toBe('right');
	});

	it('stellt die Mitte im freien Bereich mittig, begrenzt durch die Maximalbreite', () => {
		const open = arrange(layout({ maxWidth: 80 }), 2000, 16, sidebar('left'));
		expect(open.width).toBe(1280);
		expect(open.offset).toBe(412 + (2000 - 412 - 1280) / 2);
		const closed = arrange(layout({ maxWidth: 80 }), 2000, 16, sidebar(null));
		expect(closed.offset).toBe((2000 - 1280) / 2);
	});

	it('wechselt die Stufe nicht durch Öffnen oder Schließen', () => {
		for (const width of [731, 732, 1327, 1328]) {
			expect(arrange(layout(), width, 16, sidebar('left')).stage).toBe(
				arrange(layout(), width, 16, sidebar(null)).stage
			);
		}
	});

	it('öffnet nur Seiten mit Tab', () => {
		const result = arrange(layout(), 1200, 16, { tabs: ['right'], open: 'left' });
		expect(result.sidebar?.open).toBeNull();
		expect(result.sidebar?.areas).toEqual([1]);
		// Ausgeschaltete Seiten bekommen auch dann keinen Tab, wenn er übergeben wird
		const off = arrange(layout({ sides: { left: false, right: true } }), 1200, 16, sidebar('left'));
		expect(off.sidebar?.tabs).toEqual(['right']);
		expect(off.sidebar?.open).toBeNull();
	});

	it('lässt die Sidebar ohne Tabs weg, die Mitte wird voll breit', () => {
		const result = arrange(layout({ maxWidth: 64 }), 1200, 16, { tabs: [], open: 'left' });
		expect(result.stage).toBe('sidebar');
		expect(result.sidebar).toBeNull();
		expect(result.width).toBe(1024);
		expect(result.offset).toBeNull();
		expect(result.order).toEqual([0]);
	});

	it('ordnet die Pfeiltasten wie zu sehen: Sidebar (links, rechts), dann Mitte', () => {
		expect(arrange(layout(), 1200, 16, sidebar(null)).order).toEqual([2, 1, 0]);
	});

	it('wählt die Stufe nach der Breite', () => {
		expect(arrange(layout(), 1200, 16, sidebar(null)).stage).toBe('sidebar');
		expect(arrange(layout(), 1400, 16, sidebar(null)).stage).toBe('wide');
		expect(arrange(layout(), 700, 16, sidebar(null))).toMatchObject({
			stage: 'stacked',
			width: 700,
			sidebar: null
		});
	});

	it('rechnet Seiten in der Sidebar mit ihrer Breite', () => {
		const result = arrange(layout(), 1200, 16, sidebar('left'));
		expect(areaPx(result, [12, 6, 6], 0, 24)).toBe(788);
		expect(areaPx(result, [12, 6, 6], 1, 24)).toBe(352);
		expect(areaPx(result, [12, 6, 6], 2, 24)).toBe(352);
	});
});

describe('Tabs der Sidebar', () => {
	const row = (id: string) => ({ items: [id], spans: [6] });
	const rows = [[row('a')], [], [row('b')]];

	it('gibt nur Seiten mit Widgets einen Tab, links vor rechts', () => {
		expect(sidebarTabs({ sides: both, columnRows: rows }, false)).toEqual(['left']);
		expect(sidebarTabs({ sides: both, columnRows: [[], [row('c')], [row('b')]] }, false)).toEqual([
			'left',
			'right'
		]);
	});

	it('zeigt im Edit-Modus auch leere Seiten', () => {
		expect(sidebarTabs({ sides: both, columnRows: rows }, true)).toEqual(['left', 'right']);
	});

	it('lässt ausgeschaltete Seiten immer weg', () => {
		const sides = { left: false, right: true };
		expect(sidebarTabs({ sides, columnRows: rows }, true)).toEqual(['right']);
		expect(sidebarTabs({ sides, columnRows: rows }, false)).toEqual([]);
	});
});
