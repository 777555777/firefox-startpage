import type { BackgroundConfig } from '$lib/config/types';
import { rgbCss, type Grade } from '$lib/theme/palette';

/**
 * Kleines Standbild des eigenen Hintergrunds für den allerersten Paint des nächsten Tabs.
 * Bis das Medium aus IndexedDB gelesen und dekodiert ist, steht es als Hintergrund des
 * `<html>`-Elements da, statt dass kurz der Himmelsverlauf aufblitzt.
 */

const POSTER_KEY = 'startpage:poster';
/** Breite des Standbilds in px; es ist nur Bruchteile einer Sekunde zu sehen */
const POSTER_WIDTH = 640;

export type Poster = {
	url: string;
	size: 'cover' | 'contain';
	/** `background-position`, z. B. „50% 30%“ */
	position: string;
};

type Look = Pick<BackgroundConfig, 'fit' | 'focus'> & { grade: Grade };

/**
 * Hält ein Standbild fest: das Bild bzw. den ersten Frame des Videos, verkleinert und mit dem
 * aktuellen Grading eingefärbt (wie die Static-Stufe: Filter, dann Soft Light).
 */
export function capturePoster(
	element: CanvasImageSource,
	width: number,
	height: number,
	look: Look
): void {
	if (width <= 0 || height <= 0) return;
	try {
		const scale = Math.min(1, POSTER_WIDTH / width);
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		const context = canvas.getContext('2d');
		if (!context) return;
		const { grade } = look;
		context.filter = `saturate(${grade.saturation}) brightness(${grade.brightness}) contrast(${grade.contrast})`;
		context.drawImage(element, 0, 0, canvas.width, canvas.height);
		context.filter = 'none';
		if (grade.amount > 0) {
			context.globalCompositeOperation = 'soft-light';
			context.globalAlpha = Math.min(1, grade.amount * 2);
			context.fillStyle = `rgb(${rgbCss(grade.tint)})`;
			context.fillRect(0, 0, canvas.width, canvas.height);
		}
		const poster: Poster = {
			url: canvas.toDataURL('image/jpeg', 0.72),
			size: look.fit,
			position: `${look.focus.x * 100}% ${look.focus.y * 100}%`
		};
		localStorage.setItem(POSTER_KEY, JSON.stringify(poster));
	} catch {
		// Kein Standbild (z. B. voller Speicher): dann startet der Tab mit der Grundfarbe
	}
}

export function readPoster(): Poster | null {
	try {
		const poster = JSON.parse(localStorage.getItem(POSTER_KEY) ?? 'null') as Poster | null;
		if (!poster || !poster.url.startsWith('data:image/')) return null;
		return poster;
	} catch {
		return null;
	}
}

/** Ohne eigenen Hintergrund gibt es kein Standbild, sonst stünde es beim nächsten Tab falsch da */
export function clearPoster(root: HTMLElement = document.documentElement): void {
	try {
		localStorage.removeItem(POSTER_KEY);
	} catch {
		// nichts zu tun
	}
	root.style.removeProperty('background-image');
}

/** Setzt das Standbild als Hintergrund des Wurzelelements (vor dem Mounten der App) */
export function applyPoster(root: HTMLElement = document.documentElement): void {
	const poster = readPoster();
	if (!poster) return;
	root.style.backgroundImage = `url("${poster.url}")`;
	root.style.backgroundSize = poster.size;
	root.style.backgroundPosition = poster.position;
	root.style.backgroundRepeat = 'no-repeat';
}
