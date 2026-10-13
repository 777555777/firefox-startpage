/**
 * Bereitet die Glasflächen für den Shader auf: in Gerätepixel umrechnen, unsichtbare Flächen
 * aussortieren und als Instanz-Daten in ein Float32Array packen. Reine Funktionen.
 */

/** Höchstzahl gleichzeitig gezeichneter Flächen (§7.1) */
export const MAX_SURFACES = 64;

/**
 * rect (x, y, w, h), clip (x0, y0, x1, y1), params (radius, depth, opacity, variant),
 * state (lift, frei, frei, frei)
 */
export const FLOATS_PER_SURFACE = 16;

export const VARIANTS = { panel: 0, popover: 1, button: 2 } as const;
export type GlassVariant = keyof typeof VARIANTS;

export type Box = { left: number; top: number; right: number; bottom: number };

export type SurfaceSnapshot = {
	/** Rechteck in CSS-Pixeln (wie `getBoundingClientRect`) */
	rect: Box;
	/** Sichtbarer Bereich, z. B. der Scroll-Container; außerhalb wird nichts gezeichnet */
	clip: Box;
	radius: number;
	depth: number;
	opacity: number;
	variant: GlassVariant;
	/** Interaktion: 1 = angehoben (Hover), -1 = eingedrückt, 0 = Ruhe */
	lift?: number;
	/** Zuordnung zur Fläche, z. B. das Element */
	key?: unknown;
};

export function intersect(a: Box, b: Box): Box {
	return {
		left: Math.max(a.left, b.left),
		top: Math.max(a.top, b.top),
		right: Math.min(a.right, b.right),
		bottom: Math.min(a.bottom, b.bottom)
	};
}

export const isEmpty = (box: Box) => box.right <= box.left || box.bottom <= box.top;

const grow = (box: Box, by: number): Box => ({
	left: box.left - by,
	top: box.top - by,
	right: box.right + by,
	bottom: box.bottom + by
});

/**
 * Packt die Flächen in Zeichenreihenfolge. `margin` ist der Platz um eine Fläche, den der
 * Schatten braucht; Flächen, die mitsamt Schatten nicht im sichtbaren Bereich liegen, fallen
 * weg. Liefert die Daten und die Anzahl.
 */
export function packSurfaces(
	surfaces: readonly SurfaceSnapshot[],
	viewport: { width: number; height: number },
	scale: number,
	margin: number,
	out = new Float32Array(MAX_SURFACES * FLOATS_PER_SURFACE)
): { data: Float32Array; count: number } {
	const screen: Box = { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
	let count = 0;
	for (const surface of surfaces) {
		if (count >= MAX_SURFACES) break;
		const { rect } = surface;
		if (surface.opacity <= 0 || isEmpty(rect)) continue;
		const clip = intersect(surface.clip, screen);
		if (isEmpty(intersect(grow(rect, margin), clip))) continue;
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		const o = count * FLOATS_PER_SURFACE;
		out[o] = rect.left * scale;
		out[o + 1] = rect.top * scale;
		out[o + 2] = width * scale;
		out[o + 3] = height * scale;
		out[o + 4] = clip.left * scale;
		out[o + 5] = clip.top * scale;
		out[o + 6] = clip.right * scale;
		out[o + 7] = clip.bottom * scale;
		out[o + 8] = Math.min(surface.radius, width / 2, height / 2) * scale;
		out[o + 9] = Math.min(1, Math.max(0, surface.depth));
		out[o + 10] = Math.min(1, surface.opacity);
		out[o + 11] = VARIANTS[surface.variant];
		out[o + 12] = Math.min(1, Math.max(-1, surface.lift ?? 0));
		out[o + 13] = 0;
		out[o + 14] = 0;
		out[o + 15] = 0;
		count++;
	}
	return { data: out, count };
}
