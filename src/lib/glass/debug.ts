import { TEXT_COLORS, worstContrast } from '$lib/theme/contrast';
import type { Tone } from '$lib/theme/palette';
import type { Rgb } from '$lib/theme/phase';
import type { GlassController } from './controller';

/** Zugriff des Debug-Panels auf den laufenden Renderer; wird nur im Dev-Build gesetzt */
export const glassDebug: { controller: GlassController | null } = { controller: null };

export type ContrastResult = { name: string; primary: number; secondary: number };

/**
 * Kontrast-Check (§8): misst die gezeichnete Glasfläche jedes Panels an einem Raster von Punkten
 * (ohne den gewölbten Rand) und liefert den schlechtesten Kontrast für primären und sekundären
 * Text. Gedacht für die manuelle Prüfung mit hellem und dunklem Testbild.
 */
export function measureContrast(controller: GlassController, tone: Tone): ContrastResult[] {
	const panels = [...document.querySelectorAll<HTMLElement>('[data-glass]')];
	const inset = 32;
	return controller.renderAndRead(() =>
		panels.map((panel) => {
			const rect = panel.getBoundingClientRect();
			const samples: Rgb[] = [];
			for (let i = 0; i <= 6; i++) {
				for (let j = 0; j <= 4; j++) {
					const x = rect.left + inset + ((rect.width - 2 * inset) * i) / 6;
					const y = rect.top + inset + ((rect.height - 2 * inset) * j) / 4;
					const pixel = controller.readPixel(x, y);
					if (pixel) samples.push(pixel);
				}
			}
			return {
				name: panel.getAttribute('aria-label') ?? panel.dataset.widget ?? '?',
				primary: worstContrast(TEXT_COLORS[tone].primary, samples),
				secondary: worstContrast(TEXT_COLORS[tone].secondary, samples)
			};
		})
	);
}
