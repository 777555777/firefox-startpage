import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMemoryAppState } from '$lib/state/app.svelte';
import { ui } from '$lib/state/ui.svelte';
import App from './App.svelte';

async function setup() {
	const app = createMemoryAppState();
	await app.init();
	ui.editing = false;
	const user = userEvent.setup();
	render(App, { props: { app } });
	return { app, user };
}

describe('Edit-Modus', () => {
	it('schaltet per Button ein und per „Fertig“ wieder aus', async () => {
		const { user } = await setup();
		expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getByRole('toolbar')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(5);

		await user.click(screen.getByRole('button', { name: 'Done' }));
		expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
		expect(screen.queryAllByRole('button', { name: /^Move / })).toHaveLength(0);
	});

	it('schaltet mit E um, aber nicht in Eingabefeldern', async () => {
		const { user } = await setup();
		await user.keyboard('e');
		expect(screen.getByRole('toolbar')).toBeInTheDocument();
		await user.keyboard('E');
		expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

		const input = document.createElement('input');
		document.body.append(input);
		input.focus();
		await user.keyboard('e');
		expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
		input.remove();
	});

	it('ändert die Spaltenzahl über die Edit-Leiste', async () => {
		const { app, user } = await setup();
		await user.keyboard('e');
		await user.click(screen.getByRole('radio', { name: '1' }));
		expect(app.config.value.layout.columns).toBe(1);
		expect(app.config.value.layout.columnItems).toHaveLength(1);
		expect(app.config.value.layout.columnItems[0]).toHaveLength(5);
	});

	it('entfernt ein Widget und stellt es per Rückgängig wieder her', async () => {
		const { app, user } = await setup();
		await user.keyboard('e');
		await user.click(screen.getByRole('button', { name: 'Remove Clock' }));
		expect(Object.values(app.config.value.widgets).map((w) => w.type)).not.toContain('clock');

		await user.click(screen.getByRole('button', { name: 'Undo' }));
		expect(Object.values(app.config.value.widgets).map((w) => w.type)).toContain('clock');
		expect(app.config.value.layout.columnItems[0][0]).toBe(
			Object.values(app.config.value.widgets).find((w) => w.type === 'clock')?.id
		);
	});
});
