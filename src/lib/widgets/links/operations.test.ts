import { describe, expect, it } from 'vitest';
import { parseLinksSettings } from './settings';
import { findLink, insertLink, moveLink, moveTab, removeLink, removeTab } from './operations';

function board() {
	return parseLinksSettings({
		activeTabId: 'b',
		tabs: [
			{
				id: 'a',
				links: [
					{ id: '1', label: 'Eins', url: 'https://1.de' },
					{ id: '2', label: 'Zwei', url: 'https://2.de' },
					{ id: '3', label: 'Drei', url: 'https://3.de' }
				]
			},
			{ id: 'b', links: [{ id: '4', label: 'Vier', url: 'https://4.de' }] },
			{ id: 'c', links: [] }
		]
	});
}

const ids = (b: ReturnType<typeof board>) => b.tabs.map((t) => t.links.map((l) => l.id));

describe('Link-Board-Operationen', () => {
	it('sortiert innerhalb eines Tabs', () => {
		const b = board();
		moveLink(b, '1', 'a', 2);
		expect(ids(b)[0]).toEqual(['2', '3', '1']);
	});

	it('verschiebt in einen anderen Tab, ohne Index ans Ende', () => {
		const b = board();
		moveLink(b, '2', 'b');
		expect(ids(b)).toEqual([['1', '3'], ['4', '2'], []]);
		moveLink(b, '4', 'c', 99);
		expect(ids(b)).toEqual([['1', '3'], ['2'], ['4']]);
	});

	it('entfernt und fügt wieder an derselben Stelle ein (Rückgängig)', () => {
		const b = board();
		const removed = removeLink(b, '2')!;
		expect(ids(b)[0]).toEqual(['1', '3']);
		insertLink(b, removed.tabId, removed.link, removed.index);
		expect(ids(b)[0]).toEqual(['1', '2', '3']);
		expect(findLink(b, '2')?.tab.id).toBe('a');
	});

	it('sortiert Tabs', () => {
		const b = board();
		moveTab(b, 'c', 0);
		expect(b.tabs.map((t) => t.id)).toEqual(['c', 'a', 'b']);
	});

	it('löscht Tabs, aber nie den letzten, und wählt einen Nachbarn aus', () => {
		const b = board();
		expect(removeTab(b, 'b')?.index).toBe(1);
		expect(b.activeTabId).toBe('a');
		removeTab(b, 'c');
		expect(removeTab(b, 'a')).toBeNull();
		expect(b.tabs).toHaveLength(1);
	});
});
