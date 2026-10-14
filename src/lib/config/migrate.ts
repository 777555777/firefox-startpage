import { CONFIG_VERSION } from './defaults';
import { isRecord, record } from './parse';
import type { Config, Language } from './types';
import { parseConfig } from './validate';

/**
 * Eine Migration hebt die rohe Config von Version `n` auf `n + 1`. Sie arbeitet auf
 * ungeprüften Daten und muss daher defensiv sein. Validiert wird erst ganz am Ende.
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Migrationen, Index = Ausgangsversion. Beispiel: `MIGRATIONS[1]` hebt v1 auf v2 */
export const MIGRATIONS: Record<number, Migration> = {
	/**
	 * v2: Spalten bestehen aus Zeilen (Widgets nebeneinander), Breiten im 24er- statt 12er-Raster,
	 * getrennte Abstände für Spalten und Panels. Jedes Widget wird zur eigenen Zeile.
	 */
	1: (raw) => {
		const { columnItems, columnWidths, gap, ...layout } = record(raw.layout);
		const columns = Array.isArray(columnItems) ? columnItems : [];
		return {
			...raw,
			layout: {
				...layout,
				columnRows: columns.map((column) =>
					Array.isArray(column) ? column.map((id) => ({ items: [id], spans: [] })) : []
				),
				// Breiten werden ohnehin proportional auf das Raster gebracht
				columnWidths,
				columnGap: gap,
				panelGap: gap
			}
		};
	},

	/**
	 * v3: statt 1–4 gleichrangiger Spalten eine Mittelspalte mit zwei Seitenspalten. Bei drei
	 * Spalten wird die mittlere zur Mitte, bei zwei die erste (die zweite rechts), bei vier
	 * teilen sich die beiden mittleren die Mitte. Die Breite der Mitte folgt den alten Anteilen.
	 */
	2: (raw) => {
		const { columns: _columns, columnRows, columnWidths, ...layout } = record(raw.layout);
		const rows = Array.isArray(columnRows) ? columnRows : [];
		const column = (i: number): unknown[] => (Array.isArray(rows[i]) ? rows[i] : []);
		const widths = Array.isArray(columnWidths) ? columnWidths : [];
		const width = (i: number) => {
			const value = widths[i];
			return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
		};

		let center: unknown[] = column(0);
		let right: unknown[] = [];
		let left: unknown[] = [];
		// Anteil der Mitte an Mitte + zwei Seiten
		let share = 0.5;
		if (rows.length === 2) {
			right = column(1);
			share = width(0) / (width(0) + 2 * width(1));
		} else if (rows.length === 3) {
			[left, center, right] = [column(0), column(1), column(2)];
			share = width(1) / (width(0) + width(1) + width(2));
		} else if (rows.length >= 4) {
			left = column(0);
			center = [...column(1), ...column(2)];
			right = rows.slice(3).flatMap((_, i) => column(3 + i));
			const total = rows.reduce<number>((sum, _, i) => sum + width(i), 0);
			share = (width(1) + width(2)) / total;
		}
		return {
			...raw,
			layout: {
				...layout,
				columnRows: [center, right, left],
				sides: { left: rows.length >= 3, right: rows.length >= 2 },
				centerSpan: share * 24
			}
		};
	}
};

/** Liest die Schema-Version; fehlt sie, gilt die erste Version */
export function rawVersion(raw: Record<string, unknown>): number {
	const version = raw.version;
	return typeof version === 'number' && Number.isInteger(version) && version > 0 ? version : 1;
}

/**
 * Bringt beliebige gespeicherte oder importierte Daten auf die aktuelle Version und validiert
 * sie. Wirft nie. Daten aus einer neueren Version werden so gut wie möglich gelesen.
 */
export function migrate(
	raw: unknown,
	fallbackLanguage: Language = 'en',
	migrations: Record<number, Migration> = MIGRATIONS,
	targetVersion = CONFIG_VERSION
): Config {
	if (!isRecord(raw)) return parseConfig(undefined, fallbackLanguage);
	let data = raw;
	let version = rawVersion(data);
	while (version < targetVersion) {
		const step = migrations[version];
		if (step) {
			try {
				data = step(structuredClone(data));
			} catch (error) {
				console.warn(`Migration von v${version} fehlgeschlagen`, error);
			}
		}
		version++;
		data = { ...data, version };
	}
	return parseConfig(data, fallbackLanguage);
}
