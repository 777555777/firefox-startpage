import { describe, expect, it } from 'vitest';
import { createDefaultConfig, DEFAULT_ACCENT } from './defaults';
import type { LayoutConfig } from './types';
import { collectMediaRefs, isValidEngineUrl, normalizeBang, parseConfig } from './validate';

/** Zeilen als lesbare Kurzform, z. B. [['a', 'b+c'], []] */
const rows = (layout: LayoutConfig) =>
	layout.columnRows.map((column) => column.map((row) => row.items.join('+')));
const single = (...ids: string[]) => ids.map((id) => ({ items: [id] }));

describe('parseConfig', () => {
	it('liefert für Unbrauchbares die Default-Config', () => {
		for (const raw of [null, undefined, 42, 'x', []]) {
			const config = parseConfig(raw);
			expect(config.layout.sides).toEqual({ left: true, right: true });
			expect(Object.keys(config.widgets)).toHaveLength(5);
		}
	});

	it('lässt eine gültige Default-Config unverändert', () => {
		const config = createDefaultConfig('de');
		expect(parseConfig(structuredClone(config))).toEqual(config);
	});

	it('ergänzt fehlende Bereiche mit Defaults', () => {
		const config = parseConfig({ version: 1, language: 'de' });
		expect(config.language).toBe('de');
		expect(config.widgets).toEqual({});
		expect(config.layout.columnRows).toEqual([[], [], []]);
		expect(config.layout.centerSpan).toBe(12);
		expect(config.layout.sides).toEqual({ left: true, right: true });
		expect(config.layout.columnGap).toBe(24);
		expect(config.appearance.accent).toBe(DEFAULT_ACCENT);
		expect(config.search.engines.length).toBeGreaterThan(0);
	});

	it('verwirft ungültige Werte, statt zu werfen', () => {
		const config = parseConfig({
			language: 'fr',
			layout: {
				columnRows: 'kaputt',
				sides: 'links',
				centerSpan: 23,
				columnGap: 999,
				panelGap: 'x'
			},
			appearance: {
				accent: 'blau',
				glass: { frost: 3 },
				quality: 'ultra',
				timeOfDay: { phaseStart: { morning: -5, day: 'zehn', evening: 5000 } }
			}
		});
		expect(config.language).toBe('auto');
		expect(config.layout.sides).toEqual({ left: true, right: true });
		expect(config.layout.centerSpan).toBe(16);
		expect(config.layout.columnGap).toBe(128);
		expect(config.layout.panelGap).toBe(24);
		expect(config.appearance.accent).toBe(DEFAULT_ACCENT);
		expect(config.appearance.glass.frost).toBe(1);
		expect(config.appearance.quality).toBe('auto');
		expect(config.appearance.timeOfDay.phaseStart).toEqual({
			morning: 0,
			day: 600,
			evening: 1439,
			night: 1290
		});
	});

	it('normalisiert Hex-Farben', () => {
		expect(parseConfig({ appearance: { accent: 'ABC' } }).appearance.accent).toBe('#aabbcc');
		expect(parseConfig({ appearance: { accent: '#12AB9f' } }).appearance.accent).toBe('#12ab9f');
	});

	it('entfernt unbekannte Widget-Typen und deren Layout-Einträge', () => {
		const config = parseConfig({
			widgets: {
				a: { type: 'clock', settings: { showSeconds: true } },
				b: { type: 'rss', settings: {} },
				c: 'kaputt'
			},
			layout: {
				columnRows: [[{ items: ['a', 'b'], spans: [6, 6] }], [{ items: ['c', 'x'] }]]
			}
		});
		expect(Object.keys(config.widgets)).toEqual(['a']);
		expect(config.widgets.a).toMatchObject({ id: 'a', type: 'clock' });
		expect(rows(config.layout)).toEqual([['a'], [], []]);
		expect(config.layout.columnRows[0][0].spans).toEqual([12]);
	});

	it('validiert Widget-Settings je Typ', () => {
		const config = parseConfig({
			widgets: {
				a: { type: 'clock', settings: { showSeconds: true, hourCycle: '13', extra: 1 } },
				b: { type: 'calendar', settings: { region: 'XX', weekStart: 'sunday' } }
			}
		});
		expect(config.widgets.a.settings).toEqual({
			showSeconds: true,
			hourCycle: 'auto',
			showDate: true,
			dateStyle: 'long'
		});
		expect(config.widgets.b.settings).toMatchObject({ region: 'none', weekStart: 'sunday' });
	});

	it('platziert Widgets ohne Layout-Eintrag in der Mitte und entfernt Duplikate', () => {
		const config = parseConfig({
			widgets: {
				a: { type: 'clock' },
				b: { type: 'search' },
				c: { type: 'calendar' }
			},
			layout: { columnRows: [[], [{ items: ['a', 'a'] }], single('a')] }
		});
		expect(rows(config.layout)).toEqual([['b', 'c'], ['a'], []]);
	});

	it('legt fehlende Bereiche leer an, Widgets ausgeschalteter Seiten stehen in der Mitte', () => {
		const widgets = { a: { type: 'clock' }, b: { type: 'search' }, c: { type: 'calendar' } };
		const short = parseConfig({ widgets, layout: { columnRows: [single('a', 'b', 'c')] } });
		expect(rows(short.layout)).toEqual([['a', 'b', 'c'], [], []]);
		const folded = parseConfig({
			widgets,
			layout: {
				columnRows: [single('a'), single('b'), single('c'), single('d')],
				sides: { left: false, right: true }
			}
		});
		expect(rows(folded.layout)).toEqual([['a', 'c'], ['b'], []]);
	});

	it('validiert Link-Boards: ungültige Links raus, mindestens ein Tab, aktiver Tab gültig', () => {
		const config = parseConfig({
			widgets: {
				l: {
					type: 'links',
					settings: {
						tabs: [
							{
								id: 't1',
								label: 'Dev',
								view: 'grid',
								links: [
									{ id: 'x', label: 'GitHub', url: 'https://github.com' },
									{ label: 'Böse', url: 'javascript:alert(1)' },
									{ label: 'Ohne Schema', url: 'example.org/pfad' },
									{ label: 'App', url: 'obsidian://open?vault=x', target: 'blank' },
									{ label: 'Kaputt', url: '' }
								]
							}
						],
						activeTabId: 'gibt-es-nicht'
					}
				},
				leer: { type: 'links', settings: { tabs: [] } }
			}
		});
		const board = config.widgets.l.settings as {
			tabs: { id: string; view: string; links: { url: string; target: string }[] }[];
			activeTabId: string;
		};
		expect(board.activeTabId).toBe('t1');
		expect(board.tabs[0].view).toBe('tiles');
		expect(board.tabs[0].links.map((l) => l.url)).toEqual([
			'https://github.com',
			'https://example.org/pfad',
			'obsidian://open?vault=x'
		]);
		expect(board.tabs[0].links[2].target).toBe('blank');
		const empty = config.widgets.leer.settings as { tabs: unknown[] };
		expect(empty.tabs).toHaveLength(1);
	});

	it('vergibt doppelte IDs in Link-Boards neu', () => {
		const config = parseConfig({
			widgets: {
				l: {
					type: 'links',
					settings: {
						tabs: [
							{
								id: 'a',
								links: [
									{ id: 'a', label: '1', url: 'https://a.de' },
									{ id: 'b', label: '2', url: 'https://b.de' },
									{ id: 'b', label: '3', url: 'https://c.de' }
								]
							}
						]
					}
				}
			}
		});
		const board = config.widgets.l.settings as { tabs: { id: string; links: { id: string }[] }[] };
		const ids = [board.tabs[0].id, ...board.tabs[0].links.map((l) => l.id)];
		expect(new Set(ids).size).toBe(4);
		expect(board.tabs[0].id).toBe('a');
	});

	it('prüft Suchmaschinen, Bangs und Default-Engine', () => {
		const config = parseConfig({
			search: {
				engines: [
					{ id: 'a', name: 'A', url: 'https://a.example/?q=%s', bang: '!A' },
					{ id: 'b', name: 'B', url: 'https://b.example/?q=', bang: 'b' },
					{ id: 'c', name: 'C', url: 'ftp://c.example/%s' },
					{ id: 'd', name: 'D', url: 'https://d.example/%s', bang: 'a' },
					{ id: 'e', name: '', url: 'https://e.example/%s' }
				],
				defaultEngineId: 'b'
			}
		});
		expect(config.search.engines.map((e) => [e.id, e.bang])).toEqual([
			['a', 'a'],
			['d', '']
		]);
		expect(config.search.defaultEngineId).toBe('a');
	});

	it('erlaubt eine leere Engine-Liste, wenn sie bewusst leer ist', () => {
		const config = parseConfig({ search: { engines: [], defaultEngineId: 'x' } });
		expect(config.search).toEqual({ engines: [], defaultEngineId: '' });
	});

	it('übernimmt Medien-Referenzen und listet sie ohne Duplikate', () => {
		const ref = { id: 'm1', kind: 'video', name: 'see.mp4' };
		const config = parseConfig({
			appearance: {
				background: {
					main: ref,
					slots: { night: ref, morning: { id: 'm2', kind: 'image', name: 'a.jpg' }, x: ref },
					focus: { x: 2, y: -1 }
				}
			}
		});
		expect(config.appearance.background.focus).toEqual({ x: 1, y: 0 });
		expect(Object.keys(config.appearance.background.slots)).toEqual(['morning', 'night']);
		expect(collectMediaRefs(config).map((r) => r.id)).toEqual(['m1', 'm2']);
	});
});

describe('Suchmaschinen-Helfer', () => {
	it('normalisiert Bangs', () => {
		expect(normalizeBang('!GH ')).toBe('gh');
		expect(normalizeBang('!!w')).toBe('w');
		expect(normalizeBang(3)).toBe('');
	});

	it('prüft URL-Templates', () => {
		expect(isValidEngineUrl('https://x.de/?q=%s')).toBe(true);
		expect(isValidEngineUrl('https://x.de/?q=')).toBe(false);
		expect(isValidEngineUrl('javascript:%s')).toBe(false);
	});
});
