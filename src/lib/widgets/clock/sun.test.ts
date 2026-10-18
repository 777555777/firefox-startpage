import { describe, expect, it } from 'vitest';
import { parseCoordinate, sunTimes } from './sun';

const BERLIN = [52.52, 13.405] as const;

/** Lokaler Mittag, damit der Kalendertag unabhängig von der Zeitzone des Testrechners ist */
const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12);

/** Erwartet einen Zeitpunkt (UTC) mit höchstens zwei Minuten Abweichung */
function expectNear(actual: Date, isoUtc: string) {
	const diffMinutes = Math.abs(actual.getTime() - Date.parse(isoUtc)) / 60_000;
	expect(diffMinutes, `${actual.toISOString()} statt ${isoUtc}`).toBeLessThanOrEqual(2);
}

function normal(result: ReturnType<typeof sunTimes>) {
	if (result.kind !== 'normal') throw new Error(`erwartet normal, war ${result.kind}`);
	return result;
}

describe('sunTimes', () => {
	it('Berlin zur Sommersonnenwende (04:43 / 21:33 MESZ)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 6, 21), ...BERLIN));
		expectNear(sunrise, '2025-06-21T02:43Z');
		expectNear(sunset, '2025-06-21T19:33Z');
	});

	it('Berlin zur Wintersonnenwende (08:15 / 15:54 MEZ)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 12, 21), ...BERLIN));
		expectNear(sunrise, '2025-12-21T07:15Z');
		expectNear(sunset, '2025-12-21T14:54Z');
	});

	it('westliche Länge: New York zur Sommersonnenwende (05:25 / 20:31 EDT)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 6, 21), 40.7128, -74.006));
		expectNear(sunrise, '2025-06-21T09:25Z');
		// Untergang liegt in UTC schon am nächsten Tag
		expectNear(sunset, '2025-06-22T00:31Z');
	});

	it('Südhalbkugel: Sydney im Dezember (05:41 / 20:05 AEDT)', () => {
		const { sunrise, sunset } = normal(sunTimes(day(2025, 12, 21), -33.8688, 151.2093));
		// Aufgang liegt in UTC noch am Vortag
		expectNear(sunrise, '2025-12-20T18:41Z');
		expectNear(sunset, '2025-12-21T09:05Z');
	});

	it('erkennt Polartag und Polarnacht in Tromsø', () => {
		expect(sunTimes(day(2025, 6, 21), 69.65, 18.96).kind).toBe('polarDay');
		expect(sunTimes(day(2025, 12, 21), 69.65, 18.96).kind).toBe('polarNight');
	});

	it('kehrt Polartag und Polarnacht auf der Südhalbkugel um', () => {
		expect(sunTimes(day(2025, 6, 21), -75, 0).kind).toBe('polarNight');
		expect(sunTimes(day(2025, 12, 21), -75, 0).kind).toBe('polarDay');
	});

	it('Pole zur Tagundnachtgleiche liefern gültige Zeiten oder Polarzeit, nie NaN', () => {
		for (const latitude of [90, -90, 89.99, -89.99]) {
			for (let month = 1; month <= 12; month++) {
				const result = sunTimes(day(2025, month, 20), latitude, 0);
				expect(['normal', 'polarDay', 'polarNight']).toContain(result.kind);
				if (result.kind === 'normal') {
					expect(Number.isFinite(result.sunrise.getTime())).toBe(true);
					expect(Number.isFinite(result.sunset.getTime())).toBe(true);
				}
			}
		}
	});

	it('Aufgang liegt immer vor dem Untergang', () => {
		for (let month = 1; month <= 12; month++) {
			const { sunrise, sunset } = normal(sunTimes(day(2025, month, 1), ...BERLIN));
			expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
		}
	});

	it('Äquator: Tag dauert das ganze Jahr etwa 12 Stunden', () => {
		for (let month = 1; month <= 12; month++) {
			const { sunrise, sunset } = normal(sunTimes(day(2025, month, 15), 0, 0));
			const hours = (sunset.getTime() - sunrise.getTime()) / 3_600_000;
			expect(hours).toBeGreaterThan(12);
			expect(hours).toBeLessThan(12.2);
		}
	});
});

describe('parseCoordinate', () => {
	it('liest Punkt und Komma', () => {
		expect(parseCoordinate('52.52', 90)).toBe(52.52);
		expect(parseCoordinate(' 13,405 ', 180)).toBe(13.405);
		expect(parseCoordinate('-74', 180)).toBe(-74);
		expect(parseCoordinate('+.5', 90)).toBe(0.5);
		expect(parseCoordinate('\u221233,87', 90)).toBe(-33.87);
	});

	it('leere Eingabe ist null', () => {
		expect(parseCoordinate('', 90)).toBeNull();
		expect(parseCoordinate('   ', 90)).toBeNull();
	});

	it('ungültige oder zu große Werte sind undefined', () => {
		expect(parseCoordinate('abc', 90)).toBeUndefined();
		expect(parseCoordinate('1e3', 180)).toBeUndefined();
		expect(parseCoordinate('52.5.1', 90)).toBeUndefined();
		expect(parseCoordinate('91', 90)).toBeUndefined();
		expect(parseCoordinate('-180.5', 180)).toBeUndefined();
	});
});
