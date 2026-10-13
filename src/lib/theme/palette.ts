import type { DayPhase } from '$lib/config/types';
import { mixNumber, mixRgb, PHASES, type PhaseWeights, type Rgb } from './phase';

/**
 * Farbstimmung pro Tageszeit-Phase: Himmelsverlauf (Shader und CSS-Fallback), Color-Grading
 * für eigene Hintergründe und der Farbton der Glasflächen. Werte werden über die
 * Phasengewichte kontinuierlich gemischt.
 */

export type SkyPalette = {
	/** Zenit */
	top: Rgb;
	/** Mitte des Himmels */
	middle: Rgb;
	/** Heller Horizont unten */
	horizon: Rgb;
	/** Weiches Licht unten links (Aero-Wiese bzw. Dämmerung) */
	ground: Rgb;
	/** Sonnen- bzw. Mondlicht */
	glow: Rgb;
	/** Position des Lichts, 0..1 von oben links */
	glowX: number;
	glowY: number;
	glowStrength: number;
};

export const SKY: Record<DayPhase, SkyPalette> = {
	morning: {
		top: [52, 104, 196],
		middle: [128, 168, 222],
		horizon: [255, 206, 170],
		ground: [255, 222, 190],
		glow: [255, 196, 140],
		glowX: 0.18,
		glowY: 0.82,
		glowStrength: 0.75
	},
	day: {
		top: [22, 96, 201],
		middle: [70, 165, 230],
		horizon: [196, 238, 240],
		ground: [186, 244, 214],
		glow: [255, 255, 255],
		glowX: 0.78,
		glowY: 0.0,
		glowStrength: 0.4
	},
	evening: {
		top: [40, 66, 140],
		middle: [196, 112, 120],
		horizon: [255, 178, 96],
		ground: [255, 150, 90],
		glow: [255, 204, 120],
		glowX: 0.82,
		glowY: 0.86,
		glowStrength: 0.8
	},
	night: {
		top: [6, 12, 34],
		middle: [14, 32, 74],
		horizon: [36, 64, 120],
		ground: [30, 52, 100],
		glow: [150, 176, 232],
		glowX: 0.74,
		glowY: 0.14,
		glowStrength: 0.22
	}
};

export function skyAt(weights: PhaseWeights): SkyPalette {
	const pick = <K extends keyof SkyPalette>(key: K) =>
		Object.fromEntries(PHASES.map((p) => [p, SKY[p][key]])) as Record<DayPhase, SkyPalette[K]>;
	return {
		top: mixRgb(weights, pick('top')),
		middle: mixRgb(weights, pick('middle')),
		horizon: mixRgb(weights, pick('horizon')),
		ground: mixRgb(weights, pick('ground')),
		glow: mixRgb(weights, pick('glow')),
		glowX: mixNumber(weights, pick('glowX')),
		glowY: mixNumber(weights, pick('glowY')),
		glowStrength: mixNumber(weights, pick('glowStrength'))
	};
}

export type Grade = {
	/** Farbe, in die eingefärbt wird */
	tint: Rgb;
	/** Stärke der Einfärbung, 0..1 */
	amount: number;
	saturation: number;
	brightness: number;
	contrast: number;
};

/** Color-Grading für eigene Bilder und Videos */
export const GRADES: Record<DayPhase, Grade> = {
	// warm und leicht entsättigt
	morning: {
		tint: [255, 196, 150],
		amount: 0.14,
		saturation: 0.88,
		brightness: 1.0,
		contrast: 0.96
	},
	// neutral
	day: { tint: [255, 255, 255], amount: 0, saturation: 1, brightness: 1, contrast: 1 },
	// golden/orange
	evening: {
		tint: [255, 156, 64],
		amount: 0.2,
		saturation: 1.05,
		brightness: 0.94,
		contrast: 1.02
	},
	// dunkelblau, abgedunkelt
	night: { tint: [40, 70, 150], amount: 0.32, saturation: 0.72, brightness: 0.58, contrast: 0.96 }
};

export const NEUTRAL_GRADE: Grade = GRADES.day;

export function gradeAt(weights: PhaseWeights): Grade {
	const pick = <K extends keyof Grade>(key: K) =>
		Object.fromEntries(PHASES.map((p) => [p, GRADES[p][key]])) as Record<DayPhase, Grade[K]>;
	return {
		tint: mixRgb(weights, pick('tint')),
		amount: mixNumber(weights, pick('amount')),
		saturation: mixNumber(weights, pick('saturation')),
		brightness: mixNumber(weights, pick('brightness')),
		contrast: mixNumber(weights, pick('contrast'))
	};
}

/**
 * Helle oder dunkle UI. Sie wechselt diskret (zur Mitte des Übergangs in die Nacht), damit
 * Text und Glas-Tönung immer zusammenpassen und nie ein kontrastarmes Grau entsteht.
 */
export type Tone = 'light' | 'dark';

export function toneAt(weights: PhaseWeights): Tone {
	return weights.night >= 0.5 ? 'dark' : 'light';
}

/** Grundfarbe des Glases pro Tonalität */
export const GLASS_BASE: Record<Tone, Rgb> = {
	light: [255, 255, 255],
	dark: [16, 26, 48]
};

/** Leichter Farbstich des Glases pro Phase */
export const GLASS_HUE: Record<DayPhase, Rgb> = {
	morning: [255, 228, 208],
	day: [236, 246, 255],
	evening: [255, 222, 180],
	night: [70, 96, 160]
};

/** Anteil des Phasen-Farbstichs an der Glasfarbe */
export const GLASS_HUE_AMOUNT = 0.14;

export function glassTintAt(weights: PhaseWeights, tone: Tone): Rgb {
	const hue = mixRgb(weights, GLASS_HUE);
	const base = GLASS_BASE[tone];
	return base.map((v, i) => v + (hue[i] - v) * GLASS_HUE_AMOUNT) as Rgb;
}

/**
 * Richtung des Lichts für Glanzkanten, als Einheitsvektor in Bildschirmkoordinaten (y nach
 * unten, zeigt zur Lichtquelle). Morgens von links, mittags von oben, abends von rechts,
 * nachts wieder von oben.
 */
export function lightDirection(weights: PhaseWeights): [number, number] {
	const x = mixNumber(weights, { morning: -0.75, day: -0.25, evening: 0.75, night: 0.2 });
	const y = -1;
	const length = Math.hypot(x, y);
	return [x / length, y / length];
}

export const rgbCss = ([r, g, b]: Rgb) => `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
