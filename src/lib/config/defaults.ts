import { translate } from '$lib/i18n/translate';
import { defaultCalendarSettings } from '$lib/widgets/calendar/settings';
import { defaultClockSettings } from '$lib/widgets/clock/settings';
import type { Link, LinksSettings, LinkTab, LinkView } from '$lib/widgets/links/settings';
import { defaultSearchSettings } from '$lib/widgets/search/settings';
import { createId } from './parse';
import type {
	AppearanceConfig,
	Config,
	DayPhase,
	Language,
	SearchConfig,
	SearchEngine
} from './types';

export const CONFIG_VERSION = 1;

/** Abstand zwischen Spalten und Panels in px */
export const DEFAULT_GAP = 24;

/** Sattes Aero-Blau */
export const DEFAULT_ACCENT = '#1872d6';

export const ACCENT_PRESETS = [
	{ id: 'blue', color: DEFAULT_ACCENT },
	{ id: 'aqua', color: '#0fa3b1' },
	{ id: 'green', color: '#3a9d3f' },
	{ id: 'orange', color: '#e8790c' },
	{ id: 'pink', color: '#d23a72' },
	{ id: 'violet', color: '#7b5be6' }
] as const;

export const DEFAULT_PHASE_START: Record<DayPhase, number> = {
	morning: 6 * 60,
	day: 10 * 60,
	evening: 17 * 60 + 30,
	night: 21 * 60 + 30
};

export function defaultAppearance(): AppearanceConfig {
	return {
		accent: DEFAULT_ACCENT,
		glass: { frost: 0.5 },
		background: { main: null, slots: {}, fit: 'cover', focus: { x: 0.5, y: 0.5 } },
		timeOfDay: { grading: true, phaseStart: { ...DEFAULT_PHASE_START } },
		quality: 'auto',
		pointerLight: true
	};
}

export function defaultEngines(): SearchEngine[] {
	const engine = (id: string, name: string, url: string, bang: string): SearchEngine => ({
		id,
		name,
		url,
		bang,
		icon: null
	});
	return [
		engine('duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q=%s', 'ddg'),
		engine('google', 'Google', 'https://www.google.com/search?q=%s', 'g'),
		engine('github', 'GitHub', 'https://github.com/search?q=%s&type=repositories', 'gh'),
		engine('mdn', 'MDN', 'https://developer.mozilla.org/search?q=%s', 'mdn'),
		engine('wikipedia-de', 'Wikipedia DE', 'https://de.wikipedia.org/w/index.php?search=%s', 'w'),
		engine('youtube', 'YouTube', 'https://www.youtube.com/results?search_query=%s', 'yt')
	];
}

export function defaultSearch(): SearchConfig {
	return { engines: defaultEngines(), defaultEngineId: 'duckduckgo' };
}

function link(label: string, url: string): Link {
	return { id: createId(), label, url, target: 'self', icon: null };
}

function tab(label: string, view: LinkView, links: Link[]): LinkTab {
	return { id: createId(), label, icon: '', view, links };
}

function board(tabs: LinkTab[]): LinksSettings {
	return { tabs, activeTabId: tabs[0].id, showStats: false };
}

/**
 * Config für den Erststart: 3 Spalten mit Uhr + Kalender | Suche + Links | Links.
 * Die Namen der Beispiel-Gruppen folgen der erkannten Sprache.
 */
export function createDefaultConfig(language: Language = 'en'): Config {
	const label = (key: 'defaults.tabEveryday' | 'defaults.tabDev' | 'defaults.tabTools') =>
		translate(language, key);

	const ids = {
		clock: createId(),
		calendar: createId(),
		search: createId(),
		links: createId(),
		tools: createId()
	};

	return {
		version: CONFIG_VERSION,
		language: 'auto',
		layout: {
			columns: 3,
			columnItems: [[ids.clock, ids.calendar], [ids.search, ids.links], [ids.tools]],
			columnWidths: [4, 4, 4],
			gap: DEFAULT_GAP,
			maxWidth: 96
		},
		widgets: {
			[ids.clock]: { id: ids.clock, type: 'clock', settings: defaultClockSettings() },
			[ids.calendar]: { id: ids.calendar, type: 'calendar', settings: defaultCalendarSettings() },
			[ids.search]: { id: ids.search, type: 'search', settings: defaultSearchSettings() },
			[ids.links]: {
				id: ids.links,
				type: 'links',
				settings: board([
					tab(label('defaults.tabEveryday'), 'tiles', [
						link('Wikipedia', 'https://www.wikipedia.org'),
						link('YouTube', 'https://www.youtube.com'),
						link('OpenStreetMap', 'https://www.openstreetmap.org'),
						link('DeepL', 'https://www.deepl.com/translator')
					]),
					tab(label('defaults.tabDev'), 'list', [
						link('GitHub', 'https://github.com'),
						link('MDN Web Docs', 'https://developer.mozilla.org'),
						link('Svelte', 'https://svelte.dev/docs'),
						link('Can I use', 'https://caniuse.com')
					])
				])
			},
			[ids.tools]: {
				id: ids.tools,
				type: 'links',
				settings: board([
					tab(label('defaults.tabTools'), 'capsules', [
						link('Excalidraw', 'https://excalidraw.com'),
						link('Squoosh', 'https://squoosh.app'),
						link('regex101', 'https://regex101.com'),
						link('Firefox Add-ons', 'https://addons.mozilla.org')
					])
				])
			}
		},
		appearance: defaultAppearance(),
		search: defaultSearch()
	};
}
