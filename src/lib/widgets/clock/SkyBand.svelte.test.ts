import { render, screen } from '@testing-library/svelte';
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
	return {
		sun: () => document.querySelector('.sun-part'),
		moon: () => document.querySelector('.moon')
	};
}

describe('Sonne und Mond in der Uhr', () => {
	it('zeigt Sonne und Mond untereinander, tagsüber mit Sonnenpunkt', () => {
		// Feste UTC-Zeitpunkte, damit es nicht auf die Zeitzone des Testrechners ankommt:
		// 18.10.2026, 13:00 in Berlin
		const { sun, moon } = setup(new Date('2026-10-18T11:00Z'));
		expect(sun()).not.toBeNull();
		expect(moon()).not.toBeNull();
		expect(document.querySelector('.travelled')).not.toBeNull();
		expect(screen.getByText(t('clock.dayLength'))).toBeInTheDocument();
		expect(screen.getByText(t('moon.firstQuarter'))).toBeInTheDocument();
		// Kein Umschalter mehr, beide Teile sind gleichzeitig sichtbar und bedienbar
		expect(screen.queryByRole('button')).toBeNull();
		expect(document.querySelector('[inert]')).toBeNull();
	});

	it('Auf- und Untergang der Sonne ohne Icons, mit Tooltip und Text für Screenreader', () => {
		setup(new Date('2026-10-18T11:00Z'), { showMoon: false });
		const sunrise = screen.getByTitle(t('clock.sunrise'));
		expect(sunrise.querySelector('svg')).toBeNull();
		expect(sunrise).toHaveTextContent(t('clock.sunrise'));
		expect(screen.getByTitle(t('clock.sunset')).querySelector('svg')).toBeNull();
	});

	it('nachts: Bogen ohne Sonnenpunkt, Mond mit nächstem Vollmond', () => {
		// 18.10.2026, 23:00 in Berlin
		setup(new Date('2026-10-18T21:00Z'));
		expect(document.querySelector('.arc')).not.toBeNull();
		expect(document.querySelector('.travelled')).toBeNull();
		// Datum des nächsten Vollmonds hängt von der Zeitzone ab; geprüft wird nur, dass er genannt ist
		const fullMoon = t('clock.nextFull', { date: '' }).trim();
		expect(screen.getByText(new RegExp(fullMoon))).toBeInTheDocument();
	});

	it('Sonne und Mond lassen sich einzeln abschalten', () => {
		const { sun, moon } = setup(new Date('2026-10-18T11:00Z'), { showSun: false });
		expect(sun()).toBeNull();
		expect(moon()).not.toBeNull();
	});

	it('Polartag statt Bogen', () => {
		setup(new Date('2025-06-21T11:00Z'), { showMoon: false, latitude: 69.65 });
		expect(screen.getByText(t('clock.polarDay'))).toBeInTheDocument();
		expect(document.querySelector('.arc')).toBeNull();
	});
});
