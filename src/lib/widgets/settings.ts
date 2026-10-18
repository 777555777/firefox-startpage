import type { WidgetSettingsMap, WidgetType } from '$lib/config/types';
import { defaultCalendarSettings, parseCalendarSettings } from './calendar/settings';
import { defaultClockSettings, parseClockSettings } from './clock/settings';
import { defaultLinksSettings, parseLinksSettings } from './links/settings';
import { defaultRssSettings, parseRssSettings } from './rss/settings';
import { defaultSearchSettings, parseSearchSettings } from './search/settings';

type SettingsSchema<S> = {
	defaultSettings: () => S;
	/** Validiert, ergänzt Fehlendes, wirft nie */
	parseSettings: (raw: unknown) => S;
};

/**
 * Reiner Daten-Teil der Widget-Registry, ohne Komponenten. So kann die Config-Validierung
 * (und ihre Unit-Tests) ohne Svelte-Komponenten laufen.
 */
export const widgetSettings: { [K in WidgetType]: SettingsSchema<WidgetSettingsMap[K]> } = {
	clock: { defaultSettings: defaultClockSettings, parseSettings: parseClockSettings },
	calendar: { defaultSettings: defaultCalendarSettings, parseSettings: parseCalendarSettings },
	search: { defaultSettings: defaultSearchSettings, parseSettings: parseSearchSettings },
	links: { defaultSettings: defaultLinksSettings, parseSettings: parseLinksSettings },
	rss: { defaultSettings: defaultRssSettings, parseSettings: parseRssSettings }
};

export function isWidgetType(value: unknown): value is WidgetType {
	return typeof value === 'string' && value in widgetSettings;
}
