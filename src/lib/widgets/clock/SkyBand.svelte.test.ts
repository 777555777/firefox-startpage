import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '$lib/i18n/index.svelte';
import SkyBand from './SkyBand.svelte';

const BERLIN = { latitude: 52.52, longitude: 13.405 };
const timeFormat = new Intl.DateTimeFormat('en', {
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

function setup(
	now: Date,
	options: { showSun?: boolean; showMoon?: boolean; latitude?: number } = {}
) {
	render(SkyBand, {
		props: {
			now,
			...BERLIN,
			showSun: true,
			showMoon: true,
			timeFormat,
			...options
		}
	});
	const views = document.querySelectorAll<HTMLElement>('.view');
	return {
		user: userEvent.setup(),
		visible: () =>
			[...views]
				.filter((view) => !view.inert)
				.map((view) => (view.classList.contains('moon') ? 'moon' : 'sun'))
	};
}

describe('Sonne und Mond in der Uhr', () => {
	it('zeigt tagsüber die Sonne mit Bogen, Zeiten und Tageslänge', () => {
		// Feste UTC-Zeitpunkte, damit es nicht auf die Zeitzone des Testrechners ankommt:
		// 18.10.2026, 13:00 in Berlin
		const { visible } = setup(new Date('2026-10-18T11:00Z'));
		expect(visible()).toEqual(['sun']);
		expect(document.querySelector('.travelled')).not.toBeNull();
		expect(screen.getByText(t('clock.dayLength'))).toBeInTheDocument();
		expect(screen.getByRole('button', { name: t('clock.viewSun') })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	it('zeigt nachts den Mond, von Hand lässt sich zurückschalten', async () => {
		// 18.10.2026, 23:00 in Berlin
		const { user, visible } = setup(new Date('2026-10-18T21:00Z'));
		expect(visible()).toEqual(['moon']);
		expect(screen.getByText(t('moon.firstQuarter'))).toBeInTheDocument();
		// Datum des nächsten Vollmonds hängt von der Zeitzone ab; geprüft wird nur, dass er genannt ist
		const fullMoon = t('clock.nextFull', { date: '' }).trim();
		expect(screen.getByText(new RegExp(fullMoon))).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: t('clock.viewSun') }));
		expect(visible()).toEqual(['sun']);
		// Nachts gibt es keinen Sonnenpunkt, nur den Bogen
		expect(document.querySelector('.travelled')).toBeNull();
		expect(screen.getByRole('button', { name: t('clock.viewSun') })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	it('nur Mond: kein Umschalter, Mond auch tagsüber', () => {
		const { visible } = setup(new Date('2026-10-18T11:00Z'), { showSun: false });
		expect(visible()).toEqual(['moon']);
		expect(screen.queryByRole('group', { name: t('clock.skyView') })).toBeNull();
	});

	it('Polartag statt Bogen', () => {
		setup(new Date('2025-06-21T11:00Z'), { showMoon: false, latitude: 69.65 });
		expect(screen.getByText(t('clock.polarDay'))).toBeInTheDocument();
		expect(document.querySelector('.arc')).toBeNull();
	});
});
