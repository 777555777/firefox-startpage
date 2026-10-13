import type { MediaRef } from '$lib/config/types';
import type { SceneSource } from './renderer';

export const SKY_SOURCE: SceneSource = { kind: 'sky', key: 'sky' };

/**
 * Bereitet ein Medium für den Renderer vor: Bilder als ImageBitmap (bei Bedarf verkleinert),
 * Videos als stummes Loop-Video. Liefert null, wenn die Datei nicht lesbar ist.
 */
export async function loadSceneSource(
	ref: MediaRef,
	blob: Blob,
	maxSize: number
): Promise<SceneSource | null> {
	try {
		return ref.kind === 'image' ? await loadImage(ref, blob, maxSize) : await loadVideo(ref, blob);
	} catch (error) {
		console.warn(`Hintergrund ${ref.name} nicht lesbar`, error);
		return null;
	}
}

async function loadImage(ref: MediaRef, blob: Blob, maxSize: number): Promise<SceneSource> {
	let bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
	const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
	if (scale < 1) {
		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);
		bitmap.close();
		bitmap = await createImageBitmap(blob, {
			imageOrientation: 'from-image',
			resizeWidth: width,
			resizeHeight: height,
			resizeQuality: 'high'
		});
	}
	return {
		kind: 'image',
		key: ref.id,
		element: bitmap,
		width: bitmap.width,
		height: bitmap.height,
		release: () => bitmap.close()
	};
}

async function loadVideo(ref: MediaRef, blob: Blob): Promise<SceneSource> {
	// Eigene URL, damit das Video unabhängig vom Medien-Cache weiterläuft
	const url = URL.createObjectURL(blob);
	const video = document.createElement('video');
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.preload = 'auto';
	video.src = url;
	try {
		await new Promise<void>((resolve, reject) => {
			video.addEventListener('loadeddata', () => resolve(), { once: true });
			video.addEventListener('error', () => reject(video.error), { once: true });
		});
	} catch (error) {
		URL.revokeObjectURL(url);
		throw error;
	}
	return {
		kind: 'video',
		key: ref.id,
		element: video,
		width: video.videoWidth,
		height: video.videoHeight,
		release: () => {
			video.pause();
			video.removeAttribute('src');
			video.load();
			URL.revokeObjectURL(url);
		}
	};
}
