import type { Config } from '$lib/config/types';
import type { Link, LinksSettings } from './settings';

/** Favicon direkt von der Seite selbst (kein Drittanbieter); nur für http(s)-Links */
export function faviconUrl(url: string): string | null {
	try {
		const { protocol, origin } = new URL(url);
		return protocol === 'http:' || protocol === 'https:' ? `${origin}/favicon.ico` : null;
	} catch {
		return null;
	}
}

/** Domain für die Anzeige, z. B. `github.com`; bei App-Schemata das Schema */
export function displayHost(url: string): string {
	try {
		const { protocol, hostname } = new URL(url);
		const isWeb = protocol === 'http:' || protocol === 'https:';
		return isWeb ? hostname.replace(/^www\./, '') : protocol.replace(/:$/, '');
	} catch {
		return url;
	}
}

/** Anzeigename eines Links; ohne Label die Domain */
export function linkTitle(link: Pick<Link, 'label' | 'url'>): string {
	return link.label || displayHost(link.url);
}

/** Anfangsbuchstabe für das Ersatz-Icon */
export function initialOf(text: string): string {
	return (text.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase();
}

export type FlatLink = Link & { host: string; boardId: string; tabId: string };

/** Alle Links aller Boards, z. B. für die Suche */
export function allLinks(config: Config): FlatLink[] {
	const links: FlatLink[] = [];
	for (const column of config.layout.columnItems) {
		for (const id of column) {
			const widget = config.widgets[id];
			if (widget?.type !== 'links') continue;
			const board = widget.settings as LinksSettings;
			for (const tab of board.tabs) {
				for (const link of tab.links) {
					links.push({ ...link, host: displayHost(link.url), boardId: id, tabId: tab.id });
				}
			}
		}
	}
	return links;
}

/**
 * Öffnet einen Link. `newTab` erzwingt einen neuen Tab (z. B. Strg/Cmd+Enter), sonst gilt das
 * Ziel des Links.
 */
export function openUrl(url: string, newTab: boolean) {
	if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
	else window.location.assign(url);
}

/** Verkleinert ein hochgeladenes Bild auf eine kleine Data-URL für die Config */
export async function imageToDataUrl(file: File, size = 64): Promise<string | null> {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		return canvas.toDataURL('image/png');
	} catch {
		return null;
	}
}
