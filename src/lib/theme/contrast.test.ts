import { describe, expect, it } from 'vitest';
import { GLASS_DEFAULTS } from '$lib/glass/params.svelte';
import { AA_NORMAL, contrastRatio, textContrast, TEXT_COLORS, worstContrast } from './contrast';
import type { Rgb } from './phase';

/** Grau mit dem Gamma-Helligkeitswert `luma`; bei gleichem Wert der ungünstigste Fall */
const grey = (luma: number): Rgb => [luma * 255, luma * 255, luma * 255];

describe('Kontrast nach WCAG', () => {
	it('rechnet bekannte Verhältnisse nach', () => {
		expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
		expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1);
		// #767676 auf Weiß ist die bekannte AA-Grenze
		expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 1);
	});

	it('berücksichtigt halbtransparenten Text', () => {
		const half = { rgb: [0, 0, 0] as Rgb, alpha: 0.5 };
		expect(textContrast(half, [255, 255, 255])).toBeLessThan(
			contrastRatio([0, 0, 0], [255, 255, 255])
		);
		expect(
			worstContrast(half, [
				[255, 255, 255],
				[128, 128, 128]
			])
		).toBeLessThan(textContrast(half, [255, 255, 255]));
	});

	it('helle UI: Text erreicht AA auf der dunkelsten erlaubten Glasfläche', () => {
		const darkest = grey(GLASS_DEFAULTS.minLuminance);
		expect(textContrast(TEXT_COLORS.light.primary, darkest)).toBeGreaterThan(AA_NORMAL);
		expect(textContrast(TEXT_COLORS.light.secondary, darkest)).toBeGreaterThan(AA_NORMAL);
	});

	it('dunkle UI: Text erreicht AA auf der hellsten erlaubten Glasfläche', () => {
		const brightest = grey(GLASS_DEFAULTS.maxLuminance);
		expect(textContrast(TEXT_COLORS.dark.primary, brightest)).toBeGreaterThan(AA_NORMAL);
		expect(textContrast(TEXT_COLORS.dark.secondary, brightest)).toBeGreaterThan(AA_NORMAL);
	});

	it('Grau ist bei gleicher Gamma-Helligkeit der ungünstigste Hintergrund', () => {
		// Gleiche gewichtete Gamma-Helligkeit wie grey(0.66), aber gesättigt
		const weights = [0.2126, 0.7152, 0.0722];
		const target = 0.66;
		const saturated: Rgb = [1, (target - 0.2126 - 0.0722 * 0.3) / 0.7152, 0.3].map(
			(v) => v * 255
		) as Rgb;
		expect(weights.reduce((sum, w, i) => sum + (w * saturated[i]) / 255, 0)).toBeCloseTo(target);
		expect(textContrast(TEXT_COLORS.light.secondary, saturated)).toBeGreaterThan(
			textContrast(TEXT_COLORS.light.secondary, grey(target))
		);
	});
});
