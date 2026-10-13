import type { Quality } from '$lib/config/types';

/**
 * Alle Parameter des Glas-Shaders an einer Stelle, damit sie sich leicht feinjustieren lassen.
 * Längen in CSS-Pixeln, der Renderer rechnet sie in Gerätepixel um. Das Debug-Panel (`?debug`
 * im Dev-Build) ändert die Werte live.
 */
export const GLASS_DEFAULTS = {
	/** Breite des gewölbten Randes bei `depth` 0 bzw. 1 */
	bevelMin: 16,
	bevelMax: 28,
	/** Maximaler Versatz der Szene am Rand (Refraktion) */
	refraction: 22,
	/** Unterschied der Brechung zwischen R, G und B (Dispersion) */
	dispersion: 0.22,
	/** Sättigung der Szene hinter dem Glas */
	saturation: 1.2,
	/** Anteil der Glasfarbe (Tönung) */
	tint: 0.16,
	/** Helle UI: Mindesthelligkeit unter der Fläche, damit dunkle Schrift Kontrast hat */
	minLuminance: 0.66,
	/** Dunkle UI: Höchsthelligkeit unter der Fläche, damit helle Schrift Kontrast hat */
	maxLuminance: 0.22,
	/** Wie stark die adaptive Aufhellung bzw. Abdunklung greift (1 = Grenzwert wird sicher erreicht) */
	adaptive: 1,
	/** Schimmer entlang des Randes (Fresnel) */
	fresnel: 0.2,
	/** Glanzlicht an der Kante zur Lichtquelle */
	specular: 0.6,
	specularPower: 5,
	/** Feine Lichtkante direkt am Rand */
	edgeLine: 0.5,
	/** Weicher Schimmer im oberen Bereich */
	sheen: 0.1,
	/** Kontaktschatten */
	shadowOpacity: 0.32,
	shadowBlur: 30,
	shadowOffset: 14,
	/** Abdunklung der Szene hinter Dialogen */
	scrim: 0.4,
	/** Mauslicht: Reichweite in px, Anteil an der Lichtrichtung, zusätzlicher Randschimmer */
	pointerRadius: 240,
	pointerInfluence: 0.7,
	pointerGlow: 0.3,
	/** Stärke von Anheben (Hover) und Eindrücken (Press) */
	hoverLift: 1,
	pressDepth: 1,
	/** Geschwindigkeit des Himmelsverlaufs */
	skySpeed: 1
};

export type GlassParams = typeof GLASS_DEFAULTS;

export const glassParams: GlassParams = $state({ ...GLASS_DEFAULTS });

export function resetGlassParams() {
	Object.assign(glassParams, GLASS_DEFAULTS);
}

/** Wertebereiche für die Regler im Debug-Panel */
export const GLASS_RANGES: Record<keyof GlassParams, [min: number, max: number, step: number]> = {
	bevelMin: [0, 48, 1],
	bevelMax: [0, 64, 1],
	refraction: [0, 80, 1],
	dispersion: [0, 1, 0.01],
	saturation: [0, 2, 0.05],
	tint: [0, 1, 0.01],
	minLuminance: [0, 1, 0.01],
	maxLuminance: [0, 1, 0.01],
	adaptive: [0, 1, 0.05],
	fresnel: [0, 1, 0.01],
	specular: [0, 2, 0.05],
	specularPower: [1, 32, 1],
	edgeLine: [0, 1, 0.05],
	sheen: [0, 0.5, 0.01],
	shadowOpacity: [0, 1, 0.01],
	shadowBlur: [0, 80, 1],
	shadowOffset: [0, 40, 1],
	scrim: [0, 1, 0.05],
	pointerRadius: [40, 800, 10],
	pointerInfluence: [0, 1, 0.05],
	pointerGlow: [0, 1, 0.01],
	hoverLift: [0, 3, 0.1],
	pressDepth: [0, 3, 0.1],
	skySpeed: [0, 10, 0.1]
};

export type RenderLevel = Exclude<Quality, 'auto' | 'static'>;

export type QualityPreset = {
	/** Obergrenze für das Gerätepixel-Verhältnis des Canvas */
	maxDpr: number;
	/** Auflösung von Szene und Blur relativ zum Canvas */
	sceneScale: number;
	refraction: boolean;
	dispersion: boolean;
	/** Bildrate für Video; 0 = nativ */
	videoFps: number;
	/** Lichtreflex folgt der Maus */
	pointerLight: boolean;
};

/** Qualitätsstufen aus §7.4 */
export const QUALITY_PRESETS: Record<RenderLevel, QualityPreset> = {
	high: {
		maxDpr: 2,
		sceneScale: 1,
		refraction: true,
		dispersion: true,
		videoFps: 0,
		pointerLight: true
	},
	medium: {
		maxDpr: 2,
		sceneScale: 0.5,
		refraction: true,
		dispersion: false,
		videoFps: 30,
		pointerLight: true
	},
	// Nur Frost und Rand-Glanz, kein Mauslicht
	low: {
		maxDpr: 1,
		sceneScale: 0.5,
		refraction: false,
		dispersion: false,
		videoFps: 24,
		pointerLight: false
	}
};
