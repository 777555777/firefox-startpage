import type { KeyValueStore } from '$lib/storage/kv';

export const SAVE_DELAY_MS = 300;

/** Wie viele eigene Schreibvorgänge erinnert werden, um ihr Echo zu erkennen */
const ECHO_MEMORY = 8;

type Options<T> = {
	key: string;
	/** Validiert Rohdaten aus dem Speicher; wirft nie */
	parse: (raw: unknown) => T;
	/** Wird gemeldet, wenn Speichern fehlschlägt bzw. wieder klappt */
	onSaveResult?: (ok: boolean) => void;
	delay?: number;
};

/**
 * Ein reaktiver Wert, der debounced im Key-Value-Speicher landet und Änderungen aus anderen
 * Tabs übernimmt. Gespeichert wird immer die validierte Form, damit das Echo des eigenen
 * Schreibvorgangs (storage.onChanged meldet auch diesen) zuverlässig erkannt wird.
 */
export class SyncedValue<T> {
	value: T = $state() as T;
	/** Speichern ist gesperrt, z. B. wenn das Laden fehlschlug und sonst Daten überschrieben würden */
	readonly = $state(false);

	#kv: KeyValueStore;
	#options: Options<T>;
	#lastJson = '';
	#echoes: string[] = [];
	#timer: ReturnType<typeof setTimeout> | undefined;
	#cleanup: (() => void)[] = [];

	constructor(kv: KeyValueStore, initial: T, options: Options<T>) {
		this.#kv = kv;
		this.#options = options;
		this.value = initial;
	}

	/**
	 * Lädt den gespeicherten Wert. Fehlt er, bleibt der Startwert und wird gespeichert.
	 * Liefert `false`, wenn der Speicher nicht lesbar war.
	 */
	async load(): Promise<boolean> {
		const result = await this.#kv.get(this.#options.key);
		if (!result.ok) {
			// Nicht überschreiben, was vielleicht doch noch im Speicher liegt
			this.readonly = true;
			return false;
		}
		if (result.value === undefined) {
			await this.save();
		} else {
			const parsed = this.#options.parse(result.value);
			this.value = parsed;
			const json = JSON.stringify(parsed);
			// Wurde beim Validieren/Migrieren etwas geändert, gleich zurückschreiben
			if (json === JSON.stringify(result.value)) this.#lastJson = json;
			else await this.save();
		}
		return true;
	}

	/** Startet Autosave und Tab-Synchronisation; liefert eine Aufräumfunktion */
	start(): () => void {
		this.#cleanup.push(
			$effect.root(() => {
				$effect(() => {
					// JSON.stringify liest den ganzen Baum und abonniert damit jede Änderung
					const json = JSON.stringify(this.value);
					if (json !== this.#lastJson) this.#schedule();
				});
			}),
			this.#kv.subscribe((key, raw) => {
				if (key === this.#options.key) this.#receive(raw);
			})
		);
		return () => this.stop();
	}

	stop() {
		clearTimeout(this.#timer);
		for (const fn of this.#cleanup.splice(0)) fn();
	}

	/** Ersetzt den Wert komplett (Import, Zurücksetzen) und speichert sofort */
	async replace(value: T): Promise<boolean> {
		this.value = value;
		return this.save();
	}

	/** Speichert sofort, z. B. beim Verlassen der Seite */
	async save(): Promise<boolean> {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		if (this.readonly) return false;
		const normalized = this.#options.parse($state.snapshot(this.value));
		const json = JSON.stringify(normalized);
		if (json === this.#lastJson) return true;
		this.#lastJson = json;
		this.#echoes = [json, ...this.#echoes].slice(0, ECHO_MEMORY);
		const ok = await this.#kv.set(this.#options.key, JSON.parse(json));
		this.#options.onSaveResult?.(ok);
		return ok;
	}

	/** Ob noch ungespeicherte Änderungen anstehen */
	get pending() {
		return this.#timer !== undefined;
	}

	#schedule() {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.save(), this.#options.delay ?? SAVE_DELAY_MS);
	}

	#receive(raw: unknown) {
		const parsed = this.#options.parse(raw);
		const json = JSON.stringify(parsed);
		if (json === this.#lastJson || this.#echoes.includes(json)) return;
		// Änderung aus einem anderen Tab gewinnt; ein eigener, noch ausstehender Stand verfällt
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.#lastJson = json;
		this.value = parsed;
	}
}
