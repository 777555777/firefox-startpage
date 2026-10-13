import { describe, expect, it } from 'vitest';
import { accentPalette, contrastRatio, hexToRgb, oklchToRgb, rgbToHex, rgbToOklch } from './accent';

describe('Farbumrechnung', () => {
	it('rechnet Hex ↔ RGB', () => {
		expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
		expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
		expect(rgbToHex([1, 0.5, 0])).toBe('#ff8000');
	});

	it('kennt die OKLCH-Werte von Referenzfarben', () => {
		const white = rgbToOklch([1, 1, 1]);
		expect(white.l).toBeCloseTo(1, 3);
		expect(white.c).toBeCloseTo(0, 3);
		const red = rgbToOklch(hexToRgb('#ff0000'));
		expect(red.l).toBeCloseTo(0.628, 2);
		expect(red.c).toBeCloseTo(0.258, 2);
		expect(red.h).toBeCloseTo(29.2, 0);
	});

	it('ist umkehrbar', () => {
		for (const hex of ['#1872d6', '#0fa3b1', '#3a9d3f', '#e8790c', '#d23a72', '#000000']) {
			expect(rgbToHex(oklchToRgb(rgbToOklch(hexToRgb(hex))))).toBe(hex);
		}
	});

	it('bleibt im sRGB-Farbraum, wenn die Chroma zu hoch ist', () => {
		const rgb = oklchToRgb({ l: 0.9, c: 0.4, h: 140 });
		for (const v of rgb) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
	});

	it('berechnet WCAG-Kontraste', () => {
		expect(contrastRatio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5);
		expect(contrastRatio([1, 1, 1], [1, 1, 1])).toBe(1);
	});
});

describe('accentPalette', () => {
	it('leitet für Aero-Blau eine stimmige Palette ab', () => {
		const palette = accentPalette('#1872d6');
		const l = (hex: string) => rgbToOklch(hexToRgb(hex)).l;
		expect(palette.base).toBe('#1872d6');
		expect(l(palette.hover)).toBeGreaterThan(l(palette.base));
		expect(l(palette.pressed)).toBeLessThan(l(palette.base));
		expect(l(palette.subtle)).toBeGreaterThan(0.9);
		expect(palette.onAccent).toBe('#ffffff');
	});

	it('behält den Farbton', () => {
		const base = rgbToOklch(hexToRgb('#d23a72'));
		const palette = accentPalette('#d23a72');
		for (const hex of [palette.hover, palette.pressed]) {
			expect(rgbToOklch(hexToRgb(hex)).h).toBeCloseTo(base.h, -0.5);
		}
	});

	it('nimmt dunklen Text auf hellen Akzenten', () => {
		const palette = accentPalette('#ffe14d');
		expect(palette.onAccent).toBe('#0b1b2e');
		// Helle Akzente werden beim Hovern dunkler
		expect(rgbToOklch(hexToRgb(palette.hover)).l).toBeLessThan(rgbToOklch(hexToRgb('#ffe14d')).l);
	});

	it('erreicht ausreichenden Kontrast für Text auf dem Akzent', () => {
		for (const hex of ['#1872d6', '#3a9d3f', '#e8790c', '#7b5be6', '#ffe14d']) {
			const palette = accentPalette(hex);
			expect(contrastRatio(hexToRgb(hex), hexToRgb(palette.onAccent))).toBeGreaterThan(3);
		}
	});
});
