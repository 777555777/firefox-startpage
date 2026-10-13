/**
 * Kleine Bausteine für die Validierung. Keiner davon wirft: Ungültiges wird durch den
 * Fallback ersetzt, damit eine kaputte Config nie die Page reißt.
 */

export const createId = () => crypto.randomUUID();

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Liefert ein Objekt zum Weiterlesen; bei Nicht-Objekten ein leeres */
export function record(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

export function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

export function oneOf<const T extends string | number>(
	value: unknown,
	options: readonly T[],
	fallback: T
): T {
	return options.includes(value as T) ? (value as T) : fallback;
}

/** Zahl im Bereich [min, max]; Werte außerhalb werden begrenzt */
export function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

export function int(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
	return Math.round(num(value, fallback, min, max));
}

export function str(value: unknown, fallback: string, maxLength = 2000): string {
	return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

/** Nicht-leerer String oder Fallback */
export function nonEmpty(value: unknown, fallback: string, maxLength = 2000): string {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

export function array(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

export function hexColor(value: unknown, fallback: string): string {
	if (typeof value !== 'string') return fallback;
	const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
	if (!match) return fallback;
	const hex = match[1].toLowerCase();
	return hex.length === 3
		? `#${hex
				.split('')
				.map((c) => c + c)
				.join('')}`
		: `#${hex}`;
}

/** Data-URL eines Bildes mit Größenlimit (für eigene Link-Icons) */
export function imageDataUrl(value: unknown, maxLength = 200_000): string | null {
	return typeof value === 'string' && value.startsWith('data:image/') && value.length <= maxLength
		? value
		: null;
}

/**
 * Sorgt für eindeutige IDs in einer Liste. Fehlende oder doppelte IDs werden neu vergeben,
 * `seen` kann über mehrere Listen geteilt werden.
 */
export function uniqueId(value: unknown, seen: Set<string>): string {
	let id = typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : createId();
	while (seen.has(id)) id = createId();
	seen.add(id);
	return id;
}
