import type { BackgroundConfig, DayPhase, MediaRef } from '$lib/config/types';

/**
 * Reine Hilfsfunktionen für Hintergründe: erlaubte Dateien, welcher Hintergrund gerade gilt
 * und wie ein Bild bei `cover`/`contain` mit Fokuspunkt auf den Bildschirm abgebildet wird.
 */

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const ACCEPTED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

/** Ab dieser Größe gibt es eine Warnung (Speicherplatz, Ladezeit) */
export const LARGE_FILE_BYTES = 200 * 1024 * 1024;

const EXTENSIONS: Record<string, 'image' | 'video'> = {
	jpg: 'image',
	jpeg: 'image',
	png: 'image',
	webp: 'image',
	avif: 'image',
	mp4: 'video',
	m4v: 'video',
	webm: 'video'
};

/** Art einer Datei oder null, wenn sie nicht unterstützt wird. Ohne MIME-Typ zählt die Endung. */
export function mediaKindOf(file: { type: string; name: string }): MediaRef['kind'] | null {
	if (IMAGE_TYPES.includes(file.type)) return 'image';
	if (VIDEO_TYPES.includes(file.type)) return 'video';
	if (file.type) return null;
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	return EXTENSIONS[extension] ?? null;
}

export type BackgroundSlot = 'main' | DayPhase;

export function refOf(background: BackgroundConfig, slot: BackgroundSlot): MediaRef | null {
	return slot === 'main' ? background.main : (background.slots[slot] ?? null);
}

/** Hintergrund für eine Phase: eigener Slot, sonst der Haupt-Hintergrund, sonst null (Verlauf) */
export function activeRef(background: BackgroundConfig, phase: DayPhase): MediaRef | null {
	return background.slots[phase] ?? background.main;
}

/** Gespeicherte Medien, auf die nichts mehr verweist */
export function unusedMedia(stored: Iterable<string>, referenced: Iterable<string>): string[] {
	const keep = new Set(referenced);
	return [...stored].filter((id) => !keep.has(id));
}

export type Size = { width: number; height: number };

/**
 * Abbildung von Bildschirmkoordinaten (0..1, oben links) auf Texturkoordinaten des Mediums:
 * `uv = st * scale + offset`. Entspricht `object-fit` mit `object-position` in Prozent, der
 * Fokuspunkt bleibt also an derselben Stelle wie in der CSS-Darstellung.
 */
export function fitTransform(
	fit: BackgroundConfig['fit'],
	focus: BackgroundConfig['focus'],
	media: Size,
	view: Size
): { scale: [number, number]; offset: [number, number] } {
	if (media.width <= 0 || media.height <= 0 || view.width <= 0 || view.height <= 0) {
		return { scale: [1, 1], offset: [0, 0] };
	}
	const ratio =
		fit === 'cover'
			? Math.max(view.width / media.width, view.height / media.height)
			: Math.min(view.width / media.width, view.height / media.height);
	const width = media.width * ratio;
	const height = media.height * ratio;
	const left = (view.width - width) * focus.x;
	const top = (view.height - height) * focus.y;
	return {
		scale: [view.width / width, view.height / height],
		offset: [-left / width, -top / height]
	};
}
