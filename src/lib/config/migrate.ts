import { CONFIG_VERSION } from './defaults';
import { isRecord } from './parse';
import type { Config, Language } from './types';
import { parseConfig } from './validate';

/**
 * Eine Migration hebt die rohe Config von Version `n` auf `n + 1`. Sie arbeitet auf
 * ungeprüften Daten und muss daher defensiv sein. Validiert wird erst ganz am Ende.
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Migrationen, Index = Ausgangsversion. Beispiel: `MIGRATIONS[1]` hebt v1 auf v2 */
export const MIGRATIONS: Record<number, Migration> = {};

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
