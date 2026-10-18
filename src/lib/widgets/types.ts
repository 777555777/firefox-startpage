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
	/** Öffnet die Einstellungen des Widgets; fehlt, wenn es keine gibt */
	opensettings?: () => void;
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
	/**
	 * Bei begrenzter Zeilenhöhe scrollt das Widget selbst nur einen Teil (z. B. eine Liste unter
	 * einem festen Kopf), statt dass das ganze Panel scrollt. Es bekommt dann die verfügbare Höhe
	 * und muss selbst `min-height: 0` setzen.
	 */
	scrollsSelf?: boolean;
};
