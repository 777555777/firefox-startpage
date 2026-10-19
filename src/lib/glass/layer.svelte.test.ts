import { afterEach, describe, expect, it } from 'vitest';
import { glass, glassLayer } from './layer';

const cleanups: (() => void)[] = [];

function surface(rect: { left: number; top: number; width: number; height: number }) {
	const element = document.createElement('section');
	element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height);
	document.body.append(element);
	return element;
}

function attach(element: HTMLElement, options: Parameters<typeof glass>[0] = {}) {
	const cleanup = glass(options)(element);
	if (cleanup) cleanups.push(cleanup);
	return cleanup;
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.innerHTML = '';
});

describe('Glas-Register', () => {
	it('liefert Flächen in DOM-Reihenfolge, höhere z-Werte zuletzt', () => {
		const first = surface({ left: 0, top: 0, width: 100, height: 50 });
		const second = surface({ left: 0, top: 100, width: 100, height: 50 });
		const overlay = surface({ left: 0, top: 200, width: 100, height: 50 });
		attach(overlay, { z: 10, variant: 'popover' });
		attach(second, { radius: 12 });
		attach(first, { depth: 0.5 });

		const { surfaces, changed } = glassLayer.sync();
		expect(changed).toBe(true);
		expect(surfaces.map((s) => s.rect.top)).toEqual([0, 100, 200]);
		expect(surfaces[0].depth).toBe(0.5);
		expect(surfaces[1].radius).toBe(12);
		expect(surfaces[2].variant).toBe('popover');
	});

	it('liest Rechtecke nur nach einer Änderung neu', () => {
		attach(surface({ left: 0, top: 0, width: 100, height: 50 }));
		expect(glassLayer.sync().changed).toBe(true);
		expect(glassLayer.sync().changed).toBe(false);
		glassLayer.invalidate();
		expect(glassLayer.sync().changed).toBe(true);
	});

	it('lässt verborgene Flächen ohne Rechteck weg', () => {
		attach(surface({ left: 0, top: 0, width: 100, height: 50 }));
		attach(surface({ left: 0, top: 0, width: 0, height: 0 }));
		expect(glassLayer.sync().surfaces).toHaveLength(1);
	});

	it('markiert Elemente und meldet sie wieder ab', () => {
		const element = surface({ left: 0, top: 0, width: 100, height: 50 });
		const cleanup = attach(element, { variant: 'button' });
		expect(element.dataset.glass).toBe('button');
		cleanup?.();
		expect(element.dataset.glass).toBeUndefined();
		expect(glassLayer.sync().surfaces).toHaveLength(0);
	});

	it('beschneidet Flächen auf ihren Scroll-Container', () => {
		const column = document.createElement('div');
		column.style.overflowY = 'auto';
		column.getBoundingClientRect = () => new DOMRect(0, 40, 300, 500);
		document.body.append(column);
		const element = surface({ left: 10, top: 0, width: 100, height: 80 });
		column.append(element);
		attach(element);
		const [snapshot] = glassLayer.sync().surfaces;
		expect(snapshot.clip.top).toBe(40);
	});
});
