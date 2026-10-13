import type { Component } from 'svelte';
import type { WidgetType } from '$lib/config/types';
import type { I18nKey } from '$lib/i18n/translate';
import type { IconName } from '$lib/ui/icons';

/** Ändert die Settings einer Instanz direkt im gespeicherten Zustand */
export type UpdateSettings<S> = (mutate: (settings: S) => void) => void;

export type WidgetProps<S> = {
	id: string;
	settings: S;
	editing: boolean;
	update: UpdateSettings<S>;
};

export type WidgetSettingsProps<S> = {
	id: string;
	settings: S;
	update: UpdateSettings<S>;
};

export type WidgetDefinition<S> = {
	type: WidgetType;
	name: I18nKey;
	icon: IconName;
	defaultSettings: () => S;
	/** Validiert, ergänzt Fehlendes, wirft nie */
	parseSettings: (raw: unknown) => S;
	component: Component<WidgetProps<S>>;
	settingsComponent?: Component<WidgetSettingsProps<S>>;
	/** Rechte, die beim Hinzufügen angefragt werden (für spätere Widgets wie RSS) */
	permissions?: { origins?: string[]; permissions?: string[] };
	/** Darf nur einmal auf der Page vorkommen */
	singleton?: boolean;
};
