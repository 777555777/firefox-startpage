import {
	array,
	bool,
	createId,
	imageDataUrl,
	nonEmpty,
	oneOf,
	record,
	str,
	uniqueId
} from '$lib/config/parse';

export type LinkTarget = 'self' | 'blank';
export type LinkView = 'capsules' | 'tiles' | 'list';

export type Link = {
	id: string;
	label: string;
	/** http(s) oder App-Schema wie `vscode://` */
	url: string;
	target: LinkTarget;
	/** Eigenes Icon als kleine Data-URL; null = Favicon bzw. Anfangsbuchstabe */
	icon: string | null;
};

export type LinkTab = {
	id: string;
	label: string;
	/** Optionales Icon, z. B. ein Emoji; leer = keins */
	icon: string;
	view: LinkView;
	links: Link[];
};

export type LinksSettings = {
	tabs: LinkTab[];
	activeTabId: string;
	/** Klickzahl als Badge anzeigen */
	showStats: boolean;
};

export const LINK_VIEWS: readonly LinkView[] = ['capsules', 'tiles', 'list'];

export function createTab(label = '', view: LinkView = 'tiles'): LinkTab {
	return { id: createId(), label, icon: '', view, links: [] };
}

export const defaultLinksSettings = (): LinksSettings => {
	const tab = createTab();
	return { tabs: [tab], activeTabId: tab.id, showStats: false };
};

/** Prüft eine URL; `javascript:` und `data:` sind als Link-Ziel nicht erlaubt */
export function normalizeLinkUrl(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed);
		if (['javascript:', 'data:', 'vbscript:'].includes(url.protocol)) return null;
		return trimmed;
	} catch {
		// Ohne Schema eingegeben, z. B. `github.com` → https annehmen
		if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(trimmed)) return `https://${trimmed}`;
		return null;
	}
}

function parseLink(raw: unknown, seen: Set<string>): Link | null {
	const r = record(raw);
	const url = typeof r.url === 'string' ? normalizeLinkUrl(r.url) : null;
	if (!url) return null;
	return {
		id: uniqueId(r.id, seen),
		label: str(r.label, '', 200).trim(),
		url,
		target: oneOf(r.target, ['self', 'blank'], 'self'),
		icon: imageDataUrl(r.icon)
	};
}

function parseTab(raw: unknown, seen: Set<string>): LinkTab {
	const r = record(raw);
	return {
		id: uniqueId(r.id, seen),
		label: str(r.label, '', 100).trim(),
		icon: str(r.icon, '', 16).trim(),
		view: oneOf(r.view, LINK_VIEWS, 'tiles'),
		links: array(r.links)
			.map((link) => parseLink(link, seen))
			.filter((link) => link !== null)
	};
}

export function parseLinksSettings(raw: unknown): LinksSettings {
	const r = record(raw);
	const seen = new Set<string>();
	const tabs = array(r.tabs)
		.filter((tab) => typeof tab === 'object' && tab !== null)
		.map((tab) => parseTab(tab, seen));
	if (tabs.length === 0) tabs.push(createTab());
	const activeTabId = nonEmpty(r.activeTabId, '');
	return {
		tabs,
		activeTabId: tabs.some((tab) => tab.id === activeTabId) ? activeTabId : tabs[0].id,
		showStats: bool(r.showStats, false)
	};
}
