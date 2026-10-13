import type { WidgetSettingsMap, WidgetType } from '$lib/config/types';
import Calendar from './calendar/Calendar.svelte';
import CalendarSettings from './calendar/CalendarSettings.svelte';
import Clock from './clock/Clock.svelte';
import ClockSettings from './clock/ClockSettings.svelte';
import LinkBoard from './links/LinkBoard.svelte';
import LinkBoardSettings from './links/LinkBoardSettings.svelte';
import Search from './search/Search.svelte';
import SearchSettings from './search/SearchSettings.svelte';
import { widgetSettings } from './settings';
import type { WidgetDefinition } from './types';

/**
 * Registry aller Widget-Typen. Neue Typen (RSS, Notizen, Termine) werden hier und in
 * `widgets/settings.ts` ergänzt, das restliche System bleibt unverändert.
 */
export const registry: { [K in WidgetType]: WidgetDefinition<WidgetSettingsMap[K]> } = {
	clock: {
		type: 'clock',
		name: 'widget.clock',
		icon: 'clock',
		...widgetSettings.clock,
		component: Clock,
		settingsComponent: ClockSettings
	},
	calendar: {
		type: 'calendar',
		name: 'widget.calendar',
		icon: 'calendar',
		...widgetSettings.calendar,
		component: Calendar,
		settingsComponent: CalendarSettings
	},
	search: {
		type: 'search',
		name: 'widget.search',
		icon: 'search',
		...widgetSettings.search,
		component: Search,
		settingsComponent: SearchSettings
	},
	links: {
		type: 'links',
		name: 'widget.links',
		icon: 'link',
		...widgetSettings.links,
		component: LinkBoard,
		settingsComponent: LinkBoardSettings
	}
};

/** Definition eines Typs; der Cast ist nötig, weil TypeScript die Zuordnung nicht verfolgt */
export function definitionOf(type: WidgetType): WidgetDefinition<unknown> {
	return registry[type] as unknown as WidgetDefinition<unknown>;
}
