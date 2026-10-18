import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'svelte';
import { t } from '$lib/i18n/index.svelte';
import { createMemoryAppState } from '$lib/state/app.svelte';
import { toasts } from '$lib/state/toasts.svelte';
import Harness from '$lib/test/Harness.svelte';
import type { WidgetProps } from '../types';
import type { AgendaConfig } from './agenda';
import Calendar from './Calendar.svelte';
import { defaultCalendarSettings, type CalendarSettings } from './settings';

const day = (key: string) => document.querySelector<HTMLElement>(`[data-day="${key}"]`)!;

async function setup(agenda: Partial<AgendaConfig> = {}) {
	const app = createMemoryAppState();
	await app.init();
	Object.assign(app.config.value.agenda, agenda);
	const settings = $state(defaultCalendarSettings());
	render(Harness, {
		props: {
			app,
			component: Calendar as unknown as Component<Record<string, unknown>>,
			props: {
				id: 'calendar',
				settings,
				editing: false,
				update: (mutate) => mutate(settings)
			} satisfies WidgetProps<CalendarSettings>
		}
	});
	return { app, user: userEvent.setup() };
}

describe('Kalender', () => {
	beforeEach(() => {
		// Sonntag, 18. Oktober 2026, mittags
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 9, 18, 12));
	});

	afterEach(() => {
		vi.useRealTimers();
		for (const toast of toasts.items) toasts.dismiss(toast.id);
	});

	it('hat genau einen Tag im Tab-Fokus und bewegt Auswahl und Fokus per Tastatur', async () => {
		const { user } = await setup();
		const focusable = document.querySelectorAll('[data-day][tabindex="0"]');
		expect([...focusable].map((el) => (el as HTMLElement).dataset.day)).toEqual(['2026-10-18']);
		expect(day('2026-10-18')).toHaveAttribute('aria-selected', 'true');

		day('2026-10-18').focus();
		await user.keyboard('{ArrowLeft}{ArrowUp}');
		expect(document.activeElement).toBe(day('2026-10-10'));
		expect(day('2026-10-10')).toHaveAttribute('aria-selected', 'true');
		expect(day('2026-10-10').tabIndex).toBe(0);
		expect(day('2026-10-18').tabIndex).toBe(-1);

		// Wochenbeginn Montag: Home → 5.10., End → 11.10.
		await user.keyboard('{Home}');
		expect(document.activeElement).toBe(day('2026-10-05'));
		await user.keyboard('{End}');
		expect(document.activeElement).toBe(day('2026-10-11'));

		// Bild ab blättert in den nächsten Monat und behält den Tag
		await user.keyboard('{PageDown}');
		expect(document.activeElement).toBe(day('2026-11-11'));
		expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/november/i);

		// Umschalt + Bild auf springt ein Jahr zurück
		await user.keyboard('{Shift>}{PageUp}{/Shift}');
		expect(document.activeElement).toBe(day('2025-11-11'));

		await user.click(screen.getByRole('button', { name: t('calendar.today') }));
		expect(day('2026-10-18')).toHaveAttribute('aria-selected', 'true');
	});

	it('legt per Enter einen Termin am gewählten Tag an', async () => {
		const { app, user } = await setup();
		day('2026-10-18').focus();
		await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');

		const dialog = screen.getByRole('dialog', { name: t('calendar.newEvent') });
		const date = within(dialog).getByLabelText(t('calendar.fieldDate'));
		expect(date).toHaveValue('2026-10-21');
		const title = within(dialog).getByLabelText(t('calendar.fieldTitle'));
		// Ins erste Feld fokussiert der Browser selbst (`autofocus`); jsdom kann das nicht
		expect(title).toHaveAttribute('autofocus');

		// Ohne Titel wird nicht gespeichert
		await user.click(within(dialog).getByRole('button', { name: t('common.save') }));
		expect(within(dialog).getByText(t('calendar.titleRequired'))).toBeInTheDocument();

		await user.type(title, 'Zahnarzt');
		await user.click(within(dialog).getByRole('button', { name: t('common.save') }));

		expect(app.config.value.agenda.events).toEqual([
			{ id: expect.any(String), date: '2026-10-21', time: null, title: 'Zahnarzt' }
		]);
		expect(screen.getByText('Zahnarzt')).toBeInTheDocument();
		expect(day('2026-10-21').getAttribute('aria-label')).toContain(
			t('calendar.events', { count: 1 })
		);
		expect(day('2026-10-21').querySelector('.dots')).not.toBeNull();
	});

	it('bearbeitet und löscht Termine, Rückgängig stellt sie wieder her', async () => {
		const { app, user } = await setup({
			events: [
				{ id: 'b', date: '2026-10-18', time: '14:30', title: 'Zahnarzt' },
				{ id: 'a', date: '2026-10-18', time: '09:00', title: 'Standup' }
			]
		});
		// Sortiert nach Uhrzeit
		const items = screen.getAllByRole('listitem').filter((li) => li.closest('.entries'));
		expect(items.map((li) => li.textContent)).toEqual([
			expect.stringContaining('Standup'),
			expect.stringContaining('Zahnarzt')
		]);

		await user.click(
			screen.getByRole('button', { name: t('calendar.editNamed', { name: 'Zahnarzt' }) })
		);
		const dialog = screen.getByRole('dialog', { name: t('calendar.editEvent') });
		const title = within(dialog).getByLabelText(t('calendar.fieldTitle'));
		await user.clear(title);
		await user.type(title, 'Zahnarzt Dr. Weiß');
		await user.click(within(dialog).getByRole('button', { name: t('common.save') }));
		expect(app.config.value.agenda.events.find((e) => e.id === 'b')?.title).toBe(
			'Zahnarzt Dr. Weiß'
		);

		await user.click(
			screen.getByRole('button', { name: t('calendar.deleteNamed', { name: 'Standup' }) })
		);
		expect(app.config.value.agenda.events.map((e) => e.id)).toEqual(['b']);
		const toast = toasts.items.at(-1)!;
		expect(toast.message).toBe(t('calendar.eventDeleted', { name: 'Standup' }));
		toasts.act(toast.id);
		expect(app.config.value.agenda.events.map((e) => e.id)).toEqual(['b', 'a']);
	});

	it('hebt Wochenende, Feiertag und freie Tage unterscheidbar hervor', async () => {
		await setup({
			offDays: [{ id: 'u', start: '2026-10-29', end: '2026-11-03', label: 'Urlaub' }]
		});
		// 3.10. Tag der Deutschen Einheit (Samstag), 17.10. Samstag, 21.10. Werktag
		expect(day('2026-10-03')).toHaveClass('holiday', 'weekend');
		expect(day('2026-10-03').getAttribute('aria-label')).toContain(t('holiday.germanUnity'));
		expect(day('2026-10-17')).toHaveClass('weekend');
		expect(day('2026-10-17')).not.toHaveClass('holiday', 'off');
		expect(day('2026-10-21').className).not.toMatch(/weekend|holiday|off/);

		// Urlaub als Band: innen ohne runde Ecken, über das Wochenende hinweg
		expect(day('2026-10-29')).toHaveClass('off', 'join-end');
		expect(day('2026-10-29')).not.toHaveClass('join-start');
		expect(day('2026-10-31')).toHaveClass('off', 'weekend', 'join-start', 'join-end');
		expect(day('2026-10-31').getAttribute('aria-label')).toContain('Urlaub');
		expect(day('2026-10-28')).not.toHaveClass('off');

		const legend = screen.getByRole('list', { name: t('calendar.legend') });
		expect(within(legend).getByText(t('calendar.off'))).toBeInTheDocument();
		expect(within(legend).getByText(t('calendar.holiday'))).toBeInTheDocument();
	});

	it('listet erst Termine, dann freie Tage, dann den Feiertag; ohne Einträge „keine Termine“', async () => {
		const { user } = await setup({
			events: [{ id: 'e', date: '2026-10-03', time: null, title: 'Fest' }],
			offDays: [{ id: 'u', start: '2026-10-01', end: '2026-10-04', label: 'Urlaub' }]
		});
		// Heute steht als „Heute“ neben der Legende, das volle Datum für Screenreader
		expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(t('calendar.today'));
		expect(screen.getByText(t('calendar.noEvents'))).toBeInTheDocument();

		await user.click(day('2026-10-03'));
		const list = screen.getByRole('list', { name: /October 3/ });
		expect(
			within(list)
				.getAllByRole('listitem')
				.map((li) => li.textContent)
		).toEqual([
			expect.stringContaining('Fest'),
			expect.stringContaining('Urlaub'),
			expect.stringContaining(t('holiday.germanUnity'))
		]);
		expect(screen.queryByText(t('calendar.noEvents'))).toBeNull();
	});

	it('trägt freie Tage ein und zeigt sie in der Tagesansicht', async () => {
		const { app, user } = await setup();
		await user.click(day('2026-10-22'));
		await user.click(
			screen.getByRole('button', {
				name: t('calendar.addOffFor', { date: 'Thursday, October 22' })
			})
		);
		const dialog = screen.getByRole('dialog', { name: t('calendar.newOff') });
		expect(within(dialog).getByLabelText(t('calendar.fieldOffStart'))).toHaveValue('2026-10-22');
		expect(within(dialog).getByLabelText(t('calendar.fieldOffEnd'))).toHaveValue('2026-10-22');
		await user.type(within(dialog).getByLabelText(t('calendar.fieldOffLabel')), 'Brückentag');
		await user.click(within(dialog).getByRole('button', { name: t('common.save') }));

		expect(app.config.value.agenda.offDays).toEqual([
			{ id: expect.any(String), start: '2026-10-22', end: '2026-10-22', label: 'Brückentag' }
		]);
		expect(day('2026-10-22')).toHaveClass('off');
		expect(screen.getByText('Brückentag')).toBeInTheDocument();

		await user.click(
			screen.getByRole('button', { name: t('calendar.deleteNamed', { name: 'Brückentag' }) })
		);
		expect(app.config.value.agenda.offDays).toEqual([]);
		expect(day('2026-10-22')).not.toHaveClass('off');
	});
});
