/**
 * Dichte der Oberfläche. „Kompakt“ verkleinert Abstände (Innenabstand der Panels, Lücken,
 * Luft in Uhr, Kalender und Kacheln), nicht die Schrift, damit die Page auf niedrigen
 * Laptop-Fenstern ohne Scrollen passt.
 */
export type DensitySetting = 'auto' | 'normal' | 'compact';
export type Density = 'normal' | 'compact';

export const DENSITY_SETTINGS: readonly DensitySetting[] = ['auto', 'normal', 'compact'];

/** Pro Rechner, weil es vom Bildschirm abhängt; nicht in der exportierbaren Config */
export const DENSITY_KEY = 'startpage:density';

/**
 * Unterhalb dieser Fensterhöhe (CSS-px) wird „Automatisch“ kompakt. Ein Full-HD-Monitor hat in
 * Firefox gut 950 px, ein MacBook mit Standardauflösung um 860 px.
 */
export const COMPACT_BELOW_PX = 900;

export function parseDensitySetting(raw: unknown): DensitySetting {
	return DENSITY_SETTINGS.includes(raw as DensitySetting) ? (raw as DensitySetting) : 'auto';
}

export function resolveDensity(setting: DensitySetting, viewportHeight: number): Density {
	if (setting !== 'auto') return setting;
	return viewportHeight < COMPACT_BELOW_PX ? 'compact' : 'normal';
}

export function loadDensitySetting(storage?: Pick<Storage, 'getItem'>): DensitySetting {
	try {
		return parseDensitySetting((storage ?? localStorage).getItem(DENSITY_KEY));
	} catch {
		return 'auto';
	}
}

export function saveDensitySetting(setting: DensitySetting, storage?: Pick<Storage, 'setItem'>) {
	try {
		(storage ?? localStorage).setItem(DENSITY_KEY, setting);
	} catch {
		// ohne localStorage gilt die Wahl nur bis zum Schließen des Tabs
	}
}
