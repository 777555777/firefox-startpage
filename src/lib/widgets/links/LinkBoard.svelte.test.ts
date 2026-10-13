import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'svelte';
import { createMemoryAppState } from '$lib/state/app.svelte';
import Harness from '$lib/test/Harness.svelte';
import type { WidgetProps } from '../types';
import LinkBoard from './LinkBoard.svelte';
import { parseLinksSettings, type LinksSettings } from './settings';

const settings = () =>
	parseLinksSettings({
		activeTabId: 'a',
		tabs: [
			{
				id: 'a',
				label: 'Eins',
				view: 'list',
				links: [
					{ id: '1', label: 'Alpha', url: 'https://alpha.example' },
					{ id: '2', label: 'Beta', url: 'https://beta.example' },
					{ id: '3', label: 'Gamma', url: 'https://gamma.example' }
				]
			},
			{
				id: 'b',
				label: 'Zwei',
				view: 'tiles',
				links: [{ id: '4', label: 'Delta', url: 'https://delta.example' }]
			}
		]
	});

async function setup() {
	const app = createMemoryAppState();
	await app.init();
	const board = $state(settings());
	const update = (mutate: (s: LinksSettings) => void) => mutate(board);
	render(Harness, {
		props: {
			app,
			component: LinkBoard as unknown as Component<Record<string, unknown>>,
			props: {
				id: 'board',
				settings: board,
				editing: false,
				update
			} satisfies WidgetProps<LinksSettings>
		}
	});
	return { app, board, user: userEvent.setup() };
}

describe('Link-Board', () => {
	const assign = vi.fn();
	const open = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('open', open);
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...window.location, assign }
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		assign.mockReset();
		open.mockReset();
	});

	it('hat genau einen Link im Tab-Fokus (Roving Tabindex) und bewegt ihn per Pfeiltasten', async () => {
		const { user } = await setup();
		const links = screen.getAllByRole('link');
		expect(links.map((l) => l.tabIndex)).toEqual([0, -1, -1]);

		links[0].focus();
		await user.keyboard('{ArrowDown}');
		expect(document.activeElement).toBe(links[1]);
		await user.keyboard('{End}');
		expect(document.activeElement).toBe(links[2]);
		await user.keyboard('{Home}');
		expect(document.activeElement).toBe(links[0]);
		expect(screen.getAllByRole('link').map((l) => l.tabIndex)).toEqual([0, -1, -1]);
	});

	it('öffnet mit Ziffern den n-ten Link und zählt die Statistik', async () => {
		const { app, user } = await setup();
		screen.getAllByRole('link')[0].focus();
		await user.keyboard('2');
		expect(assign).toHaveBeenCalledWith('https://beta.example');
		expect(app.stats.value['https://beta.example']?.count).toBe(1);
	});

	it('öffnet mit Strg+Enter in einem neuen Tab', async () => {
		const { user } = await setup();
		screen.getAllByRole('link')[2].focus();
		await user.keyboard('{Control>}{Enter}{/Control}');
		expect(open).toHaveBeenCalledWith('https://gamma.example', '_blank', 'noopener,noreferrer');
	});

	it('wechselt mit Alt+Ziffer und Pfeiltasten die Tabs', async () => {
		const { board, user } = await setup();
		screen.getAllByRole('link')[0].focus();
		await user.keyboard('{Alt>}2{/Alt}');
		expect(board.activeTabId).toBe('b');
		expect(screen.getByRole('tab', { name: 'Zwei' })).toHaveAttribute('aria-selected', 'true');
		expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Zwei' }));

		await user.keyboard('{ArrowLeft}');
		expect(board.activeTabId).toBe('a');
	});

	it('ignoriert Kürzel in Eingabefeldern', async () => {
		await setup();
		const input = document.createElement('input');
		screen.getAllByRole('link')[0].closest('[data-link-board]')!.append(input);
		input.focus();
		await userEvent.keyboard('1');
		expect(assign).not.toHaveBeenCalled();
	});
});
