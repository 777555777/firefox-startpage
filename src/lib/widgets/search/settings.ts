import { bool, record } from '$lib/config/parse';

export type SearchSettings = {
	/** Passende Links aus den Link-Boards beim Tippen vorschlagen */
	suggestLinks: boolean;
};

export const defaultSearchSettings = (): SearchSettings => ({ suggestLinks: true });

export function parseSearchSettings(raw: unknown): SearchSettings {
	const d = defaultSearchSettings();
	const r = record(raw);
	return { suggestLinks: bool(r.suggestLinks, d.suggestLinks) };
}
