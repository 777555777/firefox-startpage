import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'svelte';
import { createMemoryAppState } from '$lib/state/app.svelte';
import Harness from '$lib/test/Harness.svelte';
import type { WidgetProps } from '../types';
import Search from './Search.svelte';
import type { SearchSettings } from './settings';

async function setup() {
	const app = createMemoryAppState();
	await app.init();
	render(Harness, {
		props: {
			app,
			component: Search as unknown as Component<Record<string, unknown>>,
			props: {
				id: 'search',
				settings: { suggestLinks: true },
				editing: false,
				update: () => {}
			} satisfies WidgetProps<SearchSettings>
		}
	});
	return { app, user: userEvent.setup(), input: screen.getByRole('combobox') };
}

describe('Suche', () => {
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

	it('schlägt Links aus den Boards vor und navigiert mit Pfeiltasten', async () => {
		const { user, input } = await setup();
		await user.type(input, 'git');
		expect(input).toHaveAttribute('aria-expanded', 'true');
		const options = screen.getAllByRole('option');
		expect(options[0]).toHaveTextContent('GitHub');
		expect(options.at(-1)).toHaveTextContent('DuckDuckGo');

		await user.keyboard('{ArrowDown}');
		expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
		expect(options[0]).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{Enter}');
		expect(assign).toHaveBeenCalledWith('https://github.com');
	});

	it('sucht ohne Auswahl mit der Default-Engine', async () => {
		const { user, input } = await setup();
		await user.type(input, 'svelte runes{Enter}');
		expect(assign).toHaveBeenCalledWith('https://duckduckgo.com/?q=svelte%20runes');
	});

	it('leitet Bangs um und zeigt die erkannte Engine', async () => {
		const { user, input } = await setup();
		await user.type(input, '!gh svelte');
		expect(screen.getByText('GitHub', { selector: '.chip' })).toBeInTheDocument();
		// Bei einem Bang gibt es keine Link-Vorschläge
		expect(input).toHaveAttribute('aria-expanded', 'false');
		await user.keyboard('{Control>}{Enter}{/Control}');
		expect(open).toHaveBeenCalledWith(
			'https://github.com/search?q=svelte&type=repositories',
			'_blank',
			'noopener,noreferrer'
		);
	});

	it('schließt die Vorschläge mit Escape und leert beim zweiten Mal', async () => {
		const { user, input } = await setup();
		await user.type(input, 'wiki');
		expect(input).toHaveAttribute('aria-expanded', 'true');
		await user.keyboard('{Escape}');
		expect(input).toHaveAttribute('aria-expanded', 'false');
		await user.keyboard('{Escape}');
		expect(input).toHaveValue('');
	});
});
