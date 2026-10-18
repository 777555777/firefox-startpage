import type { Rgb } from './phase';
import type { Tone } from './palette';

/**
 * Kontrast nach WCAG 2: relative Leuchtdichte und Kontrastverhältnis, dazu die Textfarben
 * der UI. Die Werte entsprechen `--text` und `--text-secondary` in `app.css`.
 */

export type TextColor = { rgb: Rgb; alpha: number };

export const TEXT_COLORS: Record<Tone, { primary: TextColor; secondary: TextColor }> = {
	light: {
		primary: { rgb: [12, 31, 51], alpha: 1 },
		secondary: { rgb: [12, 31, 51], alpha: 0.86 }
	},
	dark: {
		primary: { rgb: [238, 244, 255], alpha: 1 },
		secondary: { rgb: [238, 244, 255], alpha: 0.8 }
	}
};

/** WCAG AA für normalen Text */
export const AA_NORMAL = 4.5;

const linear = (channel: number) => {
	const v = channel / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance([r, g, b]: Rgb): number {
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Halbtransparente Farbe über einem Hintergrund */
export function blend(color: TextColor, background: Rgb): Rgb {
	return color.rgb.map((c, i) => c * color.alpha + background[i] * (1 - color.alpha)) as Rgb;
}

/** Kontrast einer (ggf. halbtransparenten) Textfarbe auf einem Hintergrund */
export function textContrast(color: TextColor, background: Rgb): number {
	return contrastRatio(blend(color, background), background);
}

/** Schlechtester Kontrast einer Textfarbe über mehrere gemessene Hintergrundfarben */
export function worstContrast(color: TextColor, backgrounds: Rgb[]): number {
	return backgrounds.reduce((worst, bg) => Math.min(worst, textContrast(color, bg)), Infinity);
}

/** Halbtransparente Fläche über einem Hintergrund, z. B. eine Tönung auf Glas */
export type Fill = { rgb: Rgb; alpha: number };

/**
 * Flächen und Schrift der Tagesarten im Kalender. Die Werte entsprechen `--holiday*` und
 * `--off*` in `app.css`. Unterscheidbar sind die Arten auch ohne Farbe: Wochenende ist eine
 * schlichte Fläche, Feiertag eine Fläche mit Rahmen, frei eine schraffierte Fläche (zwei
 * Streifenfarben).
 */
export const DAY_COLORS: Record<
	Tone,
	{ holiday: { text: TextColor; fills: Fill[] }; off: { text: TextColor; fills: Fill[] } }
> = {
	light: {
		holiday: {
			text: { rgb: [156, 16, 40], alpha: 1 },
			fills: [{ rgb: [255, 226, 230], alpha: 0.66 }]
		},
		off: {
			text: { rgb: [5, 83, 91], alpha: 1 },
			fills: [
				{ rgb: [222, 246, 247], alpha: 0.62 },
				{ rgb: [168, 226, 232], alpha: 0.62 }
			]
		}
	},
	dark: {
		holiday: {
			text: { rgb: [255, 179, 191], alpha: 1 },
			fills: [{ rgb: [255, 120, 140], alpha: 0.16 }]
		},
		off: {
			text: { rgb: [158, 236, 242], alpha: 1 },
			fills: [
				{ rgb: [100, 214, 226], alpha: 0.08 },
				{ rgb: [100, 214, 226], alpha: 0.2 }
			]
		}
	}
};
