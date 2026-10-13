import { describe, expect, it } from 'vitest';
import type { BackgroundConfig, MediaRef } from '$lib/config/types';
import { activeRef, fitTransform, mediaKindOf, refOf, unusedMedia } from './media-utils';

const ref = (id: string, kind: MediaRef['kind'] = 'image'): MediaRef => ({ id, kind, name: id });

describe('Hintergrund-Dateien', () => {
	it('erkennt unterstützte Bilder und Videos', () => {
		expect(mediaKindOf({ type: 'image/avif', name: 'a.avif' })).toBe('image');
		expect(mediaKindOf({ type: 'video/webm', name: 'a.webm' })).toBe('video');
		expect(mediaKindOf({ type: 'image/gif', name: 'a.gif' })).toBeNull();
		expect(mediaKindOf({ type: 'application/pdf', name: 'a.mp4' })).toBeNull();
		// ohne MIME-Typ entscheidet die Endung
		expect(mediaKindOf({ type: '', name: 'Strand.JPG' })).toBe('image');
		expect(mediaKindOf({ type: '', name: 'clip.mp4' })).toBe('video');
		expect(mediaKindOf({ type: '', name: 'notes.txt' })).toBeNull();
	});

	it('wählt den Slot der Phase, sonst den Haupt-Hintergrund', () => {
		const background: BackgroundConfig = {
			main: ref('main'),
			slots: { night: ref('night', 'video') },
			fit: 'cover',
			focus: { x: 0.5, y: 0.5 }
		};
		expect(activeRef(background, 'night')?.id).toBe('night');
		expect(activeRef(background, 'day')?.id).toBe('main');
		expect(activeRef({ ...background, main: null }, 'day')).toBeNull();
		expect(refOf(background, 'main')?.id).toBe('main');
		expect(refOf(background, 'morning')).toBeNull();
	});

	it('findet Medien ohne Verweis', () => {
		expect(unusedMedia(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
		expect(unusedMedia([], ['b'])).toEqual([]);
	});
});

describe('Bildausschnitt', () => {
	const view = { width: 1600, height: 900 };

	it('füllt bei cover die Fläche und richtet am Fokuspunkt aus', () => {
		// Hochformat: Höhe wird beschnitten
		const media = { width: 1000, height: 1000 };
		const centered = fitTransform('cover', { x: 0.5, y: 0.5 }, media, view);
		expect(centered.scale[0]).toBeCloseTo(1);
		expect(centered.scale[1]).toBeCloseTo(900 / 1600);
		expect(centered.offset[1]).toBeCloseTo((1 - 900 / 1600) / 2);
		// Fokus oben: Ausschnitt beginnt am oberen Rand
		expect(fitTransform('cover', { x: 0.5, y: 0 }, media, view).offset[1]).toBeCloseTo(0);
		// Fokus unten: Ausschnitt endet am unteren Rand
		const bottom = fitTransform('cover', { x: 0.5, y: 1 }, media, view);
		expect(bottom.offset[1] + bottom.scale[1]).toBeCloseTo(1);
	});

	it('zeigt bei contain das ganze Bild mit Rand', () => {
		const media = { width: 1000, height: 1000 };
		const { scale, offset } = fitTransform('contain', { x: 0.5, y: 0.5 }, media, view);
		expect(scale[1]).toBeCloseTo(1);
		expect(scale[0]).toBeCloseTo(1600 / 900);
		// Links und rechts liegt der Bildschirm außerhalb der Textur
		expect(offset[0]).toBeLessThan(0);
		expect(offset[0] + scale[0]).toBeGreaterThan(1);
	});

	it('bleibt bei fehlenden Maßen neutral', () => {
		expect(fitTransform('cover', { x: 0.5, y: 0.5 }, { width: 0, height: 0 }, view)).toEqual({
			scale: [1, 1],
			offset: [0, 0]
		});
	});
});
