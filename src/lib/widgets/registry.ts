import type { WidgetSettingsMap, WidgetType } from '$lib/config/types';
import Calendar from './calendar/Calendar.svelte';
import Clock from './clock/Clock.svelte';
import LinkBoard from './links/LinkBoard.svelte';
import Search from './search/Search.svelte';
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
		component: Clock
	},
	calendar: {
		type: 'calendar',
		name: 'widget.calendar',
		icon: 'calendar',
		...widgetSettings.calendar,
		component: Calendar
	},
	search: {
		type: 'search',
		name: 'widget.search',
		icon: 'search',
		...widgetSettings.search,
		component: Search
	},
	links: {
		type: 'links',
		name: 'widget.links',
		icon: 'link',
		...widgetSettings.links,
		component: LinkBoard
	}
};

/** Definition eines Typs; der Cast ist nötig, weil TypeScript die Zuordnung nicht verfolgt */
export function definitionOf(type: WidgetType): WidgetDefinition<unknown> {
	return registry[type] as unknown as WidgetDefinition<unknown>;
}
