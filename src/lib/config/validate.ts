import {
	COLUMN_GAP_MAX,
	COLUMN_GAP_MIN,
	MAX_WIDTH_MAX,
	MAX_WIDTH_MIN,
	normalizeColumnRows,
	normalizeColumnWidths,
	PANEL_GAP_MAX,
	PANEL_GAP_MIN
} from '$lib/layout/operations';
import { isWidgetType, widgetSettings } from '$lib/widgets/settings';
import {
	CONFIG_VERSION,
	createDefaultConfig,
	DEFAULT_GAP,
	defaultAppearance,
	defaultSearch
} from './defaults';
import {
	bool,
	hexColor,
	imageDataUrl,
	int,
	isRecord,
	nonEmpty,
	num,
	oneOf,
	record,
	str,
	uniqueId
} from './parse';
import type {
	AppearanceConfig,
	BackgroundConfig,
	ColumnCount,
	Config,
	DayPhase,
	Language,
	LayoutConfig,
	MediaRef,
	SearchConfig,
	SearchEngine,
	WidgetInstance
} from './types';

export const DAY_PHASES: readonly DayPhase[] = ['morning', 'day', 'evening', 'night'];

function parseMediaRef(raw: unknown): MediaRef | null {
	const r = record(raw);
	const id = nonEmpty(r.id, '');
	if (!id) return null;
	return {
		id,
		kind: oneOf(r.kind, ['image', 'video'], 'image'),
		name: str(r.name, '', 300)
	};
}

function parseBackground(raw: unknown, fallback: BackgroundConfig): BackgroundConfig {
	const r = record(raw);
	const slotsRaw = record(r.slots);
	const slots: BackgroundConfig['slots'] = {};
	for (const phase of DAY_PHASES) {
		const ref = parseMediaRef(slotsRaw[phase]);
		if (ref) slots[phase] = ref;
	}
	const focus = record(r.focus);
	return {
		main: parseMediaRef(r.main),
		slots,
		fit: oneOf(r.fit, ['cover', 'contain'], fallback.fit),
		focus: { x: num(focus.x, fallback.focus.x, 0, 1), y: num(focus.y, fallback.focus.y, 0, 1) }
	};
}

function parseAppearance(raw: unknown): AppearanceConfig {
	const d = defaultAppearance();
	const r = record(raw);
	const timeOfDay = record(r.timeOfDay);
	const phaseStart = record(timeOfDay.phaseStart);
	return {
		accent: hexColor(r.accent, d.accent),
		glass: { frost: num(record(r.glass).frost, d.glass.frost, 0, 1) },
		background: parseBackground(r.background, d.background),
		timeOfDay: {
			grading: bool(timeOfDay.grading, d.timeOfDay.grading),
			phaseStart: Object.fromEntries(
				DAY_PHASES.map((phase) => [
					phase,
					int(phaseStart[phase], d.timeOfDay.phaseStart[phase], 0, 24 * 60 - 1)
				])
			) as Record<DayPhase, number>
		},
		quality: oneOf(r.quality, ['auto', 'high', 'medium', 'low', 'static'], d.quality)
	};
}

/** Bang ohne Ausrufezeichen, klein, ohne Leerzeichen */
export function normalizeBang(value: unknown): string {
	return typeof value === 'string'
		? value.trim().replace(/^!+/, '').toLowerCase().replace(/\s+/g, '').slice(0, 20)
		: '';
}

/** Suchmaschinen-URL muss http(s) sein und `%s` enthalten */
export function isValidEngineUrl(value: string): boolean {
	if (!value.includes('%s')) return false;
	try {
		const { protocol } = new URL(value.replace(/%s/g, 'test'));
		return protocol === 'https:' || protocol === 'http:';
	} catch {
		return false;
	}
}

function parseEngine(raw: unknown, seen: Set<string>, bangs: Set<string>): SearchEngine | null {
	const r = record(raw);
	const name = nonEmpty(r.name, '', 80);
	const url = str(r.url, '', 2000).trim();
	if (!name || !isValidEngineUrl(url)) return null;
	let bang = normalizeBang(r.bang);
	if (bangs.has(bang)) bang = '';
	if (bang) bangs.add(bang);
	return { id: uniqueId(r.id, seen), name, url, bang, icon: imageDataUrl(r.icon) };
}

function parseSearch(raw: unknown): SearchConfig {
	if (!isRecord(raw) || !Array.isArray(raw.engines)) return defaultSearch();
	const seen = new Set<string>();
	const bangs = new Set<string>();
	const engines = raw.engines
		.map((engine) => parseEngine(engine, seen, bangs))
		.filter((engine) => engine !== null);
	const defaultEngineId = nonEmpty(raw.defaultEngineId, '');
	return {
		engines,
		defaultEngineId: engines.some((e) => e.id === defaultEngineId)
			? defaultEngineId
			: (engines[0]?.id ?? '')
	};
}

function parseWidgets(raw: unknown): Record<string, WidgetInstance> {
	const widgets: Record<string, WidgetInstance> = {};
	for (const [key, value] of Object.entries(record(raw))) {
		const r = record(value);
		if (!isWidgetType(r.type) || !key) continue;
		const type = r.type;
		widgets[key] = {
			id: key,
			type,
			settings: widgetSettings[type].parseSettings(r.settings)
		} as WidgetInstance;
	}
	return widgets;
}

function parseLayout(raw: unknown, widgetIds: string[]): LayoutConfig {
	const r = record(raw);
	const columns = oneOf<ColumnCount>(r.columns, [1, 2, 3, 4], 3);
	const columnWidths = normalizeColumnWidths(r.columnWidths, columns);
	// Abstände im 4-px-Raster
	const gap = (value: unknown, min: number, max: number) =>
		Math.round(num(value, DEFAULT_GAP, min, max) / 4) * 4;
	const layout: LayoutConfig = {
		columns,
		columnRows: normalizeColumnRows(r.columnRows, columns, widgetIds, columnWidths),
		columnWidths,
		columnGap: gap(r.columnGap, COLUMN_GAP_MIN, COLUMN_GAP_MAX),
		panelGap: gap(r.panelGap, PANEL_GAP_MIN, PANEL_GAP_MAX)
	};
	// Ohne Angabe (oder `null`) nutzt das Layout die volle Breite
	if (typeof r.maxWidth === 'number') {
		layout.maxWidth = Math.round(num(r.maxWidth, 96, MAX_WIDTH_MIN, MAX_WIDTH_MAX));
	}
	return layout;
}

/**
 * Validiert eine Config der aktuellen Schema-Version. Fehlendes wird ergänzt, Ungültiges
 * verworfen. Wirft nie; bei völlig unbrauchbarem Inhalt kommt die Default-Config zurück.
 */
export function parseConfig(raw: unknown, fallbackLanguage: Language = 'en'): Config {
	if (!isRecord(raw)) return createDefaultConfig(fallbackLanguage);
	const widgets = parseWidgets(raw.widgets);
	return {
		version: CONFIG_VERSION,
		language: oneOf(raw.language, ['auto', 'de', 'en'], 'auto'),
		layout: parseLayout(raw.layout, Object.keys(widgets)),
		widgets,
		appearance: parseAppearance(raw.appearance),
		search: parseSearch(raw.search)
	};
}

/** Alle Medien-Referenzen einer Config, z. B. für Export und Import */
export function collectMediaRefs(config: Config): MediaRef[] {
	const { main, slots } = config.appearance.background;
	const refs = [main, ...DAY_PHASES.map((phase) => slots[phase])].filter(
		(ref): ref is MediaRef => ref != null
	);
	return [...new Map(refs.map((ref) => [ref.id, ref])).values()];
}
