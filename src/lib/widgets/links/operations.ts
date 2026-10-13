import type { Link, LinksSettings, LinkTab } from './settings';

/**
 * Operationen auf einem Link-Board. Sie ändern die übergebenen Settings direkt, damit sie
 * über `update(mutate)` auf dem gespeicherten Zustand laufen können.
 */

export function findLink(board: LinksSettings, linkId: string) {
	for (const tab of board.tabs) {
		const index = tab.links.findIndex((link) => link.id === linkId);
		if (index !== -1) return { tab, index, link: tab.links[index] };
	}
	return null;
}

/** Verschiebt einen Link in einen Tab an `index` (begrenzt); ohne Index ans Ende */
export function moveLink(board: LinksSettings, linkId: string, tabId: string, index?: number) {
	const found = findLink(board, linkId);
	const target = board.tabs.find((tab) => tab.id === tabId);
	if (!found || !target) return;
	found.tab.links.splice(found.index, 1);
	const at = Math.max(0, Math.min(index ?? target.links.length, target.links.length));
	target.links.splice(at, 0, found.link);
}

export function removeLink(board: LinksSettings, linkId: string) {
	const found = findLink(board, linkId);
	if (!found) return null;
	found.tab.links.splice(found.index, 1);
	return { tabId: found.tab.id, index: found.index, link: found.link };
}

export function insertLink(board: LinksSettings, tabId: string, link: Link, index?: number) {
	const tab = board.tabs.find((t) => t.id === tabId) ?? board.tabs[0];
	const at = Math.max(0, Math.min(index ?? tab.links.length, tab.links.length));
	tab.links.splice(at, 0, link);
}

export function moveTab(board: LinksSettings, tabId: string, index: number) {
	const from = board.tabs.findIndex((tab) => tab.id === tabId);
	if (from === -1) return;
	const [tab] = board.tabs.splice(from, 1);
	board.tabs.splice(Math.max(0, Math.min(index, board.tabs.length)), 0, tab);
}

/** Entfernt einen Tab; der letzte Tab bleibt immer erhalten */
export function removeTab(board: LinksSettings, tabId: string) {
	if (board.tabs.length <= 1) return null;
	const index = board.tabs.findIndex((tab) => tab.id === tabId);
	if (index === -1) return null;
	const [tab] = board.tabs.splice(index, 1);
	if (board.activeTabId === tabId) board.activeTabId = board.tabs[Math.max(0, index - 1)].id;
	return { index, tab };
}

export function insertTab(board: LinksSettings, tab: LinkTab, index = board.tabs.length) {
	board.tabs.splice(Math.max(0, Math.min(index, board.tabs.length)), 0, tab);
}
