import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { getMedia } from '$lib/storage/media';

export type MediaStatus = 'loading' | 'ready' | 'missing';

type Entry = {
	status: MediaStatus;
	blob: Blob | null;
	url: string | null;
	users: number;
};

/**
 * Lädt Medien aus IndexedDB bei Bedarf und stellt sie als Blob und Object-URL bereit. Wer ein
 * Medium braucht, hält es mit `retain` fest; ohne Nutzer wird die URL wieder freigegeben.
 */
class MediaLibrary {
	#entries = new SvelteMap<string, Entry>();

	/** Hält ein Medium geladen; liefert die Freigabe (passt als `$effect`-Cleanup) */
	retain(id: string): () => void {
		// Aufrufer ist meist ein Effekt, der nicht vom Ladezustand abhängen soll
		return untrack(() => this.#retain(id));
	}

	#retain(id: string): () => void {
		let entry = this.#entries.get(id);
		if (!entry) {
			entry = { status: 'loading', blob: null, url: null, users: 0 };
			this.#entries.set(id, entry);
			void this.#load(id);
		}
		entry.users++;
		return () => {
			const current = this.#entries.get(id);
			if (!current) return;
			current.users--;
			// Kurz warten, damit ein Wechsel zwischen zwei Nutzern nicht neu lädt
			setTimeout(() => {
				const latest = this.#entries.get(id);
				if (latest && latest.users <= 0) {
					if (latest.url) URL.revokeObjectURL(latest.url);
					this.#entries.delete(id);
				}
			}, 1000);
		};
	}

	status(id: string): MediaStatus {
		return this.#entries.get(id)?.status ?? 'loading';
	}

	url(id: string): string | null {
		return this.#entries.get(id)?.url ?? null;
	}

	blob(id: string): Blob | null {
		return this.#entries.get(id)?.blob ?? null;
	}

	async #load(id: string) {
		const blob = await getMedia(id);
		const entry = this.#entries.get(id);
		if (!entry) return;
		// Neu setzen, damit SvelteMap die Änderung meldet
		this.#entries.set(id, {
			...entry,
			status: blob ? 'ready' : 'missing',
			blob,
			url: blob ? URL.createObjectURL(blob) : null
		});
	}
}

export const mediaLibrary = new MediaLibrary();
