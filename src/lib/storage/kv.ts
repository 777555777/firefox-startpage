import { extensionApi } from './extension';

/**
 * Schlüssel-Wert-Speicher für JSON-Daten. In der Extension ist das `browser.storage.local`,
 * auf dem Dev-Server `localStorage`, und wenn beides fehlt ein flüchtiger Speicher.
 * Kein Aufruf wirft: Lesefehler liefern `{ ok: false }`, Schreibfehler `false`.
 */
export type ReadResult = { ok: true; value: unknown } | { ok: false };

export interface KeyValueStore {
	readonly kind: 'extension' | 'local' | 'memory';
	/** `value` ist `undefined`, wenn der Schlüssel fehlt */
	get(key: string): Promise<ReadResult>;
	set(key: string, value: unknown): Promise<boolean>;
	remove(key: string): Promise<boolean>;
	/** Meldet Änderungen aus anderen Tabs (und je nach Backend auch eigene) */
	subscribe(listener: (key: string, value: unknown) => void): () => void;
}

export function createExtensionStore(): KeyValueStore | undefined {
	const api = extensionApi();
	const area = api?.storage?.local;
	if (!api || !area) return undefined;

	return {
		kind: 'extension',
		async get(key) {
			try {
				return { ok: true, value: (await area.get(key))[key] };
			} catch (error) {
				console.warn('storage.local.get fehlgeschlagen', error);
				return { ok: false };
			}
		},
		async set(key, value) {
			try {
				await area.set({ [key]: value });
				return true;
			} catch (error) {
				console.warn('storage.local.set fehlgeschlagen', error);
				return false;
			}
		},
		async remove(key) {
			try {
				await area.remove(key);
				return true;
			} catch (error) {
				console.warn('storage.local.remove fehlgeschlagen', error);
				return false;
			}
		},
		subscribe(listener) {
			const handler = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
				if (areaName !== 'local') return;
				for (const [key, change] of Object.entries(changes)) listener(key, change.newValue);
			};
			api.storage.onChanged.addListener(handler);
			return () => api.storage.onChanged.removeListener(handler);
		}
	};
}

const LOCAL_PREFIX = 'startpage:';

/** Fallback für den Dev-Server: JSON in `localStorage`, Sync über das `storage`-Event */
export function createLocalStore(storage: Storage): KeyValueStore {
	return {
		kind: 'local',
		async get(key) {
			try {
				const raw = storage.getItem(LOCAL_PREFIX + key);
				return { ok: true, value: raw === null ? undefined : JSON.parse(raw) };
			} catch (error) {
				console.warn('localStorage lesen fehlgeschlagen', error);
				return { ok: false };
			}
		},
		async set(key, value) {
			try {
				storage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
				return true;
			} catch (error) {
				console.warn('localStorage schreiben fehlgeschlagen', error);
				return false;
			}
		},
		async remove(key) {
			try {
				storage.removeItem(LOCAL_PREFIX + key);
				return true;
			} catch {
				return false;
			}
		},
		subscribe(listener) {
			const handler = (event: StorageEvent) => {
				if (event.storageArea !== storage || !event.key?.startsWith(LOCAL_PREFIX)) return;
				let value: unknown;
				try {
					value = event.newValue === null ? undefined : JSON.parse(event.newValue);
				} catch {
					return;
				}
				listener(event.key.slice(LOCAL_PREFIX.length), value);
			};
			window.addEventListener('storage', handler);
			return () => window.removeEventListener('storage', handler);
		}
	};
}

/** Flüchtiger Speicher, z. B. für Tests oder wenn gar nichts anderes geht */
export function createMemoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
	const data = new Map(Object.entries(structuredClone(initial)));
	const listeners = new Set<(key: string, value: unknown) => void>();
	return {
		kind: 'memory',
		async get(key) {
			const value = data.get(key);
			return { ok: true, value: value === undefined ? undefined : structuredClone(value) };
		},
		async set(key, value) {
			data.set(key, structuredClone(value));
			// Wie storage.onChanged: auch eigene Schreibvorgänge werden gemeldet
			for (const listener of listeners) listener(key, structuredClone(value));
			return true;
		},
		async remove(key) {
			data.delete(key);
			for (const listener of listeners) listener(key, undefined);
			return true;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}

function localStorageOrNull(): Storage | null {
	try {
		const storage = globalThis.localStorage;
		// Zugriff kann z. B. bei blockierten Website-Daten werfen
		storage.getItem('startpage:probe');
		return storage;
	} catch {
		return null;
	}
}

/** Wählt das passende Backend für die aktuelle Umgebung */
export function createKeyValueStore(): KeyValueStore {
	const extension = createExtensionStore();
	if (extension) return extension;
	const local = localStorageOrNull();
	return local ? createLocalStore(local) : createMemoryStore();
}
