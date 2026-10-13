/**
 * Leitet aus einer Akzentfarbe (Hex) eine kleine Palette ab. Gerechnet wird in OKLCH, damit
 * Helligkeitsstufen gleichmäßig wirken und der Farbton erhalten bleibt.
 */

export type Oklch = { l: number; c: number; h: number };
type Rgb = [number, number, number];

export type AccentPalette = {
	base: string;
	hover: string;
	pressed: string;
	/** Dezente Fläche, z. B. für Auswahl-Hintergründe */
	subtle: string;
	/** Textfarbe auf der Akzentfarbe */
	onAccent: string;
};

export function hexToRgb(hex: string): Rgb {
	const value = hex.replace('#', '');
	const full =
		value.length === 3
			? value
					.split('')
					.map((c) => c + c)
					.join('')
			: value;
	const n = parseInt(full, 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
	const to = (v: number) =>
		Math.round(Math.min(1, Math.max(0, v)) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${to(r)}${to(g)}${to(b)}`;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
	const [r, g, b] = rgb.map(toLinear);
	const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	const c = Math.hypot(a, bb);
	const h = c < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
	return { l: L, c, h };
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
	const rad = (h * Math.PI) / 180;
	const a = c * Math.cos(rad);
	const b = c * Math.sin(rad);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
	];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** Wandelt zurück nach sRGB; außerhalb des Farbraums wird die Chroma reduziert */
export function oklchToRgb(color: Oklch): Rgb {
	let linear = oklchToLinear(color);
	if (!inGamut(linear)) {
		let low = 0;
		let high = color.c;
		for (let i = 0; i < 20; i++) {
			const mid = (low + high) / 2;
			if (inGamut(oklchToLinear({ ...color, c: mid }))) low = mid;
			else high = mid;
		}
		linear = oklchToLinear({ ...color, c: low });
	}
	return linear.map((v) => toGamma(Math.min(1, Math.max(0, v)))) as Rgb;
}

/** Relative Leuchtdichte nach WCAG */
export function luminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [1, 1, 1];
const INK: Rgb = hexToRgb('#0b1b2e');

export function accentPalette(hex: string): AccentPalette {
	const rgb = hexToRgb(hex);
	const base = rgbToOklch(rgb);
	const shift = (dl: number, cScale = 1) =>
		rgbToHex(
			oklchToRgb({ l: Math.min(0.98, Math.max(0.05, base.l + dl)), c: base.c * cScale, h: base.h })
		);
	// Helle Akzente werden beim Hovern dunkler, dunkle heller
	const hoverDirection = base.l > 0.75 ? -1 : 1;
	return {
		base: rgbToHex(rgb),
		hover: shift(0.06 * hoverDirection),
		pressed: shift(-0.08),
		subtle: rgbToHex(oklchToRgb({ l: 0.93, c: Math.min(base.c, 0.06), h: base.h })),
		// Weiß bevorzugen, solange es AA erreicht; sonst die kontrastreichere Variante
		onAccent:
			contrastRatio(rgb, WHITE) >= 4.5 || contrastRatio(rgb, WHITE) >= contrastRatio(rgb, INK)
				? '#ffffff'
				: '#0b1b2e'
	};
}
