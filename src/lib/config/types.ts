import type { CalendarSettings } from '$lib/widgets/calendar/settings';
import type { ClockSettings } from '$lib/widgets/clock/settings';
import type { LinksSettings } from '$lib/widgets/links/settings';
import type { SearchSettings } from '$lib/widgets/search/settings';

export type Language = 'de' | 'en';
export type LanguageSetting = Language | 'auto';

export type Quality = 'auto' | 'high' | 'medium' | 'low' | 'static';
export type DayPhase = 'morning' | 'day' | 'evening' | 'night';

export type ColumnCount = 1 | 2 | 3 | 4;

/** Einstellungen je Widget-Typ; neue Typen werden hier ergänzt */
export type WidgetSettingsMap = {
	clock: ClockSettings;
	calendar: CalendarSettings;
	search: SearchSettings;
	links: LinksSettings;
};

export type WidgetType = keyof WidgetSettingsMap;

export type WidgetInstance<T extends WidgetType = WidgetType> = {
	[K in T]: { id: string; type: K; settings: WidgetSettingsMap[K] };
}[T];

export type LayoutConfig = {
	columns: ColumnCount;
	/** Widget-Instanz-IDs pro Spalte, in Reihenfolge; Länge entspricht immer `columns` */
	columnItems: string[][];
	/** Maximale Inhaltsbreite in rem */
	maxWidth?: number;
};

export type MediaRef = { id: string; kind: 'image' | 'video'; name: string };

export type BackgroundConfig = {
	/** Haupt-Hintergrund; null = Shader-Verlauf */
	main: MediaRef | null;
	/** Optionale Slots pro Tageszeit; leer = main verwenden */
	slots: Partial<Record<DayPhase, MediaRef>>;
	fit: 'cover' | 'contain';
	/** Fokuspunkt für cover, 0..1 */
	focus: { x: number; y: number };
};

export type TimeOfDayConfig = {
	grading: boolean;
	/** Beginn der Phasen in Minuten nach Mitternacht */
	phaseStart: Record<DayPhase, number>;
};

export type AppearanceConfig = {
	accent: string;
	glass: { frost: number };
	background: BackgroundConfig;
	timeOfDay: TimeOfDayConfig;
	quality: Quality;
	pointerLight: boolean;
};

export type SearchEngine = {
	id: string;
	name: string;
	/** URL-Template mit `%s` als Platzhalter für den Suchtext */
	url: string;
	/** Bang ohne Ausrufezeichen, z. B. `gh`; leer = kein Bang */
	bang: string;
	/** Eigenes Icon als Data-URL; null = Favicon der Origin */
	icon: string | null;
};

export type SearchConfig = {
	engines: SearchEngine[];
	defaultEngineId: string;
};

export type Config = {
	version: number;
	language: LanguageSetting;
	layout: LayoutConfig;
	widgets: Record<string, WidgetInstance>;
	appearance: AppearanceConfig;
	search: SearchConfig;
};

/** Klick-Statistik pro URL, getrennt von der Config gespeichert */
export type LinkStat = { count: number; lastOpened: number };
export type LinkStats = Record<string, LinkStat>;
