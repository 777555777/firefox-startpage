import { createId } from '$lib/config/parse';
import type { MediaRef } from '$lib/config/types';

/**
 * Hochgeladene Hintergründe (Bilder/Videos) als Blobs in IndexedDB. In der Config steht nur
 * ihre ID. Alle Funktionen sind fehlertolerant und werfen nicht.
 */

const DB_NAME = 'startpage';
const DB_VERSION = 1;
const STORE = 'media';

type MediaRecord = MediaRef & { blob: Blob; size: number; createdAt: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
	dbPromise ??= new Promise((resolve) => {
		try {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(STORE)) {
					request.result.createObjectStore(STORE, { keyPath: 'id' });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				console.warn('IndexedDB nicht verfügbar', request.error);
				resolve(null);
			};
		} catch (error) {
			console.warn('IndexedDB nicht verfügbar', error);
			resolve(null);
		}
	});
	return dbPromise;
}

async function run<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
	const db = await openDb();
	if (!db) return undefined;
	return new Promise((resolve) => {
		try {
			const request = action(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				console.warn('IndexedDB-Zugriff fehlgeschlagen', request.error);
				resolve(undefined);
			};
		} catch (error) {
			console.warn('IndexedDB-Zugriff fehlgeschlagen', error);
			resolve(undefined);
		}
	});
}

/** Speichert eine Datei; liefert die Referenz für die Config oder null bei Fehler */
export async function putMedia(file: File): Promise<MediaRef | null> {
	const kind = file.type.startsWith('video/') ? 'video' : 'image';
	const record: MediaRecord = {
		id: createId(),
		kind,
		name: file.name,
		blob: file,
		size: file.size,
		createdAt: Date.now()
	};
	const key = await run('readwrite', (store) => store.put(record));
	return key === undefined ? null : { id: record.id, kind, name: record.name };
}

export async function getMedia(id: string): Promise<Blob | null> {
	const record = (await run('readonly', (store) => store.get(id))) as MediaRecord | undefined;
	return record?.blob ?? null;
}

export async function hasMedia(id: string): Promise<boolean> {
	const count = await run('readonly', (store) => store.count(id));
	return (count ?? 0) > 0;
}

export async function deleteMedia(id: string): Promise<void> {
	await run('readwrite', (store) => store.delete(id));
}
