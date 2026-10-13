import { describe, expect, it } from 'vitest';
import { FLOATS_PER_SURFACE, MAX_SURFACES, packSurfaces, type SurfaceSnapshot } from './pack';

const viewport = { width: 1000, height: 800 };
const screen = { left: 0, top: 0, right: 1000, bottom: 800 };

const surface = (overrides: Partial<SurfaceSnapshot> = {}): SurfaceSnapshot => ({
	rect: { left: 100, top: 50, right: 400, bottom: 250 },
	clip: screen,
	radius: 24,
	depth: 1,
	opacity: 1,
	variant: 'panel',
	...overrides
});

describe('Glasflächen packen', () => {
	it('rechnet in Gerätepixel um', () => {
		const { data, count } = packSurfaces([surface()], viewport, 2, 40);
		expect(count).toBe(1);
		expect([...data.slice(0, FLOATS_PER_SURFACE)]).toEqual([
			200, 100, 600, 400, 0, 0, 2000, 1600, 48, 1, 1, 0, 0, 0, 0, 0
		]);
	});

	it('übernimmt den Interaktionszustand, begrenzt auf -1 … 1', () => {
		const { data } = packSurfaces([surface({ lift: 0.5 }), surface({ lift: -3 })], viewport, 1, 0);
		expect(data[12]).toBe(0.5);
		expect(data[FLOATS_PER_SURFACE + 12]).toBe(-1);
	});

	it('begrenzt den Radius auf die halbe Kante', () => {
		const { data } = packSurfaces(
			[surface({ rect: { left: 0, top: 0, right: 100, bottom: 30 }, radius: 99 })],
			viewport,
			1,
			0
		);
		expect(data[8]).toBe(15);
	});

	it('lässt unsichtbare und weggescrollte Flächen weg', () => {
		const column = { left: 0, top: 100, right: 500, bottom: 800 };
		const { count } = packSurfaces(
			[
				surface({ opacity: 0 }),
				// komplett oberhalb des Scroll-Containers, auch mit Schatten
				surface({ rect: { left: 10, top: -400, right: 400, bottom: 40 }, clip: column }),
				// außerhalb des Fensters
				surface({ rect: { left: 1200, top: 0, right: 1500, bottom: 200 } }),
				// teilweise sichtbar
				surface({ rect: { left: 10, top: -100, right: 400, bottom: 150 }, clip: column })
			],
			viewport,
			1,
			20
		);
		expect(count).toBe(1);
	});

	it('zählt den Schatten zur sichtbaren Fläche', () => {
		const column = { left: 0, top: 100, right: 500, bottom: 800 };
		const justAbove = surface({ rect: { left: 10, top: 0, right: 400, bottom: 90 }, clip: column });
		expect(packSurfaces([justAbove], viewport, 1, 0).count).toBe(0);
		expect(packSurfaces([justAbove], viewport, 1, 20).count).toBe(1);
	});

	it('zeichnet höchstens 64 Flächen', () => {
		const many = Array.from({ length: 80 }, () => surface());
		expect(packSurfaces(many, viewport, 1, 0).count).toBe(MAX_SURFACES);
	});
});
