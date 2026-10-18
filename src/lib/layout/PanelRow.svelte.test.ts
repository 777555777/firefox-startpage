import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { LayoutRow } from '$lib/config/types';
import { t } from '$lib/i18n/index.svelte';
import PanelRow from './PanelRow.svelte';

const panel = createRawSnippet((id: () => string) => ({
	render: () => `<section class="panel">${id()}</section>`
}));

function setup(row: LayoutRow, editing = true) {
	const onheight = vi.fn();
	render(PanelRow, {
		props: {
			row,
			stacked: false,
			editing,
			panel,
			onresize: () => {},
			onequalize: () => {},
			onheight
		}
	});
	return { onheight, handle: () => screen.queryByRole('separator', { name: t('edit.rowHeight') }) };
}

describe('Höhe einer Zeile im Edit-Modus', () => {
	it('zeigt den Griff nur im Edit-Modus', () => {
		const { handle } = setup({ items: ['a'], spans: [24] }, false);
		expect(handle()).toBeNull();
	});

	it('beschreibt den Wert für Screenreader', () => {
		const { handle } = setup({ items: ['a'], spans: [24], maxHeight: 32 });
		expect(handle()).toHaveAttribute('aria-orientation', 'horizontal');
		expect(handle()).toHaveAttribute('aria-valuenow', '32');
		expect(handle()).toHaveAttribute('aria-valuetext', t('edit.rowHeightValue', { value: 32 }));
	});

	it('ändert die Höhe per Tastatur', async () => {
		const { handle, onheight } = setup({ items: ['a'], spans: [24], maxHeight: 32 });
		await fireEvent.keyDown(handle()!, { key: 'ArrowUp' });
		expect(onheight).toHaveBeenLastCalledWith(30);
		await fireEvent.keyDown(handle()!, { key: 'ArrowDown' });
		expect(onheight).toHaveBeenLastCalledWith(34);
		await fireEvent.keyDown(handle()!, { key: 'Home' });
		expect(onheight).toHaveBeenLastCalledWith(12);
		await fireEvent.keyDown(handle()!, { key: 'Delete' });
		expect(onheight).toHaveBeenLastCalledWith(undefined);
		await fireEvent.keyDown(handle()!, { key: 'a' });
		expect(onheight).toHaveBeenCalledTimes(4);
	});

	it('setzt per Doppelklick auf „Automatisch“ zurück', async () => {
		const { handle, onheight } = setup({ items: ['a', 'b'], spans: [12, 12], maxHeight: 20 });
		await fireEvent.dblClick(handle()!);
		expect(onheight).toHaveBeenCalledWith(undefined);
	});

	it('meldet „Automatisch“, wenn keine Höhe gesetzt ist', () => {
		const { handle } = setup({ items: ['a'], spans: [24] });
		expect(handle()).toHaveAttribute('aria-valuetext', t('edit.rowHeightAuto'));
	});
});
