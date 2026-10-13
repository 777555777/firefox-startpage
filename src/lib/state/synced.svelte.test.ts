import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type KeyValueStore } from '$lib/storage/kv';
import { SyncedValue } from './synced.svelte';

type Data = { name: string; items: string[] };

const parse = (raw: unknown): Data => {
	const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Data>;
	return {
		name: typeof r.name === 'string' ? r.name : 'default',
		items: Array.isArray(r.items) ? r.items.filter((i) => typeof i === 'string') : []
	};
};

function create(kv: KeyValueStore) {
	return new SyncedValue<Data>(kv, { name: 'default', items: [] }, { key: 'data', parse });
}

describe('SyncedValue', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('speichert beim Erststart den Startwert', async () => {
		const kv = createMemoryStore();
		await create(kv).load();
		expect(await kv.get('data')).toEqual({ ok: true, value: { name: 'default', items: [] } });
	});

	it('lädt gespeicherte Werte validiert und schreibt Korrekturen zurück', async () => {
		const kv = createMemoryStore({ data: { name: 'A', items: ['x', 3] } });
		const synced = create(kv);
		await synced.load();
		expect(synced.value).toEqual({ name: 'A', items: ['x'] });
		expect(await kv.get('data')).toEqual({ ok: true, value: { name: 'A', items: ['x'] } });
	});

	it('speichert Änderungen debounced', async () => {
		const kv = createMemoryStore();
		const synced = create(kv);
		await synced.load();
		const stop = synced.start();
		const set = vi.spyOn(kv, 'set');

		synced.value.items.push('a');
		flushSync();
		synced.value.items.push('b');
		flushSync();
		expect(set).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(300);
		expect(set).toHaveBeenCalledTimes(1);
		expect(set).toHaveBeenCalledWith('data', { name: 'default', items: ['a', 'b'] });
		stop();
	});

	it('übernimmt Änderungen aus anderen Tabs und ignoriert das eigene Echo', async () => {
		const kv = createMemoryStore();
		const synced = create(kv);
		await synced.load();
		const stop = synced.start();

		// Anderer Tab schreibt
		await kv.set('data', { name: 'Tab B', items: ['b'] });
		expect(synced.value).toEqual({ name: 'Tab B', items: ['b'] });

		// Übernahme löst kein erneutes Speichern aus
		const set = vi.spyOn(kv, 'set');
		flushSync();
		await vi.advanceTimersByTimeAsync(1000);
		expect(set).not.toHaveBeenCalled();

		// Eigenes Schreiben kommt als Echo zurück und ändert nichts
		synced.value.name = 'Tab A';
		flushSync();
		synced.value.name = 'Tab A2';
		await synced.save();
		expect(synced.value.name).toBe('Tab A2');
		stop();
	});

	it('verwirft einen ausstehenden eigenen Stand, wenn ein anderer Tab schreibt', async () => {
		const kv = createMemoryStore();
		const synced = create(kv);
		await synced.load();
		const stop = synced.start();

		synced.value.name = 'lokal';
		flushSync();
		await kv.set('data', { name: 'fern', items: [] });
		await vi.advanceTimersByTimeAsync(1000);
		expect(synced.value.name).toBe('fern');
		expect(await kv.get('data')).toEqual({ ok: true, value: { name: 'fern', items: [] } });
		stop();
	});

	it('überschreibt nichts, wenn der Speicher nicht lesbar war', async () => {
		const kv = createMemoryStore();
		vi.spyOn(kv, 'get').mockResolvedValue({ ok: false });
		const set = vi.spyOn(kv, 'set');
		const synced = create(kv);
		expect(await synced.load()).toBe(false);
		synced.value.name = 'neu';
		expect(await synced.save()).toBe(false);
		expect(set).not.toHaveBeenCalled();
	});

	it('meldet fehlgeschlagenes Speichern', async () => {
		const kv = createMemoryStore();
		vi.spyOn(kv, 'set').mockResolvedValue(false);
		const onSaveResult = vi.fn();
		const synced = new SyncedValue<Data>(
			kv,
			{ name: 'x', items: [] },
			{ key: 'data', parse, onSaveResult }
		);
		await synced.load();
		expect(onSaveResult).toHaveBeenCalledWith(false);
	});
});
