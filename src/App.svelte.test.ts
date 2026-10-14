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

	it('schaltet eine Seitenspalte über die Edit-Leiste aus und per Rückgängig wieder ein', async () => {
		const { app, user } = await setup();
		await user.keyboard('e');
		const toggle = screen.getByRole('button', { name: 'Right column' });
		expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await user.click(toggle);
		const layout = app.config.value.layout;
		expect(layout.sides).toEqual({ left: true, right: false });
		expect(toggle).toHaveAttribute('aria-pressed', 'false');
		// Die Widgets der rechten Spalte stehen jetzt am Ende der Mitte
		expect(layout.columnRows[0]).toHaveLength(3);
		expect(layout.columnRows[1]).toHaveLength(0);

		await user.click(screen.getByRole('button', { name: 'Undo' }));
		expect(app.config.value.layout.sides).toEqual({ left: true, right: true });
		expect(app.config.value.layout.columnRows[1]).toHaveLength(1);
	});

	it('entfernt ein Widget und stellt es per Rückgängig wieder her', async () => {
		const { app, user } = await setup();
		await user.keyboard('e');
		await user.click(screen.getByRole('button', { name: 'Remove Clock' }));
		expect(Object.values(app.config.value.widgets).map((w) => w.type)).not.toContain('clock');

		await user.click(screen.getByRole('button', { name: 'Undo' }));
		expect(Object.values(app.config.value.widgets).map((w) => w.type)).toContain('clock');
		// Die Uhr steht im Default links oben
		expect(app.config.value.layout.columnRows[2][0].items[0]).toBe(
			Object.values(app.config.value.widgets).find((w) => w.type === 'clock')?.id
		);
	});
});
